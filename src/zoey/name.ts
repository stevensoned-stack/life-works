// When they say Zoey's name (Ed, 2026-11-14: "when the user mentions zoey or Zoey
// or Zoe, come up with an answer based on the context, such as Hi Zoey, say Hi {name}").
//
// - "Zoey", "Zoe?", "zoeyyy": she answers to her name.
// - "Zoey are you there?", "you there?", "can you hear me": she's right here.
// - "Hi Zoey", "Hey Zoe", "Good morning Zoey": her hello mirrors theirs, name right
//   after it with no comma ("Hi Jordan!"), then "how are you?".
// - Anywhere else her name is just them talking to her ("Zoey, what's next?",
//   "I'm tired Zoe Zoe"), so it comes off and she answers the rest.
// - "Zoey is stupid", "I love Zoey", "thanks Zoey": the name is part of what they
//   mean, so it stays and the usual answers take it from there.
//
// Typos and nicknames count: zoe, zoie, zooey, zoeyy, zowey, zoee. If someone in
// their LifeCircle is really named Zoe, "Zoe" means that person, not her.
// The safety screen runs on what they typed before any of this (AskScreen.submit).
import { clean } from './feelings';
import { partOfDay, type PartOfDay } from './greet';

const VARIANT = 'z+o+e+y*s?|z+o+i+e*s?|z+o+e+i+|z+o+y+|z+o+a+y+|z+o+w+e+y*|z+o+o+e+y+';
const VARIANT_RE = new RegExp(`\\b(?:${VARIANT})\\b`, 'gi');

// Her name in their words: every spelling becomes "Zoey", except a LifeCircle person's own name.
export function spellName(text: string, people: string[] = []): string {
  const theirs = new Set(people.map((p) => p.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean));
  return text.replace(VARIANT_RE, (w) => {
    const low = w.toLowerCase();
    if (low !== 'zoey' && low !== 'zoeys' && theirs.has(low.replace(/s$/, ''))) return w;
    // "zoeys" (apostrophe already gone) stays possessive.
    return /ys$/i.test(w) ? 'Zoey’s' : 'Zoey';
  });
}

export const saysName = (text: string, people: string[] = []) => /\bzoey\b/i.test(spellName(text, people));

export type NameCall = { kind: 'only' } | { kind: 'there' } | { kind: 'greet'; hi: string; asked: boolean };

const ONLY = /^(?:(?:oh|um|uh|ok|okay|so|and|well|yes) )*zoey(?: zoey)*$/;
const THERE = new RegExp(
  '^(?:(?:hey|hi|hello|yo|oh|um|uh|ok|okay|zoey) )*(?:' +
    [
      '(?:are|r) (?:you|u) (?:still )?(?:there|here|around|awake|up|listening|with me|ignoring me|busy)',
      '(?:you|u) (?:still )?(?:there|here|around|awake|listening|with me)',
      '(?:can|do) (?:you|u) hear me',
      '(?:is )?(?:anyone|anybody|someone|somebody) (?:there|here|home|listening)',
      'where (?:are|r) (?:you|u)',
      'where (?:did|d) (?:you|u) go',
      'did (?:you|u) (?:leave|fall asleep|go to sleep)',
      'knock knock',
      'hello+(?: hello+)+',
    ].join('|') +
    ')(?: (?:zoey|now|right now|lol|still))*$',
);
// A greeting with her name: "hi zoey", "hey zoe how are you", "good morning zoey".
const HELLO = '(good (?:morning|afternoon|evening|day)|morning|afternoon|evening|hiya|hi|hello|heya|hey|howdy|yo|sup|whats up)';
const HOW = '(?:how are you(?: doing| today)?|how are you doing today|hows it going|how is it going|hows your day|whats up|how have you been|hru|how r u|how are u)';
const GREET = new RegExp(`^${HELLO}(?: there)?(?: zoey)+(?: (?:${HOW}))?(?: zoey)?$|^zoey ${HELLO}(?: (?:${HOW}))?$`);

