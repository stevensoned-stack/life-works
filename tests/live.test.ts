// Run with: npm test
// Zoey's live AI answers from the phone's side: what is sent, what is shown.
import assert from 'node:assert/strict';
import { liveReply, liveStatus } from '../src/zoey/live';
import { asksAboutToday, checkLiveReply, cleanRequest, LiveRequest, scrub } from '../src/zoey/liveRules';

let passed = 0;
const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const cfg = { url: 'https://api.example', deviceKey: 'k' };
const req = (over: Partial<LiveRequest> = {}): LiveRequest => ({
  message: 'what should I do this weekend?',
  history: [],
  context: { firstName: 'Jordan Smith', cleanDays: 42, coordinatorName: 'Maya Torres', hasSponsor: true, today: [{ time: '18:00', label: 'NA meeting' }] },
  ...over,
});
const fakeFetch = (body: unknown, calls: { url: string; body: any }[] = [], status = 200) =>
  (async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : null });
    return { ok: status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;

test('personal details are taken out', () => {
  const s = scrub('call me at (509) 555-0134 or jo@mail.com, I live at 1234 N Monroe St apt 5 99201, see www.x.com', []);
  assert.ok(!/555|jo@|Monroe|99201|www/.test(s), s);
  assert.match(s, /\[phone\].*\[email\].*\[address\]/);
  assert.equal(scrub('Jim Parker hates me', ['Jim Parker']), 'Jim hates me');
  assert.equal(scrub('I have 120 days and 3 kids'), 'I have 120 days and 3 kids');
});

test('only first names, clean days, and today only when asked', () => {
  const c = cleanRequest(req());
  assert.deepEqual(c.context, { firstName: 'Jordan', cleanDays: 42, coordinatorName: 'Maya', hasSponsor: true });
  const t = cleanRequest(req({ message: 'what do I have today?' }));
  assert.deepEqual(t.context.today, [{ time: '18:00', label: 'NA meeting' }]);
  assert.ok(asksAboutToday("what's my schedule"));
  assert.ok(!asksAboutToday('I feel bored'));
});

test('history is trimmed and scrubbed', () => {
  const history = Array.from({ length: 30 }, (_, i) => ({ from: (i % 2 ? 'zoey' : 'me') as 'me' | 'zoey', text: `msg ${i} 509-555-0100` }));
  const c = cleanRequest(req({ history }));
  assert.equal(c.history.length, 12);
  assert.ok(c.history.every((t) => !t.text.includes('555')));
});

test('model replies that break the rules are refused', () => {
  assert.ok(checkLiveReply('That sounds like a lot. What would make tonight a little easier?').ok);
  assert.ok(checkLiveReply('Wow, 120 days! That is huge. How are you celebrating?').ok);
  for (const bad of [
    'Please call 988 if you feel unsafe.',
    'You can reach the crisis line any time.',
    'It sounds like you have depression.',
    'Try taking 50 mg less.',
    'Call me at 509-555-0100.',
    'As your counselor, I think you should go.',
    'Check out https://example.com',
    'I want to kill myself too sometimes.',
    'x'.repeat(700),
    '',
  ])
    assert.equal(checkLiveReply(bad).ok, false, bad);
});

test('off without a server, and the server decides', async () => {
  assert.equal(await liveStatus(null), false);
  assert.equal(await liveStatus(cfg, fakeFetch({ live: true })), true);
  assert.equal(await liveStatus(cfg, fakeFetch({ live: false })), false);
  assert.equal(await liveStatus(cfg, fakeFetch({}, [], 500)), false);
  assert.equal(await liveReply(null, req(), []), null);
});

test('a good reply is shown; sends the scrubbed request', async () => {
  const calls: { url: string; body: any }[] = [];
  const text = await liveReply(cfg, req({ message: 'Jim Parker said call 509-555-0100' }), ['Jim Parker'], fakeFetch({ text: ' Sounds fun! ' }, calls));
  assert.equal(text, 'Sounds fun!');
  assert.equal(calls[0].url, 'https://api.example/v1/zoey/chat');
  assert.equal(calls[0].body.message, 'Jim said call [phone]');
  assert.equal(calls[0].body.context.firstName, 'Jordan');
});

test('any problem falls back to authored answers (null)', async () => {
  assert.equal(await liveReply(cfg, req(), [], fakeFetch({ text: null })), null);
  assert.equal(await liveReply(cfg, req(), [], fakeFetch({ text: 'Call 988 now.' })), null);
  assert.equal(await liveReply(cfg, req(), [], fakeFetch({}, [], 503)), null);
  const offline = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.equal(await liveReply(cfg, req(), [], offline), null);
  const slow = ((_: string, init: RequestInit) =>
    new Promise((_r, reject) => init.signal!.addEventListener('abort', () => reject(new Error('aborted'))))) as unknown as typeof fetch;
  assert.equal(await liveReply(cfg, req(), [], slow, 20), null);
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      passed++;
    } catch (e) {
      console.error(`FAIL ${name}`);
      throw e;
    }
  }
  console.log(`live: ${passed} passed`);
})();
