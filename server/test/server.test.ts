import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Alerts, IncomingEvent } from '../src/alerts';
import { buildApp } from '../src/app';
import { addPerson, addStaff } from '../src/auth';
import { connectMemory, migrate, Sql } from '../src/db';
import { DEFAULT_HOURS, inBusinessHours, planFor, REPORT_ROUTES, rerouteTargets, routeFor, Team } from '../src/routing';
import { addHome, routingSummary, setHouseManager, setPersonHome } from '../src/team';
import { LogSender, maskPhone, TwilioSender } from '../src/sms';
import { LanguageModel, phrase } from '../src/zoey';
import { ChatModel, ChatTurn, liveAnswer, liveModelFromEnv, RateLimit, toTurns } from '../src/zoeyLive';
import { systemPrompt, ZOEY_RULES } from '../src/zoeyPrompt';

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
    assert.deepEqual(rerouteTargets(['maya'], ['sam'], ['pat'], ['ana']), ['sam']);
    assert.deepEqual(rerouteTargets(['maya'], [], ['pat'], ['ana']), ['pat']);
    assert.deepEqual(rerouteTargets(['sam'], ['sam'], [], ['ana']), ['ana']);
    assert.deepEqual(rerouteTargets(['maya'], [], [], []), []);
  });

  const team = (over: Partial<Team> = {}): Team => ({
    counselor: 'maya',
    houseManager: undefined,
    caseManagers: ['cam'],
    programDirectors: ['pat'],
    onCall: ['ana'],
    ...over,
  });
  test('each report reaches the right role', () => {
    // Overdose risk in a Life Works Home: house manager too, any hour.
    assert.deepEqual(planFor(2, 'urgent', 'using', SAT_NIGHT, team({ houseManager: 'dee' }), DEFAULT_HOURS), {
      text: ['ana', 'dee'],
      share: [],
      missing: [],
    });
    // Not in a Life Works Home: no house manager, and nothing missing.
    assert.deepEqual(planFor(3, 'crisis', 'medical', WED_NOON, team(), DEFAULT_HOURS), { text: ['maya'], share: [], missing: [] });
    // Home with no manager named yet: noted as missing.
    assert.deepEqual(planFor(3, 'crisis', 'psychiatric', WED_NOON, team({ houseManager: null }), DEFAULT_HOURS).missing, ['house_manager']);
    // Losing housing: case manager and house manager in business hours ...
    assert.deepEqual(planFor(2, 'urgent', 'housing', WED_NOON, team({ houseManager: 'dee' }), DEFAULT_HOURS).text, ['maya', 'dee', 'cam']);
    // ... and on their list for the morning after hours.
    assert.deepEqual(planFor(2, 'urgent', 'housing', SAT_NIGHT, team({ houseManager: 'dee' }), DEFAULT_HOURS), {
      text: ['ana'],
      share: ['dee', 'cam'],
      missing: [],
    });
    // Abuse goes to the program director, never the house manager.
    const abuse = planFor(2, 'urgent', 'abuse', WED_NOON, team({ houseManager: 'dee' }), DEFAULT_HOURS);
    assert.deepEqual(abuse.text, ['maya', 'pat']);
    assert.equal(abuse.share.includes('dee'), false);
    // No case manager yet.
    assert.deepEqual(planFor(2, 'urgent', 'pregnant', WED_NOON, team({ caseManagers: [] }), DEFAULT_HOURS).missing, ['case_manager']);
    // Tier 1 texts nobody but still lands on the role's list.
    assert.deepEqual(planFor(1, 'urgent', 'housing', WED_NOON, team(), DEFAULT_HOURS), { text: [], share: ['cam'], missing: [] });
  });
  test('every report the phone can raise has a route', () => {
    const reports = ['crisis:psychiatric', 'crisis:medical', 'check', ...['withdrawal', 'abuse', 'housing', 'someone', 'pregnant', 'using'].map((v) => `urgent:${v}`)];
    assert.deepEqual(REPORT_ROUTES.map((r) => r.report).sort(), reports.sort());
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
  keys.dee = await addStaff(sql, { id: 'dee', name: 'Dee Park', phone: '+15095550103', role: 'house_manager' });
  keys.jordan = await addPerson(sql, { id: 'jordan', displayName: 'Jordan', counselorId: 'maya' });
  keys.riley = await addPerson(sql, { id: 'riley', displayName: 'Riley', counselorId: 'ana' });
});
after(() => sql.close());

