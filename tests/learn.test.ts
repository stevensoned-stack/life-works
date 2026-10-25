// Run with: npm test
// Zoey learning how each person talks (src/zoey/learn.ts): what she learns,
// that she uses it, and that safety and medicine are never changed by it.
import assert from 'node:assert/strict';
import { ANSWERS, AnswerContext } from '../src/zoey/answers';
import { ask } from '../src/zoey/ask';
import { buildContext } from '../src/zoey/context';
import { greetLine } from '../src/zoey/greet';
import {
  boost,
  canLearn,
  countTopic,
  emptyLearned,
  expand,
  findNickname,
  findReplyPref,
  forget,
  helloBack,
  isEmpty,
  Learned,
  learnPick,
  learnRephrase,
  observe,
  replyStyle,
  screenHeard,
  setNickname,
  SHORTHAND,
  shorten,
  summaryForLive,
  wordSwap,
} from '../src/zoey/learn';
import { screen } from '../src/zoey/safety';
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
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};
const idOf = (q: string, learned: Learned | null) => {
  const r = ask(q, ctx, { learned });
  return r.kind === 'answer' ? r.answer.id : r.kind;
};
const L0 = emptyLearned();

// --- Learning from a miss and a rephrase -------------------------------------

test('a miss then a rephrase teaches her their spelling', () => {
  assert.equal(idOf('how do i get a spnsr', L0), 'fallback');
  const worked = idOf('how do i get a sponsor', L0);
  assert.notEqual(worked, 'fallback');
  const l = learnRephrase(L0, 'how do i get a spnsr', 'how do i get a sponsor', worked);
  assert.deepEqual(l.words.map((w) => [w.said, w.means]), [['spnsr', 'sponsor']]);
  // A new question with their spelling now works.
  assert.equal(idOf('is it hard to find a spnsr', l), idOf('is it hard to find a sponsor', L0));
  // And the exact first way of asking goes straight to the answer.
  assert.equal(idOf('how do i get a spnsr', l), worked);
});

test('wordSwap finds the one word that changed, and only that', () => {
  assert.deepEqual(wordSwap('when do i see my parol officer', 'when do i see my parole officer'), { said: 'parol', means: 'parole' });
  assert.deepEqual(wordSwap('when do i see my po', 'when do i see my probation officer'), { said: 'po', means: 'probation officer' });
  assert.equal(wordSwap('when do i see my parol guy', 'when do i see my parole officer'), null, 'two words changed');
  assert.deepEqual(wordSwap('i need a mtng', 'i need a meeting'), { said: 'mtng', means: 'meeting' });
  assert.equal(wordSwap('where is my coffee', 'how do i find a sponsor'), null);
  assert.equal(wordSwap('hi', 'hello'), null);
});

test('a tap on "You might also ask" teaches her that way of asking', () => {
  const q = 'the coffee thing on thursdays';
  assert.equal(idOf(q, L0), 'fallback');
  const meeting = ANSWERS.find((a) => a.id === 'meeting-find')!;
  const l = learnPick(L0, q, meeting.id);
  assert.equal(idOf(q, l), 'meeting-find');
  // Close enough wording works too.
  assert.equal(idOf('the coffee thing on thursday', l), 'meeting-find');
  // With learning off (no profile passed) it's a miss again.
  assert.equal(idOf(q, null), 'fallback');
});

test('common shorthand helps from day one, without changing any library answer', () => {
  assert.equal(idOf('wat time is the mtg', L0), 'meeting-find');
  for (const a of ANSWERS) {
    for (const k of [a.q, ...a.keys]) assert.equal(idOf(k, L0), idOf(k, null), k);
  }
});

test('the questions they ask most win a close tie, and only a tie', () => {
  let l = L0;
  for (let i = 0; i < 4; i++) l = countTopic(l, 'court', 'court');
  assert.equal(boost('court', 'anything', l, false), 0);
  assert.equal(boost('court', 'anything', l, true), 1);
});

