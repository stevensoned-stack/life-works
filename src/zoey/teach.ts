// Teaching Zoey what a saying means (Ed, 2026-10-25: "when zoey doesn't know what
// a question, saying or expression means have her figure it out for the next
// time or teach it to her for the next time").
//
// Two ways, both on top of learn.ts:
//   1. On the phone. When she misses, she guesses the closest answers and asks
//      which one they meant ("I'm still learning. Did you mean one of these?").
//      Their pick, or the rephrase that worked, is kept in their own profile.
//   2. For everyone, only if the person turns on "Help teach Zoey" (off by
//      default). The missed saying is scrubbed (no names, numbers, links, long
//      messages, danger or medicine) and sent without who said it. Staff map it
//      to an answer, or write one, on the server's Teach Zoey page, and every
//      phone picks that up.
//
// Safety is the same as learn.ts: the safety screen and the medicine check run
// on what they typed before any of this, and a saying that the screen or the
// medicine check reacts to is never sent, taught or used.
// No import of answers.ts here: the server uses this file too, and answers.ts
// pulls in app screen types. Callers pass the answers in.
import { canLearn } from './learn';
import { normalize } from './safety';

// What the team has taught Zoey, from the server. Same on every phone.
export type Taught = {
  // A saying -> an answer id (a library answer or one of `answers`).
  phrases: { said: string; answer: string }[];
  // Answers the team wrote for sayings the library didn't cover.
  answers: { id: string; q: string; text: string }[];
  at: string | null;
};
export const emptyTaught = (): Taught => ({ phrases: [], answers: [], at: null });

// A missed saying waiting to go to the team (only with "Help teach Zoey" on).
// `picked`: the answer they said it meant, if they told her.
export type Missed = { id: string; phrase: string; picked: string | null; at: string };

// The parts of a library answer (answers.ts) this file reads.
type Guessable = { id: string; q: string; keys: string[] };

const tokens = (t: string) => normalize(t).trim().split(' ').filter(Boolean);

// ---------------------------------------------------------------------------
// Scrubbing, on the phone and again on the server. Returns null when the saying
// can't be sent at all.

// Capitalised words that aren't anyone's name.
const NOT_NAMES = new Set([
  'i', 'im', 'ive', 'id', 'ill', 'aa', 'na', 'ca', 'smart', 'god', 'jesus', 'lord', 'zoey', 'ok', 'okay', 'omg', 'lol', 'idk',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december',
  'ged', 'po', 'ua', 'dr', 'mr', 'mrs', 'ms', 'er', 'tv',
]);

export const MAX_WORDS = 12;

