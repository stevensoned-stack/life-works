// "How I talk": what Zoey learns about the way one person writes and asks, so
// she understands them better next time (Ed, 2026-10-25: "start learning the
// way each user speaks ... and keep a profile to look back at").
//
// Everything here is plain data kept in the person's encrypted state on this
// phone (store.tsx, vault.ts). It is never sent to staff. They can see it and
// clear it in Settings > What Zoey has learned, and turn learning off.
//
// What she learns:
//   - their own words: "sponser" means "sponsor", "my po" means probation
//     officer (from a miss followed by a rephrase that worked)
//   - their own ways of asking: "where do i go tonite" -> the meetings answer
//     (from a rephrase that worked, or a tap on "You might also ask")
//   - what to call them ("call me J"), short or longer answers, their hello
//   - the questions they ask most, and the people they mention ("my mom", "Jim")
//
// Safety is never learned and never changed by learning. The safety screen
// always reads exactly what they typed, first. Nothing is learned from a
// message that sets it off or asks about medicine, and a learned word can't
// mean, or stand for, anything the screen looks for (canLearn). Feelings
// aren't counted either: that is what check-ins and LifePath are for.
import { isMedicationQuestion } from './medication';
import { normalize, SafetyResult, screen } from './safety';

export type Learned = {
  // What they asked Zoey to call them.
  nickname: string | null;
  // What they asked for ("keep it short"); otherwise read from how they write.
  replies: 'short' | 'long' | null;
  // Their word -> the word Zoey knows. `n`: times seen.
  words: { said: string; means: string; n: number }[];
  // Their way of asking -> the answer it meant (answers.ts id).
  phrases: { said: string; answer: string; n: number }[];
  // Answers they've been given, by id, with the question for the Settings list.
  topics: { answer: string; q: string; n: number }[];
  // "mom", "Jim (brother)".
  people: { who: string; rel: string | null; n: number }[];
  // The hello they use most ("hey", "yo").
  hellos: { word: string; n: number }[];
  // Counted to tell whether they write short messages.
  style: { messages: number; short: number };
  updatedAt: string | null;
};

export const emptyLearned = (): Learned => ({
  nickname: null,
  replies: null,
  words: [],
  phrases: [],
  topics: [],
  people: [],
  hellos: [],
  style: { messages: 0, short: 0 },
  updatedAt: null,
});

// Kept small so the profile stays readable in Settings.
const CAP = { words: 40, phrases: 40, topics: 20, people: 20, hellos: 5 };
const tokens = (t: string) => normalize(t).trim().split(' ').filter(Boolean);
const keep = <T extends { n: number }>(xs: T[], cap: number) => [...xs].sort((a, b) => b.n - a.n).slice(0, cap);
const stamp = (l: Learned, now: Date): Learned => ({ ...l, updatedAt: now.toISOString() });

// ---------------------------------------------------------------------------
// The guard. Nothing is learned from words the safety screen reacts to or from
// medicine questions, so learning can't touch either path.

export function canLearn(text: string) {
  const t = text.trim();
  return !!t && t.length <= 200 && screen(t).kind === 'none' && !isMedicationQuestion(t);
}

// Common shorthand every resident gets from day one, so matching starts
// closer. Only used to pick a library answer; safety reads the original text.
export const SHORTHAND: Record<string, string> = {
  tmrw: 'tomorrow', tmr: 'tomorrow', tmrow: 'tomorrow', tomoro: 'tomorrow', tommorow: 'tomorrow', tomorow: 'tomorrow',
  '2day': 'today', '2nite': 'tonight', tonite: 'tonight', '2night': 'tonight',
  u: 'you', r: 'are', ur: 'your', ya: 'you', pls: 'please', plz: 'please',
  bc: 'because', cuz: 'because', cus: 'because', b4: 'before', rn: 'right now',
  mtg: 'meeting', mtgs: 'meetings', meetin: 'meeting', appt: 'appointment', appts: 'appointments',
  dr: 'doctor', doc: 'doctor', po: 'probation officer', ppl: 'people', sum1: 'someone', some1: 'someone',
  wat: 'what', wut: 'what', wht: 'what', wen: 'when', wher: 'where', hw: 'how',
  wanna: 'want to', gonna: 'going to', gotta: 'got to', hafta: 'have to', kinda: 'kind of',
  sponser: 'sponsor', sponsur: 'sponsor', counsler: 'counselor', councelor: 'counselor', coordinater: 'coordinator',
};