// --- Safety is never learned and never weakened ------------------------------

test('nothing is learned from danger words or medicine questions', () => {
  for (const t of ['I want to die', 'i want to kill myself', 'I overdosed', 'he hit me', 'can i take more suboxone', 'how many mg of gabapentin']) {
    assert.equal(canLearn(t), false, t);
    assert.deepEqual(learnPick(L0, t, 'craving-now'), L0, t);
    assert.deepEqual(observe(L0, t), L0, t);
  }
  // Nor a rephrase into or out of one.
  assert.deepEqual(learnRephrase(L0, 'i want to dye', 'i want to die', 'craving-now'), L0);
  assert.deepEqual(learnRephrase(L0, 'i want to zzz', 'i want to kill myself', 'craving-now'), L0);
});

test('a learned word or phrase can never route danger away from safety', () => {
  // Even planted straight into the profile, past the guard.
  const bad: Learned = {
    ...L0,
    words: [
      { said: 'die', means: 'dance', n: 9 },
      { said: 'myself', means: 'coffee', n: 9 },
      { said: 'suboxone', means: 'snacks', n: 9 },
    ],
    phrases: [
      { said: 'i want to die', answer: 'craving-now', n: 9 },
      { said: 'can i take more suboxone', answer: 'craving-now', n: 9 },
    ],
  };
  assert.equal(ask('i want to die', ctx, { learned: bad }).kind, 'crisis');
  assert.equal(ask('I want to kill myself', ctx, { learned: bad }).kind, 'crisis');
  assert.equal(screenHeard('i want to die', bad).kind, 'crisis');
  assert.equal(ask('can i take more suboxone', ctx, { learned: bad }).kind, 'medication');
});

test('swapping in their words can only add safety help', () => {
  const l: Learned = { ...L0, words: [{ said: 'zz', means: 'kill myself', n: 1 }] };
  assert.equal(screen('i want to zz').kind, 'none');
  assert.equal(screenHeard('i want to zz', l).kind, 'crisis');
  assert.equal(ask('i want to zz', ctx, { learned: l }).kind, 'crisis');
});

test('no shorthand means anything the safety screen or medicine check looks for', () => {
  for (const [said, means] of Object.entries(SHORTHAND)) {
    assert.equal(screen(means).kind, 'none', `${said} -> ${means}`);
    assert.ok(canLearn(means), `${said} -> ${means}`);
  }
  // Danger in shorthand still reaches the screen, which reads the original.
  assert.equal(screenHeard('i wanna kill myself rn', L0).kind, 'crisis');
});

// --- What they tell her -------------------------------------------------------

test('"call me J" sets a nickname; "call me back" does not', () => {
  assert.equal(findNickname('call me J'), 'J');
  assert.equal(findNickname('you can call me big mike'), 'Big Mike');
  assert.equal(findNickname('I go by Jojo'), 'Jojo');
  assert.equal(findNickname('my name is Jordan'), 'Jordan');
  assert.equal(findNickname('Zoey, call me Dre!'), 'Dre');
  for (const t of ['can you call me back', 'call me later', 'call me now', "I'm tired", 'im sad', 'call me stupid', 'call me crazy', 'call me', 'call me when you can']) {
    assert.equal(findNickname(t), null, t);
  }
});

test('the nickname is what Zoey calls them, while learning is on', () => {
  const s = seedState();
  const named = { ...s, learned: setNickname(s.learned, 'J') };
  assert.equal(buildContext(named).name, 'J');
  assert.equal(buildContext({ ...named, settings: { ...named.settings, zoeyLearns: false } }).name, s.profile.name);
});

