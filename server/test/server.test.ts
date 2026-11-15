import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { Alerts, IncomingEvent } from '../src/alerts';
import { buildApp } from '../src/app';
import { addPerson, addStaff } from '../src/auth';
import { addAdmin, AdminAuth } from '../src/setup';
import { connectMemory, migrate, Sql } from '../src/db';
import { DEFAULT_HOURS, inBusinessHours, planFor, REPORT_ROUTES, rerouteTargets, routeFor, Team } from '../src/routing';
import { addHome, routingSummary, setHouseManager, setPersonHome } from '../src/team';
import { LogSender, maskPhone, TwilioSender } from '../src/sms';
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
});

describe('admin setup', () => {
  let password: string;
  let clock = new Date('2026-10-23T18:00:00Z');
  const adminAuth = new AdminAuth(sqlRef(), () => clock);
  function sqlRef() {
    // sql is assigned in before(); defer the lookup until a query runs.
    return { query: (t: string, p?: unknown[]) => sql.query(t, p), close: async () => {} } as Sql;
  }
  const app = () => buildApp({ sql, alerts, model: null, adminAuth });
  const auth = (k: string) => ({ authorization: `Bearer ${k}` });
  const signIn = async (pw = password) => app().inject({ method: 'POST', url: '/v1/admin/sign-in', payload: { id: 'ed', password: pw } });

  before(async () => {
    password = await addAdmin(sql, { id: 'ed', name: 'Ed Stevenson' });
  });

  test('only a signed-in administrator gets in, and staff keys do not work', async () => {
    assert.equal((await app().inject({ url: '/v1/admin/setup' })).statusCode, 401);
    assert.equal((await app().inject({ url: '/v1/admin/setup', headers: auth(keys.sam) })).statusCode, 401);
    assert.equal((await signIn('wrong')).statusCode, 401);
    const ok = await signIn();
    assert.equal(ok.statusCode, 200);
    const setup = await app().inject({ url: '/v1/admin/setup', headers: auth(ok.json().token) });
    assert.equal(setup.statusCode, 200);
    assert.equal(setup.json().me.name, 'Ed Stevenson');
    assert.ok(setup.json().staff.some((s: { id: string }) => s.id === 'maya'));
    // Administrators set things up; they never see alerts.
    assert.doesNotMatch(setup.body, /evidence|trigger/);
    assert.equal((await app().inject({ url: '/v1/console/alerts', headers: auth(ok.json().token) })).statusCode, 401);
  });

  test('sessions expire and sign-out ends them', async () => {
    const { token } = (await signIn()).json();
    clock = new Date(clock.getTime() + 9 * 3600_000);
    assert.equal((await app().inject({ url: '/v1/admin/setup', headers: auth(token) })).statusCode, 401);
    const t2 = (await signIn()).json().token;
    assert.equal((await app().inject({ method: 'POST', url: '/v1/admin/sign-out', headers: auth(t2), payload: {} })).statusCode, 200);
    assert.equal((await app().inject({ url: '/v1/admin/setup', headers: auth(t2) })).statusCode, 401);
  });

  test('five wrong passwords lock the name for a while', async () => {
    const lockAuth = new AdminAuth(sql, () => clock);
    const a = buildApp({ sql, alerts, model: null, adminAuth: lockAuth });
    const tryPw = (pw: string) => a.inject({ method: 'POST', url: '/v1/admin/sign-in', payload: { id: 'ed', password: pw } });
    for (let i = 0; i < 5; i++) assert.equal((await tryPw('nope')).statusCode, 401);
    assert.equal((await tryPw(password)).statusCode, 409);
    clock = new Date(clock.getTime() + 16 * 60_000);
    assert.equal((await tryPw(password)).statusCode, 200);
  });

  test('set up a home, its house manager and a resident; alerts then reach them', async () => {
    const t = (await signIn()).json().token;
    const post = (url: string, payload: object, method: 'POST' | 'PATCH' = 'POST') => app().inject({ method, url, headers: auth(t), payload });

    const hm = await post('/v1/admin/staff', { id: 'hal', name: 'Hal Moore', phone: '+15095550120', role: 'house_manager' });
    assert.equal(hm.statusCode, 200);
    const halKey = hm.json().key;
    assert.equal((await app().inject({ url: '/v1/console/me', headers: auth(halKey) })).json().name, 'Hal Moore');
    assert.equal((await post('/v1/admin/staff', { id: 'hal', name: 'Again', phone: '+15095550120', role: 'counselor' })).statusCode, 409);
    assert.equal((await post('/v1/admin/staff', { id: 'x', name: 'Bad', phone: '555', role: 'counselor' })).statusCode, 409);
    assert.equal((await post('/v1/admin/staff', { id: 'bad', name: 'Bad', phone: '+15095550121', role: 'janitor' })).statusCode, 400);

    // A counselor can't be a house manager.
    assert.equal((await post('/v1/admin/homes', { id: 'oak', name: 'Oak House', houseManagerId: 'maya' })).statusCode, 409);
    assert.equal((await post('/v1/admin/homes', { id: 'oak', name: 'Oak House', houseManagerId: 'hal' })).statusCode, 200);

    const p = await post('/v1/admin/people', { id: 'casey', name: 'Casey', counselorId: 'maya', homeId: 'oak' });
    assert.equal(p.statusCode, 200);
    const caseyKey = p.json().key;
    assert.equal((await post('/v1/admin/people', { id: 'kai', name: 'Kai', counselorId: 'hal' })).statusCode, 409);

    // Withdrawal in a Life Works Home reaches the house manager.
    const sent = await app().inject({ method: 'POST', url: '/v1/alerts', headers: auth(caseyKey), payload: event({ id: 'casey-1' }) });
    assert.equal(sent.statusCode, 200);
    assert.ok(sms.sent.some((m) => m.to === '+15095550120'));

    // Hal can't be switched off or change role while he runs Oak House.
    assert.equal((await post('/v1/admin/staff/hal/active', { active: false })).statusCode, 409);
    assert.equal((await post('/v1/admin/staff/hal', { role: 'case_manager' }, 'PATCH')).statusCode, 409);
    assert.equal((await post('/v1/admin/homes/oak', { houseManagerId: null }, 'PATCH')).statusCode, 200);
    assert.equal((await post('/v1/admin/staff/hal/active', { active: false })).statusCode, 200);
    // Switched off: no sign-in, not counted in the role.
    assert.equal((await app().inject({ url: '/v1/console/me', headers: auth(halKey) })).statusCode, 401);
    const routing = (await app().inject({ url: '/v1/admin/setup', headers: auth(t) })).json().routing;
    assert.deepEqual(routing.roles.find((r: { role: string }) => r.role === 'house_manager').people, ['Dee Park']);
    assert.equal((await post('/v1/admin/homes/oak', { houseManagerId: 'hal' }, 'PATCH')).statusCode, 409);

    // A new phone key replaces the old one.
    const nk = await post('/v1/admin/people/casey/new-key', {});
    assert.equal((await app().inject({ method: 'POST', url: '/v1/alerts', headers: auth(caseyKey), payload: event({ id: 'casey-2' }) })).statusCode, 401);
    assert.equal((await app().inject({ method: 'POST', url: '/v1/alerts', headers: auth(nk.json().key), payload: event({ id: 'casey-3' }) })).statusCode, 200);

    // Moving Casey to Ana and out of the home.
    assert.equal((await post('/v1/admin/people/casey', { counselorId: 'ana', homeId: null }, 'PATCH')).statusCode, 200);
    const casey = (await sql.query<any>('select counselor_id, home_id from person where id = $1', ['casey'])).rows[0];
    assert.deepEqual(casey, { counselor_id: 'ana', home_id: null });
  });

  test('every change is in the change log, without keys, passwords or phone numbers, and the log cannot be edited', async () => {
    const t = (await signIn()).json().token;
    await app().inject({ method: 'PATCH', url: '/v1/admin/staff/dee', headers: auth(t), payload: { phone: '+15095550199' } });
    const { entries } = (await app().inject({ url: '/v1/admin/audit', headers: auth(t) })).json();
    const actions = entries.map((e: { action: string }) => e.action);
    for (const a of ['sign_in', 'sign_in.failed', 'sign_in.locked', 'staff.added', 'home.added', 'person.added', 'staff.switched_off', 'person.new_key', 'person.updated', 'staff.updated'])
      assert.ok(actions.includes(a), a);
    const dee = entries.find((e: { action: string; target: string }) => e.action === 'staff.updated' && e.target === 'staff:dee');
    assert.deepEqual(dee.detail, { phone: 'changed' });
    const raw = JSON.stringify((await sql.query('select * from admin_audit')).rows);
    assert.doesNotMatch(raw, new RegExp(password));
    assert.doesNotMatch(raw, /5550199|5550120/);
    await assert.rejects(sql.query('delete from admin_audit'), /append-only/);
    await assert.rejects(sql.query("update admin_audit set action = 'x'"), /append-only/);
  });

  test('admin page is served with a strict policy', async () => {
    const r = await app().inject({ url: '/admin' });
    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-security-policy'] as string, /default-src 'none'/);
    assert.doesNotMatch(r.body, /innerHTML/);
  });
});
