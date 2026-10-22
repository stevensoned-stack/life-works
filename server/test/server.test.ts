import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Alerts, IncomingEvent } from '../src/alerts';
import { buildApp } from '../src/app';
import { addPerson, addStaff } from '../src/auth';
import { connectMemory, migrate, Sql } from '../src/db';
import { DEFAULT_HOURS, inBusinessHours, rerouteTargets, routeFor } from '../src/routing';
import { counselorNotice, Messages, smsIntro, toE164 } from '../src/messages';
import { LogSender, maskPhone, twilioSignature, TwilioSender } from '../src/sms';
import { LanguageModel, phrase } from '../src/zoey';

const WED_NOON = new Date('2026-10-21T19:00:00Z'); // 12:00 in Spokane
const SAT_NIGHT = new Date('2026-10-25T06:00:00Z'); // Sat 23:00 in Spokane

describe('routing', () => {
  test('business hours follow the org time zone', () => {
    assert.equal(inBusinessHours(WED_NOON, DEFAULT_HOURS), true);
    assert.equal(inBusinessHours(new Date('2026-10-22T02:00:00Z'), DEFAULT_HOURS), false); // Wed 19:00
    assert.equal(inBusinessHours(SAT_NIGHT, DEFAULT_HOURS), false);
  });
  test('who gets texted by tier', () => {
    assert.deepEqual(routeFor(1, WED_NOON, 'maya', ['sam'], DEFAULT_HOURS), []);
    assert.deepEqual(routeFor(2, WED_NOON, 'maya', ['sam'], DEFAULT_HOURS), ['maya']);
    assert.deepEqual(routeFor(2, SAT_NIGHT, 'maya', ['sam'], DEFAULT_HOURS), ['sam']);
    assert.deepEqual(routeFor(2, SAT_NIGHT, 'maya', [], DEFAULT_HOURS), ['maya']);
    assert.deepEqual(routeFor(3, WED_NOON, 'maya', ['sam'], DEFAULT_HOURS), ['maya']);
    assert.deepEqual(routeFor(3, SAT_NIGHT, 'maya', ['sam', 'maya'], DEFAULT_HOURS), ['maya', 'sam']);
  });
  test('re-route goes to someone new', () => {
    assert.deepEqual(rerouteTargets(['maya'], ['sam'], ['ana']), ['sam']);
    assert.deepEqual(rerouteTargets(['sam'], ['sam'], ['ana']), ['ana']);
    assert.deepEqual(rerouteTargets(['maya'], [], []), []);
  });
});

describe('sms', () => {
  test('phone numbers are masked in logs', () => assert.equal(maskPhone('+15095550100'), '+•••••••••00'));
  test('log sender keeps the body out of the log line', async () => {
    const lines: string[] = [];
    await new LogSender((l) => lines.push(l)).send('+15095550100', 'Life Works alert: Jordan would like a check-in');
    assert.doesNotMatch(lines[0], /Jordan|5550100/);
  });
  test('twilio request and failure handling', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const ok = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ sid: 'SM1' }), { status: 201 });
    }) as unknown as typeof fetch;
    const s = new TwilioSender({ accountSid: 'AC1', authToken: 'tok', from: '+15095559999' }, ok);
    assert.deepEqual(await s.send('+15095550100', 'hi'), { status: 'sent', providerId: 'SM1' });
    assert.match(seen!.url, /Accounts\/AC1\/Messages\.json$/);
    assert.equal(String(seen!.init.body), 'To=%2B15095550100&From=%2B15095559999&Body=hi');
    const bad = (async () => new Response(JSON.stringify({ message: 'bad number' }), { status: 400 })) as unknown as typeof fetch;
    const r = await new TwilioSender({ accountSid: 'AC1', authToken: 'tok', from: '+1' }, bad).send('+1', 'hi');
    assert.equal(r.status, 'failed');
    assert.match(r.error!, /bad number/);
  });
});

