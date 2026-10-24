// Run with: npm test
// Checks the question router and that every authored answer follows the reply rules.
import assert from 'node:assert/strict';
import { ANSWERS, AnswerContext, FALLBACKS, FALLBACKS_AGAIN, FIXED } from '../src/zoey/answers';
import { ask, validateReply } from '../src/zoey/ask';
import { findFeeling, findHelp, findSick, followUp, mentionedFeeling, typedAnswer, yesNo } from '../src/zoey/feelings';
import { screen } from '../src/zoey/safety';

const ctx: AnswerContext = {
  name: 'Jordan',
  coordinatorName: 'Maya',
  sponsorName: 'Marcus',
  cleanDays: 78,
  nextMilestone: '90 days',
  daysToNext: 12,
  nextEvent: { title: 'GED math class', when: 'today at 4:00 PM' },
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

const kindOf = (q: string) => ask(q, ctx).kind;
const idOf = (q: string) => {
  const r = ask(q, ctx);
  return r.kind === 'answer' ? r.answer.id : r.kind;
};

// 1. Safety runs before anything else, even inside an ordinary question.
for (const q of ['i want to kill myself', 'how do i find a sponsor? i want to die', 'my friend took too many pills', 'I think im overdosing']) {
  test(`crisis: ${q}`, () => assert.equal(kindOf(q), 'crisis'));
}
for (const q of ["i'm done with all of this", 'whats the point, i give up']) {
  test(`safety check: ${q}`, () => assert.equal(kindOf(q), 'check'));
}

// 1b. Every phrasing from the safety review (Oct 2026) that the old word list
// missed, with the tier it must reach. Run through ask() so routing order is
// covered too, not just the screen.
const review: [string, string][] = [
  ['my friend overdosed and wont wake up', 'crisis/medical'],
  ["he's not breathing", 'crisis/medical'],
  ['i took all my pills', 'crisis/medical'],
  ['i overdosed', 'crisis/medical'],
  ["i think i OD'd", 'crisis/medical'],
  ['i swallowed a bottle of tylenol', 'crisis/medical'],
  ['i cant breath', 'crisis/medical'],
  ["i relapsed and im scared i'll die", 'crisis/medical'],
  ['i want to end myself', 'crisis/psychiatric'],
  ["i'm going to hang myself", 'crisis/psychiatric'],
  ['i bought a gun to shoot myself', 'crisis/psychiatric'],
  ["i'm going to jump off the bridge", 'crisis/psychiatric'],
  ['i dont want to be alive anymore', 'crisis/psychiatric'],
  ['no reason to live', 'crisis/psychiatric'],
  ['everyone would be better off without me', 'crisis/psychiatric'],
  ['kill myslef', 'crisis/psychiatric'],
  ['suicidial', 'crisis/psychiatric'],
  ['wanna end it', 'crisis/psychiatric'],
  ['unalived', 'crisis/psychiatric'],
  ['i feel like dying', 'crisis/psychiatric'],
  ['i dont want to wake up', 'crisis/psychiatric'],
  ['im not safe', 'crisis/psychiatric'],
  ['i need help now', 'crisis/psychiatric'],
  ['i want to kill him', 'crisis/psychiatric'],
  ['quiero morir', 'crisis/psychiatric'],
  ['me quiero matar', 'crisis/psychiatric'],
  ['Quiero morírme', 'crisis/psychiatric'],
  ['i wanna kms', 'crisis/psychiatric'],
  ['having a seizure', 'crisis/medical'],
  ['i might hurt myself tonight', 'crisis/psychiatric'],
  ['my boyfriend hits me', 'urgent/abuse'],
  ['i was raped', 'urgent/abuse'],
  ['i stopped taking my suboxone', 'urgent/withdrawal'],
  ['can i stop taking my suboxone', 'urgent/withdrawal'],
  ["i'm detoxing alone", 'urgent/withdrawal'],
  ['im in withdrawal and shaking', 'urgent/withdrawal'],
  ['can i quit benzos cold turkey', 'urgent/withdrawal'],
  // misspelled, stretched and spaced versions
  ['I want to kil my self', 'crisis/psychiatric'],
  ['i wanna dieeee', 'crisis/psychiatric'],
  ['thinking about sucide', 'crisis/psychiatric'],
  ['i think im over dosing', 'crisis/medical'],
];
const tierOf = (q: string) => {
  const r = ask(q, ctx);
  return r.kind === 'crisis' || r.kind === 'urgent' ? `${r.kind}/${r.variant}` : r.kind;
};
for (const [q, tier] of review) test(`review: ${q}`, () => assert.equal(tierOf(q), tier));

test('urgent replies lead with 911', () => {
  for (const q of ['my boyfriend hits me', 'im in withdrawal and shaking']) {
    const r = ask(q, ctx);
    assert.equal(r.kind, 'urgent');
    if (r.kind === 'urgent') assert.deepEqual(r.actions[0], { kind: 'phone', label: 'Call 911', number: '911' });
  }
});

// 1c. Ordinary sentences that share words with the patterns must not interrupt.
for (const q of [
  "that's odd",
  'I took all my meds this morning',
  'what are signs of an overdose',
  'i went to high school with him',
  'can i get a drink of water',
  "my sponsor isn't responding to my texts",
  'he is moving to ohio',
  "i'm willing to try",
  'i rated the meeting',
  'he hit me up last night',
  'she pushed me to go to a meeting',
  "i don't want to hurt her feelings",
  'i hurt my back',
  'recovery helped me take my life back',
  'i stopped drinking 3 months ago',
  'i quit heroin a year ago',
  'i overdid it at the gym',
  'i ate the whole box of cookies',
  'this headache is killing me',
  "i'm dying to see my kids",
  'i shook hands with my sponsor',
  'i feel safe here',
  'i took the whole day off',
  'i used all my sick days',
]) {
  test(`no interrupt: ${q}`, () => assert.equal(screen(q).kind, 'none'));
}

// 1d. Losing housing: Maya and 211 come first, ahead of any library answer.
// Danger words in the same message still win.
for (const q of [
  "i'm homeless",
  'im homles',
  'i got eveicted',
  'got an eviction notice today',
  'my landlord is kicking me out',
  'they kicked me out of sober living',
  'my mom threw me out',
  'my roommate says i have to be out tonight',
  'i have to move out by friday',
  'got a 30 day notice',
  'i lost my apartment',
  'i cant pay rent this month',
  'behind on rent',
  'im sleeping in my car',
  'i slept in the park last night',
  'im on the street tonight',
  'i have nowhere to stay tonight',
  "i don't have a place to sleep",
  'couch surfing at my cousins',
  'where is the nearest shelter',
  "i'm aging out of foster care and have nowhere to go",
  'me echaron de la casa',
  'no tengo dónde dormir',
  'sin hogar',
]) {
  test(`housing: ${q}`, () => assert.equal(tierOf(q), 'urgent/housing'));
}
test('housing reply leads with the coordinator, then 211', () => {
  const r = ask('i got evicted', ctx);
  assert.equal(r.kind, 'urgent');
  if (r.kind === 'urgent') {
    assert.equal(r.actions[0].kind, 'call');
    assert.deepEqual(r.actions[1], { kind: 'phone', label: 'Call 211', number: '211' });
  }
});
test('housing reply points to local shelters and housing help', () => {
  const r = ask('im sleeping in my car', ctx);
  assert.ok('actions' in r && r.actions.some((a) => a.kind === 'url' && /sheltermespokane/.test(a.url)));
  assert.ok('actions' in r && r.actions.some((a) => a.kind === 'route' && a.route.name === 'resources'));
});
test('housing plus danger words still opens the crisis screen', () =>
  assert.equal(tierOf('im homeless and i want to die'), 'crisis/psychiatric'));
test('housing plus "give up" still asks if they are safe', () => assert.equal(tierOf('im homeless and i give up'), 'check'));
for (const q of [
  'i got kicked out of class',
  'i lost my place in the book',
  'i adopted a shelter dog',
  'i volunteer at the animal shelter',
  'we went to an event',
  'i live on main street',
  'i paid rent today',
  'my landlord fixed the sink',
  'we sat on the couch',
  'i stayed home tonight',
  'i had to leave work early',
  'im hopeless',
]) {
  test(`not housing: ${q}`, () => assert.notEqual(tierOf(q), 'urgent/housing'));
}

// 2. Medication questions never get an answer, only a route to the prescriber.
for (const q of [
  'how much methadone should i take',
  'is it ok to drink on zoloft',
  'my meds make me tired',
  'what are the side effects of vivitrol',
  'I hate my medication',
]) {
  test(`medication: ${q}`, () => assert.equal(kindOf(q), 'medication'));
}
test('medication reply gives no advice', () => {
  const r = ask('should I double my dose', ctx);
  assert.equal(r.kind, 'medication');
  assert.match(r.text, /prescriber or a pharmacist/);
});

// 3. Ordinary questions find the right answer.
const expected: [string, string][] = [
  ['what do i do when i get a craving', 'craving-now'],
  ['how long do cravings last', 'craving-length'],
  ['I relapsed last night', 'slip'],
  ['where can i get narcan', 'overdose'],
  ['what happens at an NA meeting', 'meeting-what'],
  ['do i have to talk at the meeting', 'meeting-talk'],
  ['how do i get a sponsor', 'sponsor-find'],
  ["i can't sleep", 'sleep'],
  ['i feel so lonely', 'lonely'],
  ['where can i get food', 'food'],
  ['how many days do i have', 'clean-days'],
  ['when is my next appointment', 'next-appointment'],
  ['are you a real person', 'is-zoey-human'],
  ['who can see my check-ins', 'who-sees'],
  ['where can i find local resources', 'local-help'],
  ['i need a lawyer', 'local-help'],
  ['how do i set a reminder', 'app-reminder'],
];
for (const [q, id] of expected) test(`answer: ${q}`, () => assert.equal(idOf(q), id));

// 4. Unknown questions ask to hear more instead of guessing (never "no good answer").
test('fallback', () => assert.equal(kindOf('what is the capital of france'), 'fallback'));
test('fallback always shows 988 / 911 and a person, never only "wait"', () => {
  const r = ask('what is the capital of france', ctx);
  assert.match(r.text, /988/);
  assert.match(r.text, /911/);
  assert.ok('actions' in r && r.actions.some((a) => a.kind === 'crisis'));
  assert.ok('actions' in r && r.actions[0].kind === 'call');
});
test('fallback asks to hear more, warmly, and never says "no good answer"', () => {
  for (const t of [FIXED.fallback(ctx), FIXED.fallbackAgain(ctx)]) {
    assert.doesNotMatch(t, /good answer|don't know|can't help/i);
    assert.match(t, /988/);
    assert.match(t, /911/);
  }
  assert.match(FIXED.fallback(ctx), /tell me a little more/);
  assert.match(ask('what is the capital of france', ctx, { again: true, rand: () => 0 }).text, /Maya is the best person/);
});

// 5. Dynamic answers use the person's own data.
test('clean days', () => assert.match((ask('how many days do i have', ctx) as { text: string }).text, /78 days.*12 more to 90 days/));

// 6. Every authored answer passes the same rules a model reply would have to.
test('rules: fixed replies', () => {
  for (const t of [FIXED.fallback(ctx), FIXED.fallbackAgain(ctx), FIXED.housing(ctx), FIXED.withdrawal(ctx), FIXED.abuse(ctx), FIXED.medication(ctx), FIXED.crisis]) {
    const v = validateReply(t);
    assert.ok(v.ok, v.reasons.join('; '));
  }
});
for (const a of ANSWERS) {
  test(`rules: ${a.id}`, () => {
    const text = typeof a.text === 'function' ? a.text(ctx) : a.text;
    const v = validateReply(text);
    assert.ok(v.ok, v.reasons.join('; '));
  });
}

// 6b. Every local listing has a real-looking number or a website, and a source.
import { CURRENT_REGION, RESOURCE_CATEGORIES } from '../src/data/resources';
for (const r of CURRENT_REGION.resources) {
  test(`resource: ${r.id}`, () => {
    assert.ok(r.phone || r.url || r.address, 'needs a phone, website or address');
    if (r.phone) assert.match(r.phone, /^(1\d{10}|\d{10})$/);
    if (r.url) assert.match(r.url, /^https:\/\//);
    assert.ok(r.source.length > 5);
    assert.ok(RESOURCE_CATEGORIES.includes(r.category));
    assert.ok(!/1-?800-?273-?8255|18002738255/.test(JSON.stringify(r)), 'legacy lifeline number');
  });
}
test('region was checked in the last year', () => {
  const age = (Date.now() - new Date(CURRENT_REGION.checked).getTime()) / 864e5;
  assert.ok(age < 365, `checked ${CURRENT_REGION.checked}; re-verify the listings`);
});
test('validator allows local listing numbers', () => assert.ok(validateReply('Call SNAP at 509-456-7627.').ok));

// 7. The validator catches what it should.
for (const bad of [
  'You have depression and should rest.',
  'Try to take your meds with food.',
  'Take 50 mg before bed.',
  "As your counselor, I think you're fine.",
  'Call the hotline at 1-800-273-8255.',
]) {
  test(`validator blocks: ${bad}`, () => assert.equal(validateReply(bad).ok, false));
}

// 8. Safety events: what the counselor gets to review.
import { alertText, makeEvent, outbox } from '../src/safety/events';
const history = Array.from({ length: 9 }, (_, i) => ({ from: (i % 2 ? 'me' : 'zoey') as 'me' | 'zoey', text: `turn ${i}`, at: '' }));
const ev = (msg: string, share = true) => {
  const r = screen(msg);
  assert.notEqual(r.kind, 'none');
  if (r.kind === 'none') throw new Error('not flagged');
  return makeEvent({ id: 'e1', result: r, message: msg, history, screen: 'ask', coordinatorName: 'Maya', share, now: new Date('2026-10-21T22:00:00Z') });
};
test('event keeps the trigger, matched words and the 6 messages before it', () => {
  const e = ev("i'm going to hang myself");
  assert.equal(e.message, "i'm going to hang myself");
  assert.equal(e.matched, 'hang myself');
  assert.equal(e.context.length, 6);
  assert.equal(e.context[5].text, 'turn 8');
  assert.equal(e.at, '2026-10-21T22:00:00.000Z');
});
test('event tiers follow the plan', () => {
  assert.equal(ev('i want to die').tier, 3);
  assert.equal(ev('i think i OD\'d').tier, 3);
  assert.equal(ev('im in withdrawal').tier, 2);
  assert.equal(ev('i got evicted').tier, 2);
  assert.equal(ev("i'm done").tier, 2);
});
test('alert is queued for the coordinator only with consent', () => {
  assert.deepEqual(ev('i want to die').alert, { to: 'Maya', status: 'queued', queuedAt: '2026-10-21T22:00:00.000Z' });
  assert.equal(ev('i want to die', false).alert.status, 'not_shared');
  assert.equal(outbox([ev('i want to die'), ev('i want to die', false)]).length, 1);
});

test('text alert is short and never quotes the message or names the topic', () => {
  const t = alertText('Jordan', 3, new Date('2026-10-21T22:05:00'));
  assert.equal(t, 'Life Works alert: Jordan would like a check-in (crisis, 10:05 PM). Please reach out soon.');
  for (const w of ['die', 'suicid', 'overdos', 'hang', 'evict', 'withdraw', 'abuse']) assert.ok(!t.toLowerCase().includes(w));
  assert.ok(validateReply(t).ok);
});

// 9. Check-in decision trees: every tap path ends, every line follows the reply rules.
import { END, FEELING_KEYS, fill, isHardFeeling, lineFor, paths, TREES } from '../src/zoey/trees';
const vars = { coord: 'Maya', sponsor: 'Marcus', name: 'Jordan' };
for (const tree of Object.values(TREES)) {
  test(`tree ${tree.id}: every path ends`, () => assert.ok(paths(tree).length > 0));
  test(`tree ${tree.id}: wording follows the rules`, () => {
    for (const [id, n] of Object.entries(tree.nodes)) {
      for (const t of [n.say, ...(n.alts ?? []), ...(n.offer ?? []).map((o) => o.label)]) {
        const v = validateReply(fill(t, vars));
        assert.ok(v.ok, `${id}: ${v.reasons.join('; ')}`);
        assert.ok(!/\{\w+\}/.test(fill(t, { ...vars, sponsor: null })), `${id}: unfilled placeholder`);
      }
      if (n.yes || n.no) assert.ok(n.yes && n.no, `${id}: yes/no needs both`);
      if (!n.say) assert.ok(n.safety, `${id}: silent node must be a safety hand-off`);
    }
  });
  test(`tree ${tree.id}: no unused nodes`, () => {
    const seen = new Set(paths(tree).flat());
    for (const id of Object.keys(tree.nodes)) assert.ok(seen.has(id), `${id} is never reached`);
  });
}
test("Ed's example: feeling bad -> know why -> share", () => {
  const t = TREES['feeling-bad'];
  assert.equal(t.nodes[t.start].say, 'Do you know why you’re feeling bad?');
  assert.ok(t.nodes[t.nodes[t.start].yes!].share);
  assert.ok(paths(t).some((p) => p.includes('help') && p.includes('sleep')));
});
test('unsafe answers hand off to the safety help', () => {
  assert.equal(TREES['People'].nodes[TREES['People'].nodes.safe.no!].safety, 'abuse');
  assert.equal(TREES['Housing'].nodes[TREES['Housing'].nodes.tonight.no!].safety, 'housing');
});
test('no sponsor: lines still read naturally', () =>
  assert.equal(fill('Please call {sponsor} or {coord} now.', { ...vars, sponsor: null }), 'Please call Maya now.'));

// 7. The risky messages from the clinician review pack (G1 to G12).
const risky: [string, string][] = [
  ['i wish i could go to sleep and never wake up', 'crisis/psychiatric'],
  ['i want to go to sleep and not wake up', 'crisis/psychiatric'],
  ['im a burden to everyone', 'check'],
  ['i feel like a burden', 'check'],
  ['i have a plan', 'crisis/psychiatric'],
  ['i made a plan to end it', 'crisis/psychiatric'],
  ['im using alone tonight', 'urgent/using'],
  ['im going to use tonight', 'urgent/using'],
  ['im about to use', 'urgent/using'],
  ['im not sure, im going to use tonight', 'urgent/using'],
  ['im gonna drink tonight', 'urgent/using'],
  ['i drank a whole bottle of vodka', 'crisis/medical'],
  ['i bought fentanyl', 'urgent/using'],
  ['just picked up some dope', 'urgent/using'],
  ['i used last night and feel really sick', 'crisis/medical'],
  ['i relapsed and now im so dizzy', 'crisis/medical'],
  ['i hear voices', 'check'],
  ['the voices are telling me to hurt myself', 'crisis/psychiatric'],
  ['im pregnant and still using', 'urgent/pregnant'],
  ['i just found out im pregnant and i relapsed', 'urgent/pregnant'],
  ['i cant stop crying', 'check'],
  ['my friend is talking about suicide', 'urgent/someone'],
  ['my brother keeps saying he wants to kill himself', 'urgent/someone'],
  ['my friend wants to die and i want to die too', 'crisis/psychiatric'],
];
for (const [q, tier] of risky) test(`risky: ${q}`, () => assert.equal(tierOf(q), tier));


for (const [q, want] of [
  ['i have a plan for the weekend', 'none'],
  ['im using the bus tonight', 'none'],
  ['i bought groceries', 'none'],
  ['i got some dope shoes', 'none'],
  ['i drank a whole bottle of water', 'none'],
  ['i cried at the movie', 'none'],
  ['i hope i dont wake up late', 'none'],
  ['i used to feel sick all the time', 'none'],
  ['i used the gym and feel really sick', 'none'],
  ['voices in the next room woke me', 'none'],
  ['im going to use my car', 'none'],
  ['i need to use the computer', 'none'],
  ['im not going to drink tonight', 'none'],
  ['i dont want to use tonight', 'none'],
  ['i want to use so bad', 'none'],
])
  test(`everyday: ${q}`, () => assert.equal(screen(q).kind, want));
test('"i want to use" is a craving, not an overdose warning', () => assert.equal(idOf('i want to use so bad'), 'craving-now'));
test('pregnant but someone else: not the pregnancy reply', () =>
  assert.notEqual(tierOf('my mom is pregnant and i relapsed'), 'urgent/pregnant'));

test('using reply: sponsor first, Never Use Alone, 911', () => {
  const r = ask('im going to use tonight', ctx);
  assert.equal(r.kind, 'urgent');
  if (r.kind !== 'urgent') return;
  const labels = r.actions.map((a) => a.label);
  assert.equal(labels[0], `Call ${ctx.sponsorName}`);
  assert.ok(r.actions.some((a) => a.kind === 'phone' && a.number === '18004843731'));
  assert.ok(labels.includes('Call 911'));
  assert.match(r.text, /don.t use alone/);
});
test('using reply without a sponsor starts with the coordinator', () => {
  const r = ask('im going to use tonight', { ...ctx, sponsorName: null });
  if (r.kind === 'urgent') assert.equal(r.actions[0].label, `Call ${ctx.coordinatorName}`);
});
test('someone else reply: 988 together, then 911', () => {
  const r = ask('my friend is talking about suicide', ctx);
  assert.equal(r.kind, 'urgent');
  if (r.kind !== 'urgent') return;
  assert.deepEqual(r.actions.map((a) => a.label), ['Call 988', 'Text 988', 'Call 911']);
  assert.doesNotMatch(r.text, /\byou('re| are) (thinking|suicidal)/);
});
test('pregnant reply: no blame, doctor today, 911 if severe', () => {
  const r = ask('im pregnant and still using', ctx);
  assert.equal(r.kind, 'urgent');
  if (r.kind !== 'urgent') return;
  assert.match(r.text, /not in trouble/);
  assert.match(r.text, /doctor/);
  assert.ok(r.actions.some((a) => a.label === 'Call 911'));
});
test('new replies pass the wording rules', () => {
  for (const t of [FIXED.someone(), FIXED.pregnant(ctx), FIXED.using(ctx), FIXED.using({ ...ctx, sponsorName: null })]) {
    const v = validateReply(t);
    assert.ok(v.ok, v.reasons.join('; '));
  }
});

// 8. Typed feelings: Zoey asks if they know why, then asks them to share (Ed, 2026-10-22).
for (const [q, key] of [
  ['I am sad', 'sad'],
  ['im so sad today', 'sad'],
  ['i feel down', 'sad'],
  ["I'm feeling really anxious", 'anxious'],
  ['i feel lonely', 'lonely'],
  ['im pissed off', 'angry'],
  ['honestly im scared', 'scared'],
  ['feeling stressed and tired', 'stressed'],
  ['im bored', 'bored'],
  ['i feel proud of myself', 'proud'],
  ['im happy', 'happy'],
  ['i am grateful today', 'grateful'],
] as const)
  test(`feeling: ${q}`, () => assert.equal(findFeeling(q)?.key, key));
for (const q of ['im fine', 'im good', 'down', 'i am not sad', 'why am i sad?', 'im sad because my dog died', 'i am going home', 'im tired of this'])
  test(`not a feeling to ask about: ${q}`, () => assert.equal(findFeeling(q), null));
test('hard feelings: "I’m sorry to hear that. Can you tell me more?", then "what is your plan?"', () => {
  for (const k of FEELING_KEYS.filter(isHardFeeling)) {
    const t = TREES[`feeling:${k}`];
    const more = t.nodes[t.start];
    assert.equal(more.say, 'I’m sorry to hear that. Can you tell me more?', k);
    assert.ok(t.nodes[more.yes!].share, `${k}: yes should ask them to share`);
    assert.equal(t.nodes[more.yes!].share, 'plan', k);
    assert.equal(more.typed, 'plan', `${k}: typing more counts as telling more`);
    assert.match(t.nodes.plan.say, /plan/);
    // Different replies for yes and no.
    assert.notEqual(t.nodes[t.nodes.plan.yes!].say, t.nodes[t.nodes.plan.no!].say);
    assert.ok(t.nodes[t.nodes.plan.yes!].share, `${k}: yes, I have a plan -> what is it?`);
    // Every path, even "no" all the way, reaches the plan question.
    for (const p of paths(t)) assert.ok(p.includes('plan'), `${k}: ${p.join(' > ')}`);
  }
});
test('good feelings: do you know what is making you feel it?', () => {
  for (const k of FEELING_KEYS.filter((x) => !isHardFeeling(x))) {
    const t = TREES[`feeling:${k}`];
    assert.match(t.nodes[t.start].say, new RegExp(`Do you know what.*${k}`));
    assert.ok(t.nodes[t.nodes[t.start].yes!].share);
  }
});
test('hard feelings: "no" leads to the quick questions, then the plan', () => {
  const t = TREES['feeling:angry'];
  assert.equal(t.nodes.more.no, 'help');
  assert.ok(paths(t).some((p) => p.includes('sleep') && p.includes('plan') && p.includes('after')));
});
test("Ed's sad example: sad -> tell me more -> (they type) -> what is your plan", () => {
  const t = TREES['feeling:sad'];
  assert.deepEqual(typedAnswer(t, 'more', 'my mom and i got into a fight'), { to: 'plan', told: true });
  assert.deepEqual(typedAnswer(t, 'more', 'yes'), { to: 'share', told: false });
  assert.deepEqual(typedAnswer(t, 'more', 'no'), { to: 'help', told: false });
  assert.deepEqual(typedAnswer(t, 'plan', 'yeah'), { to: 'planTell', told: false });
  assert.deepEqual(typedAnswer(t, 'plan', 'nope'), { to: 'planNo', told: false });
  assert.deepEqual(typedAnswer(t, 'plan', 'call my sponsor and go to a meeting'), { to: 'planGood', told: true });
  // A new question mid-way goes to the answer library instead.
  assert.equal(typedAnswer(t, 'more', 'how do i find a meeting?'), null);
});

// 8b. Feeling sick (Ed, 2026-10-24): have you talked to your doctor?
for (const q of ['I am sick', 'im sick', 'i feel sick today', "I don't feel well", 'im not feeling good', 'i have the flu', 'i think i have a cold', 'my stomach hurts', 'i threw up', 'im really sick', 'feeling ill'])
  test(`sick: ${q}`, () => assert.ok(findSick(q)));
for (const q of ['im sick of this', 'im sick and tired of my roommate', 'my mom is sick', 'im feeling well', 'how do i find a sponsor'])
  test(`not sick: ${q}`, () => assert.ok(!findSick(q)));
test("Ed's sick example: doctor? yes -> what did they say -> plan; no -> encourage the doctor or coordinator", () => {
  const t = TREES.sick;
  const doctor = t.nodes[t.start];
  assert.match(doctor.say, /sorry to hear that.*talked to your doctor/);
  assert.match(t.nodes[doctor.yes!].say, /What did they say/);
  assert.equal(t.nodes[doctor.yes!].share, 'plan');
  assert.match(t.nodes.plan.say, /plan/);
  assert.match(t.nodes[doctor.no!].say, /doctor.*\{coord\}/);
  assert.notEqual(t.nodes[doctor.yes!].say, t.nodes[doctor.no!].say);
  assert.deepEqual(typedAnswer(t, 'doctor', 'yes she said to rest and drink water'), { to: 'plan', told: true });
  assert.deepEqual(typedAnswer(t, 'doctor', 'yes'), { to: 'said', told: false });
  assert.deepEqual(typedAnswer(t, 'doctor', 'not yet'), { to: 'call', told: false });
  // Every path that doesn't come back with a plan points to 911 if it gets worse.
  for (const p of paths(t)) assert.ok(p.includes('worse') || p.includes('planGood'), p.join(' > '));
});
test('no medical advice in the sick tree', () => {
  for (const n of Object.values(TREES.sick.nodes)) assert.doesNotMatch(n.say, /\b(take|dose|mg|ibuprofen|tylenol|medicine|pill)\b/i);
});
test('sick after using, withdrawal and chest pain still go to safety first', () => {
  assert.notEqual(screen('i used last night and now i feel sick').kind, 'none');
  assert.notEqual(screen('im dope sick').kind, 'none');
  assert.notEqual(screen('im sick and my chest hurts').kind, 'none');
});

// 8c. Never a fallback for a feeling, and typed yes / no.
for (const [q, key] of [
  ['my dog died and im so sad', 'sad'],
  ['im sad because my dog died', 'sad'],
  ['work was awful and i feel really anxious about tomorrow', 'anxious'],
  ['i got the job and im so happy', 'happy'],
] as const)
  test(`feeling named in a longer message: ${q}`, () => assert.equal(mentionedFeeling(q)?.key, key));
test('"not sad" is not a feeling named', () => assert.equal(mentionedFeeling('im not sad anymore'), null));
// What AskZoey does with each, after the safety screen.
const flow = (q: string) => {
  const f = followUp(q, ask(q, ctx).kind);
  return f ? `${f.tree}/${f.node}` : ask(q, ctx).kind;
};
for (const [q, want] of [
  ['I am sad', 'feeling:sad/more'],
  ['i am sick', 'sick/doctor'],
  ['I feel sick', 'sick/doctor'],
  ['i have the flu', 'sick/doctor'],
  ['im sad because my dog died', 'feeling:sad/heard'],
  ['my dog died and im so sad', 'feeling:sad/heard'],
  ['im bummed my girlfriend left', 'feeling:sad/heard'],
  ['i got the job and im so happy', 'feeling:happy/glad'],
  ['is it normal to feel sad?', 'answer'],
  ['im sick, can i take tylenol?', 'medication'],
  ['i want to kill myself', 'crisis'],
  ['im sad and i want to die', 'crisis'],
  ['what is the capital of france', 'fallback'],
  ['help', 'help/ask'],
  ['Help me', 'help/ask'],
  ['I need help', 'help/ask'],
  ['can you help me?', 'help/ask'],
  ['help me please zoey', 'help/ask'],
  ["i don't know what to do", 'help/ask'],
  ['help i want to die', 'crisis'],
  ['i need help i overdosed', 'crisis'],
  ['help me find a meeting', 'answer'],
  ['i need help with rent', 'answer'],
] as const)
  test(`AskZoey flow: ${q} -> ${want}`, () => assert.equal(flow(q), want));
test('"heard" thanks them, then asks for the plan', () => {
  const t = TREES['feeling:sad'];
  assert.match(t.nodes.heard.say, /sorry to hear that/);
  assert.equal(t.nodes.heard.next, 'plan');
});
for (const [q, a] of [
  ['yes', 'yes'], ['Yeah', 'yes'], ['yep!', 'yes'], ['i did', 'yes'], ['no', 'no'], ['nope', 'no'], ['not yet', 'no'],
  ["I haven't", 'no'], ['nah', 'no'],
] as const)
  test(`typed ${a}: ${q}`, () => assert.equal(yesNo(q)?.answer, a));
for (const q of ["i don't know", 'maybe', 'not sure', 'my mom'])
  test(`not a yes or no: ${q}`, () => assert.equal(yesNo(q), null));
test('every yes / no question in every tree has its own reply for yes and for no', () => {
  for (const tree of Object.values(TREES))
    for (const [id, n] of Object.entries(tree.nodes))
      if (n.yes || n.no) assert.notEqual(n.yes, n.no, `${tree.id}/${id}`);
});
test('crisis words still win over a feeling', () => {
  assert.equal(tierOf('im sad and i want to die'), 'crisis/psychiatric');
  assert.equal(findFeeling('im sad and i want to die'), null);
});
// 10. "Help" (Ed, 2026-10-24): ask warmly what they need help with, then route it.
for (const q of ['help', 'HELP!!', 'i really need help', 'can u help', 'please help me', 'zoey help', 'im struggling', 'sos'])
  test(`help: ${q}`, () => assert.ok(findHelp(q)));
for (const q of ['help me find a meeting', 'i need help with rent', 'how do i get help with food', 'i helped my friend'])
  test(`not a plain help: ${q}`, () => assert.ok(!findHelp(q)));
test('help asks what they need help with, in every variant', () => {
  const n = TREES.help.nodes.ask;
  assert.ok((n.alts ?? []).length >= 3);
  for (const t of [n.say, ...(n.alts ?? [])]) assert.match(t, /help/i);
  for (const t of n.topics!) assert.ok(t.tree ? TREES[t.tree] : TREES.help.nodes[t.node!], t.label);
  assert.ok(n.topics!.some((t) => t.node === 'other'), 'there is always a "something else"');
});

// 11. Zoey rotates how she says things (Ed, 2026-10-24), but never what they mean.
test('lineFor picks among the variants', () => {
  const n = TREES['feeling:sad'].nodes.more;
  assert.equal(lineFor(n, () => 0), n.say);
  assert.equal(lineFor(n, () => 0.999), n.alts!.at(-1));
  const seen = new Set(Array.from({ length: 200 }, () => lineFor(n)));
  assert.ok(seen.size > 1);
});
test('every "tell me more" variant asks to hear more, every plan variant asks about a plan', () => {
  for (const k of FEELING_KEYS.filter(isHardFeeling)) {
    const t = TREES[`feeling:${k}`];
    for (const x of [t.nodes.more.say, ...t.nodes.more.alts!]) assert.match(x, /tell me (a little )?more/i, x);
    for (const x of [t.nodes.plan.say, ...t.nodes.plan.alts!]) assert.match(x, /plan|what you want to do next/i, x);
  }
  for (const x of [TREES.sick.nodes.doctor.say, ...TREES.sick.nodes.doctor.alts!]) assert.match(x, /doctor/, x);
  for (const x of [TREES.sick.nodes.worse.say, ...TREES.sick.nodes.worse.alts!]) assert.match(x, /911/, x);
});
test('every fallback variant asks warmly and keeps a person, 988 and 911', () => {
  for (const f of [...FALLBACKS, ...FALLBACKS_AGAIN]) {
    const t = f(ctx);
    assert.doesNotMatch(t, /good answer|don't know|can't help/i);
    for (const w of [/Maya/, /988/, /911/]) assert.match(t, w);
    assert.ok(validateReply(t).ok, t);
  }
  const texts = new Set([0, 0.5, 0.99].map((x) => ask('what is the capital of france', ctx, { rand: () => x }).text));
  assert.equal(texts.size, FALLBACKS.length);
});
void END;

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