// Their text with their own words (and the shorthand) swapped for the words the
// answer library knows. For matching only: the safety screen never sees this.
export function expand(text: string, l: Learned | null) {
  const mine = new Map((l?.words ?? []).map((w) => [w.said, w.means]));
  return tokens(text)
    .map((w) => mine.get(w) ?? SHORTHAND[w] ?? w)
    .join(' ');
}

// The safety screen on what they typed; if that's clear, on the expanded text
// too. Expanding can only add a safety reply, never take one away.
export function screenHeard(text: string, l: Learned | null): SafetyResult {
  const s = screen(text);
  if (s.kind !== 'none') return s;
  return screen(expand(text, l));
}

// ---------------------------------------------------------------------------
// Matching boost (ask.ts): a way of asking they've used before points straight
// at the answer it meant, and their usual topics win a close tie.

const overlap = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  const both = [...A].filter((x) => B.has(x)).length;
  return both / Math.max(A.size, B.size, 1);
};

export function boost(answerId: string, text: string, l: Learned | null, matched: boolean) {
  if (!l) return 0;
  const said = tokens(text).join(' ');
  let s = 0;
  for (const p of l.phrases) {
    if (p.answer !== answerId) continue;
    if (p.said === said) s = Math.max(s, 12);
    else if (overlap(p.said.split(' '), said.split(' ')) >= 0.75) s = Math.max(s, 6);
  }
  // A small nudge, only for answers that already matched.
  const t = l.topics.find((x) => x.answer === answerId);
  if (t && matched) s += Math.min(t.n, 4) * 0.25;
  return s;
}

// ---------------------------------------------------------------------------
// Learning from a miss: Zoey couldn't place "whats a sponser", then "whats a
// sponsor" worked. She keeps "sponser" -> "sponsor" and the first way of asking.

export function learnRephrase(l: Learned, missed: string, worked: string, answer: string, now = new Date()): Learned {
  if (!canLearn(missed) || !canLearn(worked)) return l;
  let next = learnPhrase(l, missed, answer, now);
  const w = wordSwap(missed, worked);
  if (w) next = learnWord(next, w.said, w.means, now);
  return next;
}

// A tap on "You might also ask" after a question: that's what they meant.
export const learnPick = (l: Learned, question: string, answer: string, now = new Date()) =>
  canLearn(question) ? learnPhrase(l, question, answer, now) : l;

function learnPhrase(l: Learned, text: string, answer: string, now: Date): Learned {
  const said = tokens(text).join(' ');
  if (!said || said.split(' ').length > 14) return l;
  const has = l.phrases.find((p) => p.said === said && p.answer === answer);
  const phrases = has
    ? l.phrases.map((p) => (p === has ? { ...p, n: p.n + 1 } : p))
    : [...l.phrases.filter((p) => p.said !== said), { said, answer, n: 1 }];
  return stamp({ ...l, phrases: keep(phrases, CAP.phrases) }, now);
}

// The one word that changed between the miss and the rephrase: "my po" ->
// "my probation officer" gives po -> probation officer.
export function wordSwap(missed: string, worked: string): { said: string; means: string } | null {
  const a = tokens(missed);
  const b = tokens(worked);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const said = a.slice(i, a.length - j);
  const means = b.slice(i, b.length - j);
  if (said.length !== 1 || !means.length || means.length > 3) return null;
  // Both sides must share some words, or it's a new question, not a rephrase.
  if (i + j === 0) return null;
  if (said[0].length < 2 || /^\d+$/.test(said[0])) return null;
  return { said: said[0], means: means.join(' ') };
}

function learnWord(l: Learned, said: string, means: string, now: Date): Learned {
  if (!canLearn(said) || !canLearn(means) || said === means) return l;
  const has = l.words.find((w) => w.said === said);
  const words = has
    ? l.words.map((w) => (w === has ? { said, means, n: w.means === means ? w.n + 1 : 1 } : w))
    : [...l.words, { said, means, n: 1 }];
  return stamp({ ...l, words: keep(words, CAP.words) }, now);
}

