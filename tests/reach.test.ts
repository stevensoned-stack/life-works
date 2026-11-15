// Run with: npm test
// "Do you want to reach out?" -> "Yes" -> who to call, by name (Ed, 2026-11-15).
import assert from 'node:assert/strict';
import { seedState } from '../src/data/seed';
import { askReach, askWho, findReach, LIFELINE_LABEL, personLabel, reachChoices, ReachEnv, reachList, shortName } from '../src/zoey/reach';
import { END, TREES } from '../src/zoey/trees';

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

const state = seedState();
const home = { ...(state.home ?? ({} as any)), roommates: [{ id: 'r1', name: 'Tony Banks', role: 'house_manager' as const, phone: '+15095550199' }, { id: 'r2', name: 'Sam', role: 'roommate' as const }] };
const list = reachList(state.people, state.profile.coordinator, home as any);

// A pretend chat: what Zoey said, the buttons, and who got called or texted.
function chat(worried = false) {
  const log: string[] = [];
  const calls: string[] = [];
  let buttons: { label: string; onPick: () => void }[] = [];
  let hear: ((t: string) => boolean) | null = null;
  let done = 0;
  const env: ReachEnv = {
    list,
    worried: () => worried,
    say: (t) => log.push(`Z: ${t}`),
    me: (t) => log.push(`me: ${t}`),
    choices: (cs) => (buttons = cs),
    listen: (h) => (hear = h),
    call: (p) => calls.push(`call ${p}`),
    text: (p) => calls.push(`text ${p}`),
  };
  return {
    env,
    log,
    calls,
    then: () => done++,
    get done() {
      return done;
    },
    labels: () => buttons.map((b) => b.label),
    tap: (label: string) => buttons.find((b) => b.label === label)!.onPick(),
    type: (t: string) => (hear ? hear(t) : false),
  };
}

test('short names: first name, titles kept, a team name kept whole', () => {
  assert.equal(shortName('Maya Torres'), 'Maya');
  assert.equal(shortName('Marcus R.'), 'Marcus');
  assert.equal(shortName('Dr. Lee'), 'Dr. Lee');
  assert.equal(shortName('Ms. Carol'), 'Ms. Carol');
  assert.equal(shortName('House staff on duty'), 'House staff on duty');
  assert.equal(shortName('Kayla'), 'Kayla');
});

test('everyone in LifeCircle, plus the house manager with a number; no repeats', () => {
  const names = list.map((r) => r.short);
  for (const n of ['Maya', 'Marcus', 'Dr. Lee', 'Dre', 'House staff on duty', 'Ms. Carol', 'Kayla', 'Tony']) assert.ok(names.includes(n), n);
  assert.ok(!names.includes('Sam'), 'no number, not listed');
  assert.equal(names.filter((n) => n === 'Maya').length, 1);
  assert.equal(personLabel(list.find((r) => r.short === 'Marcus')!), 'Marcus (sponsor)');
});

test('988 only after danger words', () => {
  assert.ok(!reachChoices(list, 'call', false).includes(LIFELINE_LABEL));
  assert.ok(reachChoices(list, 'call', true).includes(LIFELINE_LABEL));
  const c = chat();
  askWho(c.env, c.then);
  assert.ok(!c.labels().includes(LIFELINE_LABEL));
  assert.ok(!c.log.join(' ').includes('988'));
  const w = chat(true);
  askWho(w.env, w.then);
  assert.ok(w.labels().includes(LIFELINE_LABEL));
});

test('typed names and roles pick the person', () => {
  const who = (t: string) => {
    const p = findReach(t, list);
    return p?.kind === 'person' ? `${p.mode} ${p.who.short}` : p?.kind ?? null;
  };
  assert.equal(who('Marcus'), 'call Marcus');
  assert.equal(who('call marcus'), 'call Marcus');
  assert.equal(who('my sponsor'), 'call Marcus');
  assert.equal(who('Marcus (sponsor)'), 'call Marcus');
  assert.equal(who('text Kayla'), 'text Kayla');
  assert.equal(who('my sister'), 'call Kayla');
  assert.equal(who('maya'), 'call Maya');
  assert.equal(who('my counselor'), 'call Dr. Lee');
  assert.equal(who('my case manager'), 'call Maya');
  assert.equal(who('the house manager'), 'call House staff on duty');
  assert.equal(who('Tony'), 'call Tony');
  assert.equal(who('dr lee'), 'call Dr. Lee');
  assert.equal(who('Carol'), 'call Ms. Carol');
  assert.equal(who('someone else'), 'other');
  assert.equal(who('988'), 'crisis');
  assert.equal(who('never mind'), 'none');
  assert.equal(who('no one'), 'none');
  assert.equal(who('what time is it'), null);
});

