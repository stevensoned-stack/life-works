// Rules for Zoey's optional live AI answers, shared by the app and the server
// so both apply them (the server again, in case an older app skips a step).
//
// The live model only ever sees ordinary conversation. Safety always runs on
// the phone first: crisis and danger words get the authored help and are never
// sent, and once a chat has had danger words the rest of it stays authored.
// What the model writes back must pass checkLiveReply() or the authored answer
// is shown instead. Crisis lines, 988 and 911 text never come from the model.

import { screen } from './safety';
import { validateReply } from './validate';

export type LiveTurn = { from: 'me' | 'zoey'; text: string };

// The few facts the model may use. Nothing else about the person is sent.
export type LiveContext = {
  firstName: string;
  cleanDays: number | null;
  coordinatorName: string; // staff, e.g. "Maya"
  hasSponsor: boolean;
  // Only when they asked about today ("what do I have today?").
  today?: { time: string; label: string }[];
};

export type LiveRequest = { message: string; history: LiveTurn[]; context: LiveContext };

export const LIVE_LIMITS = { message: 1000, turn: 600, history: 12, reply: 600 };

// ---------------------------------------------------------------------------
// Taking personal details out before anything leaves the phone.

const PATTERNS: [RegExp, string][] = [
  [/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, '[email]'],
  [/\bhttps?:\/\/\S+|\bwww\.\S+/gi, '[link]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[number]'], // SSN shape
  [/(\+?1[-.\s]?)?\(?\b\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[phone]'],
  // "1234 N Monroe St", "55 E 3rd Ave"
  [/\b\d{1,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Za-z0-9]+\s+){0,3}(?:st|street|ave|avenue|rd|road|blvd|boulevard|dr|drive|ln|lane|way|ct|court|pl|place|hwy|highway)\b\.?/gi, '[address]'],
  [/\b(?:apt|apartment|unit|suite)\s*#?\s*\w+\b/gi, '[address]'],
  [/\b\d{5}(?:-\d{4})?\b/g, '[number]'], // zip codes, case and account numbers
  [/\b\d{6,}\b/g, '[number]'],
];

// `names`: full names of people in their LifeCircle; only first names go out.
export function scrub(text: string, names: string[] = []): string {
  let out = text;
  for (const full of names) {
    const parts = full.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const rest = parts.slice(1).map(esc).join('\\s+');
    out = out.replace(new RegExp(`\\b${esc(parts[0])}\\s+${rest}\\b`, 'gi'), parts[0]);
  }
  for (const [re, label] of PATTERNS) out = out.replace(re, label);
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "What do I have today?", "what's my schedule", "plans tonight"
export const asksAboutToday = (text: string) =>
  /\b(today|tonight|this (morning|afternoon|evening)|schedule|my plans?|my day|what do i have|where (do|should) i (need to )?be)\b/i.test(text);

// Trims and scrubs a request so it fits the limits; used on both sides.
export function cleanRequest(req: LiveRequest, names: string[] = []): LiveRequest {
  const cut = (s: string, n: number) => scrub(s, names).slice(0, n).trim();
  const c = req.context;
  return {
    message: cut(req.message, LIVE_LIMITS.message),
    history: req.history
      .filter((t) => t.text.trim())
      .slice(-LIVE_LIMITS.history)
      .map((t) => ({ from: t.from, text: cut(t.text, LIVE_LIMITS.turn) })),
    context: {
      firstName: c.firstName.trim().split(/\s+/)[0].slice(0, 40),
      cleanDays: typeof c.cleanDays === 'number' && c.cleanDays >= 0 ? Math.floor(c.cleanDays) : null,
      coordinatorName: c.coordinatorName.trim().split(/\s+/)[0].slice(0, 40),
      hasSponsor: !!c.hasSponsor,
      ...(c.today?.length && asksAboutToday(req.message)
        ? { today: c.today.slice(0, 8).map((x) => ({ time: x.time.slice(0, 5), label: scrub(x.label, names).slice(0, 60) })) }
        : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// What the model wrote, checked before anyone sees it.

// Crisis and emergency wording stays authored, word for word.
const CRISIS_WORDS =
  /\b(988|911|suicid\w*|lifeline|crisis line|hotline|emergency room|call emergency|self[- ]harm|overdos\w*|kill (yourself|myself)|end (your|my) life)\b/i;

export function checkLiveReply(text: string): { ok: boolean; reasons: string[] } {
  const t = text.trim();
  const reasons: string[] = [];
  if (!t) reasons.push('empty');
  if (t.length > LIVE_LIMITS.reply) reasons.push('too long');
  if (CRISIS_WORDS.test(t)) reasons.push('crisis wording');
  if (screen(t).kind !== 'none') reasons.push('safety words');
  if (/https?:\/\/|www\./i.test(t)) reasons.push('link');
  // The usual output rules (no diagnosis, no medicine directions, not a
  // professional). Model replies may not carry any phone number, even a known
  // one; short numbers like "120 days" are fine.
  const short = (t.match(/\b\d{3,6}\b/g) ?? []).filter((n) => !/^(988|911|211)$/.test(n));
  reasons.push(...validateReply(t, short).reasons);
  return { ok: reasons.length === 0, reasons };
}