export function countTopic(l: Learned, answer: string, q: string, now = new Date()): Learned {
  const has = l.topics.find((t) => t.answer === answer);
  const topics = has ? l.topics.map((t) => (t === has ? { ...t, n: t.n + 1 } : t)) : [...l.topics, { answer, q, n: 1 }];
  return stamp({ ...l, topics: keep(topics, CAP.topics) }, now);
}

// ---------------------------------------------------------------------------
// Every message that passes canLearn: how long it is, their hello, who they mention.

const RELS = [
  'mom', 'mother', 'mama', 'dad', 'father', 'sister', 'brother', 'son', 'daughter', 'kids', 'kid', 'wife', 'husband',
  'girlfriend', 'boyfriend', 'fiance', 'fiancee', 'partner', 'grandma', 'grandpa', 'grandmother', 'grandfather',
  'aunt', 'uncle', 'cousin', 'friend', 'best friend', 'roommate', 'sponsor', 'counselor', 'therapist', 'boss',
  'probation officer', 'po', 'case manager', 'house manager', 'pastor', 'baby', 'ex',
];
const REL_RE = new RegExp(`\\bmy (${[...RELS].sort((a, b) => b.length - a.length).join('|')})\\b`, 'g');
// A capitalised name right after "my brother": read from what they typed, case and all.
const NAME_AFTER = /^ ([A-Z][a-z]+)\b/;
const HELLO_RE = /^(hi|hello|hey|hiya|heya|howdy|yo|sup|morning|good morning)\b/;

// `known`: first names from their LifeCircle, so "Jim called" counts Jim.
export function observe(l: Learned, text: string, known: string[] = [], now = new Date()): Learned {
  if (!canLearn(text)) return l;
  const n = tokens(text);
  const style = { messages: l.style.messages + 1, short: l.style.short + (n.length <= 4 ? 1 : 0) };
  let hellos = l.hellos;
  const h = n.join(' ').match(HELLO_RE);
  if (h) {
    const word = h[1];
    hellos = keep(hellos.some((x) => x.word === word) ? hellos.map((x) => (x.word === word ? { ...x, n: x.n + 1 } : x)) : [...hellos, { word, n: 1 }], CAP.hellos);
  }
  let people = l.people;
  const bump = (who: string, rel: string | null) => {
    const has = people.find((p) => p.who.toLowerCase() === who.toLowerCase());
    people = has
      ? people.map((p) => (p === has ? { ...p, n: p.n + 1, rel: p.rel ?? rel } : p))
      : [...people, { who, rel, n: 1 }];
  };
  const seen = new Set<string>();
  for (const m of text.toLowerCase().matchAll(REL_RE)) {
    const rel = m[1] === 'po' ? 'probation officer' : m[1];
    const name = text.slice(m.index! + m[0].length).match(NAME_AFTER)?.[1];
    const who = name ?? rel;
    seen.add(who.toLowerCase());
    bump(who, name ? rel : null);
  }
  for (const k of known) {
    if (k && !seen.has(k.toLowerCase()) && new RegExp(`\\b${k.replace(/[^A-Za-z'-]/g, '')}\\b`, 'i').test(text)) bump(k, null);
  }
  return stamp({ ...l, style, hellos, people: keep(people, CAP.people) }, now);
}

// ---------------------------------------------------------------------------
// Things they tell Zoey about themselves.

// Words that follow "call me" but aren't a name.
const NOT_NAME = new Set([
  'back', 'later', 'now', 'today', 'tomorrow', 'tonight', 'please', 'when', 'if', 'a', 'an', 'the', 'at', 'on', 'in',
  'crazy', 'stupid', 'dumb', 'names', 'anything', 'whatever', 'maybe', 'soon', 'asap', 'ok', 'okay', 'it', 'that',
  'out', 'up', 'over', 'sometime', 'tho', 'though', 'there', 'here', 'something', 'someone', 'nothing',
]);