describe('zoey language seam', () => {
  const model = (out: string): LanguageModel & { calls: number } => ({
    name: 'fake',
    calls: 0,
    async rephrase() {
      this.calls++;
      return out;
    },
  });
  const req = { authored: 'That sounds like a hard day. Want to tell Maya?', recent: [], tier: 0 as const };

  test('no model: authored text', async () => {
    assert.deepEqual(await phrase(null, req), { text: req.authored, llmUsed: false, validator: null });
  });
  test('model wording that passes the rules is used', async () => {
    const r = await phrase(model('Rough day, huh. Want me to let Maya know?'), req);
    assert.equal(r.llmUsed, true);
    assert.equal(r.text, 'Rough day, huh. Want me to let Maya know?');
  });
  test('clinical language or an invented number falls back to authored text', async () => {
    for (const out of ['Sounds like depression symptoms.', 'Call 555-123-4567 for help.', 'As your therapist, rest.']) {
      const r = await phrase(model(out), req);
      assert.equal(r.text, req.authored, out);
      assert.equal(r.validator?.ok, false);
    }
  });
  test('crisis turns never reach the model', async () => {
    const m = model('anything');
    const r = await phrase(m, { ...req, tier: 3 });
    assert.equal(m.calls, 0);
    assert.equal(r.text, req.authored);
  });
});

// ---- Alerts against a real Postgres (PGlite) ----

let sql: Sql;
let sms: LogSender;
let now: Date;
let alerts: Alerts;
let messages: Messages;
const keys: Record<string, string> = {};

const event = (over: Partial<IncomingEvent> = {}): IncomingEvent => ({
  id: 'evt-1',
  at: '2026-10-21T18:58:00.000Z',
  screen: 'ask',
  tier: 2,
  kind: 'urgent',
  variant: 'withdrawal',
  matched: 'shaking',
  message: 'shaking bad and sweating, cant stop',
  context: [{ from: 'zoey', text: 'How are you doing?', at: '2026-10-21T18:57:00.000Z' }],
  shown: "Zoey's withdrawal reply with call buttons",
  taken: [],
  ...over,
});

before(async () => {
  sql = await connectMemory();
  await migrate(sql);
  await migrate(sql); // safe to run twice
  keys.maya = await addStaff(sql, { id: 'maya', name: 'Maya Torres', phone: '+15095550100', role: 'counselor' });
  keys.ana = await addStaff(sql, { id: 'ana', name: 'Ana Ruiz', phone: '+15095550102', role: 'counselor', on_call: true });
  keys.sam = await addStaff(sql, { id: 'sam', name: 'Sam Lee', phone: '+15095550101', role: 'supervisor' });
  keys.jordan = await addPerson(sql, { id: 'jordan', displayName: 'Jordan', counselorId: 'maya' });
  keys.riley = await addPerson(sql, { id: 'riley', displayName: 'Riley', counselorId: 'ana' });
});
after(() => sql.close());

beforeEach(async () => {
  await sql.query('alter table alert disable trigger alert_guard');
  await sql.query('alter table alert_action disable trigger alert_action_guard');
  await sql.query('alter table access_log disable trigger access_log_guard');
  await sql.query('alter table message disable trigger message_guard');
  await sql.query('truncate alert, alert_action, notification, access_log, message, conversation');
  await sql.query('alter table message enable trigger message_guard');
  await sql.query('alter table alert enable trigger alert_guard');
  await sql.query('alter table alert_action enable trigger alert_action_guard');
  await sql.query('alter table access_log enable trigger access_log_guard');
  sms = new LogSender(() => {});
  now = WED_NOON;
  alerts = new Alerts(sql, sms, { hours: DEFAULT_HOURS, escalateAfterMin: 15, now: () => now });
  messages = new Messages(sql, sms, () => now);
});

const staff = async (id: string) =>
  (await sql.query<any>('select id, name, phone, role, on_call from staff where id = $1', [id])).rows[0];