// `names`: their name, their coordinator's, their LifeCircle's.
export function scrubPhrase(text: string, names: string[] = []): string | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t || !canLearn(t)) return null;
  // Long messages are stories, and stories carry details. Only short sayings go.
  if (t.split(' ').length > MAX_WORDS || t.length > 100) return null;
  const known = new Set(names.flatMap((n) => n.toLowerCase().split(/\s+/)).filter((n) => n.length > 1));
  const out = t
    .replace(/\S+@\S+|https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/\d[\d\s().:/-]*\d|\d/g, '#')
    .split(' ')
    .map((w, i) => {
      const bare = w.replace(/[^A-Za-z']/g, '').replace(/'s$/i, '');
      const lower = bare.toLowerCase().replace(/'/g, '');
      if (!bare) return w;
      if (known.has(lower)) return w.replace(bare, '[name]');
      // A capital in the middle of a sentence is likely a name or a place.
      if (i > 0 && /^[A-Z]/.test(bare) && !NOT_NAMES.has(lower)) return w.replace(bare, '[name]');
      return w;
    })
    .join(' ')
    .toLowerCase()
    .replace(/\[name\]/g, '[name]');
  return out.replace(/[^a-z0-9\[\]# '?!.,-]/g, '').trim() || null;
}

// ---------------------------------------------------------------------------
// Her best guesses at what a missed saying meant: answers sharing a word with
// it, typos and word endings included ("spnsr", "meetings").

const STOP = new Set([
  'i', 'a', 'an', 'the', 'to', 'my', 'me', 'is', 'am', 'are', 'do', 'does', 'did', 'how', 'what', 'whats', 'when', 'where',
  'why', 'who', 'can', 'could', 'should', 'would', 'will', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'it', 'its', 'im',
  'you', 'your', 'u', 'ur', 'be', 'get', 'got', 'have', 'has', 'with', 'about', 'that', 'this', 'there', 'so', 'just',
  'like', 'if', 'not', 'no', 'yes', 'some', 'any', 'go', 'going', 'want', 'need', 'know', 'really', 'one', 'up', 'out',
]);

function close(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b.slice(0, 5)) || b.startsWith(a.slice(0, 5)))) return true;
  if (a.length < 4 || Math.abs(a.length - b.length) > 1) return false;
  // One letter off (missing, extra or wrong), or two letters swapped.
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// A whole missing vowel run ("spnsr" for "sponsor") counts as close too.
const consonants = (w: string) => w.replace(/[aeiou]/g, '');

export function guesses<A extends Guessable>(text: string, answers: A[], n = 3): A[] {
  const words = [...new Set(tokens(text).filter((w) => !STOP.has(w) && w.length > 1))];
  if (!words.length) return [];
  return answers
    .map((a) => {
      const vocab = new Set([a.q, ...a.keys].flatMap(tokens).filter((w) => !STOP.has(w)));
      let s = 0;
      for (const w of words) {
        if (vocab.has(w)) s += 2;
        else if ([...vocab].some((v) => close(w, v) || (w.length >= 4 && consonants(w) === consonants(v)))) s += 1;
      }
      return { a, s };
    })
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s)
    .slice(0, n)
    .map((x) => x.a);
}

// ---------------------------------------------------------------------------
// What she says.

const quoted = (t: string) => {
  const s = t.trim().replace(/[.!?]+$/, '');
  return s.split(/\s+/).length <= 6 ? `“${s}”` : 'that';
};

export const teachLine = (said: string, hasGuesses: boolean) =>
  hasGuesses
    ? `I’m still learning, and I don’t know ${quoted(said)} yet. Did you mean one of these? I’ll remember for next time.`
    : `I’m still learning, and I don’t know ${quoted(said)} yet. Can you say it another way? I’ll remember for next time.`;
export const SOMETHING_ELSE = 'Something else';
export const SAY_IT_AGAIN = 'Okay! Tell me in other words, and I’ll remember what you meant.';
export const thanksLine = (said: string) => `Thanks for teaching me! Next time I’ll know what ${quoted(said)} means.`;

// ---------------------------------------------------------------------------
// Using what the team taught: their answers join the library, and their
// sayings point at an answer, a little below a person's own (12).

export const taughtAnswers = (t: Taught | null) =>
  (t?.answers ?? []).map((a) => ({ id: a.id, topic: 'Using Life Works' as const, q: a.q, keys: [] as string[], text: a.text }));

export function taughtBoost(answerId: string, text: string, t: Taught | null) {
  if (!t) return 0;
  const said = tokens(text).join(' ');
  let s = 0;
  for (const p of t.phrases) {
    if (p.answer !== answerId || !canLearn(p.said)) continue;
    if (p.said === said) s = Math.max(s, 11);
    else {
      const a = new Set(p.said.split(' '));
      const b = new Set(said.split(' '));
      const both = [...a].filter((x) => b.has(x)).length;
      if (both / Math.max(a.size, b.size, 1) >= 0.75) s = Math.max(s, 5);
    }
  }
  return s;
}

// The saying as the server stores it, so the phone and server compare alike.
export const sayingKey = (text: string) => tokens(text).join(' ');

// Used by the phone before queueing: nothing about safety or medicine, short, scrubbed.
export function missedFor(text: string, names: string[], picked: string | null, id: string, now = new Date()): Missed | null {
  const phrase = scrubPhrase(text, names);
  return phrase ? { id, phrase, picked, at: now.toISOString() } : null;
}
