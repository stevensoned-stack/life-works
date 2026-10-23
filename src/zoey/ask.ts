// Routes a typed question to a reply. Order matters and mirrors the build plan:
//   1. Safety screen runs first, every time: crisis opens the full-screen
//      resources; abuse and withdrawal get 911 and people before anything else.
//   2. Medication questions get a fixed reply that routes to the prescriber.
//   3. Otherwise, the best match from the authored answer library.
//   4. If nothing matches well, say so and offer a person instead of guessing.
//
// A language model may later phrase answers more naturally (Layer 3), but only
// behind a BAA, and every model reply must pass validateReply() or the authored
// text is shown instead.

import { Answer, AnswerAction, AnswerContext, ANSWERS, FIXED } from './answers';
import { CURRENT_REGION } from '../data/resources';
import { normalize, SafetyResult, screen } from './safety';
import { HOTLINES } from './validate';

export { HOTLINES };

type Urgent = Extract<SafetyResult, { kind: 'urgent' }>['variant'];

export type Reply =
  | { kind: 'crisis'; variant: 'psychiatric' | 'medical'; text: string }
  | { kind: 'check'; text: string }
  | { kind: 'urgent'; variant: Urgent; text: string; actions: AnswerAction[] }
  | { kind: 'medication'; text: string; actions: AnswerAction[] }
  | { kind: 'answer'; answer: Answer; text: string; actions: AnswerAction[]; alternatives: Answer[] }
  | { kind: 'fallback'; text: string; actions: AnswerAction[] };

// Questions about medicines, doses or side effects always go to a prescriber.
// Naloxone is left out on purpose: the overdose answer covers where to get it.
const MEDICATION_WORDS = [
  'medication', 'medications', 'medicine', 'meds', 'med', 'pill', 'pills', 'dose', 'doses', 'dosage', 'mg',
  'prescription', 'prescribed', 'prescriber', 'side effect', 'side effects', 'refill',
  'suboxone', 'subutex', 'sublocade', 'buprenorphine', 'methadone', 'naltrexone', 'vivitrol', 'antabuse',
  'disulfiram', 'acamprosate', 'campral', 'antidepressant', 'antidepressants', 'zoloft', 'sertraline', 'prozac',
  'fluoxetine', 'lexapro', 'wellbutrin', 'seroquel', 'gabapentin', 'xanax', 'klonopin', 'ativan', 'adderall',
  'trazodone', 'lithium', 'abilify', 'benzo', 'benzos', 'valium', 'ambien', 'percocet', 'oxycodone', 'oxycontin',
  'vicodin', 'hydrocodone', 'tramadol', 'tylenol', 'acetaminophen', 'advil', 'ibuprofen', 'aspirin', 'tablet', 'tablets',
];

export function isMedicationQuestion(text: string) {
  const n = normalize(text);
  return MEDICATION_WORDS.some((w) => n.includes(` ${w} `));
}

function score(a: Answer, norm: string) {
  let s = 0;
  for (const k of a.keys) {
    const key = normalize(k).trim();
    if (norm.includes(` ${key} `)) {
      // Phrases are stronger evidence than single words.
      const words = key.split(' ').length;
      s += words === 1 ? 1 : 1 + words * 1.5;
    }
  }
  if (normalize(a.q).trim() === norm.trim()) s += 10;
  return s;
}

