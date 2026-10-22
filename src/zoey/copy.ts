// Authored text for the Daily Check-In flow (Layer 2 in the build plan).
// Zoey asks, listens, logs and reflects back. She does not diagnose, interpret,
// or give treatment advice. Every line here needs clinician sign-off before
// real use; FLOW_VERSION is pinned on every saved check-in so it can be audited.

import { CheckInKind } from '../data/types';

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
      ? `Good morning, ${name}! Before your day gets going, how are you feeling right now?`
      : kind === 'evening'
        ? `Good evening, ${name}. How are you feeling as the day winds down?`
        : `Hi ${name}, checking in. How are you feeling right now?`,
  afterMood: (v: number) =>
    v < 0
      ? "Thanks for being honest. Let's figure out what's behind it so today goes a little easier."
      : v === 0
        ? "Thanks for checking in. Let's take a quick look at what's going on today."
        : "Good to hear. Let's note what's helping, so you can look back on it later.",
  askTags: (v: number) =>
    v >= 1 ? "What's helping today? Tap anything that fits." : "What's behind that feeling? Tap anything that fits.",
  askMoreTags: "Here's what I've noted. Tap anything else that's part of it.",
  rather: "That's okay. You don't have to.",
  askMeds: 'Did you take your morning meds?',
  meds: {
    yes: 'Got it, thanks.',
    not_yet: "Got it. I've noted that for today.",
    none: 'Okay, thanks for letting me know.',
  },
  journalPrompt: "Go ahead and write whatever's on your mind. I'll save it to your LifePath.",
  journalSaved: "Saved. Thanks for putting that into words.",
  // One short, non-advisory reflection per tag. Offers are content, not advice.
  reflect: {
    Sleep: "Rough sleep makes everything harder. There's a 4-7-8 breathing exercise from group, if you'd like it.",
    Cravings: 'Thanks for telling me. Cravings are worth sharing with someone you trust. Want to call Maya now?',
    Housing: 'Housing stress is a lot to carry, and Maya can help with it. Want to call her now?',
    'Feeling alone': "I'm glad you told me. Want to call Maya now, or just keep going?",
    Money: "Money worries are heavy. I've noted it so you and Maya can talk it through.",
    Meds: "Thanks for telling me. That's worth bringing up with your prescriber. I've added it to today's notes so it doesn't get lost.",
    'Work or school': "That's a lot to juggle. I've noted it on your LifePath.",
    People: "People can be the hardest part. I've noted it on your LifePath.",
  } as Record<string, string>,
  positive: "Nice. I've noted what's helping on your LifePath.",
  breathing: {
    title: '4-7-8 breathing',
    steps: ['Breathe in through your nose for 4.', 'Hold for 7.', 'Breathe out slowly through your mouth for 8.', 'Repeat 4 times.'],
    source: 'From your group materials',
  },
  done: (name: string) => `That's your check-in done, ${name}. I've logged it on your LifePath.`,
  footer: 'If you ever feel unsafe, call or text 988 any time, or 911 in an emergency.',
  freeTextAck: "Thanks for telling me. I've added that to today's notes.",
  medsFreeText:
    "Thanks for telling me. That's worth saying out loud to your prescriber. I've added it to today's notes so it's there when you see them.",
  safetyCheck: 'Thank you for telling me. First: are you safe right now?',
  safeYes: "I'm glad you're safe right now. If that changes, you can call or text 988 any time, day or night.",
};

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
