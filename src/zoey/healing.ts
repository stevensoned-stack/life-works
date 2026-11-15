// Signs of healing (Ed, 2026-11-15): "my head is clearing", "the fog has lifted",
// "I am thinking better", "my body aches are gone". Zoey celebrates it, names it as
// part of their recovery, and gently keeps them focused, because feeling better is
// when some people start to think they can use "just once":
// "That is great, that is part of your recovery, but let's stay focused."
//
// Also sleeping better, eating again, more energy, skin clearing up, cravings easing,
// feeling like themselves again. Ed types fast ("my head id clearing", "mt body aches
// are gone"), so "id"/"iz" read as "is" and "mt"/"ny" as "my" here (spell.ts leaves
// words under 4 letters alone).
//
// Never in place of safety: the screens run the safety checks first, and a message
// that turns with "but" goes the usual way. "My head is clearing, so maybe one drink"
// (feeling better as a reason to use) comes back with `use`: Zoey is glad, says
// feeling better doesn't make it safe, and the urge talk carries on from there.
import { clean, findUrge } from './feelings';

export type Healing = 'head' | 'fog' | 'think' | 'body' | 'sleep' | 'eat' | 'energy' | 'skin' | 'cravings' | 'self';

// Typed fast: "id" for "is", "mt" for "my".
const tidy = (text: string) =>
  ` ${clean(text)} `
    .replace(/ (?:id|iz|ia|os) /g, ' is ')
    .replace(/ (?:mt|ny|mu|mi) /g, ' my ')
    .replace(/ (?:i m|i am) /g, ' im ')
    .replace(/ (?:it s|it is) /g, ' its ')
    .replace(/\s+/g, ' ')
    .trim();

const MY = '(?:my|the)';
const IS = '(?:is|s|has|have|are|has been|have been|is finally|are finally|finally|seems|seem|is starting to|are starting to|started to|is getting|are getting|feels|feel|is really|are really)';
const NOW = '(?: (?:now|finally|again|so much|a lot|a little|a bit|today|lately|this week|anymore|any more|more|already|completely|totally|at last|too|for real))*';
const GONE = '(?:gone|went away|going away|better|lifted|lifting|lighter|easing|eased|eased up|easing up|stopped|less|fewer|weaker|calmer|disappeared|fading|faded|not as bad|way better|much better|so much better)';