test('short or long answers: asked for, or read from how they write', () => {
  assert.equal(findReplyPref('can you keep it short'), 'short');
  assert.equal(findReplyPref('thats too long'), 'short');
  assert.equal(findReplyPref('give me more detail please'), 'long');
  assert.equal(findReplyPref('i like long walks'), null);
  let l = L0;
  for (let i = 0; i < 9; i++) l = observe(l, 'ok cool');
  assert.equal(replyStyle(l), null, 'not before 10 messages');
  l = observe(l, 'yep');
  assert.equal(replyStyle(l), 'short');
  assert.equal(replyStyle({ ...l, replies: 'long' }), 'long');
});

test('shorten keeps the first two sentences and the rest behind "More"', () => {
  const long = ANSWERS.map((a) => (typeof a.text === 'function' ? a.text(ctx) : a.text)).find((t) => t.length > 260)!;
  const cut = shorten(long)!;
  assert.ok(cut.short.length < long.length);
  assert.equal(`${cut.short} ${cut.rest}`.replace(/\s+/g, ' '), long.replace(/\s+/g, ' '));
  assert.equal(shorten('Short and sweet.'), null);
});

test('their usual hello is said back', () => {
  let l = observe(L0, 'hey');
  assert.equal(helloBack(l), null, 'once is not a habit');
  l = observe(l, 'hey zoey');
  assert.equal(helloBack(l), 'Hey');
  assert.equal(greetLine({ now: new Date(2026, 9, 25, 9), name: 'Jordan', asked: false, hello: 'Hey' }, () => 0), 'Hey Jordan, good morning! How are you this morning?');
});

test('people they mention: "my mom", "my brother Jim", and LifeCircle names', () => {
  let l = observe(L0, 'my mom called me today');
  l = observe(l, 'going to see my brother Jim later');
  l = observe(l, 'Marcus said to call him');
  l = observe(l, 'my mom is coming over');
  const who = Object.fromEntries(l.people.map((p) => [p.who, [p.rel, p.n]]));
  assert.deepEqual(who.mom, [null, 2]);
  assert.deepEqual(who.Jim, ['brother', 1]);
  assert.equal(who.Marcus, undefined, 'not in their LifeCircle here');
  l = observe(l, 'Marcus said to call him', ['Marcus']);
  assert.ok(l.people.some((p) => p.who === 'Marcus'));
  assert.equal(observe(L0, 'my brother Jim said he would kill me').people.length, 0, 'not from a danger message');
});

// --- Seeing it and clearing it -----------------------------------------------

test('each thing can be removed, and clear leaves nothing', () => {
  let l = learnRephrase(L0, 'how do i get a spnsr', 'how do i get a sponsor', 'sponsor-find');
  l = observe(setNickname(l, 'J'), 'my mom called');
  l = countTopic(l, 'court', 'Court');
  assert.equal(forget(l, 'word', 'spnsr').words.length, 0);
  assert.equal(forget(l, 'phrase', 'how do i get a spnsr').phrases.length, 0);
  assert.equal(forget(l, 'nickname').nickname, null);
  assert.equal(forget(l, 'person', 'mom').people.length, 0);
  assert.equal(forget(l, 'topic', 'court').topics.length, 0);
  assert.ok(!isEmpty(l));
  assert.ok(isEmpty(emptyLearned()));
});

test('live AI gets only a small summary: no people, no numbers', () => {
  let l = learnRephrase(L0, 'how do i get a spnsr', 'how do i get a sponsor', 'sponsor-find');
  l = observe(setNickname(l, 'J'), 'my brother Jim called');
  l = { ...l, words: [...l.words, { said: 'jimsnumber', means: '509 555 1234', n: 1 }] };
  const s = summaryForLive(l)!;
  assert.equal(s.callMe, 'J');
  assert.deepEqual(s.words, ['spnsr = sponsor']);
  assert.ok(!JSON.stringify(s).includes('Jim'));
});

test('old saved data without a profile loads with an empty one', () => {
  const s = seedState();
  assert.deepEqual(s.learned, emptyLearned());
  assert.equal(s.settings.zoeyLearns, true);
  assert.equal(expand('see u tmrw', L0), 'see you tomorrow');
});

console.log(`learn: ${passed} passed`);
