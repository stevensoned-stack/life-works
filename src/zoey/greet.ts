// "Hello": Zoey says hello back by time of day and asks how they're doing (Ed, 2026-10-24).
import { clean } from './feelings';

export type PartOfDay = 'morning' | 'afternoon' | 'evening';

// Before 12 PM morning, 12 to 5 PM afternoon, from 5 PM evening.
export const partOfDay = (d: Date): PartOfDay => (d.getHours() < 12 ? 'morning' : d.getHours() < 17 ? 'afternoon' : 'evening');

const HELLO = '(?:hi|hello|hey|hiya|heya|howdy|yo|sup|whats up|good (?:morning|afternoon|evening|day)|morning|evening|afternoon)';
const TO = '(?: there| zoey| friend| girl| again)*';
const HOW = '(?:how are you(?: doing| today)?|how are you doing today|hows it going|how is it going|hows your day|whats up|how have you been)';
const GREETING = new RegExp(`^(?:(?:${HELLO})${TO}(?: (?:${HOW}))?|${HOW}(?: zoey)?)$`);
const ASKED = new RegExp(`(?:^| )${HOW}(?: zoey)?$`);

// Only a greeting on its own: "hi, I'm sad" goes to the feelings flow instead.
export function findGreeting(text: string): { asked: boolean } | null {
  const t = clean(text);
  if (!GREETING.test(t)) return null;
  return { asked: ASKED.test(t) || t === 'whats up' || t === 'sup' };
}

const HELLOS: Record<PartOfDay, string[]> = {
  morning: ['Good morning, {name}!', 'Morning, {name}!', 'Good morning! It’s good to see you, {name}.'],
  afternoon: ['Good afternoon, {name}!', 'Hi {name}, good afternoon!', 'Good afternoon! It’s good to hear from you, {name}.'],
  evening: ['Good evening, {name}!', 'Hi {name}, good evening!', 'Good evening! I’m glad you stopped by, {name}.'],
};
const ME_TOO = ['I’m doing well, thanks for asking.', 'I’m good, thank you for asking!', 'Doing well, and better now that you’re here.'];
const HOW_ARE_YOU: Record<PartOfDay, string[]> = {
  morning: ['How are you this morning?', 'How’s your morning going so far?', 'How are you feeling this morning?'],
  afternoon: ['How are you this afternoon?', 'How’s your afternoon going?', 'How’s your day been so far?'],
  evening: ['How are you this evening?', 'How was your day?', 'How are you feeling tonight?'],
};

export function greetLine(o: { now: Date; name: string; asked: boolean; weather?: string | null }, rand: () => number = Math.random) {
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
  const part = partOfDay(o.now);
  return [pick(HELLOS[part]).replace('{name}', o.name), o.asked ? pick(ME_TOO) : '', o.weather ?? '', pick(HOW_ARE_YOU[part])]
    .filter(Boolean)
    .join(' ');
}

// Their answer to "how are you?" when it isn't a feeling the trees already know.
const GOOD = /^(?:(?:im|i am|i feel|feeling|doing|pretty|really|very|so|actually|yeah|yes|all|) ?)*(?:good|great|fine|ok|okay|alright|all right|well|not bad|cant complain|wonderful|fantastic|awesome|excellent|blessed)\b/;
const BAD = /^(?:(?:im|i am|i feel|feeling|doing|honestly|pretty|really|very|so|kind of|kinda|) ?)*(?:not (?:good|great|well|ok|okay|so good|too good)|bad|rough|terrible|awful|horrible|meh|could be better|been better|so so|not the best|crappy|crap|shitty|struggling|hard day|rough day|bad day)\b/;

export function howAnswer(text: string): 'good' | 'bad' | null {
  const t = clean(text);
  if (BAD.test(t)) return 'bad';
  if (GOOD.test(t)) return 'good';
  return null;
}

export const GLAD = [
  'I’m really glad to hear that! What’s on your mind today?',
  'Love hearing that. Is there anything I can help you with today?',
  'That’s great. What would you like to talk about?',
  'Good! I’m here if you want to talk or ask me anything.',
];
