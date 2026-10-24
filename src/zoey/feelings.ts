// Spotting a typed feeling ("I'm sad", "feeling really anxious today") so Zoey
// can ask if they know why (Ed, 2026-10-22). Only short statements count: a
// question goes to the answer library, and "I'm sad because..." already says why.
// The safety screen always runs before this.
import { END, FeelingKey, Tree, TREES } from './trees';

const WORDS: Record<FeelingKey, string[]> = {
  sad: ['sad', 'down', 'depressed', 'blue', 'upset', 'unhappy', 'miserable', 'low', 'bummed'],
  angry: ['angry', 'mad', 'pissed', 'pissed off', 'furious', 'irritated', 'annoyed'],
  frustrated: ['frustrated'],
  anxious: ['anxious', 'nervous', 'worried', 'on edge', 'panicky', 'uneasy', 'restless'],
  scared: ['scared', 'afraid', 'frightened', 'terrified'],
  lonely: ['lonely', 'alone', 'isolated'],
  stressed: ['stressed', 'stressed out', 'overwhelmed'],
  numb: ['numb', 'empty'],
  guilty: ['guilty'],
  ashamed: ['ashamed', 'embarrassed'],
  tired: ['tired', 'exhausted', 'drained', 'worn out'],
  bored: ['bored'],
  happy: ['happy', 'great', 'glad', 'awesome', 'amazing'],
  proud: ['proud', 'proud of myself'],
  grateful: ['grateful', 'thankful', 'blessed'],
  excited: ['excited'],
  hopeful: ['hopeful', 'optimistic'],
  calm: ['calm', 'peaceful', 'relaxed', 'at peace'],
};

const LEAD = '(?:(?:honestly|today|tonight|ugh|well|zoey|hey zoey|hi zoey|tbh|lately|right now|just|so) )*';
const SUBJECT = '(?:i am|im|i feel|i felt|i feel like im|i have been|ive been|i been|been|feeling|im feeling|i am feeling|i keep feeling|i just feel|i get)';
const DEGREE = '(?:(?:so|really|very|kinda|kind of|pretty|a little|a bit|a little bit|super|just|quite|extremely|too|feeling|sort of|somewhat) )*';
const TAIL = '(?: (?:today|right now|now|lately|tonight|again|all day|this morning|this week|these days|rn))*';

const ENTRIES = Object.entries(WORDS).flatMap(([k, ws]) => ws.map((w) => [w, k as FeelingKey] as const));
// Longest first, so "pissed off" wins over "pissed".
ENTRIES.sort((a, b) => b[0].length - a[0].length);
const WORD_RE = ENTRIES.map(([w]) => w.replace(/ /g, ' ')).join('|');
const STATEMENT = new RegExp(
  `^${LEAD}(?:${SUBJECT} )?${DEGREE}(${WORD_RE})(?: (?:and|but) ${DEGREE}(?:${WORD_RE}))?${TAIL}$`,
);
// One word on its own ("down", "great") is too vague; "sad" alone is clear enough.
const NEEDS_SUBJECT = new Set(['low', 'down', 'blue', 'alone', 'empty', 'great', 'calm', 'mad']);

export type Feeling = { key: FeelingKey; word: string };

export function findFeeling(text: string): Feeling | null {
  if (/\?\s*$/.test(text)) return null;
  const t = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = t.match(STATEMENT);
  if (!m) return null;
  const word = m[1];
  if (NEEDS_SUBJECT.has(word) && t === word) return null;
  const key = ENTRIES.find(([w]) => w === word)![1];
  return { key, word };
}

const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// "I'm sick", "I have the flu", "my stomach hurts" (Ed, 2026-10-24). Only about
// themselves: "my mom is sick" is not this. "Sick of" means fed up, not ill.
// Sick after using, withdrawal and chest pain go to the safety screen first.
const ME = '(?:i am|im|i feel|i felt|i feel like|feeling|im feeling|i am feeling|ive been|i have been|i been|been|i think im|i got|i get|getting|im getting)';
const DEG = '(?:(?:so|really|very|kinda|kind of|pretty|a little|a bit|super|just|still|feeling|sort of|real) )*';
const SICK_RES = [
  new RegExp(`\\b${ME} ${DEG}(?:sick|ill|unwell|nauseous|nauseated|queasy|feverish|under the weather|sick to my stomach|achy|run down)\\b(?! of\\b| and tired\\b)`),
  /\b(?:i dont|i do not|im not|i am not|not) (?:feel|feeling) (?:so |very |too |that )?(?:well|good|great|right|so hot)\b/,
  /\b(?:i have|ive got|i got|i caught|i think i have|i think i got|got|have) (?:a |the |an |some )?(?:bad |really bad |terrible |little )?(?:cold|flu|fever|headache|migraine|stomach ache|stomachache|stomach bug|sore throat|cough|infection|covid|virus|toothache|earache|tooth ache|food poisoning)\b/,
  /\bmy (?:head|stomach|tummy|back|tooth|teeth|throat|ear|ears|body|chest) (?:hurts|is hurting|aches|is killing me|really hurts)\b/,
  /\b(?:i threw up|ive been throwing up|im throwing up|been throwing up|i keep throwing up|im vomiting|i cant stop throwing up|i have diarrhea)\b/,
  /\b(?:im|i am) in (?:a lot of )?pain\b/,
];

export function findSick(text: string): boolean {
  const t = ` ${clean(text)} `;
  return SICK_RES.some((r) => r.test(t));
}

