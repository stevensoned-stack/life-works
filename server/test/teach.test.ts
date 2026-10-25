import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { Alerts } from '../src/alerts';
import { buildApp } from '../src/app';
import { addPerson, addStaff } from '../src/auth';
import { connectMemory, migrate, Sql } from '../src/db';
import { LogSender } from '../src/sms';
import { DEFAULT_HOURS } from '../src/routing';

describe('Teach Zoey', () => {
  let sql: Sql;
  let staffKey: string;
  let phoneKey: string;
  let app: ReturnType<typeof buildApp>;
  const auth = (k: string) => ({ authorization: `Bearer ${k}` });

  before(async () => {
    sql = await connectMemory();
    await migrate(sql);
    staffKey = await addStaff(sql, { id: 'maya', name: 'Maya Torres', phone: '+15095550100', role: 'counselor' });
    phoneKey = await addPerson(sql, { id: 'jordan', displayName: 'Jordan', counselorId: 'maya' });
    app = buildApp({ sql, alerts: new Alerts(sql, new LogSender(), { hours: DEFAULT_HOURS, escalateAfterMin: 15 }), model: null });
  });
  after(async () => {
    await app.close();
    await sql.close();
  });

  const send = (phrase: string, picked?: string) =>
    app.inject({ method: 'POST', url: '/v1/zoey/missed', headers: auth(phoneKey), payload: { phrase, ...(picked ? { picked } : {}) } });
  const missed = async () => (await app.inject({ url: '/v1/teach/missed', headers: auth(staffKey) })).json().missed;

  test('only phones send, only staff read', async () => {
    assert.equal((await app.inject({ method: 'POST', url: '/v1/zoey/missed', payload: { phrase: 'hi' } })).statusCode, 401);
    assert.equal((await app.inject({ url: '/v1/teach/missed', headers: auth(phoneKey) })).statusCode, 401);
    assert.equal((await app.inject({ url: '/v1/zoey/taught', headers: auth(staffKey) })).statusCode, 401);
  });

  test('sayings are counted with what residents said they meant, and no one is named', async () => {
    assert.equal((await send('whats a sponsr')).statusCode, 200);
    await send('whats a sponsr');
    await send('whats a sponsr', 'sponsor-find');
    const [m] = await missed();
    assert.equal(m.shown, 'whats a sponsr');
    assert.equal(m.times, 2);
    assert.deepEqual(m.picks, { 'sponsor-find': 1 });
    const cols = (await sql.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'zoey_missed'")).rows.map((r) => r.column_name);
    assert.ok(!cols.some((c) => /person|device|staff_id|ip/.test(c) && c !== 'handled_by'), cols.join());
  });

  test('danger, medicine, names, numbers and long messages are refused', async () => {
    for (const p of ['i want to die', 'can i take more suboxone', 'Call Jim at 555 1234', 'i miss Jim', 'one two three four five six seven eight nine ten eleven twelve thirteen']) {
      assert.equal((await send(p)).statusCode, 400, p);
    }
    // The scrubbed version is fine.
    assert.equal((await send('i miss [name]')).statusCode, 200);
  });

  test('staff teach a saying and every phone gets it', async () => {
    const m = (await missed()).find((x: { shown: string }) => x.shown === 'whats a sponsr');
    const r = await app.inject({ method: 'POST', url: `/v1/teach/missed/${m.id}/teach`, headers: auth(staffKey), payload: { answer: 'sponsor-find' } });
    assert.equal(r.statusCode, 200);
    const t = (await app.inject({ url: '/v1/zoey/taught', headers: auth(phoneKey) })).json();
    assert.deepEqual(t.phrases, [{ said: 'whats a sponsr', answer: 'sponsor-find' }]);
    assert.ok(!(await missed()).some((x: { shown: string }) => x.shown === 'whats a sponsr'));
    // Sending it again after it's taught doesn't put it back on the list.
    await send('whats a sponsr');
    assert.ok(!(await missed()).some((x: { shown: string }) => x.shown === 'whats a sponsr'));
  });

  test('a new answer must pass the reply rules, and can be undone', async () => {
    await send('that hits different');
    const m = (await missed()).find((x: { shown: string }) => x.shown === 'that hits different');
    const bad = await app.inject({
      method: 'POST',
      url: `/v1/teach/missed/${m.id}/teach`,
      headers: auth(staffKey),
      payload: { q: 'What does "hits different" mean?', text: 'Call 509-555-0199 and take 20 mg.' },
    });
    assert.equal(bad.statusCode, 409);
    const ok = await app.inject({
      method: 'POST',
      url: `/v1/teach/missed/${m.id}/teach`,
      headers: auth(staffKey),
      payload: { q: 'What does "hits different" mean?', text: 'It means something feels special or stronger than usual. What hit different for you?' },
    });
    assert.equal(ok.statusCode, 200);
    let t = (await app.inject({ url: '/v1/zoey/taught', headers: auth(phoneKey) })).json();
    assert.equal(t.answers.length, 1);
    assert.equal(t.phrases.find((p: { said: string }) => p.said === 'that hits different').answer, t.answers[0].id);
    const row = (await app.inject({ url: '/v1/teach/taught', headers: auth(staffKey) })).json().taught.find((x: { saying: string }) => x.saying === 'that hits different');
    assert.equal(row.taught_by, 'maya');
    await app.inject({ method: 'POST', url: `/v1/teach/taught/${row.id}/undo`, headers: auth(staffKey), payload: {} });
    t = (await app.inject({ url: '/v1/zoey/taught', headers: auth(phoneKey) })).json();
    assert.equal(t.answers.length, 0);
    assert.ok((await missed()).some((x: { shown: string }) => x.shown === 'that hits different'));
  });

  test('the Teach Zoey page is served with the same locked-down headers', async () => {
    const r = await app.inject({ url: '/teach' });
    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-security-policy'] as string, /default-src 'none'/);
    assert.ok(!r.body.includes('innerHTML'));
  });
});
