// Run with: npm test
// Checks what Chat sends to the server and how replies land on the phone.
import assert from 'node:assert/strict';
import { conversationKey, mergeIncoming, pending, personForKey, pushMessages, ServerMessage, unreadFrom } from '../src/chat/sync';
import { seedPeople } from '../src/data/seed';
import { ChatMessage } from '../src/data/types';

let passed = 0;
const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const people = seedPeople();
const cfg = { url: 'https://api.example', deviceKey: 'k' };
const mine = (id: string, over: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  with: 'maya',
  from: 'me',
  text: `hello ${id}`,
  at: `2026-10-21T19:0${id.length}:00.000Z`,
  status: 'sending',
  ...over,
});
const fakeFetch = (statuses: number[], calls: { url: string; body: any }[]) =>
  (async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    const status = statuses.shift() ?? 200;
    if (status === 0) throw new Error('offline');
    return new Response(JSON.stringify({ id: String(calls.length) }), { status });
  }) as unknown as typeof fetch;
const srv = (id: string, over: Partial<ServerMessage> = {}): ServerMessage => ({
  id,
  clientId: null,
  conversation: 'coordinator',
  direction: 'in',
  author: 'Maya Torres',
  body: `reply ${id}`,
  at: '2026-10-21T19:10:00.000Z',
  ...over,
});

test('the coordinator is the counselor conversation; everyone else by their LifeCircle id', () => {
  assert.equal(conversationKey(people.find((p) => p.id === 'maya')!), 'coordinator');
  assert.equal(conversationKey(people.find((p) => p.id === 'kayla')!), 'kayla');
  assert.equal(personForKey(people, 'coordinator')!.id, 'maya');
  assert.equal(personForKey(people, 'nobody'), undefined);
});

test('sends waiting messages oldest first, with the number to text', async () => {
  const calls: { url: string; body: any }[] = [];
  const msgs = [mine('bb', { with: 'kayla' }), mine('a'), mine('sent', { status: 'sent' }), mine('x', { from: 'them', status: 'received' })];
  const done = await pushMessages(cfg, msgs, people, fakeFetch([200, 200], calls));
  assert.deepEqual(done.map((d) => [d.id, d.status]), [['a', 'sent'], ['bb', 'sent']]);
  assert.equal(calls[0].url, 'https://api.example/v1/messages');
  assert.deepEqual(calls[0].body.to, { id: 'coordinator', name: 'Maya Torres', phone: '+15095550142' });
  assert.deepEqual(calls[1].body.to, { id: 'kayla', name: 'Kayla', phone: '+15095550174' });
  assert.equal(done[0].serverId, '1');
});

test('a refused message fails on its own; a network failure stops the run to retry later', async () => {
  const calls: { url: string; body: any }[] = [];
  const done = await pushMessages(cfg, [mine('a'), mine('bb'), mine('ccc')], people, fakeFetch([400, 0], calls));
  assert.deepEqual(done.map((d) => [d.id, d.status]), [['a', 'failed']]);
  assert.equal(pending([mine('a'), mine('b', { status: 'failed' })]).length, 1);
  const gone = await pushMessages(cfg, [mine('a', { with: 'removed' })], people, fakeFetch([], []));
  assert.deepEqual(gone, [{ id: 'a', status: 'failed' }]);
});

test('replies are added once, unread, and the cursor moves on', () => {
  const r = mergeIncoming([], people, [srv('5'), srv('7', { conversation: 'kayla', author: 'sms', body: 'Lunch?' })], '0');
  assert.equal(r.cursor, '7');
  assert.deepEqual(r.added.map((m) => [m.with, m.from, m.text, m.read, m.author]), [
    ['maya', 'them', 'reply 5', false, undefined],
    ['kayla', 'them', 'Lunch?', false, undefined],
  ]);
  const again = mergeIncoming(r.added, people, [srv('5')], r.cursor);
  assert.deepEqual(again.added, []);
  assert.equal(unreadFrom(r.added), 2);
  assert.equal(unreadFrom(r.added, 'kayla'), 1);
});

test("a covering counselor's name shows; my own messages are matched, not duplicated", () => {
  const local = [mine('abc', { status: 'sending' })];
  const r = mergeIncoming(local, people, [srv('3', { direction: 'out', clientId: 'abc', author: 'person' }), srv('4', { author: 'Sam Lee' })], '2');
  assert.deepEqual(r.added.map((m) => [m.text, m.author]), [['reply 4', 'Sam Lee']]);
  // From another phone: kept as mine and already sent.
  const other = mergeIncoming([], people, [srv('9', { direction: 'out', clientId: 'zzz', author: 'person', body: 'hi' })], '0');
  assert.deepEqual(other.added.map((m) => [m.id, m.from, m.status]), [['zzz', 'me', 'sent']]);
});

test('conversations with people no longer in LifeCircle are skipped', () => {
  const r = mergeIncoming([], people, [srv('11', { conversation: 'gone' })], '10');
  assert.deepEqual(r.added, []);
  assert.equal(r.cursor, '11');
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
    } catch (e) {
      console.error(`FAIL ${name}\n`, e);
      process.exitCode = 1;
    }
  }
  console.log(`chat: ${passed} passed`);
})();
