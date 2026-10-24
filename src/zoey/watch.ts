// Danger words stay on for the rest of the chat (Ed, 2026-10-24): once
// something risky comes up, Zoey keeps saying she's worried, asks how they
// are, and keeps offering help instead of moving on as if nothing happened.
// Needs clinician review: wording, and how often she brings it back up.
import { AnswerAction, AnswerContext } from './answers';
import { urgentReply } from './ask';
import { SafetyResult } from './safety';

export type RiskTopic = 'self' | 'medical' | 'using' | 'withdrawal' | 'abuse' | 'someone' | 'pregnant' | 'housing';

export type Risk = {
  // 3 crisis, 2 urgent or "are you safe?", 1 housing.
  level: 1 | 2 | 3;
  topic: RiskTopic;
  // Messages since the danger words, and whether they said they're safe.
  turns: number;
  safe: boolean;
};

const levelOf = (s: Exclude<SafetyResult, { kind: 'none' }>): Risk['level'] =>
  s.kind === 'crisis' ? 3 : s.kind === 'urgent' && s.variant === 'housing' ? 1 : 2;

const topicOf = (s: Exclude<SafetyResult, { kind: 'none' }>): RiskTopic =>
  s.kind === 'crisis' ? (s.variant === 'medical' ? 'medical' : 'self') : s.kind === 'check' ? 'self' : s.variant;

// New danger words: the most serious topic so far wins, and the count starts over.
export function raise(prev: Risk | null, s: SafetyResult): Risk | null {
  if (s.kind === 'none') return prev;
  const level = levelOf(s);
  if (prev && prev.level > level) return { ...prev, turns: 0, safe: false };
  return { level, topic: topicOf(s), turns: 0, safe: false };
}

export const markSafe = <R extends Risk | null>(r: R): R => (r ? { ...r, safe: true } : r) as R;

// Not yet safe: every message. Said they're safe, or housing only: every third.
export const shouldWorry = (r: Risk) => (!r.safe && r.level > 1) || r.turns % 3 === 0;

const OPENERS = [
  "I'm still thinking about what you told me earlier, and I'm worried about you.",
  "I haven't forgotten what you said before. I care about you, and I'm worried.",
  "Before we go on, I want you to know I'm still worried about you.",
  "I keep coming back to what you said earlier. I care about you, and I want to make sure you're okay.",
];

const ASKS: Record<RiskTopic, ((c: AnswerContext) => string)[]> = {
  self: [
    () => 'How are you feeling about that right now?',
    () => 'Are those thoughts still with you right now?',
    () => "Can you tell me more about what's been going on?",
    () => 'Is anyone with you right now?',
  ],
  medical: [() => 'How is your body feeling right now? Is someone with you?', () => 'Are you feeling any better? Did you get help?'],
  using: [() => 'How are you doing right now? Is anyone with you?', () => 'Can you tell me more about how today has been?'],
  withdrawal: [() => 'How is your body feeling right now?', (c) => `Have you been able to talk to ${c.coordinatorName} or a doctor yet?`],
  abuse: [() => 'Are you somewhere safe from that person right now?', () => 'Has anything else happened since you told me?'],
  someone: [() => 'How is the person you were worried about? Did they get help?', () => 'Is someone with them right now?'],
  pregnant: [() => 'How are you feeling right now?', () => 'Have you been able to talk to a doctor yet?'],
  housing: [() => 'Do you know where you can stay tonight?', (c) => `Did you get a chance to call 211 or ${c.coordinatorName}?`],
};

const help = (t: RiskTopic, c: AnswerContext) =>
  t === 'self' || t === 'medical'
    ? 'You can call or text 988 any time, and call 911 in an emergency.'
    : t === 'housing'
      ? `${c.coordinatorName} and 211 can help you find a place.`
      : `${c.coordinatorName} wants to help, and 911 is there in an emergency.`;

export function worryActions(t: RiskTopic, c: AnswerContext): AnswerAction[] {
  const coord: AnswerAction = { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' };
  const sponsor: AnswerAction[] = c.sponsorName ? [{ kind: 'call', label: `Call ${c.sponsorName}`, who: 'sponsor' }] : [];
  if (t === 'self') return [{ kind: 'crisis', label: 'Call or text 988' }, coord, ...sponsor];
  if (t === 'medical') return [{ kind: 'phone', label: 'Call 911', number: '911' }, coord];
  return urgentReply(t, c).actions;
}

export const worryLine = (t: RiskTopic, c: AnswerContext, rand: () => number = Math.random) => {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  return `${pick(OPENERS)} ${pick(ASKS[t])(c)} ${help(t, c)}`;
};

// Call once for each later message without new danger words.
export function worry(r: Risk, c: AnswerContext, rand: () => number = Math.random) {
  const risk = { ...r, turns: r.turns + 1 };
  const reply = shouldWorry(risk) ? { text: worryLine(r.topic, c, rand), actions: worryActions(r.topic, c) } : null;
  return { risk, reply };
}

export const ALL_WORRY_LINES = (c: AnswerContext) =>
  (Object.keys(ASKS) as RiskTopic[]).flatMap((t) => OPENERS.flatMap((o) => ASKS[t].map((a) => `${o} ${a(c)} ${help(t, c)}`)));

// "I'm okay now": she checks in less often, but still doesn't forget.
export const saysSafe = (t: string) =>
  /\b(i'?m|i am|im|i feel) (safe|ok|okay|fine|alright|all right|better)\b/i.test(t) && !/\bnot\b/i.test(t);