describe('alerts', () => {
  test('an urgent alert is saved and texts the counselor without saying what was written', async () => {
    const r = await alerts.receive('jordan', event());
    assert.equal(r.created, true);
    assert.deepEqual(r.notified, ['maya']);
    assert.equal(sms.sent.length, 1);
    assert.equal(sms.sent[0].to, '+15095550100');
    assert.match(sms.sent[0].body, /^Life Works alert: Jordan would like a check-in \(urgent, 11:58 AM\)/);
    assert.doesNotMatch(sms.sent[0].body, /shaking|withdrawal|sweating/i);
    const n = (await sql.query<any>('select status, reason from notification')).rows;
    assert.deepEqual(n, [{ status: 'logged', reason: 'raised' }]);
  });

  test('tier 1 waits on the list and texts nobody', async () => {
    const r = await alerts.receive('jordan', event({ tier: 1 }));
    assert.deepEqual(r.notified, []);
    assert.equal(sms.sent.length, 0);
  });

  test('outside business hours urgent goes to on-call, crisis to both', async () => {
    now = SAT_NIGHT;
    assert.deepEqual((await alerts.receive('jordan', event({ id: 'a' }))).notified, ['ana']);
    assert.deepEqual((await alerts.receive('jordan', event({ id: 'b', tier: 3, kind: 'crisis' }))).notified.sort(), ['ana', 'maya']);
  });

  test('resending is safe: no duplicate, new taps added, raised tier texts again', async () => {
    await alerts.receive('jordan', event());
    const again = await alerts.receive('jordan', event({ message: 'edited on the phone?' }));
    assert.equal(again.created, false);
    assert.equal(sms.sent.length, 1);

    const tap = { label: 'Called 988', at: '2026-10-21T19:01:00.000Z' };
    const raised = await alerts.receive('jordan', event({ tier: 3, taken: [tap] }));
    assert.deepEqual(raised.notified, ['maya']);
    assert.equal(sms.sent.length, 2);
    assert.match(sms.sent[1].body, /crisis/);

    const [a] = await alerts.list(await staff('maya'), { open: true });
    assert.equal(a.tier, 3);
    assert.equal(a.firstTier, 2);
    assert.equal(a.evidence.message, 'shaking bad and sweating, cant stop'); // first version kept
    assert.deepEqual(a.taken, [tap]);

    await alerts.receive('jordan', event({ tier: 2, taken: [tap] })); // a lower tier never lowers it
    assert.equal((await alerts.list(await staff('maya'), { open: true }))[0].tier, 3);
  });

  test('the database refuses to rewrite or delete what was recorded', async () => {
    const { id } = await alerts.receive('jordan', event());
    await assert.rejects(sql.query(`update alert set evidence = '{}' where id = $1`, [id]), /cannot be changed/);
    await assert.rejects(sql.query('update alert set tier = 1 where id = $1', [id]), /only rise/);
    await assert.rejects(sql.query('delete from alert where id = $1', [id]), /append-only/);
    await alerts.resolve(await staff('maya'), id, 'Called Jordan');
    await assert.rejects(sql.query(`update alert set resolution = 'changed' where id = $1`, [id]), /recorded once/);
    await assert.rejects(sql.query('delete from access_log'), /append-only/);
  });

  test('unacknowledged urgent alerts re-route to a supervisor once', async () => {
    const { id } = await alerts.receive('jordan', event());
    const acked = await alerts.receive('jordan', event({ id: 'evt-2' }));
    await alerts.acknowledge(await staff('maya'), acked.id);

    now = new Date(WED_NOON.getTime() + 14 * 60_000);
    assert.deepEqual(await alerts.sweep(), []);
    now = new Date(WED_NOON.getTime() + 16 * 60_000);
    assert.deepEqual(await alerts.sweep(), [id]);
    assert.equal(sms.sent.at(-1)!.to, '+15095550101');
    assert.match(sms.sent.at(-1)!.body, /Not yet acknowledged after 15 min/);
    assert.deepEqual(await alerts.sweep(), []);

    const [a] = (await alerts.list(await staff('sam'), { open: true })).filter((x) => x.id === id);
    assert.deepEqual(a.rerouted?.to, ['Sam Lee']);
  });

  test('counselors see their own people; supervisors see everyone; every read is logged', async () => {
    const j = await alerts.receive('jordan', event());
    await alerts.receive('riley', event({ id: 'r-1' }));
    const maya = await staff('maya');
    assert.deepEqual((await alerts.list(maya, { open: true })).map((a) => a.person.name), ['Jordan']);
    assert.deepEqual((await alerts.list(await staff('ana'), { open: true })).map((a) => a.person.name), ['Riley']);
    assert.equal((await alerts.list(await staff('sam'), { open: true })).length, 2);
    assert.equal(await alerts.acknowledge(await staff('ana'), j.id), false); // not Ana's person

    assert.equal(await alerts.acknowledge(maya, j.id), true);
    assert.equal(await alerts.acknowledge(maya, j.id), false);
    assert.equal(await alerts.resolve(maya, j.id, 'Reached Jordan, going to detox intake'), true);
    assert.deepEqual(await alerts.list(maya, { open: true }), []);
    const [done] = await alerts.list(maya, { open: false });
    assert.equal(done.resolved?.note, 'Reached Jordan, going to detox intake');
    assert.equal(done.acknowledged?.by, 'Maya Torres');

    const log = (await sql.query<any>(`select staff_id, action from access_log order by id`)).rows;
    assert.ok(log.some((l) => l.staff_id === 'sam' && l.action === 'list'));
    assert.ok(log.some((l) => l.staff_id === 'maya' && l.action === 'resolve'));
  });
});

