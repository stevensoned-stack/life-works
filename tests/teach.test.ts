// Run with: npm test
// Teaching Zoey sayings she didn't understand (src/zoey/teach.ts): her guesses,
// the scrub before anything leaves the phone, and what the team taught.
import assert from 'node:assert/strict';
import { ANSWERS, AnswerContext } from '../src/zoey/answers';
import { ask } from '../src/zoey/ask';
import { emptyLearned, learnPick } from '../src/zoey/learn';
import { emptyTaught, guesses, missedFor, sayingKey, scrubPhrase, Taught, teachLine, thanksLine } from '../src/zoey/teach';
import { fetchTaught, pushMissed } from '../src/zoey/teachSync';
import { seedState } from '../src/data/seed';

const ctx: AnswerContext = {
  name: 'Jordan',
  coordinatorName: 'Maya',
  sponsorName: 'Marcus',
  cleanDays: 78,
  cleanDate: 'August 7, 2026',
  nextMilestone: '90 days',
  daysToNext: 12,
  nextEvent: null,
  meetingsThisWeek: 1,
};

let passed = 0;
const pending: Promise<void>[] = [];
const test = (name: string, fn: () => void | Promise<void>) => {
  const fail = (e: unknown) => {
    console.error(`FAIL ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  };
  try {
    const r = fn();
    if (r instanceof Promise) pending.push(r.then(() => void passed++, fail));
    else passed++;
  } catch (e) {
    fail(e);
  }
};
const idOf = (q: string, taught: Taught | null = null) => {
  const r = ask(q, ctx, { learned: emptyLearned(), taught });
  return r.kind === 'answer' ? r.answer.id : r.kind;
};

// --- Her guesses -------------------------------------------------------------

test('a miss gets close guesses, typos included', () => {
  assert.equal(idOf('who can be my spnsr'), 'fallback');
  const ids = guesses('who can be my spnsr', ANSWERS).map((a) => a.id);
  assert.ok(ids.some((id) => id.startsWith('sponsor')), ids.join());
  assert.ok(guesses('where r the meetins at', ANSWERS).some((a) => a.id.startsWith('meeting')));
  assert.ok(guesses('who what when', ANSWERS).length <= 3);
  assert.deepEqual(guesses('?', ANSWERS), []);
});

test('she says what she does not know, and thanks them after', () => {
  assert.match(teachLine('that hits different', true), /I’m still learning, and I don’t know “that hits different” yet\. Did you mean one of these\?/);
  assert.match(teachLine('this is a much longer thing that i said to her just now', false), /don’t know that yet\. Can you say it another way\?/);
  assert.equal(thanksLine('spnsr'), 'Thanks for teaching me! Next time I’ll know what “spnsr” means.');
});

test('their pick is remembered for next time', () => {
  const l = learnPick(emptyLearned(), 'that hits different', 'meeting-find');
  assert.equal(ask('that hits different', ctx, { learned: l }).kind, 'answer');
});

// --- The scrub ----------------------------------------------------------------

test('names, numbers and links come out; long messages stay on the phone', () => {
  assert.equal(scrubPhrase('Can Jim come to group', []), 'can [name] come to group');
  assert.equal(scrubPhrase('can jim come to group', ['Jim Boyd']), 'can [name] come to group');
  assert.equal(scrubPhrase('call me at 509-555-0100', []), 'call me at #');
  assert.equal(scrubPhrase('see www.example.com', []), 'see [link]');
  assert.equal(scrubPhrase('I go to AA on Monday', []), 'i go to aa on monday');
  assert.equal(scrubPhrase('a b c d e f g h i j k l m n', []), null);
});

test('danger and medicine never leave the phone', () => {
  for (const t of ['i want to die', 'im gonna kill myself', 'he hit me', 'i overdosed', 'can i take more suboxone', 'how many mg of xanax']) {
    assert.equal(scrubPhrase(t, []), null, t);
    assert.equal(missedFor(t, [], null, 'x'), null, t);
  }
});

test('with sharing off nothing is queued, and turning it off drops the queue', () => {
  const s = seedState();
  assert.equal(s.settings.shareMissed, false);
  assert.deepEqual(s.missedOutbox, []);
  assert.deepEqual(s.taught, emptyTaught());
});

// --- What the team taught ------------------------------------------------------

const taught: Taught = {
  phrases: [
    { said: sayingKey('that hits different'), answer: 'taught-1' },
    { said: sayingKey('whats a sponsr'), answer: 'sponsor-find' },
  ],
  answers: [{ id: 'taught-1', q: 'What does “hits different” mean?', text: 'It means something feels special. What hit different for you?' }],
  at: '2026-10-25',
};

test('a taught saying and a team-written answer work on every phone', () => {
  assert.equal(idOf('whats a sponsr'), 'fallback');
  assert.equal(idOf('whats a sponsr', taught), 'sponsor-find');
  const r = ask('that hits different', ctx, { learned: emptyLearned(), taught });
  assert.equal(r.kind, 'answer');
  assert.match(r.kind === 'answer' ? r.text : '', /feels special/);
});

test('a person’s own meaning beats the team’s for the same saying', () => {
  const l = learnPick(emptyLearned(), 'whats a sponsr', 'sponsor-what');
  assert.equal(ask('whats a sponsr', ctx, { learned: l, taught }).kind === 'answer' && ask('whats a sponsr', ctx, { learned: l, taught }).answer.id, 'sponsor-what');
});

test('nothing taught can route danger or medicine away from safety', () => {
  const bad: Taught = {
    phrases: [
      { said: 'i want to die', answer: 'taught-1' },
      { said: 'can i take more suboxone', answer: 'taught-1' },
      { said: 'kill myself', answer: 'craving-now' },
    ],
    answers: taught.answers,
    at: null,
  };
  assert.equal(ask('i want to die', ctx, { learned: emptyLearned(), taught: bad }).kind, 'crisis');
  assert.equal(ask('I want to kill myself', ctx, { learned: emptyLearned(), taught: bad }).kind, 'crisis');
  assert.equal(ask('can i take more suboxone', ctx, { learned: emptyLearned(), taught: bad }).kind, 'medication');
});

// --- Sending and fetching -------------------------------------------------------

const cfg = { url: 'https://lw.test', deviceKey: 'k' };

test('sends each saying, keeps the rest when the server is down', async () => {
  const sent: string[] = [];
  let calls = 0;
  const f = (async (_url: string, init: RequestInit) => {
    calls++;
    if (calls === 3) throw new Error('offline');
    sent.push(String(init.body));
    return new Response('{}', { status: calls === 2 ? 400 : 200 });
  }) as typeof fetch;
  const items = ['a', 'b', 'c', 'd'].map((id) => ({ id, phrase: `say ${id}`, picked: id === 'a' ? 'sponsor-find' : null, at: '' }));
  assert.deepEqual(await pushMissed(cfg, items, f), ['a', 'b']);
  assert.deepEqual(JSON.parse(sent[0]), { phrase: 'say a', picked: 'sponsor-find' });
  assert.deepEqual(JSON.parse(sent[1]), { phrase: 'say b' });
});

test('fetches what was taught, and ignores a bad reply', async () => {
  const ok = (async () => new Response(JSON.stringify(taught), { status: 200 })) as unknown as typeof fetch;
  assert.deepEqual(await fetchTaught(cfg, ok), taught);
  const junk = (async () => new Response('{"nope":1}', { status: 200 })) as unknown as typeof fetch;
  assert.equal(await fetchTaught(cfg, junk), null);
  const down = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.equal(await fetchTaught(cfg, down), null);
});

Promise.all(pending).then(() => console.log(`teach: ${passed} passed`));
