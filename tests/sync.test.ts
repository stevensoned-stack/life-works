// Run with: npm test
// Checks which safety events the phone sends to the server, and what it sends.
import assert from 'node:assert/strict';
import { SafetyEvent } from '../src/data/types';
import { outbox, syncVersion } from '../src/safety/events';
import { payload, pushAlerts } from '../src/safety/sync';

let passed = 0;
const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const ev = (id: string, over: Partial<SafetyEvent> = {}): SafetyEvent => ({
  id,
  at: `2026-10-21T19:0${id.length}:00.000Z`,
  screen: 'ask',
  tier: 2,
  kind: 'urgent',
  variant: 'withdrawal',
  matched: 'shaking',
  message: 'shaking bad',
  context: [],
  shown: 'reply',
  taken: [],
  alert: { to: 'Maya', status: 'queued', queuedAt: '2026-10-21T19:00:00.000Z' },
  ...over,
});
const cfg = { url: 'https://api.example', deviceKey: 'k' };
const fakeFetch = (statuses: number[], calls: { url: string; body: any; auth: string }[]) =>
  (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: (init.headers as Record<string, string>).Authorization });
    const status = statuses.shift() ?? 200;
    if (status === 0) throw new Error('offline');
    return new Response('{}', { status });
  }) as unknown as typeof fetch;

test('events the person chose not to share never leave the phone', () => {
  const hidden = ev('a', { alert: { to: 'Maya', status: 'not_shared', queuedAt: '' } });
  assert.deepEqual(outbox([hidden, ev('b')]).map((e) => e.id), ['b']);
});

test('a synced event is sent again only when it changes', () => {
  const e = ev('a');
  const synced = { ...e, alert: { ...e.alert, syncedVersion: syncVersion(e) } };
  assert.deepEqual(outbox([synced]), []);
  assert.equal(outbox([{ ...synced, taken: [{ label: 'Called 988', at: 'x' }] }]).length, 1);
  assert.equal(outbox([{ ...synced, tier: 3 }]).length, 1);
  assert.equal(outbox([{ ...e, alert: { ...e.alert, status: 'texted' } }]).length, 1); // texting from the phone doesn't replace the server copy
});

test('the payload leaves out local delivery and review fields', () => {
  const p = payload(ev('a', { review: { by: 'Maya', at: 'x', note: 'n' } }));
  assert.equal('alert' in p, false);
  assert.equal('review' in p, false);
  assert.equal(p.message, 'shaking bad');
});

test('sends oldest first with the device key', async () => {
  const calls: any[] = [];
  const done = await pushAlerts(cfg, [ev('bb'), ev('a')], fakeFetch([], calls));
  assert.deepEqual(calls.map((c) => c.body.id), ['a', 'bb']);
  assert.equal(calls[0].url, 'https://api.example/v1/alerts');
  assert.equal(calls[0].auth, 'Bearer k');
  assert.deepEqual(done, [{ id: 'a', version: '2:0' }, { id: 'bb', version: '2:0' }]);
});

test('stops when offline or the server fails, skips one it refused', async () => {
  assert.deepEqual(await pushAlerts(cfg, [ev('a'), ev('bb')], fakeFetch([0], [])), []);
  assert.deepEqual(await pushAlerts(cfg, [ev('a'), ev('bb')], fakeFetch([200, 503], [])), [{ id: 'a', version: '2:0' }]);
  assert.deepEqual(await pushAlerts(cfg, [ev('a'), ev('bb')], fakeFetch([400, 200], [])), [{ id: 'bb', version: '2:0' }]);
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
    } catch (e) {
      console.error(`FAIL ${name}\n  ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
  console.log(`sync: ${passed} passed`);
})();