describe('http', () => {
  const app = () => buildApp({ sql, alerts, messages, model: null });
  const auth = (k: string) => ({ authorization: `Bearer ${k}` });

  test('the phone needs its key, and a bad body is refused', async () => {
    const a = app();
    assert.equal((await a.inject({ method: 'POST', url: '/v1/alerts', payload: event() })).statusCode, 401);
    assert.equal((await a.inject({ method: 'POST', url: '/v1/alerts', headers: auth(keys.maya), payload: event() })).statusCode, 401);
    const bad = await a.inject({ method: 'POST', url: '/v1/alerts', headers: auth(keys.jordan), payload: { ...event(), tier: 5 } });
    assert.equal(bad.statusCode, 400);
  });

  test('alert in, counselor reviews it on the console', async () => {
    const a = app();
    const sent = await a.inject({ method: 'POST', url: '/v1/alerts', headers: auth(keys.jordan), payload: event() });
    assert.equal(sent.statusCode, 200);
    assert.deepEqual({ ...(sent.json() as object), id: undefined }, { id: undefined, created: true, notified: 1 });

    assert.equal((await a.inject({ url: '/v1/console/alerts', headers: auth(keys.jordan) })).statusCode, 401);
    const list = await a.inject({ url: '/v1/console/alerts', headers: auth(keys.maya) });
    const [alert] = list.json().alerts;
    assert.equal(alert.person.name, 'Jordan');
    assert.equal(alert.notifications[0].to, 'Maya Torres');
    assert.equal(list.headers['cache-control'], 'no-store');

    const noNote = await a.inject({ method: 'POST', url: `/v1/console/alerts/${alert.id}/resolve`, headers: auth(keys.maya), payload: { note: '' } });
    assert.equal(noNote.statusCode, 400);
    const ack = await a.inject({ method: 'POST', url: `/v1/console/alerts/${alert.id}/acknowledge`, headers: auth(keys.maya), payload: {} });
    assert.equal(ack.statusCode, 200);
    const again = await a.inject({ method: 'POST', url: `/v1/console/alerts/${alert.id}/acknowledge`, headers: auth(keys.maya), payload: {} });
    assert.equal(again.statusCode, 409);
    const bogus = await a.inject({ method: 'POST', url: `/v1/console/alerts/x'1/acknowledge`, headers: auth(keys.maya), payload: {} });
    assert.equal(bogus.statusCode, 409);
  });

  test('console page is served with a strict policy', async () => {
    const r = await app().inject({ url: '/console' });
    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-security-policy'] as string, /default-src 'none'/);
    assert.doesNotMatch(r.body, /innerHTML/);
  });

  test('zoey endpoint returns authored text with no model', async () => {
    const r = await app().inject({
      method: 'POST',
      url: '/v1/zoey/phrase',
      headers: auth(keys.jordan),
      payload: { authored: 'Want to tell Maya?', recent: [], tier: 0 },
    });
    assert.deepEqual(r.json(), { text: 'Want to tell Maya?', llmUsed: false, validator: null });
  });
});