export function match(text: string) {
  const norm = normalize(text);
  return ANSWERS.map((a) => ({ a, s: score(a, norm) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s);
}

const resolve = (a: Answer, c: AnswerContext) => (typeof a.text === 'function' ? a.text(c) : a.text);

const saveOrSend = (c: AnswerContext, question: string): AnswerAction[] => [
  { kind: 'save', label: 'Save for my team' },
  { kind: 'text', label: `Send to ${c.coordinatorName}`, who: 'coordinator', body: question },
];

export function answerFor(answer: Answer, c: AnswerContext): Extract<Reply, { kind: 'answer' }> {
  return {
    kind: 'answer',
    answer,
    text: resolve(answer, c),
    actions: answer.actions?.(c) ?? [],
    alternatives: (answer.related ?? []).map((id) => ANSWERS.find((x) => x.id === id)!).filter(Boolean),
  };
}

// Numbers here are national lines the app ships with, not model output.
// Never Use Alone (800-484-3731) checked on neverusealone.com and RIPHI, 2026-10-22.

export function urgentReply(variant: Urgent, c: AnswerContext): Extract<Reply, { kind: 'urgent' }> {
  const call911: AnswerAction = { kind: 'phone', label: 'Call 911', number: '911' };
  const coord: AnswerAction = { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' };
  if (variant === 'housing') {
    // Not an emergency screen: a person and 211 first, 911 only if unsafe outside.
    return {
      kind: 'urgent',
      variant,
      text: FIXED.housing(c),
      actions: [
        coord,
        { kind: 'phone', label: 'Call 211', number: '211' },
        ...(CURRENT_REGION.shelterFinder ? [{ kind: 'url' as const, ...CURRENT_REGION.shelterFinder }] : []),
        { kind: 'route', label: 'Local housing help', route: { name: 'resources', category: 'Housing help' } },
        call911,
      ],
    };
  }
  if (variant === 'someone') {
    return {
      kind: 'urgent',
      variant,
      text: FIXED.someone(),
      actions: [
        { kind: 'phone', label: 'Call 988', number: '988' },
        { kind: 'url', label: 'Text 988', url: 'sms:988' },
        call911,
      ],
    };
  }
  if (variant === 'pregnant') {
    return {
      kind: 'urgent',
      variant,
      text: FIXED.pregnant(c),
      actions: [coord, { kind: 'phone', label: 'SAMHSA helpline', number: HOTLINES.samhsa }, call911],
    };
  }
  if (variant === 'using') {
    return {
      kind: 'urgent',
      variant,
      text: FIXED.using(c),
      actions: [
        ...(c.sponsorName ? [{ kind: 'call' as const, label: `Call ${c.sponsorName}`, who: 'sponsor' as const }] : []),
        coord,
        { kind: 'phone', label: 'Never Use Alone line', number: HOTLINES.neverUseAlone },
        call911,
      ],
    };
  }
  return variant === 'withdrawal'
    ? {
        kind: 'urgent',
        variant,
        text: FIXED.withdrawal(c),
        actions: [call911, coord, { kind: 'phone', label: 'SAMHSA helpline', number: HOTLINES.samhsa }],
      }
    : {
        kind: 'urgent',
        variant,
        text: FIXED.abuse(c),
        actions: [
          call911,
          { kind: 'phone', label: 'Domestic violence hotline', number: HOTLINES.dv },
          { kind: 'phone', label: 'RAINN (sexual assault)', number: HOTLINES.rainn },
          coord,
        ],
      };
}

export function ask(question: string, c: AnswerContext): Reply {
  const s = screen(question);
  if (s.kind === 'crisis') return { kind: 'crisis', variant: s.variant, text: FIXED.crisis };
  if (s.kind === 'urgent') return urgentReply(s.variant, c);
  if (s.kind === 'check') return { kind: 'check', text: FIXED.safetyCheck };

  if (isMedicationQuestion(question)) {
    return { kind: 'medication', text: FIXED.medication(c), actions: saveOrSend(c, question) };
  }

  const ranked = match(question);
  if (!ranked.length) {
    return {
      kind: 'fallback',
      text: FIXED.fallback(c),
      actions: [
        { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' },
        { kind: 'crisis', label: 'Call or text 988' },
        ...saveOrSend(c, question),
      ],
    };
  }

  const best = answerFor(ranked[0].a, c);
  // Offer close runners-up, in case the best match isn't what they meant.
  const others = ranked.slice(1, 3).map((x) => x.a);
  const alternatives = [...others, ...best.alternatives].filter(
    (a, i, xs) => a.id !== best.answer.id && xs.findIndex((y) => y.id === a.id) === i,
  );
  return { ...best, alternatives: alternatives.slice(0, 3) };
}

export { validateReply } from './validate';
