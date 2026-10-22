// Spotting a typed feeling ("I'm sad", "feeling really anxious today") so Zoey
// can ask if they know why (Ed, 2026-10-22). Only short statements count: a
// question goes to the answer library, and "I'm sad because..." already says why.
// The safety screen always runs before this.
import { FeelingKey } from './trees';

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