describe('chat', () => {
  const msg = (over: Partial<{ id: string; body: string; to: { id: string; name: string; phone?: string } }> = {}) => ({
    id: 'm1',
    at: '2026-10-21T19:00:00.000Z',
    body: 'Can we move our call to 3?',
    to: { id: 'coordinator', name: 'Maya Torres' },
    ...over,
  });
  const kayla = { id: 'kayla', name: 'Kayla', phone: '(509) 555-0174' };

  test('phone numbers are normalised so replies can be matched', () => {
    assert.equal(toE164('(509) 555-0174'), '+15095550174');
    assert.equal(toE164('1 509 555 0174'), '+15095550174');
    assert.equal(toE164('+44 20 7946 0958'), '+442079460958');
    assert.equal(toE164('555-0174'), null);
  });

  test('a message to the counselor waits on the review page; one content-free text per unread batch', async () => {
    const r = await messages.send('jordan', msg());
    assert.equal(r.delivery, 'stored');
    await messages.send('jordan', msg({ id: 'm2', body: 'And I need a ride' }));
    assert.equal(sms.sent.length, 1);
    assert.equal(sms.sent[0].to, '+15095550100');
    assert.equal(sms.sent[0].body, counselorNotice('Jordan'));
    assert.doesNotMatch(sms.sent[0].body, /call|ride/i);

    const maya = await staff('maya');
    const [c] = (await messages.conversations(maya)).filter((x) => x.person.id === 'jordan');
    assert.equal(c.unread, 2);
    const thread = (await messages.thread(maya, 'jordan'))!;
    assert.deepEqual(thread.map((m) => m.body), ['Can we move our call to 3?', 'And I need a ride']);
    assert.equal((await messages.conversations(maya)).find((x) => x.person.id === 'jordan')!.unread, 0);

    // Read, so the next message texts Maya again.
    await messages.send('jordan', msg({ id: 'm3', body: 'thanks' }));
    assert.equal(sms.sent.length, 2);
  });

  test('resending the same message stores and texts it once', async () => {
    await messages.send('jordan', msg({ to: kayla }));
    const again = await messages.send('jordan', msg({ to: kayla }));
    assert.equal(again.created, false);
    assert.equal(sms.sent.length, 2); // intro + the message
    assert.equal((await sql.query('select * from message')).rows.length, 1);
  });

  test('LifeCircle members get texts and their replies come back to the phone', async () => {
    const r = await messages.send('jordan', msg({ to: kayla, body: 'Are you free Saturday?' }));
    assert.equal(r.delivery, 'logged');
    assert.deepEqual(sms.sent.map((s) => s.to), ['+15095550174', '+15095550174']);
    assert.equal(sms.sent[0].body, smsIntro('Jordan'));
    assert.doesNotMatch(sms.sent[0].body, /recovery|counsel/i);
    assert.equal(sms.sent[1].body, 'Jordan: Are you free Saturday?');
    await messages.send('jordan', msg({ id: 'm2', to: kayla, body: 'ok' }));
    assert.equal(sms.sent.length, 3); // no second intro

    assert.ok(await messages.receiveSms('+1 509-555-0174', 'Yes! Lunch?', 'SM9'));
    assert.equal(await messages.receiveSms('+15095550199', 'who is this', 'SM10'), null);
    const mine = await messages.forPerson('jordan');
    assert.deepEqual(
      mine.map((m) => [m.conversation, m.direction, m.author, m.body]),
      [
        ['kayla', 'out', 'person', 'Are you free Saturday?'],
        ['kayla', 'out', 'person', 'ok'],
        ['kayla', 'in', 'sms', 'Yes! Lunch?'],
      ],
    );
    assert.deepEqual((await messages.forPerson('jordan', mine[1].id)).map((m) => m.body), ['Yes! Lunch?']);
    assert.deepEqual(await messages.forPerson('riley'), []);
  });

  test("staff never see someone's texts with family", async () => {
    await messages.send('jordan', msg({ to: kayla }));
    const sam = await staff('sam');
    const all = await messages.conversations(sam);
    assert.ok(all.every((c) => c.last === null));
    assert.deepEqual(await messages.thread(sam, 'jordan'), []);
  });

  test('counselors reply to their own people only; supervisors can cover', async () => {
    const maya = await staff('maya');
    const ana = await staff('ana');
    assert.equal(await messages.reply(ana, 'jordan', 'hi'), null);
    assert.equal(await messages.thread(ana, 'jordan'), null);
    assert.ok(await messages.reply(maya, 'jordan', 'Sure, 3 works.'));
    assert.ok(await messages.reply(await staff('sam'), 'jordan', 'Covering for Maya today.'));
    const got = await messages.forPerson('jordan');
    assert.deepEqual(got.map((m) => [m.conversation, m.direction, m.author]), [
      ['coordinator', 'in', 'Maya Torres'],
      ['coordinator', 'in', 'Sam Lee'],
    ]);
    assert.ok((await sql.query<any>("select * from access_log where action = 'read_messages'")).rows.length === 0);
    await messages.thread(maya, 'jordan');
    const log = (await sql.query<any>("select staff_id, person_id from access_log where action = 'read_messages'")).rows;
    assert.deepEqual(log, [{ staff_id: 'maya', person_id: 'jordan' }]);
  });

  test('risky messages are flagged for the counselor', async () => {
    await messages.send('jordan', msg({ body: 'i want to kill myself' }));
    await messages.send('jordan', msg({ id: 'm2', body: 'see you thursday' }));
    const c = (await messages.conversations(await staff('maya'))).find((x) => x.person.id === 'jordan')!;
    assert.equal(c.flagged, 1);
    const [risky, plain] = (await messages.thread(await staff('maya'), 'jordan'))!;
    assert.equal(risky.flag, 'crisis/psychiatric');
    assert.equal(plain.flag, null);
  });

  test('the database refuses to edit or delete a message', async () => {
    await messages.send('jordan', msg());
    await assert.rejects(sql.query("update message set body = 'changed'"), /cannot be changed/);
    await assert.rejects(sql.query('delete from message'), /append-only/);
    await sql.query("update message set delivery = 'sent'");
  });

  describe('http', () => {
    const app = (twilio: { authToken: string; inboundUrl: string } | null = null) =>
      buildApp({ sql, alerts, messages, model: null, twilio });
    const auth = (k: string) => ({ authorization: `Bearer ${k}` });

    test('phone sends and picks up messages; console reads and replies', async () => {
      const a = app();
      assert.equal((await a.inject({ method: 'POST', url: '/v1/messages', payload: msg() })).statusCode, 401);
      const sent = await a.inject({ method: 'POST', url: '/v1/messages', headers: auth(keys.jordan), payload: msg() });
      assert.equal(sent.statusCode, 200);
      const bad = await a.inject({ method: 'POST', url: '/v1/messages', headers: auth(keys.jordan), payload: msg({ to: { id: 'x', name: 'X', phone: '12' } }) });
      assert.equal(bad.statusCode, 400);

      const list = await a.inject({ url: '/v1/console/conversations', headers: auth(keys.maya) });
      assert.equal(list.json().conversations[0].unread, 1);
      const thread = await a.inject({ url: '/v1/console/conversations/jordan', headers: auth(keys.maya) });
      assert.equal(thread.json().messages[0].body, 'Can we move our call to 3?');
      assert.equal((await a.inject({ url: '/v1/console/conversations/jordan', headers: auth(keys.ana) })).statusCode, 404);
      const reply = await a.inject({ method: 'POST', url: '/v1/console/conversations/jordan', headers: auth(keys.maya), payload: { body: 'Yes' } });
      assert.equal(reply.statusCode, 200);

      const got = await a.inject({ url: '/v1/messages?after=0', headers: auth(keys.jordan) });
      assert.deepEqual(got.json().messages.map((m: any) => m.body), ['Can we move our call to 3?', 'Yes']);
      assert.equal(got.headers['cache-control'], 'no-store');
    });

    test('texts back are taken only with a valid Twilio signature', async () => {
      await messages.send('jordan', msg({ to: kayla }));
      const url = 'https://lw.example/v1/sms/inbound';
      const form = { From: '+15095550174', Body: 'On my way', MessageSid: 'SM1' };
      const payload = new URLSearchParams(form).toString();
      const headers = { 'content-type': 'application/x-www-form-urlencoded' };

      const off = await app().inject({ method: 'POST', url: '/v1/sms/inbound', headers, payload });
      assert.equal(off.statusCode, 403);
      const a = app({ authToken: 'tok', inboundUrl: url });
      const forged = await a.inject({ method: 'POST', url: '/v1/sms/inbound', headers: { ...headers, 'x-twilio-signature': 'nope' }, payload });
      assert.equal(forged.statusCode, 403);
      const ok = await a.inject({
        method: 'POST',
        url: '/v1/sms/inbound',
        headers: { ...headers, 'x-twilio-signature': twilioSignature('tok', url, form) },
        payload,
      });
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.body, '<Response></Response>');
      assert.equal((await messages.forPerson('jordan')).at(-1)!.body, 'On my way');
    });
  });
});
