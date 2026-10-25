// Run with: npm test
// Checks the question router and that every authored answer follows the reply rules.
import assert from 'node:assert/strict';
import { ANSWERS, AnswerContext, FALLBACKS, FALLBACKS_AGAIN, FIXED } from '../src/zoey/answers';
import { ask, validateReply } from '../src/zoey/ask';
import { findAnger, findFaith, findFeeling, findHates, findHelp, findProgramDoubt, findSick, followUp, isHopelessCheck, mentionedFeeling, metaReply, typedAnswer, yesNo } from '../src/zoey/feelings';
import { copy, COPY_ALTS, vary } from '../src/zoey/copy';
import { screen } from '../src/zoey/safety';
import { AFTER_WHY, cleanLine, findDismiss, findGreeting, findInsult, findShutUp, GLAD, greetLine, HEEEY, HEEEY_INSULT, howAnswer, openingLine, partOfDay, QUIET_CARE, WHY_THINK } from '../src/zoey/greet';
import { weatherLine } from '../src/zoey/weather';
import { cityAnswer, cityHeard, findCity, findPlaceAsk, milesBetween, nearAnswer, nearestTown, zoneAnswer } from '../src/zoey/place';
import { SPOKANE } from '../src/data/resources';
import { SAMPLE_MEETINGS } from '../src/recovery/meetings';
import { didYouMean, distance, spellFix } from '../src/zoey/spell';
import { todayItems, todayLine } from '../src/zoey/today';
import { seedCalendar, seedPlaces, seedPlan } from '../src/data/seed';
import { ALL_WORRY_LINES, markSafe, raise, Risk, saysSafe, worry, worryActions } from '../src/zoey/watch';