// "Call me J", "I go by Jojo", "my name is Jordan but call me J". Not "call me back".
export function findNickname(text: string): string | null {
  const m = text.trim().match(/^(?:(?:hi|hey|ok|okay|zoey|please|just|actually|you can|u can|can you|could you)[ ,]+)*(?:call me|i go by|my nickname is|everyone calls me|people call me|my name is|my names|my name's|i am|im|i'm)\s+([A-Za-z][A-Za-z'-]{0,19}(?: [A-Za-z][A-Za-z'-]{0,19})?)[.! ]*$/i);
  if (!m) return null;
  // "I am" / "im" only with an explicit "call me" before it, or it catches "I'm tired".
  if (/^(?:.*\s)?(?:i am|im|i'm)\s/i.test(text.trim()) && !/call me|go by|nickname|name/i.test(text)) return null;
  const name = m[1].trim();
  if (name.split(' ').some((w) => NOT_NAME.has(w.toLowerCase()))) return null;
  if (!canLearn(name)) return null;
  return name.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function setNickname(l: Learned, name: string | null, now = new Date()): Learned {
  return stamp({ ...l, nickname: name }, now);
}

const SHORT_ASK = /\b(?:keep it short|shorter|too long|tldr|tl dr|less words|fewer words|short answers|shorter answers|get to the point|too much to read|just the short version)\b/;
const LONG_ASK = /\b(?:longer answers|more detail|more details|give me more detail|in more detail|you can say more|full answers|longer replies)\b/;

export function findReplyPref(text: string): 'short' | 'long' | null {
  const t = tokens(text).join(' ');
  if (SHORT_ASK.test(t)) return 'short';
  if (LONG_ASK.test(t)) return 'long';
  return null;
}

export const setReplies = (l: Learned, replies: 'short' | 'long' | null, now = new Date()): Learned =>
  stamp({ ...l, replies }, now);

// What they asked for, or after 10 messages, short if most of theirs are 4 words or fewer.
export function replyStyle(l: Learned | null): 'short' | 'long' | null {
  if (!l) return null;
  if (l.replies) return l.replies;
  if (l.style.messages >= 10 && l.style.short / l.style.messages >= 0.7) return 'short';
  return null;
}

// The first two sentences, and the rest behind "More". Short texts stay whole.
export function shorten(text: string): { short: string; rest: string } | null {
  if (text.length <= 200) return null;
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [text];
  if (sentences.length <= 2) return null;
  const short = sentences.slice(0, 2).join('').trim();
  return { short, rest: sentences.slice(2).join('').trim() };
}

// The hello they use most, said back to them ("Hey Jordan, good morning!").
const HELLO_BACK: Record<string, string> = { hey: 'Hey', yo: 'Yo', sup: 'Hey', hiya: 'Hiya', heya: 'Heya', howdy: 'Howdy' };
export function helloBack(l: Learned | null): string | null {
  const top = l?.hellos[0];
  return top && top.n >= 2 ? HELLO_BACK[top.word] ?? null : null;
}

// ---------------------------------------------------------------------------
// Settings > What Zoey has learned: remove one thing, or everything.

export type LearnedKind = 'nickname' | 'replies' | 'word' | 'phrase' | 'topic' | 'person' | 'hello';

export function forget(l: Learned, kind: LearnedKind, key = '', now = new Date()): Learned {
  switch (kind) {
    case 'nickname':
      return stamp({ ...l, nickname: null }, now);
    case 'replies':
      return stamp({ ...l, replies: null, style: { messages: 0, short: 0 } }, now);
    case 'word':
      return stamp({ ...l, words: l.words.filter((w) => w.said !== key) }, now);
    case 'phrase':
      return stamp({ ...l, phrases: l.phrases.filter((p) => p.said !== key) }, now);
    case 'topic':
      return stamp({ ...l, topics: l.topics.filter((t) => t.answer !== key) }, now);
    case 'person':
      return stamp({ ...l, people: l.people.filter((p) => p.who !== key) }, now);
    case 'hello':
      return stamp({ ...l, hellos: [] }, now);
  }
}

export const isEmpty = (l: Learned) =>
  !l.nickname && !l.replies && !l.words.length && !l.phrases.length && !l.topics.length && !l.people.length && !l.hellos.length;

// ---------------------------------------------------------------------------
// For live AI answers (PR #31), only when that is switched on: the least that
// helps her understand them. No people, no names of others, no topics' text,
// nothing about safety. Words that look like a phone number or email are dropped.

export function summaryForLive(l: Learned | null) {
  if (!l) return null;
  const clean = (s: string) => !/\d{3}|@/.test(s);
  return {
    callMe: l.nickname,
    replies: replyStyle(l),
    words: l.words.filter((w) => w.n >= 1 && clean(w.said) && clean(w.means)).slice(0, 10).map((w) => `${w.said} = ${w.means}`),
    asksAbout: l.topics.slice(0, 3).map((t) => t.answer),
  };
}
