// Paced breathing, from Ed's Paced Breathing Timer (2026-10-27: "add this when you ask
// to breath"). A circle grows while they breathe in and shrinks while they breathe out,
// with a count down for each half. Pure, so the timer screen and tests share it.

export type Pattern = { in: number; out: number };

// Seconds in / out. 4 / 6 is the default: about 6 breaths a minute.
export const PATTERNS: Pattern[] = [
  { in: 4, out: 6 },
  { in: 5, out: 5 },
  { in: 4, out: 7 },
];
export const LENGTHS = [1, 3, 5];
export const DEFAULT_MINUTES = 5;

// How small the circle gets at the bottom of a breath out (1 is full size).
export const SMALL = 0.45;

export const TITLE = 'Paced Breathing';
export const SUB = 'Slow the body so the heart and brain can work together.';
// Zoey, when the timer runs out. Their answer goes through the usual feelings and safety.
export const AFTER_BREATHING = ['Nice work. How do you feel now?', 'You did it. How is your body feeling now?', 'Well done. How are you feeling after that?'];
// Before the flow they were in carries on with its next question.
export const BREATH_WELL_DONE = ['Nice work.', 'Well done.', 'Good job sticking with it.'];
export const DONE_LINE = 'Notice how your body feels now. Rate your stress from 1 to 10.';

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

// Where they are in the breath `elapsed` seconds in.
export const breathAt = (elapsed: number, p: Pattern) => {
  const cycle = p.in + p.out;
  const t = elapsed % cycle;
  const inhale = t < p.in;
  const f = inhale ? t / p.in : (t - p.in) / p.out;
  return {
    inhale,
    cue: inhale ? 'Breathe in' : 'Breathe out',
    // Seconds left in this half, counting down to 1.
    count: Math.ceil((inhale ? p.in - t : cycle - t) - 1e-6),
    scale: inhale ? SMALL + (1 - SMALL) * ease(f) : 1 - (1 - SMALL) * ease(f),
    breaths: Math.floor(elapsed / cycle),
  };
};

// "6" for 4 / 6, "5.5" for 4 / 7.
export const perMinute = (p: Pattern) => {
  const n = 60 / (p.in + p.out);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

// 300 -> "5:00"
export const clock = (s: number) => {
  const x = Math.max(0, Math.ceil(s));
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
};

// "Breathing exercise" (Ed, 2026-10-27): ask first, "Do you want to do that now?"
// Yes brings up the timer; no, "Okay, we can do it later." Not for trouble breathing,
// which is a medical worry, not an ask for the exercise.
const NOT_ASK = /\b(cant|can ?not|couldnt|trouble|hard to|hurts? to|struggling to|short of|out of|stopped|not|isnt|wont|no) (breath|breathe|breathing)\b|\bbreathing (problem|problems|issue|issues|hard|fast|weird)\b/;
const ASK = /^(?:(?:can|could) (?:we|you|i) (?:do|try|start) (?:a |some |the )?|(?:i want|i wanna|i need|id like|let'?s|lets|i would like) (?:to )?(?:do |try |start )?(?:a |some |the )?|(?:do |try |start |show me )(?:a |some |the )?)?(?:paced )?(?:breathing|breath|breathe)(?: exercises?| timer| thing| with me| together| now| please)*$/;
export function findBreathAsk(text: string): boolean {
  const t = text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || NOT_ASK.test(t)) return false;
  return ASK.test(t) || /\bbreathing (exercise|exercises|timer)\b/.test(t);
}
export const BREATH_ASK = 'Do you want to do that now?';
export const BREATH_LATER = ['Okay, we can do it later.', 'No problem, we can do it later.', 'That’s okay. We can do it later, whenever you’re ready.'];
export const BREATH_GO = ['Okay, let’s breathe together. Follow the circle.', 'Great. Follow the circle, and breathe along with it.'];
