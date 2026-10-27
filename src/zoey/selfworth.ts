// "Do you think I am weak?" (Ed, 2026-10-25). Questions about their own worth get
// a firm, warm no, with what's true about them (their days in recovery), then "what's
// making you feel that way?" into the feelings flow. "Am I worthless?", "am I a
// burden?" and "am I hopeless?" set off the safety check first (safety.ts).
import { clean } from './feelings';

type Kind = 'weak' | 'stupid' | 'failure' | 'bad' | 'looks' | 'broken' | 'worth' | 'crazy' | 'lazy';

const WORDS: [Kind, string][] = [
  ['weak', 'weak|soft|a coward|a wimp|weak for asking for help|weak for needing help'],
  ['stupid', 'stupid|dumb|an idiot|a idiot|a moron|slow|not smart|not smart enough'],
  ['failure', 'a failure|a failure at everything|a loser|a screwup|a screw up|a fuckup|a fuck up|a mess|a hot mess|a disappointment|a joke|a fraud|a fake'],
  ['bad', 'a bad person|bad|a terrible person|a horrible person|evil|a monster|a bad mom|a bad dad|a bad mother|a bad father|a bad parent|a bad son|a bad daughter|a bad friend|selfish'],
  ['looks', 'ugly|fat|gross|disgusting'],
  ['broken', 'broken|damaged|messed up|too messed up|hopeless|a lost cause|too far gone|beyond help|beyond saving'],
  ['worth', 'worthless|useless|a burden|not good enough|unlovable|nothing|a nobody|no good|good for nothing|pathetic|a waste|a waste of space'],
  ['crazy', 'crazy|insane|psycho|nuts|a freak|weird'],
  ['lazy', 'lazy'],
];
const ALL = WORDS.flatMap(([k, ws]) => ws.split('|').map((w) => [w, k] as const)).sort((a, b) => b[0].length - a[0].length);
const WORD_RE = ALL.map(([w]) => w).join('|');
const LEAD = '(?:(?:hey|zoey|so|honestly|be honest|seriously|really|ok|okay|um|but|and|tell me|tell me the truth|tell me honestly) )*';
const ASKS = [
  // "do you think I am weak", "you think im stupid", "would you say im a failure"
  new RegExp(`^${LEAD}(?:do you|do u|you|would you|wouldnt you|dont you|does zoey|do you really|do you honestly) (?:think|say|believe|feel like|consider me) (?:that )?(?:i am|im|i m|me) (?:(?:a|really|so|too|just|kind of|kinda|such) )*(${WORD_RE})(?: (?:person|human|man|woman|guy|girl|now|then|zoey|or not|for this))*$`),
  // "am I weak", "am I a bad person", "am I really that stupid"
  new RegExp(`^${LEAD}am i (?:(?:really|so|too|just|that|kind of|kinda|actually|such) )*(${WORD_RE})(?: (?:person|human|man|woman|guy|girl|now|then|zoey|or not|for this|or what))*$`),
  // "is it weak to ask for help", "does asking for help make me weak"
  /^(?:is it|isnt it) (weak) (?:to|for me to) (?:ask for|need|get) help$/,
  /^does (?:asking for|needing|getting) help make me (weak)$/,
];

export function findSelfDoubt(text: string): { word: string; kind: Kind; help?: boolean } | null {
  const t = clean(text).replace(/^i (?:wonder|wanna know|want to know|need to know)(?: if)? /, '');
  for (const [i, re] of ASKS.entries()) {
    const m = t.match(re);
    if (!m) continue;
    const word = m[1];
    const kind = ALL.find(([w]) => w === word)![1];
    // "Is it weak to ask for help?" is about asking, not about them.
    return { word, kind, ...(i >= 2 ? { help: true } : {}) };
  }
  return null;
}

const NO = ['No, I don’t.', 'Not at all, {name}.', 'No way, {name}.', 'Honestly? No.'];
// What's true about them.
const PROOF = (days: number | null) =>
  days && days > 0
    ? [`You’re on day ${days} in recovery, and that takes real strength.`, `${days} days of not using doesn’t happen by accident. That’s you, doing hard things.`]
    : ['You’re here, working on your recovery, and that takes real strength.', 'You keep showing up for your recovery, and that’s not easy.'];
const REFRAME: Record<Kind, string[]> = {
  weak: ['Asking for help isn’t weakness. It’s courage.', 'Feeling worn down isn’t the same as being weak. Reaching out is one of the strongest things you can do.'],
  stupid: ['Everyone makes mistakes and has things they’re still learning. That’s not the same as being stupid.', 'Having a hard time with something doesn’t make you stupid. It means you’re human.'],
  failure: ['A setback or a bad day doesn’t make you a failure. You keep getting back up.', 'Mistakes are part of recovery. They don’t define you.'],
  bad: ['Good people make bad choices sometimes. That you care whether you’re a good person says a lot about you.', 'What you did when you were using isn’t who you are. Who you’re becoming matters more.'],
  looks: ['How you look isn’t what makes you who you are. The people in your LifeCircle care about you, not your looks.', 'You deserve to be kind to yourself, inside and out.'],
  broken: ['Nobody is too broken to heal. Recovery is putting things back together, one day at a time.', 'Hard times don’t make you broken. You’re healing, and that takes time.'],
  worth: ['You matter, and the people in your LifeCircle are glad you’re here.', 'Your worth isn’t something you have to earn. You matter, just as you are.'],
  crazy: ['Having a hard time with your thoughts or feelings doesn’t make you crazy. It makes you human.', 'Lots of people feel that way sometimes. It doesn’t mean something is wrong with you.'],
  lazy: ['Some days just feel heavy, and rest is part of recovery too.', 'Low energy isn’t laziness. Your body and mind are doing a lot of healing.'],
};
const ASK = ['What’s making you feel that way?', 'What happened that has you feeling that way?', 'Did something happen today that brought this up?'];

export function selfWorthLine(
  d: { word: string; kind: Kind; help?: boolean },
  o: { name: string; cleanDays: number | null },
  rand: () => number = Math.random,
): string {
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  const no = pick(NO).replace('{name}', o.name);
  // "No, I don't think you're weak." when it reads naturally.
  const think = d.help ? 'No, it isn’t.' : /^No, I don’t\.$/.test(no) ? `No, I don’t think you’re ${d.word}.` : no;
  return `${think} ${pick(PROOF(o.cleanDays))} ${pick(REFRAME[d.kind])} ${pick(ASK)}`;
}

// After they say what made them feel that way.
export const SELF_HEARD = [
  'That sounds really hard. One bad moment, or what someone says, doesn’t decide who you are.',
  'I’m sorry that happened. It makes sense it got to you, but it doesn’t change what you’re worth.',
  'That would hurt anyone. It doesn’t make you any less strong.',
];
