// Chat between a person and their LifeCircle (build plan sec. 03).
//   - Their counselor reads and replies on the review page. The counselor gets a
//     content-free text when a new message is waiting, once until they read it.
//   - Anyone else (sponsor, sister) gets the person's messages as texts and
//     answers by text; replies come back through receiveSms().
// Everything is kept and nothing can be edited or deleted (schema.sql).
import { screen } from '../../src/zoey/safety';
import { Staff } from './alerts';
import { Sql } from './db';
import { SmsSender } from './sms';

// 'coordinator' is the phone's name for the conversation with the assigned
// counselor; any other id is a LifeCircle member reached by text.
export const COUNSELOR = 'coordinator';

export type OutgoingMessage = {
  id: string;
  at: string;
  body: string;
  to: { id: string; name: string; phone?: string };
};

export type MessageView = {
  id: string;
  clientId: string | null; // the phone's id for the person's own messages
  conversation: string; // the phone's LifeCircle id
  direction: 'out' | 'in';
  author: string; // 'person', 'sms', or the staff member's name
  body: string;
  at: string;
  delivery: 'stored' | 'logged' | 'sent' | 'failed';
  flag: string | null;
  read: boolean;
};

export type ConversationView = {
  id: string;
  person: { id: string; name: string };
  last: { body: string; at: string; direction: 'out' | 'in' } | null;
  unread: number;
  flagged: number; // unread messages the safety screen flagged
};

export const counselorNotice = (name: string) =>
  `Life Works: ${name} sent you a message. Read it on the review page.`;

// The first text a LifeCircle member gets says who it's from and how to answer.
// It names the person but not why they use the app.
export const smsIntro = (name: string) =>
  `${name} is messaging you through Life Works. Reply to this number to answer. Reply STOP to opt out.`;

export const smsBody = (name: string, body: string) => `${name}: ${body}`;

// E.164 only, so a reply can be matched back to its conversation.
export const toE164 = (phone: string) => {
  const t = phone.trim();
  const d = t.replace(/\D/g, '');
  if (t.startsWith('+')) return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
};

const flagFor = (body: string) => {
  const r = screen(body);
  if (r.kind === 'none') return null;
  return 'variant' in r ? `${r.kind}/${r.variant}` : r.kind;
};

export class Messages {
  constructor(
    private sql: Sql,
    private sms: SmsSender,
    private now: () => Date = () => new Date(),
  ) {}

  // From the phone. Safe to resend: a message id already stored is not stored
  // or texted again.
  async send(personId: string, m: OutgoingMessage) {
    const person = await this.one<{ display_name: string; counselor_id: string }>(
      'select display_name, counselor_id from person where id = $1',
      [personId],
    );
    if (!person) throw new Error('unknown person');
    const toCounselor = m.to.id === COUNSELOR;
    const phone = toCounselor ? null : toE164(m.to.phone ?? '');
    if (!toCounselor && !phone) return { error: 'phone' as const };

    const convo = await this.conversation(personId, m.to.id, toCounselor ? 'counselor' : 'sms', m.to.name, phone);
    const firstText = !toCounselor && !(await this.one('select 1 from message where conversation_id = $1 and direction = $2', [convo, 'out']));
    const inserted = await this.one<{ id: string }>(
      `insert into message (conversation_id, client_id, direction, author, body, flag, to_phone, sent_at, delivery)
       values ($1, $2, 'out', 'person', $3, $4, $5, $6, 'stored')
       on conflict (conversation_id, client_id) do nothing returning id`,
      [convo, m.id, m.body, flagFor(m.body), phone, m.at],
    );
    if (!inserted) {
      const existing = (await this.one<{ id: string; delivery: MessageView['delivery'] }>(
        'select id, delivery from message where conversation_id = $1 and client_id = $2',
        [convo, m.id],
      ))!;
      return { id: String(existing.id), delivery: existing.delivery, created: false };
    }
    const id = String(inserted.id);

    if (toCounselor) {
      await this.nudgeCounselor(person.counselor_id, person.display_name, convo, id);
      return { id, delivery: 'stored' as const, created: true };
    }
    if (firstText) await this.sms.send(phone!, smsIntro(person.display_name));
    const res = await this.sms.send(phone!, smsBody(person.display_name, m.body));
    await this.sql.query('update message set delivery = $2, provider_id = $3, error = $4 where id = $1', [
      id,
      res.status,
      res.providerId ?? null,
      res.error ?? null,
    ]);
    return { id, delivery: res.status, created: true };
  }

  // Everything in the person's conversations after the given message id, for
  // the phone to pick up. Includes the person's own messages so a second phone
  // or a reinstall catches up.
  async forPerson(personId: string, after = '0'): Promise<MessageView[]> {
    const rows = await this.sql.query<Record<string, any>>(
      `select m.*, c.client_id as convo, s.name as staff_name from message m
       join conversation c on c.id = m.conversation_id
       left join staff s on s.id = m.author
       where c.person_id = $1 and m.id > $2 order by m.id limit 500`,
      [personId, /^\d+$/.test(after) ? after : '0'],
    );
    return rows.rows.map(view);
  }

