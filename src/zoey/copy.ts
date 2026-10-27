// Authored text for the Daily Check-In flow (Layer 2 in the build plan).
// Zoey asks, listens, logs and reflects back. She does not diagnose, interpret,
// or give treatment advice. Every line here needs clinician sign-off before
// real use; FLOW_VERSION is pinned on every saved check-in so it can be audited.

import { CheckInKind } from '../data/types';
import { LIFELINE } from './answers';

export const FLOW_VERSION = 'daily-checkin@0.1-draft';

export const NEGATIVE_TAGS = ['Money', 'Housing', 'Work or school', 'People', 'Cravings', 'Sleep', 'Feeling alone', 'Meds'];
export const POSITIVE_TAGS = ['Slept well', 'People', 'Work or school', 'Meetings', 'Home', 'Staying busy', 'Exercise'];

export function partOfDay(d = new Date()): 'morning' | 'afternoon' | 'evening' {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function kindFor(d = new Date()): CheckInKind {
  const h = d.getHours();
  if (h < 11) return 'morning';
  if (h < 17) return 'midday';
  return 'evening';
}

export const KIND_LABEL: Record<CheckInKind, string> = {
  morning: 'Morning check-in',
  midday: 'Midday check-in',
  evening: 'Evening check-in',
  drop_in: 'Check-in',
};

export const copy = {
  greet: (name: string, kind: CheckInKind) =>
    kind === 'morning'
      ? `Good morning ${name}! Before your day gets going, how are you feeling right now?`
      : kind === 'evening'
        ? `Good evening ${name}. How are you feeling as the day winds down?`
        : `Hi ${name}, checking in. How are you feeling right now?`,
  afterMood: (v: number) =>
    v < 0
      ? "Thanks for being honest with me. I'm sorry it's a hard one. Let's see what's behind it, so today can go a little easier."
      : v === 0
        ? "Okay, thanks for checking in. Let's take a quick look at your day."
        : "Oh, I'm so glad to hear that! Let's remember what's helping, so you can look back on it later.",
  askTags: (v: number) =>
    v >= 1 ? "What's been helping today? You can tap any that fit." : "What do you think is behind that feeling? You can tap any that fit.",
  askMoreTags: "Okay, I've got those. Is anything else part of it?",
  rather: "That's okay. You don't have to.",
  askMeds: 'Did you take your morning meds?',
  meds: {
    yes: 'Good, thanks for taking care of yourself.',
    not_yet: "Okay. Maybe set a little reminder so you don't forget?",
    none: 'Okay, thanks for letting me know.',
  },
  journalPrompt: "Go ahead and write whatever's on your mind. I'll save it to your LifePath.",
  journalSaved: "Saved. Thanks for putting that into words.",
  // One short, non-advisory reflection per tag. Offers are content, not advice.
  reflect: {
    Sleep: "Rough sleep makes everything harder. A slow breathing exercise can help your body settle, if you'd like it.",
    Cravings: 'Cravings are real, and saying it out loud is a strong move. Want to call Maya now?',
    Housing: 'Housing stress is a lot to carry, and Maya can help with it. Want to call her now?',
    'Feeling alone': "I'm glad you told me. Want to call Maya now, or just keep going?",
    Money: "Money worries are so heavy. I've saved it so you and Maya can talk it through.",
    Meds: "That's a good one to bring up with your prescriber. I put it in today's notes so you don't have to remember it.",
    'Work or school': "That's a lot to juggle. Be gentle with yourself today.",
    People: "Ugh, people can be the hardest part. I'm sorry you're dealing with that.",
  } as Record<string, string>,
  positive: "I love that. I saved what's helping on your LifePath.",
  done: (name: string) => `All done, ${name}. Thanks for checking in with me. It's saved on your LifePath.`,
  footer: `If you ever feel unsafe, call or text ${LIFELINE}, any time. In an emergency, call 911.`,
  freeTextAck: "Got it. I've added that to today's notes.",
  medsFreeText:
    "That's worth saying out loud to your prescriber. I've added it to today's notes so it's there when you see them.",
  safetyCheck: "I'm really worried about you. Are you safe right now?",
  safeYes: `I'm glad you're safe right now. If that changes, you can call or text ${LIFELINE}, any time, day or night.`,
};

// Other ways to say the everyday lines above, so Zoey sounds like a person and
// not a script (Ed, 2026-10-24). Safety lines (safetyCheck, safeYes, footer)
// are never varied. Keys are copy keys, or reflect.<tag>.
export const COPY_ALTS: Record<string, string[]> = {
  rather: ["No problem. We don't have to go there.", "That's fine. You don't owe anyone an explanation."],
  freeTextAck: ["I hear you. That's in today's notes.", "Okay, I've got that down in today's notes.", "That makes sense. I've added it to today's notes."],
  medsFreeText: ["Your prescriber should hear that. It's in today's notes so you don't have to remember it."],
  journalSaved: ['Saved. Writing it down can take some of the weight off.', "It's saved. Good on you for getting it out of your head."],
  positive: ["Love that. It's on your LifePath so you can look back on it.", "That's the good stuff. I've added it to your LifePath."],
  'reflect.Cravings': ["That's a hard moment, and you're handling it by speaking up. Want to call Maya now?"],
  'reflect.Money': ["Money stress is exhausting. I saved it so you and Maya can look at it together."],
  'reflect.People': ["Other people can really get under your skin. I hear you."],
  'reflect.Work or school': ['That’s a lot on your plate. Take it one thing at a time.'],
};

// One of the ways to say a copy line, at random (`rand` for tests).
export function vary(key: string, rand: () => number = Math.random): string {
  const base = key.startsWith('reflect.') ? copy.reflect[key.slice(8)] : (copy as unknown as Record<string, string>)[key];
  const all = [base, ...(COPY_ALTS[key] ?? [])];
  return all[Math.floor(rand() * all.length) % all.length];
}

// Simple keyword slots so a typed message can add tags, e.g.
// "cant sleep, roommate using again" -> Sleep, People, Cravings.
const SLOT_WORDS: [string, string[]][] = [
  ['Sleep', ['sleep', 'slept', 'insomnia', 'tired', 'awake all night', 'nightmare']],
  ['Money', ['money', 'broke', 'rent', 'bills', 'paycheck', 'cash']],
  ['Housing', ['housing', 'evict', 'kicked out', 'out tonight', 'homeless', 'shelter', 'landlord', 'roommate says']],
  ['Work or school', ['work', 'job', 'boss', 'school', 'class', 'ged', 'shift']],
  ['People', ['roommate', 'family', 'mom', 'dad', 'sister', 'brother', 'friend', 'girlfriend', 'boyfriend', 'partner']],
  ['Cravings', ['craving', 'crave', 'want to use', 'wanna use', 'using again', 'relapse', 'drink', 'high']],
  ['Feeling alone', ['alone', 'lonely', 'no one', 'nobody']],
  ['Meds', ['meds', 'medication', 'medicine', 'pills', 'prescription']],
];

export function extractTags(text: string): string[] {
  const t = text.toLowerCase();
  return SLOT_WORDS.filter(([, words]) => words.some((w) => t.includes(w))).map(([tag]) => tag);
}