const GOOD_PART: Record<PartOfDay, string> = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' };
// Her hello mirrors theirs. "Good morning" at 3 PM is "Good afternoon".
function helloFor(word: string, now: Date): string {
  if (/^(?:good |morning|afternoon|evening)/.test(word)) return GOOD_PART[partOfDay(now)];
  if (word === 'hello') return 'Hello';
  if (word === 'howdy') return 'Howdy';
  if (word === 'hi' || word === 'hiya') return 'Hi';
  return 'Hey';
}

export function findNameCall(text: string, now: Date = new Date(), people: string[] = []): NameCall | null {
  const t = clean(spellName(text, people));
  if (ONLY.test(t)) return { kind: 'only' };
  if (THERE.test(t)) return { kind: 'there' };
  const g = GREET.exec(t);
  if (g && /\bzoey\b/.test(t)) {
    const word = g[1] ?? g[2];
    return { kind: 'greet', hi: helloFor(word, now), asked: new RegExp(`${HOW}(?: zoey)?$`).test(t) };
  }
  return null;
}

// Words that make the name part of what they mean ("Zoey is...", "I love Zoey").
const KEEP_AFTER = /^(?:is|isnt|isn’t|isn't|was|wasnt|wasn't|s|has|hasnt|had|doesnt|doesn't|doesn’t|sucks|rocks|knows|said|says|told|thinks|seems|gets|makes|always|never|keeps|and)$/i;
const KEEP_BEFORE = /^(?:love|like|hate|miss|need|thank|about|to|with|for|call|called|ask|asked|named|meet|is|am|are|was|from|of|trust|help|helps|use|using|annoy|dear|and|or|than|hey|hi|hello|bye|goodbye|night|morning|evening|afternoon|thanks|ty|sorry|love|you|u)$/i;

// Their message with Zoey's name taken out where it's only them talking to her.
// Punctuation at the end stays: "what's next zoey?" -> "what's next?".
export function withoutName(text: string, people: string[] = []): string {
  let s = spellName(text, people).trim();
  // Leading: "Zoey, what's next", "hey zoey I'm sad", "ok zoey can you help".
  const lead = /^(?:(?:hey|hi|hello|ok|okay|so|um|oh|yo|well|and|but|uh)[\s,]+)*zoey\b[\s,:;!.\-–—]*/i.exec(s);
  if (lead) {
    const rest = s.slice(lead[0].length);
    const next = rest.split(/\s+/)[0]?.replace(/[^a-z’']/gi, '') ?? '';
    if (rest && !KEEP_AFTER.test(next) && !/^’s|^'s/.test(rest)) s = rest;
  }
  // In the middle, set off by commas: "I'm sad, Zoey, really sad".
  s = s.replace(/,\s*zoey\s*(?=[,.!?])/gi, '');
  // Trailing: "what's next zoey?", "I'm tired Zoe Zoe" (beta test).
  const tail = /((?:[\s,]+zoey)+)([\s!?.,]*)$/i.exec(s);
  if (tail) {
    const before = s.slice(0, tail.index);
    const prev = before.trim().split(/\s+/).pop()?.replace(/[^a-z’']/gi, '') ?? '';
    if (before.trim() && !KEEP_BEFORE.test(prev)) s = `${before.replace(/[\s,]+$/, '')}${tail[2].trim().replace(/^[,]+/, '')}`;
  }
  return s.trim();
}

// --- What she says ----------------------------------------------------------

export const NAME_ONLY = ['Yes {name}? I’m right here.', 'That’s me! What’s on your mind, {name}?', 'I’m here {name}! What’s up?', 'Right here! What can I do for you, {name}?'];
export const NAME_THERE = [
  'I’m right here {name}! What’s on your mind?',
  'Yep, still here! I’m not going anywhere. What’s up?',
  'I’m here, {name}. Always. What can I do for you?',
  'Right here and listening! What’s going on?',
];
// When she was in the middle of asking them something: she's here, and the question stays open.
export const NAME_BACK = ['I’m right here {name}! Take your time.', 'Still here! Whenever you’re ready, I’m listening.', 'I’m here {name}. No rush.'];
