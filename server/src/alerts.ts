// Safety alerts: taking them in from the phone, texting staff, re-routing the
// ones nobody acknowledged, and the counselor review list.
import { CheckInTurn, SafetyEvent, SafetyTier } from '../../src/data/types';
import { alertText } from '../../src/safety/events';
import { Sql } from './db';
import { Hours, rerouteTargets, routeFor } from './routing';
import { SmsSender } from './sms';

// What the phone sends: its SafetyEvent minus the local-only fields.
export type IncomingEvent = Pick<
  SafetyEvent,
  'id' | 'at' | 'screen' | 'tier' | 'kind' | 'variant' | 'matched' | 'message' | 'context' | 'shown' | 'taken'
>;

export type Staff = { id: string; name: string; phone: string; role: 'counselor' | 'supervisor'; on_call: boolean };

export type AlertConfig = { hours: Hours; escalateAfterMin: number; now?: () => Date };

type Reason = 'raised' | 'tier_raised' | 'rerouted';

export type AlertView = {
  id: string;
  person: { id: string; name: string };
  tier: SafetyTier;
  firstTier: SafetyTier;
  kind: string;
  variant: string | null;
  trigger: string;
  screen: string;
  raisedAt: string;
  receivedAt: string;
  evidence: { message: string; context: CheckInTurn[]; shown: string };
  taken: { label: string; at: string }[];
  notifications: { to: string; reason: Reason; status: string; at: string }[];
  acknowledged: { by: string; at: string } | null;
  rerouted: { to: string[]; at: string } | null;
  resolved: { by: string; at: string; note: string } | null;
};

export class Alerts {
  constructor(
    private sql: Sql,
    private sms: SmsSender,
    private cfg: AlertConfig,
  ) {}

  private now = () => (this.cfg.now ?? (() => new Date()))();

  // Safe to call again with the same event: evidence is kept as first received,
  // new taps are added, and the tier can only go up (which texts again).
  async receive(personId: string, ev: IncomingEvent) {
    const person = await this.one<{ display_name: string; counselor_id: string }>(
      'select display_name, counselor_id from person where id = $1',
      [personId],
    );
    if (!person) throw new Error('unknown person');
    const onCall = await this.staffIds('on_call');
    const now = this.now();

    const routed = routeFor(ev.tier, now, person.counselor_id, onCall, this.cfg.hours);
    const inserted = await this.one<{ id: string }>(
      `insert into alert (person_id, client_id, tier, first_tier, kind, variant, trigger, screen, raised_at, evidence, routed_to, received_at)
       values ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (person_id, client_id) do nothing
       returning id`,
      [
        personId,
        ev.id,
        ev.tier,
        ev.kind,
        ev.variant ?? null,
        ev.matched,
        ev.screen,
        ev.at,
        JSON.stringify({ message: ev.message, context: ev.context, shown: ev.shown }),
        routed,
        now,
      ],
    );

    let id: string;
    const notified: string[] = [];
    if (inserted) {
      id = String(inserted.id);
      notified.push(...(await this.notify(id, routed, 'raised', person.display_name, ev.tier, new Date(ev.at))));
    } else {
      const existing = (await this.one<{ id: string; tier: SafetyTier; routed_to: string[] }>(
        'select id, tier, routed_to from alert where person_id = $1 and client_id = $2',
        [personId, ev.id],
      ))!;
      id = String(existing.id);
      if (ev.tier > existing.tier) {
        await this.sql.query('update alert set tier = $2 where id = $1', [id, ev.tier]);
        const to = routeFor(ev.tier, now, person.counselor_id, onCall, this.cfg.hours);
        notified.push(...(await this.notify(id, to, 'tier_raised', person.display_name, ev.tier, now)));
      }
    }

    for (const t of ev.taken)
      await this.sql.query('insert into alert_action (alert_id, label, at) values ($1, $2, $3) on conflict do nothing', [
        id,
        t.label,
        t.at,
      ]);

    return { id, created: !!inserted, notified };
  }

  // Run every minute or so. Texts supervisors about Tier 2+ alerts nobody has
  // acknowledged within escalateAfterMin. Each alert is re-routed at most once.
  async sweep() {
    const cutoff = new Date(this.now().getTime() - this.cfg.escalateAfterMin * 60_000);
    const overdue = await this.sql.query<{ id: string; tier: SafetyTier; routed_to: string[]; display_name: string; raised_at: Date }>(
      `select a.id, a.tier, a.routed_to, p.display_name, a.raised_at from alert a join person p on p.id = a.person_id
       where a.tier >= 2 and a.acknowledged_at is null and a.resolved_at is null and a.rerouted_at is null
         and a.received_at <= $1`,
      [cutoff],
    );
    const supervisors = await this.staffIds('supervisor');
    const onCall = await this.staffIds('on_call');
    const done: string[] = [];
    for (const a of overdue.rows) {
      const to = rerouteTargets(a.routed_to, supervisors, onCall);
      // Claim the alert first so two sweeps can't both text about it.
      const claimed = await this.sql.query(
        'update alert set rerouted_at = $2, rerouted_to = $3 where id = $1 and rerouted_at is null and acknowledged_at is null returning id',
        [a.id, this.now(), to],
      );
      if (!claimed.rows.length) continue;
      await this.notify(a.id, to, 'rerouted', a.display_name, a.tier, new Date(a.raised_at));
      done.push(String(a.id));
    }
    return done;
  }