  // A text back from a LifeCircle member. Matched to the conversation that most
  // recently texted that number; unknown numbers are dropped.
  async receiveSms(from: string, body: string, providerId?: string) {
    const phone = toE164(from);
    if (!phone || !body.trim()) return null;
    const convo = await this.one<{ id: string }>(
      `select c.id from conversation c
       left join message m on m.conversation_id = c.id and m.direction = 'out'
       where c.kind = 'sms' and c.phone = $1
       group by c.id order by max(m.id) desc nulls last limit 1`,
      [phone],
    );
    if (!convo) return null;
    const r = await this.one<{ id: string }>(
      `insert into message (conversation_id, client_id, direction, author, body, sent_at, delivery, provider_id)
       values ($1, $2, 'in', 'sms', $3, $4, 'stored', $2)
       on conflict (conversation_id, client_id) do nothing returning id`,
      [convo.id, providerId ?? null, body, this.now()],
    );
    return r ? String(r.id) : null;
  }

  // ---- Staff side: only the counselor conversation, never texts with family. ----

  async conversations(staff: Staff): Promise<ConversationView[]> {
    const rows = await this.sql.query<Record<string, any>>(
      `select p.id as person_id, p.display_name, c.id as convo,
         (select row_to_json(x) from (select body, sent_at, direction from message where conversation_id = c.id order by id desc limit 1) x) as last,
         (select count(*) from message where conversation_id = c.id and direction = 'out' and read_at is null) as unread,
         (select count(*) from message where conversation_id = c.id and direction = 'out' and read_at is null and flag is not null) as flagged
       from person p left join conversation c on c.person_id = p.id and c.kind = 'counselor'
       where $1::text is null or p.counselor_id = $1
       order by unread desc, p.display_name`,
      [staff.role === 'supervisor' ? null : staff.id],
    );
    return rows.rows.map((r) => ({
      id: r.person_id,
      person: { id: r.person_id, name: r.display_name },
      last: r.last ? { body: r.last.body, at: new Date(r.last.sent_at).toISOString(), direction: r.last.direction } : null,
      unread: Number(r.unread ?? 0),
      flagged: Number(r.flagged ?? 0),
    }));
  }

  // Opening a conversation marks the person's messages read and is logged.
  async thread(staff: Staff, personId: string): Promise<MessageView[] | null> {
    if (!(await this.canMessage(staff, personId))) return null;
    const convo = await this.one<{ id: string }>("select id from conversation where person_id = $1 and kind = 'counselor'", [personId]);
    await this.sql.query('insert into access_log (staff_id, action, alert_ids, person_id) values ($1, $2, $3, $4)', [
      staff.id,
      'read_messages',
      [],
      personId,
    ]);
    if (!convo) return [];
    await this.sql.query("update message set read_at = $2 where conversation_id = $1 and direction = 'out' and read_at is null", [
      convo.id,
      this.now(),
    ]);
    const rows = await this.sql.query<Record<string, any>>(
      `select m.*, c.client_id as convo, s.name as staff_name from message m
       join conversation c on c.id = m.conversation_id left join staff s on s.id = m.author
       where m.conversation_id = $1 order by m.id desc limit 200`,
      [convo.id],
    );
    return rows.rows.reverse().map(view);
  }

  async reply(staff: Staff, personId: string, body: string) {
    if (!(await this.canMessage(staff, personId))) return null;
    const convo = await this.conversation(personId, COUNSELOR, 'counselor', staff.name, null);
    const r = (await this.one<{ id: string }>(
      `insert into message (conversation_id, direction, author, body, sent_at, delivery)
       values ($1, 'in', $2, $3, $4, 'stored') returning id`,
      [convo, staff.id, body, this.now()],
    ))!;
    return String(r.id);
  }

  private async canMessage(staff: Staff, personId: string) {
    if (staff.role === 'supervisor') return !!(await this.one('select 1 from person where id = $1', [personId]));
    return !!(await this.one('select 1 from person where id = $1 and counselor_id = $2', [personId, staff.id]));
  }

  // One text per batch of unread messages, so a run of messages doesn't page
  // the counselor over and over.
  private async nudgeCounselor(counselorId: string, name: string, convo: string, messageId: string) {
    const earlier = await this.one(
      "select 1 from message where conversation_id = $1 and direction = 'out' and read_at is null and id <> $2",
      [convo, messageId],
    );
    if (earlier) return;
    const staff = await this.one<{ phone: string }>('select phone from staff where id = $1', [counselorId]);
    if (staff) await this.sms.send(staff.phone, counselorNotice(name));
  }

  private async conversation(personId: string, clientId: string, kind: 'counselor' | 'sms', name: string, phone: string | null) {
    // A new number for the same LifeCircle member replaces the old one.
    const r = (await this.one<{ id: string }>(
      `insert into conversation (person_id, client_id, kind, name, phone) values ($1, $2, $3, $4, $5)
       on conflict (person_id, client_id) do update set phone = coalesce(excluded.phone, conversation.phone)
       returning id`,
      [personId, clientId, kind, name, phone],
    ))!;
    return String(r.id);
  }

  private async one<T = Record<string, unknown>>(text: string, params: unknown[]) {
    return (await this.sql.query<T>(text, params)).rows[0] as T | undefined;
  }
}

function view(r: Record<string, any>): MessageView {
  return {
    id: String(r.id),
    clientId: r.direction === 'out' ? r.client_id : null,
    conversation: r.convo,
    direction: r.direction,
    author: r.author === 'person' || r.author === 'sms' ? r.author : (r.staff_name ?? r.author),
    body: r.body,
    at: new Date(r.sent_at).toISOString(),
    delivery: r.delivery,
    flag: r.flag ?? null,
    read: !!r.read_at,
  };
}