const SIGNS: [Healing, RegExp][] = [
  // "my head is clearing", "my mind is clearer", "my head feels clear", "my brain is working again"
  ['head', new RegExp(`\\b${MY} (?:heads?|minds?|brains?|thinking|thoughts)(?: ${IS})? (?:clearing|clearing up|clearer|clear|clear again|less foggy|not foggy|sharper|sharp again|working again|coming back|back)${NOW}\\b`)],
  ['head', /\b(?:im|i feel|feeling|i can see|i see) (?:so much |much |a lot |more )?(?:clear headed|clearheaded|clearer|sharper)\b/],
  ['head', /\bclearer head\b|\bhead is clear\b/],
  // "the fog has lifted", "brain fog is gone", "no more brain fog"
  ['fog', new RegExp(`\\b(?:the|my)? ?(?:brain )?fogs?(?: ${IS})? (?:lifted|lifting|gone|cleared|clearing|clearing up|lifted up|is gone|went away|going away|less|lighter|better)${NOW}\\b`)],
  ['fog', /\b(?:no more|less|not as much) (?:brain )?fog\b|\bout of the fog\b|\bfoggy anymore\b/],
  // "I am thinking better", "I can think clearly", "I can focus again", "my memory is better"
  ['think', /\bim thinking (?:so much |much |a lot |way )?(?:better|clearer|clearly|straight|straighter|more clearly|right|again)\b/],
  ['think', /\bi can (?:think|focus|concentrate|remember things)(?: so much| much| a lot| way)? ?(?:better|clearer|clearly|straight|again|now)\b/],
  ['think', new RegExp(`\\b${MY} (?:memory|focus|concentration)(?: ${IS})? (?:better|coming back|back|improving|sharper)${NOW}\\b`)],
  // "my body aches are gone", "no more shakes", "the sweats stopped", "my body feels better"
  ['body', new RegExp(`\\b(?:${MY} )?(?:body )?(?:aches|aching|pains|body pain|shakes|shaking|sweats|night sweats|tremors|withdrawals|withdrawal|sickness|nausea)(?: and (?:pains|shakes|sweats|aches))?(?: ${IS})? ${GONE}${NOW}\\b`)],
  ['body', /\b(?:no more|dont have the|not having) (?:body )?(?:aches|pains|shakes|sweats|tremors|withdrawals?)\b/],
  ['body', new RegExp(`\\b${MY} body (?:${IS} )?(?:feels |feeling )?(?:better|stronger|healthier|healing|good again|so much better|much better|way better|is healing)${NOW}\\b`)],
  ['body', /\b(?:i dont|dont) (?:ache|hurt|shake) (?:anymore|any more|as much)\b/],
  // "I'm sleeping better", "I slept through the night", "I can sleep again"
  ['sleep', /\bim (?:finally )?sleeping (?:so much |much |a lot |way )?(?:better|well|good|through the night|all night|again)\b/],
  ['sleep', /\bi (?:finally )?slept (?:so |really )?(?:well|good|great|through the night|all night|like a baby)\b/],
  ['sleep', /\bi can (?:finally )?sleep (?:again|now|through the night)\b|\bmy sleep (?:is )?(?:better|improving|getting better|back)\b/],
  // "I'm eating again", "my appetite is back"
  ['eat', /\bim (?:finally )?eating (?:again|better|more|real food)\b|\bi can eat again\b/],
  ['eat', new RegExp(`\\b${MY} appetite(?: ${IS})? (?:back|coming back|better|returning)${NOW}\\b`)],
  ['eat', /\bim (?:actually |finally )?hungry again\b/],
  // "I have more energy", "my energy is back"
  ['energy', /\bi (?:have|got|feel|am getting) (?:so much |a lot |way |much )?more energy\b|\bi have energy again\b/],
  ['energy', new RegExp(`\\b${MY} energy(?: ${IS})? (?:back|coming back|better|up|returning)${NOW}\\b`)],
  ['energy', /\bim (?:not|no longer) (?:so |as )?tired (?:all the time|anymore)\b/],
  // "my skin is clearing up", "I look healthier"
  ['skin', new RegExp(`\\b${MY} (?:skin|face|color|colour|eyes)(?: ${IS})? (?:clearing|clearing up|clearer|better|healing|healthier|brighter|looking better)${NOW}\\b`)],
  ['skin', /\bi (?:look|am looking|im looking) (?:so much |a lot |way |much )?(?:healthier|better|alive again|like me again)\b/],
  // "my cravings are less", "I don't crave it as much"
  ['cravings', new RegExp(`\\b${MY} (?:cravings?|urges?)(?: ${IS})? (?:${GONE}|not as strong|not so strong|smaller|quieter|going down|down)${NOW}\\b`)],
  ['cravings', /\b(?:less|fewer|weaker|smaller|not as many) (?:cravings|urges)\b|\bi dont crave (?:it |them |that )?(?:as much|like i used to|anymore|any more)\b|\bcravings? (?:are|is) (?:less|fewer|easing|weaker|going away|not as bad)\b/],
  // "I feel like myself again", "I feel human again", "I feel healthy"
  ['self', /\bi (?:feel|am feeling|im feeling) like (?:myself|me|a person|a human|my old self) again\b|\b(?:i feel|feeling|im feeling) (?:human|alive) again\b/],
  ['self', /\b(?:i feel|im feeling|feeling) (?:so much |a lot |way |much )?(?:healthier|physically better)\b|\bim (?:getting|feeling) healthier\b|\bmy health is (?:better|improving|getting better)\b/],
];

// Hopes, questions and turns aren't news yet: "I wish the fog would lift",
// "when will my head clear?", "my head is clearing but I want to drink".
const NOT_YET = /\b(?:wish|hope|hoping|if only|when will|will it|will my|does the|do the|how long|supposed to|should|cant wait|waiting for|until|not yet|yet)\b/;
const TURN = /\b(?:but|except|though|although|however)\b/;
const QUESTION = /^(?:when|will|does|do|is|are|how|why|what|can|could|should)\b/;

// Feeling better as a reason to use: "so I could use just once", "maybe one drink".
const USE = /\b(?:just once|one time|only once|one drink|a drink|one beer|a beer|a shot|one hit|a hit|get high|get drunk|use again|use a little|could use|can use|might use|could drink|can drink|have a drink|drink again|reward myself|celebrate with|i can handle a|relapse|pick up again|(?:want|wanna|wanted|need|feel like|thinking about) (?:to )?(?:use|using|drink|drinking|get high))\b/;

export type HealingSign = { kind: Healing; use: boolean };