  async list(staff: Staff, opts: { open: boolean }): Promise<AlertView[]> {
    const rows = await this.sql.query<Record<string, any>>(
      `select a.*, p.display_name from alert a join person p on p.id = a.person_id
       where ($1::text is null or p.counselor_id = $1 or $1 = any(a.routed_to) or $1 = any(coalesce(a.rerouted_to, '{}')))
         and ($2::boolean = false or a.resolved_at is null)
       order by (a.resolved_at is null) desc, a.tier desc, a.raised_at desc
       limit 200`,
      [staff.role === 'supervisor' ? null : staff.id, opts.open],
    );
    const ids = rows.rows.map((r) => String(r.id));
    if (ids.length) await this.logAccess(staff.id, 'list', ids);
    const actions = await this.byAlert<{ label: string; at: Date }>('select alert_id, label, at from alert_action where alert_id = any($1) order by at', ids);
    const notes = await this.byAlert<{ staff_id: string; reason: Reason; status: string; created_at: Date }>(
      'select alert_id, staff_id, reason, status, created_at from notification where alert_id = any($1) order by created_at',
      ids,
    );
    const names = Object.fromEntries((await this.sql.query<{ id: string; name: string }>('select id, name from staff')).rows.map((s) => [s.id, s.name]));
    const iso = (d: Date | null) => (d ? new Date(d).toISOString() : '');
    return rows.rows.map((r) => ({
      id: String(r.id),
      person: { id: r.person_id, name: r.display_name },
      tier: r.tier,
      firstTier: r.first_tier,
      kind: r.kind,
      variant: r.variant,
      trigger: r.trigger,
      screen: r.screen,
      raisedAt: iso(r.raised_at),
      receivedAt: iso(r.received_at),
      evidence: r.evidence,
      taken: (actions.get(String(r.id)) ?? []).map((a) => ({ label: a.label, at: iso(a.at) })),
      notifications: (notes.get(String(r.id)) ?? []).map((n) => ({
        to: names[n.staff_id] ?? n.staff_id,
        reason: n.reason,
        status: n.status,
        at: iso(n.created_at),
      })),
      acknowledged: r.acknowledged_at ? { by: names[r.acknowledged_by] ?? r.acknowledged_by, at: iso(r.acknowledged_at) } : null,
      rerouted: r.rerouted_at ? { to: (r.rerouted_to ?? []).map((id: string) => names[id] ?? id), at: iso(r.rerouted_at) } : null,
      resolved: r.resolved_at ? { by: names[r.resolved_by] ?? r.resolved_by, at: iso(r.resolved_at), note: r.resolution } : null,
    }));
  }

  // Returns false when the alert isn't visible to this staff member or the step
  // was already recorded (by them or someone else).
  async acknowledge(staff: Staff, id: string) {
    if (!(await this.canSee(staff, id))) return false;
    const r = await this.sql.query('update alert set acknowledged_at = $2, acknowledged_by = $3 where id = $1 and acknowledged_at is null returning id', [
      id,
      this.now(),
      staff.id,
    ]);
    if (r.rows.length) await this.logAccess(staff.id, 'acknowledge', [id]);
    return r.rows.length > 0;
  }

  // Resolving also acknowledges, if nobody had yet.
  async resolve(staff: Staff, id: string, note: string) {
    if (!(await this.canSee(staff, id))) return false;
    const r = await this.sql.query(
      `update alert set resolved_at = $2, resolved_by = $3, resolution = $4,
         acknowledged_at = coalesce(acknowledged_at, $2), acknowledged_by = coalesce(acknowledged_by, $3)
       where id = $1 and resolved_at is null returning id`,
      [id, this.now(), staff.id, note],
    );
    if (r.rows.length) await this.logAccess(staff.id, 'resolve', [id]);
    return r.rows.length > 0;
  }

  private async canSee(staff: Staff, id: string) {
    if (!/^\d+$/.test(id)) return false;
    if (staff.role === 'supervisor') return !!(await this.one('select 1 from alert where id = $1', [id]));
    return !!(await this.one(
      `select 1 from alert a join person p on p.id = a.person_id
       where a.id = $1 and (p.counselor_id = $2 or $2 = any(a.routed_to) or $2 = any(coalesce(a.rerouted_to, '{}')))`,
      [id, staff.id],
    ));
  }

  private async notify(alertId: string, staffIds: string[], reason: Reason, name: string, tier: SafetyTier, at: Date) {
    if (!staffIds.length) return [];
    const staff = await this.sql.query<{ id: string; phone: string }>('select id, phone from staff where id = any($1)', [staffIds]);
    let body = alertText(name, tier, at, this.cfg.hours.timeZone);
    if (reason === 'rerouted') body += ` Not yet acknowledged after ${this.cfg.escalateAfterMin} min.`;
    for (const s of staff.rows) {
      const res = await this.sms.send(s.phone, body);
      await this.sql.query(
        `insert into notification (alert_id, staff_id, reason, channel, body, status, provider_id, error)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [alertId, s.id, reason, this.sms.channel, body, res.status, res.providerId ?? null, res.error ?? null],
      );
    }
    return staff.rows.map((s) => s.id);
  }

  private async staffIds(which: 'on_call' | 'supervisor') {
    const where = which === 'on_call' ? 'on_call' : "role = 'supervisor'";
    return (await this.sql.query<{ id: string }>(`select id from staff where ${where} order by id`)).rows.map((r) => r.id);
  }

  private logAccess(staffId: string, action: string, ids: string[]) {
    return this.sql.query('insert into access_log (staff_id, action, alert_ids) values ($1, $2, $3)', [staffId, action, ids]);
  }

  private async byAlert<T>(text: string, ids: string[]) {
    const m = new Map<string, T[]>();
    if (!ids.length) return m;
    for (const r of (await this.sql.query<T & { alert_id: string }>(text, [ids])).rows) {
      const k = String(r.alert_id);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return m;
  }

  private async one<T = Record<string, unknown>>(text: string, params: unknown[]) {
    return (await this.sql.query<T>(text, params)).rows[0] as T | undefined;
  }
}