test('"Want to reach out?" -> Yes -> who to call, by name -> calls them', () => {
  const c = chat();
  askReach(c.env, c.then);
  assert.deepEqual(c.labels(), ['Yes', 'Not now']);
  c.tap('Yes');
  assert.match(c.log.at(-1)!, /Who (?:would you like|do you want) to call\?/);
  assert.ok(c.labels().includes('Marcus (sponsor)'));
  assert.ok(c.labels().includes('Kayla (sister)'));
  assert.ok(c.labels().includes('Someone else'));
  c.tap('Kayla (sister)');
  assert.deepEqual(c.calls, ['call +15095550174']);
  assert.match(c.log.at(-1)!, /Kayla/);
  assert.equal(c.done, 1);
});

test('typing "yes", then a name, works the same', () => {
  const c = chat();
  askReach(c.env, c.then);
  assert.equal(c.type('yeah'), true);
  assert.equal(c.type('call my sponsor'), true);
  assert.deepEqual(c.calls, ['call +15095550118']);
  assert.equal(c.done, 1);
});

test('a name right away skips the "who" question', () => {
  const c = chat();
  askReach(c.env, c.then);
  assert.equal(c.type('text marcus'), true);
  assert.deepEqual(c.calls, ['text +15095550118']);
});

test('"no" -> okay, maybe later, and the talk goes on', () => {
  const c = chat();
  askReach(c.env, c.then);
  assert.equal(c.type('no'), true);
  assert.equal(c.log.at(-1), 'Z: Okay, maybe later.');
  assert.deepEqual(c.calls, []);
  assert.equal(c.done, 1);
});

test('text instead, someone else, someone not saved', () => {
  const c = chat();
  askWho(c.env, c.then);
  c.tap('Text someone instead');
  assert.match(c.log.at(-1)!, /text\?/);
  c.tap('Dre (peer mentor)');
  assert.deepEqual(c.calls, ['text +15095550131']);

  const o = chat();
  askWho(o.env, o.then);
  o.tap('Someone else');
  assert.match(o.log.at(-1)!, /call(?:ing)?\?/);
  assert.equal(o.type('my mom'), true);
  assert.match(o.log.at(-1)!, /don’t have a number for your mom/);
  assert.equal(o.done, 1);

  const k = chat();
  askWho(k.env, k.then);
  k.tap('Someone else');
  k.type('Kayla');
  assert.deepEqual(k.calls, ['call +15095550174']);
});

test('988 after danger words calls 988', () => {
  const c = chat(true);
  askWho(c.env, c.then);
  c.tap(LIFELINE_LABEL);
  assert.deepEqual(c.calls, ['call 988']);
});

test('every "who would you like to reach" node lists people by name', () => {
  for (const [id, n] of [['urge', 'who'], ['Feeling alone', 'who'], ['People', 'who'], ['Work or school', 'who'], ['hopeless', 'who'], ['hates', 'call'], ['after-safe', 'call'], ['help', 'talk'], ['faith', 'talk']] as const)
    assert.equal(TREES[id].nodes[n].people, true, `${id}/${n}`);
  // No tree still asks "who?" with only two buttons.
  for (const t of Object.values(TREES))
    for (const [id, n] of Object.entries(t.nodes))
      if (/Who (?:would you like|should we|do you want)/.test([n.say, ...(n.alts ?? [])].join(' '))) assert.ok(n.people, `${t.id}/${id}`);
  assert.ok(END);
});

console.log(`reach: ${passed} passed`);