export function findHealing(text: string): HealingSign | null {
  const t = tidy(text);
  if (!t || NOT_YET.test(t) || QUESTION.test(t) || /\?\s*$/.test(text.trim())) return null;
  const use = USE.test(t) || findUrge(text);
  for (const [kind, re] of SIGNS) {
    const m = re.exec(t);
    if (!m) continue;
    // A "not" right before it ("my head is not clearing") or a "but" after it.
    const before = t.slice(Math.max(0, m.index - 12), m.index);
    if (/\b(?:not|isnt|arent|hasnt|havent|never|no)\s*$/.test(before)) continue;
    if (/\bnot\b/.test(m[0]) && !/\b(?:not foggy|not as|not so|not having|not tired|no longer|not as many)\b/.test(m[0])) continue;
    if (TURN.test(t.slice(m.index + m[0].length)) && !use) return null;
    return { kind, use };
  }
  return null;
}

// What they said, back to them first (Ed's style: reflect, then respond).
export const HEALING_HEARD: Record<Healing, string[]> = {
  head: ['Your head is clearing!', 'A clearer head!', 'Your mind is clearing up!'],
  fog: ['The fog has lifted!', 'The fog is lifting!', 'No more fog!'],
  think: ['You’re thinking more clearly!', 'You’re thinking better!', 'Clearer thinking!'],
  body: ['Your body is healing!', 'The aches are going away!', 'Your body is feeling better!'],
  sleep: ['You’re sleeping better!', 'Better sleep!', 'Real rest!'],
  eat: ['Your appetite is coming back!', 'You’re eating again!', 'Eating again!'],
  energy: ['More energy!', 'Your energy is coming back!', 'You’ve got more energy!'],
  skin: ['You’re looking healthier!', 'Your skin is clearing up!', 'Looking healthier!'],
  cravings: ['The cravings are easing up!', 'Fewer cravings!', 'The cravings are getting weaker!'],
  self: ['You’re feeling like yourself again!', 'Feeling like you again!', 'You’re feeling healthier!'],
};

// Celebrate it, name it as recovery, and stay focused. Ed's own line is first.
export const HEALING_LINES = [
  'That is great, that is part of your recovery, but let’s stay focused.',
  'That’s wonderful! That’s part of your recovery working. Let’s keep that focus going.',
  'I love hearing that! That’s what recovery looks like. Let’s stay focused so it keeps getting better.',
  'That is so good to hear. That’s your recovery at work. Feeling better is a great sign, and it’s also a time to stay extra focused.',
  'That’s great news! That’s part of your recovery, and you earned it. Let’s keep doing what got you here.',
  'Yes! That is part of your recovery. Just remember, feeling better is when some people think they can use “just once,” so let’s stay focused.',
  'That is great! Your recovery is paying off. Let’s not let up now. Stay focused.',
  'How wonderful! That’s part of healing in recovery. Enjoy it, and let’s stay focused on what’s working.',
  'That’s a big deal! It’s part of your recovery. Let’s keep our eyes on the road ahead.',
  'That is great, and it’s no accident. That’s part of your recovery. Let’s stay on track and keep it going.',
  'I’m so happy for you! That’s part of your recovery. Feeling good is a gift, so let’s protect it and stay focused.',
  'That is awesome! That’s your recovery working. One day at a time, let’s stay focused.',
  'That’s really great! That’s part of your recovery. Feeling stronger is the perfect time to keep your guard up and stay focused.',
  'So good! Your body and mind are healing, and that’s part of your recovery. Let’s keep going, one day at a time.',
];

// "My body aches are gone, so I could use just once": glad, but feeling better doesn't
// make it safe. Each ends on the urge talk's question, which then listens quietly.
export const HEALING_USE_LINES = [
  'I’m really glad you’re feeling better, and that is part of your recovery. But feeling better doesn’t make it safe to use, not even once. What’s going on that has you thinking about it?',
  'That healing is real, and it’s part of your recovery. Feeling good is exactly when “just once” starts to sound okay, and it isn’t. What’s making you want to use right now?',
  'It’s great that you’re feeling better. That’s your recovery working, so let’s protect it. Using “just once” can undo a lot. What’s going on that makes you want to?',
  'I’m so glad your body and mind are healing. That’s part of your recovery, and it’s worth staying focused for. What’s pulling you toward using right now?',
];

// Not the same line twice in a row.
const last = new Map<string, string>();
const fresh = (key: string, xs: string[], rand: () => number) => {
  const pool = xs.length > 1 ? xs.filter((x) => x !== last.get(key)) : xs;
  const x = pool[Math.floor(rand() * pool.length) % pool.length];
  last.set(key, x);
  return x;
};

export const healingLine = (kind: Healing, rand: () => number = Math.random) =>
  `${fresh(`heard:${kind}`, HEALING_HEARD[kind], rand)} ${fresh('line', HEALING_LINES, rand)}`;

export const healingUseLine = (rand: () => number = Math.random) => fresh('use', HEALING_USE_LINES, rand);