// For anything the answer library can't place: a hard or good feeling named
// anywhere in what they wrote ("my dog died and im so sad"). Never a fallback
// for a feeling (Ed, 2026-10-24). "not sad" doesn't count.
const SKIP_LOOSE = new Set(['down', 'low', 'blue', 'alone', 'empty', 'great', 'calm', 'mad', 'tired', 'upset', 'restless', 'awesome', 'amazing', 'glad', 'blessed']);
const LOOSE = ENTRIES.filter(([w]) => !SKIP_LOOSE.has(w));
const LOOSE_RE = new RegExp(`(?:^| )(not |never |no longer |)(?:${DEGREE})(${LOOSE.map(([w]) => w).join('|')})(?= |$)`, 'g');

export function mentionedFeeling(text: string): Feeling | null {
  const t = clean(text);
  for (const m of t.matchAll(LOOSE_RE)) {
    if (m[1]) continue;
    const word = m[2];
    return { key: LOOSE.find(([w]) => w === word)![1], word };
  }
  return null;
}

// A typed answer to one of Zoey's yes / no questions. `rest` is anything they
// said after it ("yes, she said to rest"), so Zoey doesn't ask for it again.
const YES = ['yes', 'yeah', 'yea', 'yep', 'yup', 'ya', 'sure', 'ok', 'okay', 'of course', 'definitely', 'i did', 'i have', 'i do', 'kind of', 'kinda', 'sort of', 'y'];
const NO = ['no', 'nope', 'nah', 'not yet', 'not really', 'i didnt', 'i havent', 'i dont', 'no i havent', 'no i didnt', 'not now', 'n'];

export function yesNo(text: string): { answer: 'yes' | 'no'; rest: string } | null {
  const t = clean(text);
  const hit = (ws: string[]) => ws.filter((w) => t === w || t.startsWith(`${w} `)).sort((a, b) => b.length - a.length)[0];
  const no = hit(NO);
  const yes = hit(YES);
  // "i dont know" and "i do not" are not a yes.
  if (/^(i dont know|idk|not sure|im not sure|maybe)\b/.test(t)) return null;
  const w = no && (!yes || no.length >= yes.length) ? no : yes;
  if (!w) return null;
  return { answer: w === no ? 'no' : 'yes', rest: t.slice(w.length).trim() };
}

// Where a typed reply goes while Zoey waits on a yes / no question in a tree,
// or null if it didn't answer it (a new question goes to the library instead).
// `told`: they said something worth keeping, beyond a plain yes or no.
export function typedAnswer(tree: Tree, nodeId: string, text: string): { to: string; told: boolean } | null {
  const n = tree.nodes[nodeId];
  if (!n || !(n.yes || n.no)) return null;
  const yn = yesNo(text);
  if (yn) {
    const to = (yn.answer === 'yes' ? n.yes : n.no) ?? END;
    const after = tree.nodes[to];
    // "Yes, she said to rest": they already answered "What did they say?"
    if (after?.share && yn.rest.split(' ').length >= 2) return { to: after.share, told: true };
    return { to, told: false };
  }
  if (!n.typed || /\?\s*$/.test(text)) return null;
  return { to: n.typed, told: true };
}

// "Help", "I need help", "can you help me?" on its own, with nothing about what
// with (Ed, 2026-10-24). "Help me find a meeting" says what, so it goes to the
// answer library instead.
const HELP = new RegExp(
  '^(?:(?:hey|hi|ok|okay|zoey|please|so|um|uh) )*' +
    '(?:(?:i|i really|i just|i think i) (?:need|want|could use|would like) (?:some |a little |your )?help' +
    '|(?:can|could|will|would) (?:you|u) (?:please )?help(?: me)?' +
    '|(?:please )?help(?: me)?(?: out)?' +
    '|i need (?:some )?(?:support|someone to help me)' +
    '|i dont know what to do' +
    '|im (?:really )?struggling' +
    '|sos)' +
    '(?: (?:please|pls|zoey|now|right now|asap|out|me|plz|help))*$',
);

export const findHelp = (text: string) => HELP.test(clean(text));

const QUESTION = /^(how|what|whats|why|when|where|who|which|is|are|am i|can|could|should|do|does|did|will|would|have|has)\b/;
export const isQuestion = (text: string) => /\?\s*$/.test(text) || QUESTION.test(clean(text));

// After the safety screen: does what they typed start a follow-up conversation
// instead of a library answer or a fallback? `reply` is what ask() would show.
//   "I'm sad"                    -> I'm sorry to hear that. Can you tell me more?
//   "I'm sick"                   -> Have you talked to your doctor?
//   "I need help"                -> What do you need help with?
//   "my dog died and I'm so sad" -> I'm sorry to hear that. Thank you for telling me. (then the plan)
// Questions ("is it normal to feel sad?") keep their library answer, and
// medicine questions keep the prescriber reply.
export function followUp(text: string, reply: 'answer' | 'medication' | 'fallback' | string): { tree: string; node: string } | null {
  if (reply !== 'answer' && reply !== 'medication' && reply !== 'fallback') return null;
  if (findHelp(text)) return { tree: 'help', node: TREES.help.start };
  const f = findFeeling(text);
  if (f) return { tree: `feeling:${f.key}`, node: TREES[`feeling:${f.key}`].start };
  if (reply === 'medication') return null;
  if (findSick(text)) return { tree: 'sick', node: TREES.sick.start };
  if (isQuestion(text)) return null;
  const m = mentionedFeeling(text);
  if (!m) return null;
  const tree = TREES[`feeling:${m.key}`];
  return { tree: tree.id, node: tree.entries?.[0] ?? tree.start };
}