beforeEach(async () => {
  await sql.query('alter table alert disable trigger alert_guard');
  await sql.query('alter table alert_action disable trigger alert_action_guard');
  await sql.query('alter table access_log disable trigger access_log_guard');
  await sql.query('truncate alert, alert_action, notification, access_log');
  await sql.query('alter table alert enable trigger alert_guard');
  await sql.query('alter table alert_action enable trigger alert_action_guard');
  await sql.query('alter table access_log enable trigger access_log_guard');
  sms = new LogSender(() => {});
  now = WED_NOON;
  alerts = new Alerts(sql, sms, { hours: DEFAULT_HOURS, escalateAfterMin: 15, now: () => now });
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

  test('reports reach the house manager and case manager, and say which roles nobody fills yet', async () => {
    await addHome(sql, { id: 'maple', name: 'Maple House' });
    await setPersonHome(sql, 'jordan', 'maple');
    try {
      // No house manager or case manager set up yet.
      const first = await alerts.receive('jordan', event({ id: 'h-1', variant: 'housing', matched: 'evicted' }));
      assert.deepEqual(first.notified, ['maya']);
      let [a] = await alerts.list(await staff('maya'), { open: true });
      assert.deepEqual(a.missingRoles, ['House manager', 'Case manager']);

      await setHouseManager(sql, 'maple', 'dee');
      keys.cam ??= await addStaff(sql, { id: 'cam', name: 'Cam Ortiz', phone: '+15095550104', role: 'case_manager' });
      const used = await alerts.receive('jordan', event({ id: 'u-1', variant: 'using', matched: 'using alone' }));
      assert.deepEqual(used.notified.sort(), ['dee', 'maya']);
      assert.equal(sms.sent.at(-1)!.to, '+15095550103');
      // The house manager sees only what reached them, not Jordan's other alerts.
      const dee = await staff('dee');
      assert.deepEqual((await alerts.list(dee, { open: true })).map((x) => x.id), [used.id]);
      assert.equal(await alerts.acknowledge(dee, first.id), false);
      assert.equal(await alerts.acknowledge(dee, used.id), true);

      // After hours, losing housing waits on the case manager's list.
      now = SAT_NIGHT;
      const late = await alerts.receive('jordan', event({ id: 'h-2', variant: 'housing', matched: 'evicted' }));
      assert.deepEqual(late.notified.sort(), ['ana']);
      [a] = (await alerts.list(await staff('cam'), { open: true })).filter((x) => x.id === late.id);
      assert.deepEqual(a.sharedWith.sort(), ['Cam Ortiz', 'Dee Park']);
      assert.deepEqual(a.missingRoles, []);
    } finally {
      await setPersonHome(sql, 'jordan', null);
    }
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
  const app = () => buildApp({ sql, alerts, model: null });
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

  test('alerts from Check In/Out and MyHome are accepted', async () => {
    const a = app();
    for (const screen of ['checkinout', 'myhome']) {
      const r = await a.inject({ method: 'POST', url: '/v1/alerts', headers: auth(keys.jordan), payload: event({ id: screen, screen: screen as never }) });
      assert.equal(r.statusCode, 200, screen);
    }
  });

  test('staff can see who gets which report', async () => {
    const r = await app().inject({ url: '/v1/console/routing', headers: auth(keys.maya) });
    const body = r.json() as Awaited<ReturnType<typeof routingSummary>>;
    assert.deepEqual(body.roles.find((x) => x.role === 'house_manager')!.people, ['Dee Park']);
    assert.ok(body.reports.some((x) => x.report === 'Losing housing' && x.also.length === 2));
    assert.equal((await app().inject({ url: '/v1/console/routing', headers: auth(keys.jordan) })).statusCode, 401);
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

  const chatBody = { message: 'I’m bored tonight', history: [], context: { firstName: 'Jordan', cleanDays: 42, coordinatorName: 'Maya', hasSponsor: true } };
  test('live AI is off by default', async () => {
    const a = app();
    assert.deepEqual((await a.inject({ url: '/v1/zoey/live', headers: auth(keys.jordan) })).json(), { live: false });
    const r = await a.inject({ method: 'POST', url: '/v1/zoey/chat', headers: auth(keys.jordan), payload: chatBody });
    assert.deepEqual(r.json(), { text: null, live: false });
    assert.equal((await a.inject({ url: '/v1/zoey/live' })).statusCode, 401);
  });

  test('live AI answers when switched on, with a cap per phone', async () => {
    const chat: ChatModel = { name: 'fake', reply: async () => 'Bored can be hard. Want to look for a meeting or call someone in your LifeCircle?' };
    const a = buildApp({ sql, alerts, model: null, chat, liveLimitPerHour: 2 });
    assert.deepEqual((await a.inject({ url: '/v1/zoey/live', headers: auth(keys.jordan) })).json(), { live: true });
    const send = () => a.inject({ method: 'POST', url: '/v1/zoey/chat', headers: auth(keys.jordan), payload: chatBody });
    const r = await send();
    assert.equal(r.json().text, 'Bored can be hard. Want to look for a meeting or call someone in your LifeCircle?');
    assert.equal(r.headers['cache-control'], 'no-store');
    await send();
    assert.deepEqual((await send()).json(), { text: null, live: true, reason: 'busy' });
    const bad = await a.inject({ method: 'POST', url: '/v1/zoey/chat', headers: auth(keys.jordan), payload: { ...chatBody, context: {} } });
    assert.equal(bad.statusCode, 400);
  });
});

describe('zoey live AI', () => {
  const ctx = { firstName: 'Jordan', cleanDays: 42, coordinatorName: 'Maya', hasSponsor: true };
  const fake = (out: string | Error) => {
    const m = {
      name: 'fake',
      calls: [] as { system: string; turns: ChatTurn[] }[],
      async reply(system: string, turns: ChatTurn[]) {
        m.calls.push({ system, turns });
        if (out instanceof Error) throw out;
        return out;
      },
    };
    return m;
  };

  test('off with no model', async () => {
    assert.deepEqual(await liveAnswer(null, { message: 'hi', history: [], context: ctx }), { text: null, reason: 'off' });
  });

  test('danger words never reach the model, even if the phone sent them', async () => {
    for (const message of ['I want to kill myself', 'I am about to use', 'we got evicted']) {
      const m = fake('anything');
      const r = await liveAnswer(m, { message, history: [], context: ctx });
      assert.equal(r.reason, 'safety', message);
      assert.equal(m.calls.length, 0);
    }
    const m = fake('anything');
    const r = await liveAnswer(m, { message: 'ok', history: [{ from: 'me', text: 'i overdosed last night' }], context: ctx });
    assert.equal(r.reason, 'safety');
    assert.equal(m.calls.length, 0);
  });

  test('crisis wording, hotlines and medical advice from the model are thrown out', async () => {
    for (const out of ['If you feel unsafe call 988.', 'Go to the emergency room.', 'You might have an anxiety disorder.', 'Call 509-555-0100.', '']) {
      const r = await liveAnswer(fake(out), { message: 'rough day', history: [], context: ctx });
      assert.deepEqual(r, { text: null, reason: 'rejected' }, out);
    }
    assert.deepEqual(await liveAnswer(fake(new Error('down')), { message: 'hey', history: [], context: ctx }), { text: null, reason: 'model error' });
  });

  test('sends only the minimum, scrubbed, in turn order', async () => {
    const m = fake('Sounds good!');
    const r = await liveAnswer(m, {
      message: 'my email is jo@mail.com, what do I have today?',
      history: [
        { from: 'zoey', text: 'Good morning, Jordan!' },
        { from: 'me', text: 'hi' },
        { from: 'me', text: 'you there' },
      ],
      context: { ...ctx, firstName: 'Jordan Smith', today: [{ time: '18:00', label: 'NA meeting' }] },
    });
    assert.equal(r.text, 'Sounds good!');
    const { system, turns } = m.calls[0];
    assert.deepEqual(turns.map((t) => t.role), ['user']);
    assert.match(turns[0].text, /hi\nyou there\nmy email is \[email\]/);
    assert.match(system, /first name: Jordan\./);
    assert.doesNotMatch(system, /Smith/);
    assert.match(system, /18:00 NA meeting/);
  });

  test('turns alternate and start with the person', () => {
    const t = toTurns({ message: 'c', history: [{ from: 'zoey', text: 'hello' }, { from: 'me', text: 'a' }, { from: 'zoey', text: 'b' }], context: ctx });
    assert.deepEqual(t, [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }, { role: 'user', text: 'c' }]);
  });

  test('the prompt carries Zoey’s voice and limits', () => {
    for (const rule of [/Warm, positive and curious/, /Heeey/, /Never joke about anything sad/, /Never give medical/, /do not mention 988 or 911/, /LifeCircle/, /sponsor/])
      assert.match(ZOEY_RULES, rule);
    assert.match(systemPrompt({ ...ctx, hasSponsor: false, cleanDays: null }), /No sponsor is listed/);
  });

  test('needs both the switch and the approval note', () => {
    assert.equal(liveModelFromEnv({}).model, null);
    assert.equal(liveModelFromEnv({ ZOEY_LIVE_AI: '1', AWS_REGION: 'us-west-2' }).model, null);
    assert.equal(liveModelFromEnv({ ZOEY_LIVE_AI: '1', ZOEY_LIVE_AI_APPROVED: 'x', ZOEY_PROVIDER: 'other', AWS_REGION: 'us-west-2' }).model, null);
    const on = liveModelFromEnv({ ZOEY_LIVE_AI: '1', ZOEY_LIVE_AI_APPROVED: 'BAA signed; clinician ok', AWS_REGION: 'us-west-2' });
    assert.equal(on.model?.name, 'bedrock:anthropic.claude-opus-5-5');
  });

  test('rate limit resets after an hour', () => {
    const l = new RateLimit(1);
    assert.equal(l.take('a', 0), true);
    assert.equal(l.take('a', 1000), false);
    assert.equal(l.take('b', 1000), true);
    assert.equal(l.take('a', 3_600_001), true);
  });
});
