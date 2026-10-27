// Recovery affirmations Ed chose (2026-10-27), from positivity.org's mental health
// recovery affirmations (https://positivity.org/affirmations/mental-health-recovery-affirmations).
// Zoey offers them in their own first-person words, matched to the moment: strength
// after cravings, emotional healing after hard feelings, hope after a bad day or a
// setback, self-worth after "I'm weak" or "I'm a failure". Never in place of the
// safety script: the screens skip them after danger words.
import { clean } from './feelings';
import { isHardFeeling, FeelingKey } from './trees';

export type AffirmGroup = 'strength' | 'healing' | 'hope' | 'worth';

export const AFFIRMATIONS: Record<AffirmGroup, string[]> = {
  strength: [
    'I am stronger than my cravings.',
    'I rise stronger after every challenge.',
    'I can overcome difficult moments.',
    'I am capable of healing, even on days when progress feels invisible.',
    'My urges are temporary; my commitment is permanent.',
  ],
  healing: [
    'I allow myself to heal at my own pace.',
    'My heart is healing every day.',
    'I can sit with difficult emotions without being overwhelmed.',
    'I release pain and welcome peace.',
    'I deserve emotional peace and balance.',
  ],
  hope: [
    'Recovery is not linear, and I trust my journey.',
    'Healing is happening even when I cannot see it.',
    'Each day I choose recovery, I become stronger.',
    'Better days are coming.',
    'Small steps forward are still forward movement.',
  ],
  worth: [
    'My mental health struggles do not define my worth or potential.',
    'I am more than my past choices.',
    'I am worthy of a life beyond addiction.',
    'I am becoming more comfortable with who I truly am.',
    'I am a Recovery Warrior.',
  ],
};
export const ALL_AFFIRMATIONS = Object.values(AFFIRMATIONS).flat();

// Ways to hand one over. Each ends on the affirmation itself, not a question.
const FRAMES = ['Here’s something to hold onto: “{a}”', 'Try saying this to yourself: “{a}”', 'Something to remember today: “{a}”', 'Say this with me: “{a}”'];

// Not the same affirmation or frame twice in a row.
const last = new Map<string, string>();
const pickFresh = (key: string, xs: string[], rand: () => number) => {
  const fresh = xs.length > 1 ? xs.filter((x) => x !== last.get(key)) : xs;
  const x = fresh[Math.floor(rand() * fresh.length) % fresh.length];
  last.set(key, x);
  return x;
};
export const affirmation = (group: AffirmGroup | 'any', rand: () => number = Math.random) =>
  pickFresh(`a:${group}`, group === 'any' ? ALL_AFFIRMATIONS : AFFIRMATIONS[group], rand);
export const affirmLine = (group: AffirmGroup | 'any', rand: () => number = Math.random) =>
  pickFresh('frame', FRAMES, rand).replace('{a}', affirmation(group, rand));

// Morning anchor (Ed's how-to: "choose one affirmation and say it aloud to set your tone").
export const morningAffirm = (rand: () => number = Math.random) => `Today’s affirmation: “${affirmation('any', rand)}”`;

// The group that fits the end of a talk, or null where none should follow.
export function groupForTree(id: string): AffirmGroup | null {
  if (id === 'urge' || id === 'Cravings') return 'strength';
  if (id === 'program' || id === 'meetings') return 'hope';
  if (id === 'feeling-bad' || id === 'big' || id === 'noTalk' || id === 'Feeling alone') return 'healing';
  if (id.startsWith('feeling:')) return isHardFeeling(id.slice(8) as FeelingKey) ? 'healing' : null;
  return null;
}

// "Give me an affirmation", "say something positive".
const ASK = /^(?:(?:hey|hi|zoey|so|um|ok|okay|can you|could you|will you|would you|please|pls) )*(?:(?:give|tell|send|share|say) (?:me )?(?:an?|another|one more|some|my|todays|a daily|a positive)? ?(?:positive )?(?:affirmation|affirmations|positive thought|positive quote|words of encouragement|something positive|something encouraging)|(?:i )?(?:need|want|could use) (?:an?|some|another)? ?(?:positive )?(?:affirmation|affirmations|encouragement|words of encouragement|something positive)|(?:positive |daily |todays |another |one more )?affirmations?|encourage me|another one)(?: (?:please|pls|zoey|today|for today|for me))*$/;
export const findAffirmAsk = (text: string, afterAffirm = false) => {
  const t = clean(text);
  return t === 'another one' ? afterAffirm : ASK.test(t);
};
export const AFFIRM_TIP = [
  'Saying it out loud a few times can help it sink in.',
  'Try repeating it whenever you need a moment of grounding today.',
  'You could also write it a few times in LifeEvent and think about what it means for you.',
];