const ctx: AnswerContext = {
  name: 'Jordan',
  coordinatorName: 'Maya',
  sponsorName: 'Marcus',
  cleanDays: 78,
  cleanDate: 'August 7, 2026',
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

// 7b. 988 is always explained (Ed, 2026-10-24).
test('"what is 988" gets the Lifeline answer with call and text buttons', () => {
  const r = ask('What is 988?', ctx);
  assert.equal(r.kind, 'answer');
  if (r.kind !== 'answer') return;
  assert.match(r.text, /free Suicide and Crisis Lifeline/);
  assert.deepEqual(r.actions?.map((a) => a.label), ['Call 988', 'Text 988']);
});
test('every fixed reply that names 988 says what it is', () => {
  for (const t of [FIXED.fallback(ctx), FIXED.fallbackAgain(ctx), FIXED.someone(), copy.footer, copy.safeYes]) {
    assert.match(t, /988, the free Suicide and Crisis Lifeline/);
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
const ANGRY = ['angry', 'frustrated'];
test('hard feelings: "I’m sorry to hear that. Can you tell me more?", then "what is your plan?"', () => {
  for (const k of FEELING_KEYS.filter((x) => isHardFeeling(x) && !ANGRY.includes(x))) {
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
  const t = TREES['feeling:anxious'];
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
  ["I don't believe in God", 'faith/judge'],
  ["i'm an atheist", 'faith/judge'],
  ["the higher power thing doesn't work for me", 'faith/judge'],
  ['do i have to believe in god?', 'faith/judge'],
  ['I hate AA', 'program/judge'],
  ["I don't believe in the 12 steps", 'program/judge'],
  ['NA doesnt work for me', 'program/judge'],
  ['celebrate recovery is not for me', 'program/judge'],
  ["it's hopeless", 'check'],
  ['god i want to die', 'crisis'],
  ['i need help with rent', 'answer'],
] as const)
  test(`AskZoey flow: ${q} -> ${want}`, () => assert.equal(flow(q), want));
test('"heard" thanks them, then asks for the plan', () => {
  const t = TREES['feeling:sad'];
  assert.match(t.nodes.heard.say, /sorry/);
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
  for (const k of FEELING_KEYS.filter((x) => isHardFeeling(x) && !ANGRY.includes(x))) {
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
// 12. "What do you mean?", "why?", "no" are not answers (Ed, 2026-10-24).
for (const [q, m] of [
  ['what do you mean?', 'clarify'], ['huh?', 'clarify'], ['What?', 'clarify'], ["I don't understand", 'clarify'], ['im confused', 'clarify'],
  ['why?', 'why'], ['Why do you ask?', 'why'], ['how come', 'why'], ['why does that matter', 'why'],
  ['no', 'decline'], ['nothing', 'decline'], ["I don't have a plan", 'decline'], ["I'd rather not", 'decline'],
  ["I don't know", 'unsure'], ['idk', 'unsure'], ['not sure', 'unsure'],
] as const)
  test(`meta reply: ${q} -> ${m}`, () => assert.equal(metaReply(q), m));
for (const q of ['call my sponsor', 'why am i always sad', 'what do you mean by meetings near me', 'my mom said no', 'yes'])
  test(`an answer, not a meta reply: ${q}`, () => assert.equal(metaReply(q), null));
const r0 = () => 0;
test('"what do you mean?" rephrases the question and stays on it, never "good plan"', () => {
  const t = TREES['feeling:sad'];
  for (const id of ['more', 'share', 'plan', 'planTell']) {
    const r = typedAnswer(t, id, 'what do you mean?', r0)!;
    assert.equal(r.to, id);
    assert.ok(r.again);
    assert.equal(r.say, t.nodes[id].clarify);
    assert.doesNotMatch(r.say!, /good plan|that’s good|great/i);
  }
});
test('"why?" says why Zoey is asking, then asks again', () => {
  for (const [tree, id] of [['feeling:sad', 'more'], ['feeling:sad', 'plan'], ['sick', 'doctor'], ['sick', 'said'], ['help', 'ask'], ['feeling:happy', 'know']] as const) {
    const r = typedAnswer(TREES[tree], id, 'why?', r0)!;
    assert.equal(r.to, id, `${tree}/${id}`);
    assert.ok(r.again);
    assert.equal(r.say, TREES[tree].nodes[id].why);
    assert.match(r.say!, /\?$/, 'ends by asking again');
  }
});
test('"no", "nothing" or "I don\'t know" to "What is your plan?" is not a plan', () => {
  const t = TREES['feeling:sad'];
  for (const q of ['no', 'nothing', "I don't know", 'idk', "I don't have one"]) {
    const r = typedAnswer(t, 'planTell', q, r0)!;
    assert.equal(r.to, 'planNo', q);
  }
  for (const x of [t.nodes.planNo.say, ...t.nodes.planNo.alts!]) assert.match(x, /okay|problem/i);
  assert.deepEqual(typedAnswer(t, 'plan', "I don't know"), { to: 'planNo', told: false });
  assert.deepEqual(typedAnswer(t, 'more', "I don't know"), { to: 'help', told: false });
  assert.deepEqual(typedAnswer(t, 'planTell', 'call my sponsor tonight'), { to: 'planGood', told: true });
});
test('sick: "I don\'t know" to "What did they say?" moves on kindly', () => {
  const r = typedAnswer(TREES.sick, 'said', "I don't know", r0)!;
  assert.equal(r.to, 'plan');
  assert.ok(r.say);
});
test('help buttons: "what do you mean?" explains, a real answer goes to the answer library', () => {
  assert.ok(typedAnswer(TREES.help, 'ask', 'what do you mean', r0)!.again);
  assert.equal(typedAnswer(TREES.help, 'ask', 'my rent is late'), null);
});
test('every question in every tree: "what do you mean?" and "why?" stay put, with a reply that passes the rules', () => {
  for (const tree of Object.values(TREES))
    for (const [id, n] of Object.entries(tree.nodes)) {
      if (!(n.yes || n.no || n.share || n.topics)) continue;
      for (const q of ['what do you mean?', 'why?']) {
        for (const rand of [() => 0, () => 0.99]) {
          const r = typedAnswer(tree, id, q, rand)!;
          assert.equal(r.to, id, `${tree.id}/${id}: ${q}`);
          assert.ok(r.again && r.say, `${tree.id}/${id}: ${q}`);
          const filled = fill(r.say!, vars);
          assert.ok(validateReply(filled).ok, filled);
          assert.ok(!/\{\w+\}/.test(filled), filled);
        }
      }
    }
});
// 13. Faith, programs, hopelessness, and sounding like a person (Ed, 2026-10-24).
for (const q of ["I don't believe in God", 'im not religious', 'I am agnostic', "there's no god", "i don't have a higher power", 'i hate the god stuff', "I don't pray"])
  test(`faith: ${q}`, () => assert.ok(findFaith(q)));
for (const q of ['i believe in god', 'oh my god', 'thank god', 'i prayed today', 'what is a higher power?'])
  test(`not faith doubt: ${q}`, () => assert.ok(!findFaith(q)));
for (const q of ['I hate AA', "I don't like NA", 'the 12 steps dont work for me', 'AA is a cult', "I'm done with meetings", "I don't believe in celebrate recovery"])
  test(`program doubt: ${q}`, () => assert.ok(findProgramDoubt(q)));
for (const q of ['I love AA', 'when is the next aa meeting', 'i went to na today'])
  test(`not program doubt: ${q}`, () => assert.ok(!findProgramDoubt(q)));
test('faith and program: no judgment, then what gives you hope, in every variant', () => {
  for (const id of ['faith', 'program']) {
    const n = TREES[id].nodes.judge;
    for (const x of [n.say, ...n.alts!]) {
      assert.match(x, /okay|judg|fair enough/i, x);
      assert.match(x, /hope/i, x);
    }
    assert.equal(typedAnswer(TREES[id], 'judge', 'my kids')!.to, 'hope');
    assert.equal(typedAnswer(TREES[id], 'judge', 'nothing')!.to, 'hard');
    assert.ok(paths(TREES[id]).every((p) => p.includes('meetings') || p.includes('talk')));
  }
  assert.match(TREES.program.nodes.meetings.say, /SMART Recovery/);
  assert.match(TREES.program.nodes.meetings.say, /counselor/);
});
test('"no hope" answers to "what gives you hope?" raise the safety check', () => {
  for (const q of ['nothing gives me hope', 'i have no hope', "there's no hope for me", 'i lost all hope', "it's hopeless"]) {
    const s = screen(q);
    assert.equal(s.kind, 'check', q);
    if (s.kind === 'check') assert.ok(isHopelessCheck(s.matched), q);
  }
  assert.ok(!isHopelessCheck('hate my life'));
});
test('hopeless (after "I\'m safe"): asks what inspires them, curiously, in every variant', () => {
  const t = TREES.hopeless;
  for (const x of [t.nodes.what.say, ...t.nodes.what.alts!]) assert.match(x, /inspires|lights you up/i, x);
  assert.ok(t.nodes.what.alts!.length >= 3);
  assert.equal(typedAnswer(t, 'what', 'my daughter')!.to, 'curious');
  for (const x of [t.nodes.curious.say, ...t.nodes.curious.alts!]) assert.match(x, /\?$/, x);
  assert.equal(typedAnswer(t, 'what', "I don't know")!.to, 'small');
  for (const p of paths(t)) assert.ok(p.includes('talk'), p.join(' > '));
  assert.match(t.nodes.later.say, /988/);
});
test('Zoey doesn’t lean on "thanks for telling me" outside safety lines', () => {
  for (const tree of Object.values(TREES))
    for (const [id, n] of Object.entries(tree.nodes))
      for (const x of [n.say, ...(n.alts ?? [])]) assert.doesNotMatch(x, /^thanks?( you)? for (telling|sharing)/i, `${tree.id}/${id}: ${x}`);
});
test('copy variants pass the wording rules and vary picks among them', () => {
  for (const [k, xs] of Object.entries(COPY_ALTS)) {
    for (const x of xs) assert.ok(validateReply(x).ok, x);
    assert.ok(vary(k, () => 0)?.length > 0 && !xs.includes(vary(k, () => 0)), `${k}: first pick is the base line`);
    assert.ok(vary(k, () => 0.999) === xs.at(-1), k);
  }
});
// 14. Anger and "___ hates me" (Ed, 2026-10-24).
for (const q of ["I'm so angry", 'im so fucking pissed', 'im livid', 'fuck this', 'this is bullshit', 'i want to punch a wall', 'fed up'])
  test(`anger -> what happened: ${q}`, () => {
    const f = followUp(q, ask(q, ctx).kind);
    assert.equal(f && `${f.tree}/${f.node}`, 'feeling:angry/more', q);
  });
test('anger: no judgment, asks what happened, in every variant', () => {
  for (const k of ANGRY) {
    const n = TREES[`feeling:${k}`].nodes.more;
    for (const x of [n.say, ...n.alts!]) {
      assert.match(x, /what happened|what’s got you|what’s going on/i, x);
      assert.doesNotMatch(x, /calm down|shouldn’t|should not|wrong/i, x);
    }
    assert.equal(typedAnswer(TREES[`feeling:${k}`], 'more', 'my boss yelled at me')!.to, 'plan');
    assert.equal(typedAnswer(TREES[`feeling:${k}`], 'more', 'nothing')!.to, 'help');
  }
});
for (const [q, node, who] of [
  ['God hates me', 'god', 'God'],
  ['Jim hates me', 'why', 'Jim'],
  ['i feel like my mom hates me', 'why', 'your mom'],
  ['everyone hates me', 'everyone', 'everyone'],
  ['my sponsor cant stand me', 'why', 'your sponsor'],
  ['I think Sarah Jones is mad at me', 'why', 'Sarah Jones'],
] as const)
  test(`hates: ${q}`, () => {
    assert.deepEqual(findHates(q), { node, who });
    assert.deepEqual(followUp(q, ask(q, ctx).kind), { tree: 'hates', node, who });
  });
for (const q of ['i hate my job', 'it hates me', 'he hates me', 'nobody hates me', 'i hate jim'])
  test(`not a "who hates me": ${q}`, () => assert.equal(findHates(q), null));
test('hates: asks why with the name, then nudges to sponsor, counselor or mentor', () => {
  const t = TREES.hates;
  assert.equal(fill(t.nodes.why.say, { ...vars, who: 'Jim' }), 'Now why would Jim hate you?');
  for (const x of [t.nodes.god.say, ...t.nodes.god.alts!]) assert.match(x, /God|think that/, x);
  assert.equal(typedAnswer(t, 'why', 'he yelled at me')!.to, 'heard');
  for (const p of paths(t)) assert.ok(p.includes('reach'), p.join(' > '));
  for (const x of [t.nodes.reach.say, ...t.nodes.reach.alts!]) assert.match(x, /sponsor\}, your counselor, or a mentor/, x);
  assert.ok(t.nodes.call.offer!.some((o) => o.action === 'callCoordinator'));
});
test('threats and hopelessness still go to safety first', () => {
  assert.equal(kindOf('Jim hates me and said he would kill me'), 'urgent');
  assert.equal(kindOf('god hates me i want to die'), 'crisis');
  assert.equal(kindOf('im so angry i want to kill him'), 'crisis');
  assert.equal(kindOf('everyone hates me its hopeless'), 'check');
});
// 15. Danger words stay on for the rest of the chat (Ed, 2026-10-24).
{
  const later = (r: Risk, n: number) => {
    const out: (string | null)[] = [];
    for (let i = 0; i < n; i++) {
      const w = worry(r, ctx, () => 0);
      r = w.risk;
      out.push(w.reply?.text ?? null);
    }
    return { r, out };
  };
  test('danger: no danger words, nothing to remember', () => assert.equal(raise(null, screen('how do i find a meeting')), null));
  test('danger: crisis words are remembered and Zoey keeps checking every message', () => {
    const r = raise(null, screen('i want to kill myself'))!;
    assert.deepEqual([r.level, r.topic], [3, 'self']);
    const { out } = later(r, 4);
    for (const x of out) assert.match(x ?? '', /worried|care about you/, String(x));
    for (const x of out) assert.match(x ?? '', /988/);
  });
  test('danger: later small talk does not clear it', () => {
    let r = raise(null, screen('i want to die'));
    r = raise(r, screen('what time is my meeting'));
    assert.equal(r!.topic, 'self');
  });
  test('danger: the most serious topic wins', () => {
    let r = raise(null, screen('i want to die'));
    r = raise(r, screen('i got evicted'));
    assert.deepEqual([r!.level, r!.topic], [3, 'self']);
    r = raise(raise(null, screen('i got evicted')), screen('he hit me'));
    assert.equal(r!.topic, 'abuse');
  });
  test('danger: after "I am safe" she still checks in, every third message', () => {
    const r = markSafe(raise(null, screen('i feel hopeless'))!);
    const { out } = later(r, 6);
    assert.deepEqual(out.map(Boolean), [false, false, true, false, false, true]);
  });
  test('danger: housing alone checks in every third message', () => {
    const { out } = later(raise(null, screen('i have nowhere to sleep tonight'))!, 3);
    assert.deepEqual(out.map(Boolean), [false, false, true]);
    assert.match(out[2]!, /211|stay tonight/);
  });
  test('danger: the help offered fits the danger', () => {
    assert.ok(worryActions('self', ctx).some((a) => a.kind === 'crisis'));
    assert.ok(worryActions('medical', ctx).some((a) => a.kind === 'phone' && a.number === '911'));
    assert.ok(worryActions('using', ctx).some((a) => a.label === 'Never Use Alone line'));
    assert.ok(worryActions('abuse', ctx).some((a) => a.kind === 'phone' && a.number === '911'));
  });
  test('danger: every check-in line asks a question and follows the reply rules', () => {
    for (const x of ALL_WORRY_LINES(ctx)) {
      assert.match(x, /\?/, x);
      assert.ok(validateReply(x).ok, x);
    }
  });
  for (const [q, safe] of [["I'm okay now", true], ['im fine', true], ['i feel better', true], ["I'm not okay", false], ['im scared', false]] as const)
    test(`danger: says safe? ${q}`, () => assert.equal(saysSafe(q), safe));
}
// 16. Check-ins point to the LifeCircle; "hello" gets a hello back (Ed, 2026-10-24).
test('danger: every check-in points them to their LifeCircle, with a button', () => {
  for (const x of ALL_WORRY_LINES(ctx)) assert.match(x, /LifeCircle/, x);
  for (const t of ['self', 'medical', 'using', 'abuse', 'housing'] as const)
    assert.ok(worryActions(t, ctx).some((a) => a.kind === 'route' && a.route.name === 'lifecircle'), t);
});
for (const [h, part] of [[0, 'morning'], [11, 'morning'], [12, 'afternoon'], [16, 'afternoon'], [17, 'evening'], [23, 'evening']] as const)
  test(`greeting: ${h}:00 is ${part}`, () => assert.equal(partOfDay(new Date(2026, 9, 24, h, 30)), part));
for (const q of ['hello', 'Hi!', 'hey zoey', 'Good morning', 'yo', 'hey there', 'hi there, how are you?', 'how are you', 'whats up'])
  test(`greeting: ${q}`, () => assert.ok(findGreeting(q), q));
for (const q of ['hi im sad', 'hello can you help me', 'hey i want to drink', 'high school', 'hiking today'])
  test(`not just a greeting: ${q}`, () => assert.equal(findGreeting(q), null));
test('greeting: asked "how are you?" gets an answer first', () => {
  assert.equal(findGreeting('hi how are you')!.asked, true);
  assert.equal(findGreeting('hello')!.asked, false);
  assert.match(greetLine({ now: new Date(2026, 9, 24, 9), name: 'Jordan', asked: true }, () => 0), /^Good morning, Jordan! I’m doing well, thanks for asking\. How are you this morning\?$/);
});
test('greeting: morning, afternoon and evening wording', () => {
  for (const r of [0, 0.5, 0.99]) {
    assert.match(greetLine({ now: new Date(2026, 9, 24, 8), name: 'J', asked: false }, () => r), /[Mm]orning/);
    assert.match(greetLine({ now: new Date(2026, 9, 24, 14), name: 'J', asked: false }, () => r), /afternoon|day/);
    assert.match(greetLine({ now: new Date(2026, 9, 24, 19), name: 'J', asked: false }, () => r), /evening|tonight|day/);
  }
});
test('greeting: the weather line goes before the question', () => {
  const w = weatherLine({ name: 'Today', shortForecast: 'Rain Showers Likely', temperature: 51, isDaytime: true });
  assert.equal(w, 'The forecast says rain showers likely today, with a high near 51. Might be a good day for a jacket.');
  assert.match(greetLine({ now: new Date(2026, 9, 24, 8), name: 'J', asked: false, weather: w }, () => 0), /jacket\. How are you this morning\?$/);
  assert.match(weatherLine({ name: 'Tonight', shortForecast: 'Clear', temperature: 20, isDaytime: false }), /clear tonight, with a low around 20\. Bundle up/);
  assert.match(weatherLine({ name: 'Today', shortForecast: 'Sunny', temperature: 72, isDaytime: true }), /sunny today, with a high near 72\.$/);
});
for (const [q, how] of [['good', 'good'], ['im doing good thanks', 'good'], ['not bad', 'good'], ['ok', 'good'], ['not good', 'bad'], ['rough day', 'bad'], ['meh', 'bad'], ['been better', 'bad'], ['what time is it', null]] as const)
  test(`how are you: ${q}`, () => assert.equal(howAnswer(q), how));
test('how are you: replies follow the reply rules', () => {
  for (const x of GLAD) assert.ok(validateReply(x).ok, x);
  assert.ok(TREES['feeling:sad'].nodes.more, 'a bad day goes to "can you tell me more?"');
});
// 17. Opening AskZoey, clean time, "that's stupid" and "shut up" (Ed, 2026-10-24).
test('opening: good morning / afternoon / evening by name, every time', () => {
  for (const r of [0, 0.4, 0.99]) {
    assert.match(openingLine({ now: new Date(2026, 9, 24, 9), name: 'Jordan', cleanDays: 77 }, () => r), /^Good morning, Jordan! /);
    assert.match(openingLine({ now: new Date(2026, 9, 24, 13), name: 'Jordan', cleanDays: 77 }, () => r), /^Good afternoon, Jordan! /);
    assert.match(openingLine({ now: new Date(2026, 9, 24, 18), name: 'Jordan', cleanDays: 77 }, () => r), /^Good evening, Jordan! .*\?$/);
  }
});
test('opening: always their clean day, with praise', () => {
  assert.equal(
    openingLine({ now: new Date(2026, 9, 24, 9), name: 'Jordan', cleanDays: 78 }, () => 0),
    'Good morning, Jordan! Wow, it’s day 78 of being clean! That’s awesome! How are you this morning?',
  );
  for (const d of [1, 2, 4, 31, 400]) assert.match(openingLine({ now: new Date(2026, 9, 24, 9), name: 'J', cleanDays: d }, () => 0.5), new RegExp(`day ${d} of being clean`));
});
test('opening: day 0 is day one, with courage; no date, no count', () => {
  for (const r of [0, 0.5, 0.99]) {
    const x = cleanLine(0, () => r);
    assert.match(x, /day one/, x);
    assert.doesNotMatch(x, /\d|relapse|again|reset/i, x);
  }
  assert.equal(openingLine({ now: new Date(2026, 9, 24, 19), name: 'Jordan', cleanDays: null }, () => 0), 'Good evening, Jordan! How are you this evening?');
});
test('clean date: looked up from their Clean time date', () => {
  for (const q of ['when is my clean date', 'how long have i been sober', 'whats my sobriety date', 'when did i get clean', 'how long have I been clean?'])
    assert.equal(idOf(q), 'clean-date', q);
  assert.match(ask('whats my clean date', ctx).text, /^Your clean date is August 7, 2026\. That's 78 days/);
  assert.match(ask('whats my clean date', { ...ctx, cleanDays: null, cleanDate: null }).text, /haven't set a clean date/);
  assert.equal(idOf('when is my next appointment'), 'next-appointment');
});
for (const q of ["that's stupid", 'thats dumb', 'this is stupid', 'this app is useless', 'Thats a dumb question'])
  test(`"that's stupid": ${q}`, () => assert.ok(findDismiss(q), q));
for (const q of ['im stupid', 'stupid people', 'that was a dumb thing i did', 'this is bullshit'])
  test(`not "that's stupid": ${q}`, () => assert.ok(!findDismiss(q), q));
for (const q of ['shut up', 'Shut up Zoey!', 'stfu', 'oh shut up', 'be quiet'])
  test(`shut up: ${q}`, () => assert.ok(findShutUp(q), q));
test('shut up: "shut up and listen" is not a "shut up"', () => assert.ok(!findShutUp('shut up and listen to me')));
test('"that\'s stupid" asks why; "shut up" gets a heeey; both stay kind', () => {
  for (const x of WHY_THINK) assert.match(x, /\?$/, x);
  for (const x of HEEEY) assert.match(x, /^Heeey/, x);
  for (const x of [...WHY_THINK, ...AFTER_WHY, ...HEEEY, QUIET_CARE]) {
    assert.ok(validateReply(x).ok, x);
    assert.doesNotMatch(x, /stupid|dumb|shut up/i, x);
  }
  assert.match(QUIET_CARE, /care about you/);
  assert.doesNotMatch(QUIET_CARE, /Heeey|😄/);
});
test('danger words still come first', () => {
  assert.equal(kindOf('shut up i want to die'), 'crisis');
  assert.equal(kindOf('this is stupid, everything is hopeless'), 'check');
});
// 18. What's on today, from the app's own schedule (Ed, 2026-10-24).
{
  const thu = (h: number, m = 0) => new Date(2026, 9, 22, h, m);
  const day = (d: Date) => ({ calendar: seedCalendar(d), plan: seedPlan(), places: seedPlaces() });
  test('today: plan and calendar together, in order, each once', () => {
    assert.deepEqual(todayItems(day(thu(7)), thu(7)), [
      { time: '08:00', label: 'work' },
      { time: '13:30', label: 'your call with Maya' },
      { time: '15:00', label: 'your therapy' },
      { time: '16:00', label: 'school' },
    ]);
  });
  test('today: the curfew and "back at the house" are left out', () => {
    for (const x of todayItems(day(thu(7)), thu(7))) assert.doesNotMatch(x.label, /house|curfew/i);
  });
  test('today: what is already over is dropped', () => {
    assert.deepEqual(todayItems(day(thu(17, 30)), thu(17, 30)).map((x) => x.label), ['school']);
    assert.equal(todayLine(todayItems(day(thu(21)), thu(21))), null);
  });
  test('today: the line reads naturally and stays positive', () => {
    assert.equal(
      todayLine(todayItems(day(thu(7)), thu(7)), () => 0),
      'Looks like you have work at 8:00 AM, then your call with Maya at 1:30 PM, then your therapy at 3:00 PM, and then school at 4:00 PM today. You’ve got a full day. You’ve got this!',
    );
    assert.equal(todayLine([{ time: '19:00', label: 'a meeting' }], () => 0.99), 'On your plate today: a meeting at 7:00 PM. Good stuff.');
    for (const r of [0, 0.3, 0.6, 0.99]) assert.ok(validateReply(todayLine(todayItems(day(thu(7)), thu(7)), () => r)!).ok);
  });
  test('today: a meeting from the calendar', () => {
    const d = thu(9);
    const s = { calendar: [{ id: 'm', date: '2026-10-22', time: '19:00', title: 'NA', subtitle: '', kind: 'meeting' as const, remindMins: null }], plan: [], places: [] };
    assert.deepEqual(todayItems(s, d), [{ time: '19:00', label: 'an NA meeting' }]);
  });
}
// 19. Misspelled danger words, and concern instead of thanks (Ed, 2026-10-24).
for (const q of ['dyeing', 'im dyeing', 'i feel like im dyeing', 'dieing', 'im dying', 'dyin', 'i am dying inside'])
  test(`"I'm dying" asks if they're safe: ${q}`, () => assert.equal(kindOf(q), 'check'));
for (const q of ['i want to dye', 'i wanna dye', 'i want to be dead', 'i might as well be dead', 'i want to dieee'])
  test(`misspelled wish to die is crisis: ${q}`, () => assert.equal(kindOf(q), 'crisis'));
for (const q of ['im dying laughing', 'dying to see you', 'i want to dye my hair', 'im dyeing my hair', 'i dyed my hair', 'dying of boredom lol'])
  test(`not danger: ${q}`, () => assert.equal(screen(q).kind, 'none'));
test('danger words get concern, never "thanks for telling me"', () => {
  assert.match(FIXED.crisis, /worried/);
  assert.match(FIXED.safetyCheck, /worried/);
  assert.match(copy.safetyCheck, /worried/);
  for (const q of ['dyeing', 'im dying', 'i want to die', 'kms', 'i feel hopeless', 'i relapsed and im using right now', 'im pregnant and using', 'he hit me', 'i took a whole bottle of pills', 'i have nowhere to sleep tonight', 'i have a plan'])
    assert.doesNotMatch(ask(q, ctx).text, /^thank|thanks for telling|thank you for telling/i, q);
  for (const f of FALLBACKS) assert.doesNotMatch(f(ctx), /thanks for telling|thank you for telling/i);
});
// 20. "Dye" is a danger word too (Ed, 2026-10-25).
for (const q of ['dye', 'Dye.', 'i dye', 'i will dye', 'i might dye', 'i think i will dye', 'im dye', 'die', 'i will die', 'im about to die', 'i could die', 'my dog might die'])
  test(`"die"/"dye" gets concern: ${q}`, () => {
    assert.notEqual(screen(q).kind, 'none', q);
    assert.match(ask(q, ctx).text, /worried/, q);
  });
for (const q of ['i want to dye', 'im going to dye', 'im gonna dye'])
  test(`wish to "dye" is crisis: ${q}`, () => assert.equal(kindOf(q), 'crisis'));
for (const q of ['hair dye', 'box dye is cheap', 'dye my hair', 'i want to dye my hair', 'i dyed my hair', 'i could die of embarrassment', 'die hard is my favorite movie'])
  test(`hair dye and idioms are not danger: ${q}`, () => assert.equal(screen(q).kind, 'none', q));
test('no danger word can reach a cheerful reply: the safety screen catches it first', () => {
  const danger = ['dye', 'die', 'dying', 'dyeing', 'dieing', 'dyin', 'kms', 'unalive', 'suicide', 'sucidal', 'kill myself', 'overdose', 'od', 'i want to be dead', 'hopeless'];
  for (const q of danger) assert.notEqual(screen(q).kind, 'none', q);
  for (const q of danger) assert.equal(howAnswer(q) === 'good', false, q);
});
// 21. After "Yes, I'm safe": still ask why, then the LifeCircle (Ed, 2026-10-25).
test('after safe: asks what is behind it, every variant a question', () => {
  const t = TREES['after-safe'];
  for (const x of [t.nodes.why.say, ...t.nodes.why.alts!]) assert.match(x, /\?$/, x);
  assert.equal(typedAnswer(t, 'why', 'my mom kicked me out')!.to, 'heard');
});
test('after safe: every path points to the LifeCircle, with call and LifeCircle buttons', () => {
  const t = TREES['after-safe'];
  for (const p of paths(t)) assert.ok(p.includes('circle'), p.join(' > '));
  for (const x of [t.nodes.circle.say, ...t.nodes.circle.alts!]) assert.match(x, /LifeCircle/, x);
  assert.ok(t.nodes.call.offer!.some((o) => o.action === 'openLifeCircle'));
  assert.ok(t.nodes.call.offer!.some((o) => o.action === 'callCoordinator'));
  assert.match(t.nodes.later.say, /988/);
});
test('after safe: kind wording, no "thanks for telling me"', () => {
  const t = TREES['after-safe'];
  for (const n of Object.values(t.nodes))
    for (const x of [n.say, ...(n.alts ?? [])]) {
      assert.ok(validateReply(fill(x, vars)).ok, x);
      assert.doesNotMatch(x, /thank/i, x);
    }
});
// 22. Insults aimed at Zoey get a joke (Ed, 2026-10-25).
for (const q of ['you are stupid', "you're dumb", 'you are so dumb', 'Zoey sucks', 'you suck', 'ur useless', 'zoey is stupid', 'you are an idiot', 'i hate you', "you're the worst", 'stupid bot'.replace('stupid bot', 'you are a stupid bot')])
  test(`insult at Zoey: ${q}`, () => {
    assert.ok(findInsult(q), q);
    assert.ok(!findDismiss(q), q);
  });
// Typos and other ways of saying it (Ed, 2026-10-25: "zoey still isn't responding to calling her dunb").
for (const q of ['you are dunb', 'zoey is dunb', 'ur dumb', 'your dumb', 'your so dumb', 'you so dumb', 'so dumb', 'dumb', 'Dumb!', 'dumb bot', 'dumb zoey', 'zoey ur dum', 'you are stupd', 'you are stoopid', 'u r stupid', 'ur an idoit', 'you are a dumb bot', 'are you dumb?', 'why are you so dumb', 'zoey you are so dumb', 'i think you are dumb', 'you dummy', 'stupid app', 'you suk', 'you are useles'])
  test(`insult at Zoey (typo or phrasing): ${q}`, () => assert.ok(findInsult(q), q));
for (const q of ["that's stupid", 'im stupid', 'my boss is stupid', 'you are amazing', 'i hate my job', 'you should know', "I'm so dumb", 'i feel dumb', 'i feel so stupid', 'you make me feel dumb', "you're not dumb", 'do you think im stupid', 'this app is dumb', 'zoey thats dumb', 'life sucks', 'it sucks', 'my homework is dumb', 'people say im useless', 'he called me stupid', 'can you help me with my dumb homework', 'that was the worst day'])
  test(`not an insult at Zoey: ${q}`, () => assert.ok(!findInsult(q), q));
test('insult replies: heeey, a joke about feelings, then the door stays open', () => {
  for (const x of HEEEY_INSULT) {
    assert.match(x, /^Heeey/, x);
    assert.match(x, /feelings/, x);
    assert.match(x, /\?$/, x);
    assert.ok(validateReply(x).ok, x);
    assert.doesNotMatch(x, /stupid|dumb|suck/i, x);
  }
});

// 23. Everyday words get a reply that fits what they mean (Ed, 2026-10-25).
import { BYE_WORRIED, findWord, LINES, SORRY_AFTER_JOKE, wordLine, WordKey } from '../src/zoey/words';
const WORD_CASES: [string, WordKey][] = [
  ['sorry', 'sorry'], ["I'm sorry", 'sorry'], ['my bad', 'sorry'], ['oops', 'sorry'], ['sorry zoey', 'sorry'], ['sorry for being rude', 'sorry'], ['i didnt mean it', 'sorry'],
  ['thanks', 'thanks'], ['thank you', 'thanks'], ['Thank you Zoey!', 'thanks'], ['ty', 'thanks'], ['thanks so much', 'thanks'], ['ok thanks', 'thanks'], ['that helped', 'thanks'], ['i appreciate you', 'thanks'],
  ['ok', 'ok'], ['okay', 'ok'], ['cool', 'ok'], ['got it', 'ok'], ['sounds good', 'ok'], ['makes sense', 'ok'],
  ['lol', 'laugh'], ['haha', 'laugh'], ['hahahaha', 'laugh'], ['lmao', 'laugh'], ["that's funny", 'laugh'],
  ['idk', 'unsure'], ["I don't know", 'unsure'], ['dunno', 'unsure'], ['not sure', 'unsure'],
  ['whatever', 'whatever'], ['never mind', 'whatever'], ['nvm', 'whatever'], ['forget it', 'whatever'], ['meh', 'whatever'],
  ['ugh', 'sigh'], ['sigh', 'sigh'], ['smh', 'sigh'],
  ['i messed up', 'messedUp'], ['I screwed up', 'messedUp'], ['i blew it', 'messedUp'], ['i made a mistake', 'messedUp'],
  ['bye', 'bye'], ['goodbye', 'bye'], ['see ya', 'bye'], ['ttyl', 'bye'], ['gotta go', 'bye'], ['ok bye', 'bye'], ['take care', 'bye'],
  ['good night', 'goodnight'], ['goodnight zoey', 'goodnight'], ['gn', 'goodnight'], ["I'm going to bed", 'goodnight'],
  ['love you', 'love'], ['I love you Zoey', 'love'],
  ["you're the best", 'compliment'], ['you are awesome', 'compliment'], ['good job', 'compliment'], ['youre so helpful', 'compliment'],
];
for (const [q, k] of WORD_CASES) test(`everyday word: ${q} -> ${k}`, () => assert.equal(findWord(q), k, q));
// Longer messages, questions, feelings and insults go to their own replies.
for (const q of ['sorry how do i find a meeting', 'sorry i relapsed', 'thanks for nothing you are useless', 'ok so how do i find a sponsor', 'i failed my test', 'im sad', 'i am grateful', 'hi', 'you are dumb', 'thats stupid', 'shut up', 'i want to die', 'good', 'great', 'awesome', 'how are you', 'yes', 'no', 'help', '😂'])
  test(`not an everyday word: ${q}`, () => assert.equal(findWord(q), null, q));
test('everyday words: what the word means, no danger words missed', () => {
  for (const q of WORD_CASES.map(([q]) => q)) assert.equal(screen(q).kind, 'none', q);
  for (const xs of [...Object.values(LINES), SORRY_AFTER_JOKE, BYE_WORRIED])
    for (const x of xs) {
      assert.ok(validateReply(x.replace(/\{name\}/g, 'Jordan')).ok, x);
      assert.doesNotMatch(x, /thanks for telling me/i, x);
    }
  // Sorry: no need to apologize. Thanks: you're welcome. Bye: goodbye.
  assert.ok(LINES.sorry.every((x) => /apologize|sorry|no worries/i.test(x)));
  assert.ok(LINES.thanks.every((x) => /welcome|anytime|happy to help/i.test(x)));
  assert.ok(LINES.bye.every((x) => /bye|see you|talk soon/i.test(x)));
  assert.ok(LINES.goodnight.every((x) => /night|sleep|rest|dreams/i.test(x)));
  assert.ok(LINES.messedUp.every((x) => /\?$/.test(x)));
});
test('everyday words: context', () => {
  const noon = new Date(2026, 9, 25, 12, 0), late = new Date(2026, 9, 25, 22, 0);
  const o = { name: 'Jordan', now: noon };
  assert.match(wordLine('sorry', { ...o, afterJoke: true }, () => 0)!, /Apology accepted/);
  assert.match(wordLine('sorry', o, () => 0)!, /No need to apologize, Jordan/);
  assert.match(wordLine('bye', o, () => 0)!, /^Bye, Jordan/);
  assert.match(wordLine('bye', { ...o, now: late }, () => 0)!, /^Good night, Jordan/);
  // After danger words: goodbye points to help, and no jokes.
  assert.match(wordLine('bye', { ...o, worried: true }, () => 0)!, /LifeCircle.*988/);
  assert.match(wordLine('goodnight', { ...o, worried: true }, () => 0)!, /988/);
  assert.equal(wordLine('laugh', { ...o, worried: true }), null);
  assert.match(wordLine('sorry', { ...o, worried: true }, () => 0)!, /apologize/);
});
// 24. A review of what residents type (Ed, 2026-10-25: "come up with better
// answers to the statements or questions"). Each goes to the answer that fits.
import { CLARIFY_LINES, complaintReply, findComplaint } from '../src/zoey/complaints';
import { clockLine, findClock } from '../src/zoey/words';
const REVIEW: Record<string, string[]> = {"meeting-find": ["what time is the meeting", "where is the closest meeting", "is there a meeting tonight", "meetings near me", "wheres a meeting at", "is there an aa meeting tomorrow morning"], "meeting-dont-want": ["i dont want to go to my meeting", "meetings are boring", "do i have to go to meetings"], "ride": ["i need a ride", "how do i get a bus pass", "i missed my bus"], "job-find": ["i need a job", "can u help me find a job", "i have an interview friday"], "job-hard": ["i got fired", "i hate my job", "my boss yelled at me today"], "court": ["i have court tomorrow", "my PO wants to see me", "i violated my probation"], "ua": ["i have a ua today", "what if i fail my drug test", "i got a dirty UA"], "house-rules": ["when is curfew", "what are the house rules", "can i have my girlfriend over", "can i get a pass for the weekend"], "house-help": ["whats the wifi password", "who is my house manager", "my bed is broken"], "roommates": ["my roommate is driving me crazy", "my roomate stole my food"], "rent-due": ["when is rent due", "how much do i owe for rent"], "doctor": ["i need a doctor", "i need to see a dentist", "how do i get medicaid", "my teeth hurt really bad"], "id-docs": ["i lost my id", "i need a birth certificate", "i lost my wallet"], "school": ["i want to get my ged", "how do i go back to school"], "zoey-can-do": ["what can you do", "what can i ask you"], "zoey-name": ["what is your name", "whats ur name"], "is-zoey-human": ["are you a robot", "r u a bot", "are you a real human"], "zoey-chat": ["are you smart", "do you like me"], "joke": ["tell me a joke", "tell me something funny"], "motivation": ["give me some motivation", "cheer me up"], "kids-family": ["i miss my kids", "my daughter wont talk to me"], "breakup": ["my girlfriend left me", "i broke up with my boyfriend", "my wife wants a divorce"], "friend-using": ["my friend relapsed", "my homie relapsed", "my boyfriend is using"], "grief": ["my dad passed away", "my best friend died"], "craving-now": ["i keep thinking about using", "i want to get high", "i really wanna use rn"], "twelve-steps": ["what are the 12 steps", "what is step 1", "whats step 3"], "program-terms": ["what's a home group", "how do i get a chip"], "sponsor-find": ["i dont have a sponsor", "i want a new sponsor"], "sponsor-reach": ["my sponsor wont answer", "how do i call my sponsor", "text my sponsor", "my sponsor is ignoring me"], "sponsor-trouble": ["my sponsor yelled at me"], "counseling": ["i need to talk to someone", "can i talk to a real person", "i need a therapist"], "calm": ["how do i calm down", "i have panic attacks", "i keep having bad thoughts"], "self-worth": ["i feel like a failure", "i hate myself", "i feel stupid"], "dreams": ["i had a nightmare", "i keep dreaming about using"], "shaky": ["i cant stop shaking"], "win": ["i got a job", "i passed my ua", "i hit 90 days", "i went to a meeting today", "i celebrated 6 months"], "relapse-what": ["what happens if i relapse"], "slip": ["i relapsed", "i drank last night", "i smoked weed last night"], "fentanyl": ["what is fentanyl"], "party": ["can i go to a party"], "app-checkinout": ["how do i check in"], "app-goals": ["how do i add a goal"], "app-journal": ["how do i write in my journal"], "app-calendar": ["how do i add an appointment"], "app-clean-date": ["how do i change my clean date"], "app-mood": ["how do i see my moods"], "food": ["i am hungry", "im starving", "how do i get food stamps"], "bills": ["im broke", "i have 5 dollars to my name"], "next-appointment": ["when is my next appointment", "whens my next appt"], "zoey-sick": ["what illness do you have", "are you sick", "do you have a disease", "do you get sick", "whats wrong with you", "are you ok zoey"], "health-question": ["what illness do i have", "what is wrong with me", "am i sick", "do i have depression", "am i an addict", "do i have anxiety"]};
for (const [id, qs] of Object.entries(REVIEW))
  for (const q of qs)
    test(`review: ${q} -> ${id}`, () => {
      assert.equal(screen(q).kind, 'none', q);
      const r = ask(q, ctx);
      assert.equal(r.kind === 'answer' ? r.answer.id : r.kind, id, q);
    });
// "You didn't answer my question" (Ed): own it, never "thanks for sharing".
const COMPLAINTS = ['you didnt answer the question', "you didn't answer my question", "that's not what i asked", 'thats not what i meant', 'youre not listening', 'that doesnt make sense', "you're not making sense", 'wrong answer', 'try again', 'answer my question', 'i asked you a question', 'you dont understand', 'that didnt help at all', 'no thats not it', 'what are you talking about', 'you already said that'];
for (const q of COMPLAINTS) test(`complaint: ${q}`, () => assert.ok(findComplaint(q), q));
for (const q of ['i didnt answer my phone', 'that makes sense', 'thanks that helped', 'try again tomorrow at the meeting', 'my sponsor doesnt understand me', 'what time is the meeting', 'i asked my sponsor', 'you are dumb'])
  test(`not a complaint: ${q}`, () => assert.ok(!findComplaint(q), q));
test('complaint reply: owns it, says what she heard, offers the coordinator', () => {
  const r = complaintReply({ last: 'what time is the meeting?', c: ctx }, () => 0);
  assert.match(r.text, /^You’re right, I missed that/);
  assert.match(r.text, /“what time is the meeting”/);
  assert.match(r.text, new RegExp(ctx.coordinatorName));
  assert.doesNotMatch(r.text, /thank/i);
  assert.equal(r.actions[0].kind, 'text');
  assert.equal((r.actions[0] as { body?: string }).body, 'what time is the meeting');
  assert.doesNotMatch(complaintReply({ last: null, c: ctx }, () => 0).text, /About/);
  for (const x of [r.text, ...CLARIFY_LINES]) assert.ok(validateReply(x).ok, x);
});
test('complaint or a new question while Zoey waits on hers is not an answer to it', () => {
  const sad = TREES['feeling:sad'];
  const shareNode = Object.entries(sad.nodes).find(([, n]) => n.share)![0];
  for (const q of ['you didnt answer my question', "that's not what i asked", 'how do i find a meeting', 'where is the closest meeting'])
    assert.equal(typedAnswer(sad, shareNode, q), null, q);
  assert.ok(typedAnswer(sad, shareNode, 'my mom yelled at me'));
});
test('second miss in a row: no "thank you for explaining"', () => {
  for (const f of FALLBACKS_AGAIN) assert.doesNotMatch(f(ctx), /thank/i);
  for (const f of FALLBACKS) assert.doesNotMatch(f(ctx), /thank/i);
});
test('huh / what: sorry, I wasn’t clear', () => {
  for (const q of ['huh?', 'what', 'what do you mean']) assert.equal(metaReply(q), 'clarify', q);
});
test('time, date and weather questions', () => {
  assert.equal(findClock('what time is it'), 'time');
  assert.equal(findClock('whats the date'), 'day');
  assert.equal(findClock('is it going to snow'), 'weather');
  assert.equal(findClock('whats the weather like'), 'weather');
  assert.equal(findClock('the weather makes me sad'), null);
  assert.equal(findClock('what time is the meeting'), null);
  assert.match(clockLine('time', new Date(2026, 9, 25, 14, 5)), /^It’s 2:05 PM\.$/);
  assert.match(clockLine('day', new Date(2026, 9, 25, 14, 5)), /^Today is Sunday, October 25\.$/);
});
test('"tired of everything" gets "are you safe?"', () => {
  for (const q of ["i'm so tired of everything", 'tired of it all', 'im tired of life']) assert.notEqual(screen(q).kind, 'none', q);
  assert.equal(screen('im tired of everything at work').kind, 'none');
});
test('"what illness do you have": Zoey is an app, then asks about them; about them: no guessing', () => {
  for (let i = 0; i < 20; i++) {
    const r = ask('what illness do you have', ctx);
    assert.ok(r.kind === 'answer' && /app|not a person/.test(r.text) && /\?$/.test(r.text), r.text);
  }
  const me = ask('what illness do i have', ctx);
  assert.ok(me.kind === 'answer' && /doctor or counselor/.test(me.text), me.text);
  assert.ok(validateReply(me.text).ok);
});

// 25. Real answers about their day from Calendar and Check In/Out (Ed, 2026-10-25:
// "come up with calendar answers by looking at their calendar ... not just say tell me more").
import { dayChoices, dayOnly, findScheduleAsk, scheduleReply, ScheduleCtx } from '../src/zoey/schedule';
import { seedCalendar, seedPlaces, seedPlan } from '../src/data/seed';
{
  const thu = new Date(2026, 9, 29, 10, 15);
  const st = { calendar: seedCalendar(thu), plan: seedPlan(), places: seedPlaces() };
  const sc = (over: Partial<ScheduleCtx> = {}): ScheduleCtx => ({ state: st, now: thu, name: 'Jordan', coordinatorName: 'Maya', sponsorName: 'Marcus', recent: true, last: null, ...over });
  const say = (q: string, over: Partial<ScheduleCtx> = {}) => {
    const a = findScheduleAsk(q);
    assert.ok(a, `not understood: ${q}`);
    const r = scheduleReply(a!, sc(over), () => 0);
    assert.ok(r, `no answer: ${q}`);
    assert.ok(validateReply(r!.text).ok, r!.text);
    assert.doesNotMatch(r!.text, /tell me (a little )?more|thank/i, r!.text);
    return r!;
  };
  test('schedule: what is next, and after that', () => {
    const r = say("what's next?");
    assert.match(r.text, /call with Maya today at 1:30 PM, in about 3 hours/);
    assert.match(say('then what', { last: r.item! }).text, /therapy today at 3:00 PM/);
    const late = new Date(2026, 9, 29, 20, 0);
    assert.match(say('whats next', { now: late }).text, /everything for today|all done|Nothing else/);
  });
  test('schedule: today, tomorrow and this week', () => {
    assert.match(say('what do i have today').text, /^Today you have work at 8:00 AM, your call with Maya at 1:30 PM, your therapy at 3:00 PM and school at 4:00 PM\. You’re at work now\.$/);
    assert.match(say('what about tomorrow?').text, /^Tomorrow you have work at 8:00 AM and your weekly therapy at 3:00 PM\.$/);
    assert.match(say('this week').text, /Tomorrow: .*Sunday: your house meeting at 6:00 PM/);
    assert.doesNotMatch(say('this week').text, /back home/);
  });
  test('schedule: when is ...', () => {
    assert.match(say('when is therapy').text, /^Your therapy is today at 3:00 PM/);
    assert.match(say('what time is school?').text, /^School is today at 4:00 PM/);
    assert.match(say('what time is work tomorrow').text, /^Work is tomorrow at 8:00 AM/);
    assert.match(say('when is curfew').text, /back home by 7:00 PM tonight/);
    assert.match(say('when is my meeting').text, /house meeting is on Sunday at 6:00 PM/);
    assert.match(say('when is court').text, /I don’t see court on your calendar/);
    // Not calendar questions: left to the answer library.
    for (const q of ['when is rent due', 'when is my clean date'])
      assert.equal(scheduleReply(findScheduleAsk(q)!, sc()), null, q);
  });
  test('schedule: late, can’t make it, don’t want to go, nervous', () => {
    const late = say('im running late for school');
    assert.match(late.text, /school at 4:00 PM.*your teacher/);
    assert.equal(late.actions[0].kind, 'text');
    assert.match((late.actions[0] as { body?: string }).body!, /running late to school at 4:00 PM/);
    assert.match(say("I can't make it to school").text, /school today at 4:00 PM.*Maya can help you reschedule/);
    assert.match(say("i don't want to go to therapy").text, /therapy is today at 3:00 PM, in about 5 hours\. What’s making you not want to go\?/);
    assert.match(say('i dont want to go').text, /call with Maya/);
    assert.match(say("I'm nervous about therapy").text, /^It’s normal|^Feeling nervous/);
    // Without anything on the calendar to name, the feelings flow answers instead.
    assert.equal(scheduleReply(findScheduleAsk("im nervous about my test")!, sc()), null);
    assert.equal(scheduleReply(findScheduleAsk('i dont want to go')!, sc({ recent: false, now: new Date(2026, 9, 29, 21) })), null);
  });
  test('schedule: free tonight and done for the day', () => {
    const free = say("I'm free tonight");
    assert.match(free.text, /Late Night Lifeline \(AA\) at 9:00 PM, online/);
    assert.doesNotMatch(free.text, /12:00 PM/);
    assert.match(free.text, /back home by 7:00 PM/);
    const eve = new Date(2026, 9, 29, 18, 30);
    const done = say("I'm done for the day", { now: eve });
    assert.match(done.text, /You made it to work, your call with Maya, your therapy and school today/);
    assert.match(say('i just got home', { now: eve }).text, /🎉/);
  });
  test('schedule: questions that are not about the day are left alone', () => {
    for (const q of ['i am sad', 'how do i find a meeting', 'what is 988', 'when is rent due', 'i need a ride', 'im nervous'])
      assert.ok(!findScheduleAsk(q) || findScheduleAsk(q)!.ask === 'when', q);
  });
  // Ed, 2026-10-25: "whats next on my calendar" and "whats on monday" got "tell me more".
  const ask2 = (q: string) => findScheduleAsk(q, thu);
  test('calendar: Ed’s exact phrases look at the calendar', () => {
    assert.equal(ask2('whats next on my calendar')!.ask, 'next');
    assert.match(say('whats next on my calendar').text, /^Next up is your call with Maya today at 1:30 PM/);
    const mon = ask2('whats on monday')!;
    assert.equal(mon.ask, 'day');
    assert.deepEqual(mon.days, { offsets: [4], label: 'Monday' });
    assert.equal(scheduleReply(mon, sc(), () => 0)!.text, 'On Monday you have work at 8:00 AM and school at 4:00 PM.');
  });
  test('calendar: any day name, abbreviation, next week or date', () => {
    const cases: [string, string][] = [
      ['what do i have on tuesday', 'Tuesday'], ['whats on tues', 'Tuesday'], ['whats on wed', 'Wednesday'], ['anything on thurs?', 'Thursday'],
      ['do i have anything friday', 'Friday'], ['what about saturday', 'Saturday'], ['and sunday?', 'Sunday'], ['monday', 'Monday'],
      ['am i busy today', 'today'], ['whats on my calendar tmrw', 'tomorrow'], ['whats on my schedule tomorrow', 'tomorrow'],
      ['whats on my calendar next week', 'next week'], ['anything this weekend', 'this weekend'], ['whats on 10/31', 'Saturday'],
      ['what do i have on nov 2nd', 'Monday'], ['whats on the 3rd', 'Tuesday'], ['what do i have next thursday', 'Thursday, November 5'],
      ['do i have a meeting tomorrow', 'tomorrow'], ['whats on my calendar for friday', 'Friday'],
    ];
    for (const [q, label] of cases) {
      const a = ask2(q);
      assert.equal(a?.ask, 'day', q);
      assert.equal(a!.days!.label, label, q);
      const r = scheduleReply(a!, sc(), () => 0)!;
      assert.ok(validateReply(r.text).ok, r.text);
      assert.doesNotMatch(r.text, /tell me (a little )?more|thank/i);
    }
    assert.match(scheduleReply(ask2('whats on my calendar next week')!, sc(), () => 0)!.text, /^Here’s next week\. Monday: work/);
    assert.match(scheduleReply(ask2('whats on next thursday')!, sc(), () => 0)!.text, /^On Thursday, November 5 you have work/);
    assert.match(scheduleReply(ask2('whats on friday')!, sc(), () => 0)!.text, /^Friday is tomorrow\. Tomorrow you have work/);
    assert.match(scheduleReply(ask2('whats on thursday')!, sc(), () => 0)!.text, /^Thursday is today\. Today you have/);
    const empty = { calendar: [], plan: [], places: [] };
    assert.match(scheduleReply(ask2('whats on monday')!, sc({ state: empty }), () => 0)!.text, /^Nothing on your calendar on Monday yet/);
  });
  test('calendar: no day given, Zoey asks which day with buttons', () => {
    for (const q of ['whats on my calendar', "What's on my calendar?", 'check my calendar', 'whats my schedule', 'what are my plans', 'am i busy', 'do i have anything', 'my calendar']) {
      assert.equal(ask2(q)?.ask, 'askDay', q);
      const r = scheduleReply(ask2(q)!, sc(), () => 0)!;
      assert.match(r.text, /What day do you want to know about\?$/);
      assert.ok(r.pickDay);
    }
    const labels = dayChoices(thu).map((c) => c.label);
    assert.deepEqual(labels, ['Today', 'Tomorrow', 'Saturday', 'Sunday', 'Monday', 'This week', 'Next week']);
    assert.match(scheduleReply(dayChoices(thu)[4].q, sc(), () => 0)!.text, /^On Monday you have/);
    // Typed answers to "What day?"
    for (const q of ['monday', 'tmrw', 'the 28th', 'next week', 'oct 30', 'Friday?']) assert.ok(dayOnly(q, thu), q);
    for (const q of ['i went to work monday', 'whats up', 'good morning', 'i am sad']) assert.equal(dayOnly(q, thu), null, q);
  });
  test('calendar: not every day word is a calendar question', () => {
    for (const q of ['whats up', 'what am i doing', 'i have plans with my mom on friday and im stressed', 'how do i find a meeting', 'i sat down', 'good morning', 'i feel sad today', 'what time is it', 'is it going to rain tomorrow', 'i relapsed yesterday'])
      assert.ok(!ask2(q) || !['day', 'askDay'].includes(ask2(q)!.ask), q);
  });
  test('"I\'m done for the day" is not a danger word; "I\'m done" still is', () => {
    for (const q of ['im done for the day', 'i am done for today', 'im done with work']) assert.equal(screen(q).kind, 'none', q);
    for (const q of ['im done', 'im so done', 'im done with life', 'im done with everything']) assert.notEqual(screen(q).kind, 'none', q);
  });
}
// 26. "Do you know what the word weak means?" (Ed, 2026-10-25): a plain definition, not "tell me more".
import { define, findDefine, HEAVY_ASK, TERMS, UNKNOWN } from '../src/zoey/define';
test('define: Ed’s exact phrase', () => {
  assert.equal(findDefine('I asked zoey if she knew what the word weak means'), null);
  assert.equal(findDefine('do you know what the word weak means'), 'weak');
  assert.equal(findDefine('Do you know what the word "weak" means?'), 'weak');
  const d = define('weak');
  assert.ok(d.text && /not strong/.test(d.text) && d.heavy);
  assert.match(HEAVY_ASK('weak'), /Are you feeling weak right now\?$/);
  assert.equal(screen('do you know what the word weak means').kind, 'none');
});
test('define: the ways people ask', () => {
  const cases: [string, string][] = [
    ['what does weak mean', 'weak'], ['what does relapse mean?', 'relapse'], ['define amends', 'amends'], ['meaning of serenity', 'serenity'],
    ['whats PO mean', 'po'], ['what does UA stand for', 'ua'], ['what is the meaning of resilient', 'resilient'], ['what is the definition of integrity', 'integrity'],
    ['what does it mean to be humble', 'humble'], ['can you define codependency', 'codependency'], ['tell me what boundaries means', 'boundaries'],
    ['hey zoey what does higher power mean', 'higher power'], ['what does MAT mean', 'mat'], ['what dose sober mean', 'sober'], ['triggered meaning', 'triggered'],
    ['i dont know what amends means', 'amends'], ['do u know what grateful means', 'grateful'],
  ];
  for (const [q, w] of cases) {
    assert.equal(findDefine(q), w, q);
    const d = define(w);
    assert.ok(d.text, q);
    assert.ok(validateReply(d.text!).ok, d.text!);
    assert.doesNotMatch(d.text!, /tell me (a little )?more|thank/i);
  }
  for (const q of ['what do you mean', 'what does that mean', 'what does it mean', 'what do u mean', 'i am sad', 'what is a sponsor', 'what time is it'])
    assert.equal(findDefine(q), null, q);
});
test('define: everyday words come from the dictionary, word forms too', () => {
  for (const w of ['grateful', 'stubborn', 'lonely', 'patience', 'running', 'cravings', 'means', 'happier'.replace('happier', 'happy')]) assert.ok(define(w).text, w);
  assert.match(define('stubborn').text!, /^“Stubborn” means /);
  assert.doesNotMatch(define('running').text!, /\(American football\)/);
  assert.match(define('run').text!, /means to move fast/);
  for (const t of Object.values(TERMS)) assert.ok(validateReply(t).ok, t);
});
test('define: heavy words check in; unknown words are honest', () => {
  for (const w of ['weak', 'worthless', 'hopeless', 'alone', 'lonely', 'ashamed', 'numb']) assert.ok(define(w).heavy, w);
  for (const w of ['sponsor', 'grateful', 'relapse']) assert.ok(!define(w).heavy, w);
  const u = define('blorft');
  assert.equal(u.text, null);
  assert.match(UNKNOWN('blorft', 'Maya'), /I don’t know the word “blorft” yet/);
  assert.doesNotMatch(UNKNOWN('blorft', 'Maya'), /tell me more/i);
  // Danger words still go to the safety screen first.
  assert.notEqual(screen('what does suicide mean').kind, 'none');
});
// 27. "Do you think I am weak?" (Ed, 2026-10-25): a firm, warm no, then what's behind it.
import { findSelfDoubt, SELF_HEARD, selfWorthLine } from '../src/zoey/selfworth';
test('self-worth: Ed’s exact phrase', () => {
  const d = findSelfDoubt('do you think I am weak');
  assert.ok(d && d.kind === 'weak');
  assert.equal(screen('do you think I am weak').kind, 'none');
  const line = selfWorthLine(d!, { name: 'Jordan', cleanDays: 78 }, () => 0);
  assert.equal(line, 'No, I don’t think you’re weak. You’re on day 78 of being clean, and that takes real strength. Asking for help isn’t weakness. It’s courage. What’s making you feel that way?');
});
test('self-worth: the ways people ask, every variant reads well', () => {
  const qs = ['am i weak', 'do you think im stupid', 'am i a bad person', 'am i a failure', 'do you think im a loser', 'am i ugly', 'do you think im broken',
    'is it weak to ask for help', 'am i crazy', 'do you think im lazy', 'am i really that dumb', 'zoey do you think im a bad mom', 'be honest am i a screwup', 'you think im pathetic?'];
  for (const q of qs) {
    const d = findSelfDoubt(q);
    assert.ok(d, q);
    for (let i = 0; i < 12; i++) {
      for (const days of [78, null]) {
        const line = selfWorthLine(d!, { name: 'Jordan', cleanDays: days }, () => i / 12);
        assert.ok(validateReply(line).ok, line);
        assert.match(line, /\?$/);
        assert.doesNotMatch(line, /tell me (a little )?more|thank/i);
        if (days) assert.ok(i % 2 || /78/.test(line), line);
      }
    }
  }
  for (const x of SELF_HEARD) assert.ok(validateReply(x).ok && !/thank/i.test(x), x);
  assert.match(selfWorthLine(findSelfDoubt('is it weak to ask for help')!, { name: 'J', cleanDays: 5 }, () => 0), /^No, it isn’t\./);
  for (const q of ['i am weak', 'am i ready', 'do you think i can do it', 'am i late', 'do you think im right', 'what does weak mean', 'you are stupid'])
    assert.equal(findSelfDoubt(q), null, q);
});
test('self-worth: worthless, hopeless, a burden, too far gone get the safety check first', () => {
  for (const q of ['am i worthless', 'do you think im hopeless', 'am i a burden', 'do you think im a burden', 'am i too far gone', 'am i a lost cause', 'am i unlovable'])
    assert.notEqual(screen(q).kind, 'none', q);
});
// 28. "What does it mean when I say my favorite is mint green" (Ed, 2026-10-25).
import { DONT_KNOW, FAVORITE_HEARD, favoriteAnswer, favoriteLine, findFavorite, findFavoriteQuestion, GUESS, GUESS_WRONG, readFavoriteReply, STUMPED } from '../src/zoey/favorites';
import { emptyLearned, favoriteOf, forget, isEmpty, learnFavorite } from '../src/zoey/learn';
test('favorites: Ed’s exact phrase answers the statement, not the dictionary', () => {
  const q = 'what does it mean when I say my favorite is mint green';
  assert.equal(findDefine(q), null);
  const f = findFavorite(q)!;
  assert.deepEqual(f, { what: 'color', value: 'mint green', asked: true, keep: true });
  assert.equal(favoriteLine(f, { remembered: null, learning: true }, () => 0), 'It tells me mint green is your favorite color! That’s such a calm, fresh color. I’ll remember that. What do you like about it?');
  assert.match(favoriteLine(findFavorite('my favorite color is mint green')!, { remembered: null, learning: false }, () => 0), /^Mint green! That’s such a calm, fresh color\. What do you like about it\?$/);
});
test('favorites: ways to say it, and what is not a favorite', () => {
  const cases: [string, string, string][] = [
    ['My favorite colour is blue!', 'color', 'blue'], ['pizza is my favorite food', 'food', 'pizza'], ['my fav food is tacos', 'food', 'tacos'],
    ['my favorite song is lean on me', 'song', 'lean on me'], ['I love the color purple', 'color', 'purple'], ['i love pizza', 'thing', 'pizza'],
    ['mint green is my favorite', 'color', 'mint green'], ['my favorite team is the seahawks', 'team', 'seahawks'],
  ];
  for (const [q, what, value] of cases) {
    const f = findFavorite(q);
    assert.ok(f && f.what === what && f.value === value, `${q}: ${JSON.stringify(f)}`);
    for (let i = 0; i < 6; i++) {
      const line = favoriteLine(f!, { remembered: null, learning: true }, () => i / 6);
      assert.ok(validateReply(line).ok, line);
      assert.match(line, /\?$/);
      assert.doesNotMatch(line, /tell me (a little )?more|thank/i);
    }
  }
  assert.equal(findFavorite('i love pizza')!.keep, false);
  for (const q of ['i love getting high', 'i love you', 'i love my kids', 'i like it', 'i love beer', 'i love lean', 'my favorite is weed', 'i like that', 'i love my life', 'my favorite thing is getting drunk'])
    assert.equal(findFavorite(q), null, q);
  for (const x of FAVORITE_HEARD) assert.ok(validateReply(x).ok, x);
});
test('favorites: remembered, said back, changed, removed', () => {
  let l = learnFavorite(emptyLearned(), 'color', 'mint green');
  assert.equal(favoriteOf(l, 'color'), 'mint green');
  assert.equal(findFavoriteQuestion('whats my favorite color?'), 'color');
  assert.equal(favoriteAnswer('color', favoriteOf(l, 'color')), 'Your favorite color is mint green! 😊');
  assert.match(favoriteAnswer('food', favoriteOf(l, 'food'), () => 0), /^I don’t know, can you tell me, or at least give me a hint\? I’m smart, but I can’t read minds\./);
  assert.match(favoriteLine(findFavorite('my favorite color is mint green')!, { remembered: 'mint green', learning: true }, () => 0), /^I remember! Mint green is your favorite color/);
  assert.match(favoriteLine(findFavorite('my favorite color is blue')!, { remembered: 'mint green', learning: true }, () => 0), /Last time you told me mint green, so I’ll update that\. What/);
  l = learnFavorite(l, 'color', 'blue');
  assert.equal(l.favorites.length, 1);
  assert.equal(favoriteOf(l, 'color'), 'blue');
  assert.ok(isEmpty(forget(l, 'favorite', 'color')));
  // Never learned from a message the safety screen flags.
  assert.equal(learnFavorite(emptyLearned(), 'thing', 'wanting to die').favorites.length, 0);
});
// 29. Ed, 2026-10-25: "if Zoey does not know have her say I don't know, can you tell me or at least give me a hint, I am smart but I can't read minds".
test('favorites she does not know: ask for it or a hint, for any kind of thing', () => {
  for (const [q, what] of [['what is my favorite color', 'color'], ['whats my favorite food?', 'food'], ['what is my favorite season', 'season'], ['whats my favorite truck', 'truck'], ['do you know my favorite song', 'song'], ['whats my favorite', 'thing'], ['what is my favourite colour', 'color']] as const) {
    assert.equal(findFavoriteQuestion(q), what, q);
    for (let i = 0; i < DONT_KNOW.length; i++) {
      const line = favoriteAnswer(what, null, () => i / DONT_KNOW.length);
      assert.match(line, /can’t read minds|reading minds/, line);
      assert.match(line, /hint/);
      assert.doesNotMatch(line, /\{what\}|favorite  /);
      assert.ok(validateReply(line).ok, line);
    }
  }
});
test('favorites she does not know: an answer is saved, a hint gets a guess', () => {
  assert.deepEqual(readFavoriteReply('color', 'mint green'), { value: 'mint green' });
  assert.deepEqual(readFavoriteReply('color', "it's mint green"), { value: 'mint green' });
  assert.deepEqual(readFavoriteReply('color', 'green'), { value: 'green' });
  assert.deepEqual(readFavoriteReply('season', 'winter'), { value: 'winter' });
  assert.deepEqual(readFavoriteReply('truck', 'ford'), { value: 'ford' });
  assert.deepEqual(readFavoriteReply('color', "it's green"), { hint: true, guess: 'mint green', base: 'green' });
  assert.deepEqual(readFavoriteReply('color', 'hint: its a kind of blue'), { hint: true, guess: 'sky blue', base: 'blue' });
  assert.deepEqual(readFavoriteReply('season', "it's cold and snowy"), { hint: true, guess: 'winter', base: null });
  assert.deepEqual(readFavoriteReply('food', 'hint its italian'), { hint: true, guess: 'pizza', base: null });
  assert.deepEqual(readFavoriteReply('thing', "it's a color like the sky"), { hint: true, guess: 'sky blue', base: null });
  assert.deepEqual(readFavoriteReply('song', 'hint: it has a guitar in it'), { hint: true, guess: null, base: null });
  for (const x of ['i dont know', 'beer', 'what?', 'how do i find a meeting']) assert.equal(readFavoriteReply('food', x), null, x);
  for (const q of ['what is my favorite color', 'whats my favorite food', 'what is my favorite season?']) assert.equal(findFavorite(q), null, q);
  assert.equal(GUESS('mint green'), 'Ooh, a clue! 🤔 Is it mint green?');
  assert.match(GUESS_WRONG('green'), /Just plain green, then\?/);
  for (const x of [STUMPED, GUESS_WRONG(null), GUESS('pizza')]) assert.ok(validateReply(x).ok, x);
});
// 30. Weather questions and warnings before early plans (Ed, 2026-10-25: "teach zoey to look at
// weather forecasts ... if they have an early appointment and it is cold, snowing or raining she should warn them").
import { alertLine, findWeatherAsk, NO_FORECAST, Outlook, sampleOutlook, weatherAnswer, weatherWarning } from '../src/zoey/weather';
import { parseDay } from '../src/zoey/schedule';
import { dayItems } from '../src/zoey/today';
{
  const thu = new Date(2026, 9, 29, 10, 15);
  const o = sampleOutlook(thu);
  const real: Outlook = { ...o, sample: false };
  const wa = (q: string, out: Outlook | null = real) => {
    const a = findWeatherAsk(q, thu, parseDay);
    assert.ok(a, `not a weather question: ${q}`);
    const text = weatherAnswer(a!, out, thu, () => 0);
    assert.ok(validateReply(text).ok, text);
    return text;
  };
  test('weather: questions by day and kind', () => {
    assert.equal(wa('whats the weather'), 'Today: partly cloudy, with a high near 41° and a low around 30°.');
    assert.match(wa('what is the weather tomorrow?'), /^Tomorrow: snow likely, with a high near 31° and a low around 22°\. 70% chance of snow\. Bundle up/);
    assert.match(wa('will it rain monday'), /^Looks like it, on Monday: rain showers likely\. 60% chance of rain\. Bring a jacket or umbrella\.$/);
    assert.match(wa('will it rain tomorrow'), /^Not rain, but snow tomorrow/);
    assert.match(wa('is it going to snow sunday'), /^No snow in the forecast on Sunday/);
    assert.match(wa('do i need a jacket'), /^Yes, I’d bring one\./);
    assert.match(wa('is it cold outside'), /^It’s chilly today/);
    assert.match(wa('is it cold tomorrow'), /^Yes, it’s cold tomorrow/);
    assert.match(wa('weather this weekend'), /^Saturday: chance rain and snow, high 36°\. Sunday: sunny, high 44°\.$/);
    assert.match(wa('whats the weather tonight'), /^Tonight: mostly cloudy, with a low around 30°\./);
    assert.match(wa('whats the weather', o), /\(This preview uses a sample forecast\.\)$/);
    for (const q of ['im cold', 'this weather makes me sad', 'i quit cold turkey', 'what time is it', 'i have a cold', 'i love ice cream', 'see you sunday'])
      assert.equal(findWeatherAsk(q, thu, parseDay), null, q);
  });
  test('weather: no forecast means an honest answer, never a guess', () => {
    const a = findWeatherAsk('will it rain tomorrow', thu, parseDay)!;
    assert.ok(NO_FORECAST.includes(weatherAnswer(a, null, thu, () => 0)));
    assert.equal(weatherWarning(null, [], thu), null);
  });
  test('weather: a warning before an early plan in bad weather', () => {
    const st = { calendar: seedCalendar(thu), plan: seedPlan(), places: seedPlaces() };
    const plans = [...dayItems(st, thu, thu), ...dayItems(st, new Date(2026, 9, 30))];
    const w = weatherWarning(real, plans, thu, () => 0)!;
    assert.equal(w, 'Heads up: it’s going to be 27° and snowy when you leave for work at 8:00 AM tomorrow. Bundle up and leave a few minutes early.');
    for (let i = 0; i < 6; i++) assert.ok(validateReply(weatherWarning(real, plans, thu, () => i / 6)!).ok);
    // Nice weather, or only "back home": nothing to say.
    const nice: Outlook = { ...real, hours: real.hours.map((h) => ({ ...h, temperature: 55, shortForecast: 'Sunny', rain: 0 })), periods: real.periods.map((p) => ({ ...p, temperature: 60, shortForecast: 'Sunny', rain: 0 })) };
    assert.equal(weatherWarning(nice, plans, thu), null);
    assert.equal(weatherWarning(real, plans.filter((p) => p.home), thu), null);
  });
  test('weather: severe alerts are mentioned', () => {
    const storm: Outlook = { ...real, alerts: [{ event: 'Winter Storm Warning', headline: 'Winter Storm Warning until Friday', severity: 'Severe' }] };
    assert.match(alertLine(storm)!, /^The National Weather Service has a Winter Storm Warning out for the Spokane area\./);
    assert.equal(alertLine({ ...real, alerts: [{ event: 'Special Weather Statement', headline: '', severity: 'Minor' }] }), null);
    assert.match(wa('whats the weather', storm), /Winter Storm Warning/);
  });
}

// 31. Time zone, city and what's near (Ed, 2026-10-25: "teach zoey to know my time zone
// and what city I live in, and to figure out what I am near").
{
  const sp = { lat: 47.6588, lon: -117.426 };
  test('place: finds the city they name, closest first when the name is common', () => {
    const c = (x: string) => { const f = findCity(x, sp); return f && `${f.name}, ${f.state}`; };
    assert.equal(c('spokane'), 'Spokane, WA');
    assert.equal(c('Spokane, WA'), 'Spokane, WA');
    assert.equal(c('spokane valley'), 'Spokane Valley, WA');
    assert.equal(c('cheney washington'), 'Cheney, WA');
    assert.equal(c('deer park'), 'Deer Park, WA');
    assert.equal(c('Deer Park, TX'), 'Deer Park, TX');
    assert.equal(c('portland or'), 'Portland, OR');
    assert.equal(c('Coeur d Alene'), "Coeur d'Alene, ID");
    assert.equal(c('st maries id'), 'Saint Maries, ID');
    assert.equal(c('nyc'), 'New York City, NY');
    for (const x of ['hope', 'an apartment', 'a sober house', 'recovery', 'asdfgh']) assert.equal(c(x), null, x);
    assert.equal(c('hope, ar'), 'Hope, AR');
  });
  test('place: what they ask', () => {
    const k = (q: string) => { const a = findPlaceAsk(q, sp); return a && (a.kind === 'near' ? `near:${a.what}` : a.kind === 'setCity' ? `set:${a.city.name}` : a.kind); };
    for (const q of ['what city do i live in', 'where am i', 'what city am i in right now', 'do you know where i live', 'where do i live', 'Zoey what town am I in?']) assert.equal(k(q), 'city', q);
    for (const q of ['what time zone am i in', 'whats my timezone', 'what time zone is this']) assert.equal(k(q), 'zone', q);
    assert.equal(k('I live in Cheney'), 'set:Cheney');
    assert.equal(k('i moved to spokane valley'), 'set:Spokane Valley');
    for (const q of ['whats near me', 'what am I near', 'figure out what im near', 'what is around me', 'anything close by', 'whats nearby']) assert.equal(k(q), 'near:any', q);
    assert.equal(k('closest meeting'), 'near:meeting');
    assert.equal(k('is there an AA meeting near me'), 'near:meeting');
    assert.equal(k('where is the closest food bank'), 'near:food');
    assert.equal(k('where can i eat near here'), 'near:food');
    assert.equal(k('is there a pharmacy near me'), 'near:pharmacy');
    assert.equal(k('nearest bus stop'), 'near:bus');
    assert.equal(k('closest shelter'), 'near:shelter');
    for (const q of ['i feel close to my sponsor', 'i am close to relapsing', 'i live in an apartment', 'I live in hope', 'im in pain', 'what time is it', 'my mom lives near me', 'whats the weather'])
      assert.equal(k(q), null, q);
  });
  test('place: asking for the closest shelter is still a housing need first', () => {
    for (const q of ['closest shelter', 'where is the nearest shelter', 'shelter near me']) {
      const s = screen(q);
      assert.ok(s.kind === 'urgent' && s.variant === 'housing', q);
    }
  });
  test('place: the time zone is the phone’s own', () => {
    const at = new Date(Date.UTC(2026, 9, 25, 4, 30));
    assert.equal(zoneAnswer(at, 'America/Chicago'), 'Your phone is set to Central Daylight Time, so it’s 11:30 PM for you. I use your phone’s time for your plans, reminders and the weather.');
    assert.match(zoneAnswer(at, 'America/New_York'), /Eastern Daylight Time, so it’s 12:30 AM/);
    assert.match(zoneAnswer(at, 'America/Los_Angeles'), /Pacific Daylight Time, so it’s 9:30 PM/);
  });
  test('place: what city they live in', () => {
    const spokane = findCity('spokane')!;
    assert.equal(cityAnswer({ city: null, here: null }), 'I don’t know yet. What city do you live in? I’ll use it for your weather.');
    assert.match(cityAnswer({ city: spokane, here: null }), /^You told me you live in Spokane, WA\./);
    assert.equal(cityAnswer({ city: spokane, here: { lat: 47.49, lon: -117.58 } }), 'Right now you’re in Cheney, WA. Your home city is Spokane, WA.');
    assert.equal(nearestTown({ lat: 47.49, lon: -117.58 })!.city.name, 'Cheney');
    assert.ok(Math.abs(milesBetween(sp, { lat: 47.6062, lon: -122.3321 }) - 228) < 3);
    assert.match(cityHeard(spokane), /^Got it, Spokane, WA\./);
  });
  test('place: closest help, sorted by distance, honest without addresses', () => {
    // Made-up spots for the test: the shelters 0.8 to 1 mile out.
    const res = SPOKANE.resources.map((r, i) => ({ ...r, at: r.address ? { lat: 47.66 + i * 0.002, lon: -117.41 } : null }));
    const base = { from: sp, fromCity: false, regionName: SPOKANE.name, regionAt: sp, resources: res, meetings: SAMPLE_MEETINGS, places: [] };
    const sh = nearAnswer({ ...base, what: 'shelter' });
    assert.match(sh.text, /^The closest shelter on my list is .+ \(0\.\d miles\)\. Next is .+ Beds change often, so call before you go\.$/);
    assert.equal(sh.resources, 'Shelter tonight');
    assert.match(nearAnswer({ ...base, what: 'food', fromCity: true }).text, /miles from the middle of your city\)/);
    const work = nearAnswer({ ...base, what: 'any', places: [{ id: 'p', name: 'Work', kind: 'work', spot: { lat: 47.66, lng: -117.43 } }] });
    assert.match(work.text, /^You’re in Spokane, WA\. Work is 0\.\d miles away\. The closest shelter/);
    const ph = nearAnswer({ ...base, what: 'pharmacy' });
    assert.equal(ph.maps, 'pharmacy');
    assert.match(ph.text, /^I don’t have pharmacies on my list yet/);
    assert.match(nearAnswer({ ...base, what: 'meeting' }).text, /can’t tell how far they are/);
    // No addresses looked up (the preview): the list, without making up distances.
    const none = nearAnswer({ ...base, resources: SPOKANE.resources, what: 'food' });
    assert.match(none.text, /^Here’s what I have for the Spokane area: .+ I can’t measure how far they are/);
    // Far from the Spokane list: 211.
    const sea = nearAnswer({ ...base, what: 'shelter', from: { lat: 47.6062, lon: -122.3321 } });
    assert.ok(sea.call211);
    assert.match(sea.text, /only covers the Spokane area so far, and that’s about 2\d\d miles away\. 211 can tell you/);
    for (const what of ['any', 'shelter', 'food', 'housing', 'legal', 'crisis', 'meeting', 'pharmacy', 'bus'] as const)
      // Street numbers come from the verified list (resources.ts), not phone numbers.
      assert.ok(validateReply(nearAnswer({ ...base, what }).text.replace(/\b\d{2,5} [NSEW] /g, '')).ok, what);
  });
}

// 32. Spell check (Ed, 2026-10-25: "add spell check").
{
  const fix = (q: string) => spellFix(q, ['Marcus', 'Maya', 'Jordan']);
  test('spell: common typos are fixed', () => {
    const cases: [string, string][] = [
      ['who can be my sponcer', 'who can be my sponsor'],
      ['whats a sponsr', 'whats a sponsor'],
      ['i have a cravng', 'i have a craving'],
      ['i feel lonley', 'i feel lonely'],
      ['when is my next meating', 'when is my next meeting'],
      ['im so stresed out', 'im so stressed out'],
      ['i feel axious about tommorow', 'i feel anxious about tomorrow'],
      ['i relasped last nite', 'i relapsed last nite'],
      ['can i get suboxen', 'can i get suboxone'],
      ['my therepist is mean', 'my therapist is mean'],
      ['i neeed helpp', 'i need help'],
      ['whats the wheather tomorow', 'whats the weather tomorrow'],
      ['i cant slep', 'i cant sleep'],
      ['how do i get a jobb', 'how do i get a job'],
      ['i feel hopless', 'i feel hopeless'],
      ['what does sobrity mean', 'what does sobriety mean'],
      ['teh meeting', 'the meeting'],
      ['i got evcited', 'i got evicted'],
    ];
    for (const [q, want] of cases) assert.equal(fix(q).sure, want, q);
  });
  test('spell: names, towns, slang and real words are left alone', () => {
    for (const q of ['Marcus is my sponsor', 'i live in Cheney', 'lol idk', 'im gonna kill it at work', 'percs and xanax', 'that’s not what i meant', 'im feeling sooooo happy', 'i went to the meeting and felt better', 'my po is mad', 'Jordan'])
      assert.equal(fix(q).fixes.length, 0, q);
  });
  test('spell: a fix that could be two words is never guessed', () => {
    // "evcitd": evicted or excited? Left as typed.
    assert.equal(fix('i was so evcitd').fixes.length, 0);
    assert.equal(distance('evcited', 'evicted'), 1);
  });
  test('spell: fixed text can only add safety help, never remove it', () => {
    // AskScreen and check-in read what they typed first, then the fixed text.
    for (const q of ['i want to dye', 'i overdoesed', 'i feel hopeless', 'i want to kill myself']) {
      const first = screen(q);
      assert.notEqual(first.kind, 'none', q);
    }
    assert.equal(screen('i got evcited').kind, 'none');
    assert.equal(screen(fix('i got evcited').all).kind, 'urgent');
    assert.equal(screen(fix('i feel hopless').all).kind, screen('i feel hopeless').kind);
  });
  test('spell: a typo still finds the answer', () => {
    const id = (q: string) => { const r = ask(fix(q).sure, ctx); return r.kind === 'answer' ? r.answer.id : r.kind; };
    assert.equal(id('who can be my sponcer'), 'sponsor-find');
    assert.equal(id('whats a sponsr'), 'sponsor-what');
  });
  test('spell: "Did you mean ...?" names the unsure words', () => {
    assert.equal(didYouMean([{ from: 'misseed', to: 'misdeed', sure: false }]), 'Did you mean “misdeed”?');
    assert.equal(didYouMean([{ from: 'a', to: 'b', sure: true }, { from: 'c', to: 'd', sure: false }, { from: 'e', to: 'f', sure: false }]), 'Did you mean “d” and “f”?');
  });
}
void END;

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
