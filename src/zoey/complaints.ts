// "You didn't answer my question", "that's not what I asked", "you're not
// listening" (Ed, 2026-10-25). Zoey owns the miss, says what she heard, and
// offers a person, instead of treating it as something they shared.
import { AnswerAction, AnswerContext } from './answers';

export { findComplaint } from './feelings';

const OWN = [
  'You’re right, I missed that. Sorry about that.',
  'My mistake, I didn’t answer that well.',
  'You’re right, that wasn’t a good answer. Sorry!',
];

// `last`: their last question, if Zoey answered something.
export function complaintReply(
  o: { last: string | null; c: AnswerContext },
  rand: () => number = Math.random,
): { text: string; actions: AnswerAction[] } {
  const own = OWN[Math.floor(rand() * OWN.length) % OWN.length];
  const q = o.last ? o.last.trim().replace(/[.!?\s]+$/, '') : null;
  const text = q
    ? `${own} About “${q}”: I don’t think I know that one well yet. Could you ask it in different words? Or I can send it to ${o.c.coordinatorName}, who can answer it for sure.`
    : `${own} What would you like to know? Ask me again in your own words and I’ll do my best, or I can send your question to ${o.c.coordinatorName}.`;
  const actions: AnswerAction[] = [
    { kind: 'text', label: `Send to ${o.c.coordinatorName}`, who: 'coordinator', ...(q ? { body: q } : {}) },
    { kind: 'call', label: `Call ${o.c.coordinatorName}`, who: 'coordinator' },
  ];
  return { text, actions };
}

// "Huh?", "what?", "what do you mean?" outside one of her questions.
export const CLARIFY_LINES = [
  'Sorry, I wasn’t clear. What would you like to know? You can ask it any way you like.',
  'Oops, let me try again. What can I help you with? Ask me in your own words.',
];
