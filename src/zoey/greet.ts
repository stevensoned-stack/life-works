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

export const GLAD_OPEN = ['I’m really glad to hear that!', 'Love hearing that.', 'That’s great!'];
export const GLAD = [
  'I’m really glad to hear that! What’s on your mind today?',
  'Love hearing that. Is there anything I can help you with today?',
  'That’s great. What would you like to talk about?',
  'Good! I’m here if you want to talk or ask me anything.',
];

// --- Opening AskZoey (Ed, 2026-10-24) ---------------------------------------
// Every time: good morning / afternoon / evening by name, their clean day, then
// "how are you?". "Wow, it's day 78 of being clean!"

const GOOD_PART: Record<PartOfDay, string> = { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' };
const WOW = ['Wow, it’s day {n} of being clean!', 'Wow, day {n} of being clean!', 'Look at you, it’s day {n} of being clean!'];
const PRAISE = [
  'That’s awesome!',
  'Congratulations!',
  'Great job!',
  'You’re doing so great!',
  'That must feel so good!',
  'I’m proud of you!',
];
// Day 0: a fresh start or a restart. Never a number, never a word about the past.
const DAY_ONE = [
  'Today is day one, and that takes courage.',
  'Today is day one. Every journey starts right here, and I’m with you.',
  'It’s day one, and showing up today is a big deal.',
];

export function cleanLine(days: number, rand: () => number = Math.random) {
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
  if (days < 1) return pick(DAY_ONE);
  return `${pick(WOW).replace('{n}', String(days))} ${pick(PRAISE)}`;
}

export function openingLine(o: { now: Date; name: string; cleanDays: number | null }, rand: () => number = Math.random) {
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
  const part = partOfDay(o.now);
  return [`${GOOD_PART[part]}, ${o.name}!`, o.cleanDays == null ? '' : cleanLine(o.cleanDays, rand), pick(HOW_ARE_YOU[part])]
    .filter(Boolean)
    .join(' ');
}

// --- "That's stupid" and "shut up" -----------------------------------------

const DISMISS = /^(?:(?:well|ok|okay|um|zoey|honestly|man|bro|dude|lol) )*(?:that|this|thats|this is|that is|its|it is|you are|youre|ur|you|this app is|that question is|that answer is)(?: (?:so|really|pretty|kinda|kind of|just|totally|super))* (?:stupid|dumb|lame|useless|pointless|silly|ridiculous|a stupid question|a dumb question|garbage|trash)(?: (?:zoey|lol|tho|though))?$/;
export const findDismiss = (text: string) => DISMISS.test(clean(text));

export const WHY_THINK = [
  'Hmm, why do you think that?',
  'Fair enough. What makes you say that?',
  'Okay, I’m listening. What about it isn’t working for you?',
  'I really want to know. Why do you think that?',
  'That’s okay to say. What’s making you feel that way?',
];
export const AFTER_WHY = [
  'That makes sense. Is there a better way I can help you right now?',
  'Okay, I get it. What would actually be helpful for you today?',
  'Thanks for being straight with me. What would help more?',
  'Got it. I’d rather be useful than annoying. What do you need?',
];

const SHUT = /^(?:(?:oh|just|zoey|omg|ugh|god|please|pls) )*(?:shut up|shutup|stfu|shut it|be quiet|zip it|hush)(?: (?:zoey|already|please|pls|lol))*$/;
export const findShutUp = (text: string) => SHUT.test(clean(text));

// Light and human, then the door stays open.
export const HEEEY = [
  'Heeey, that hurts my feelings! 😄 Just kidding, I can take it. I’m right here if you want to talk.',
  'Heeey! Ouch, my feelings! 😄 Okay, I’ll be quiet for a bit. I’m here whenever you need me.',
  'Heeey, rude! 😄 That’s okay, I still like you. Rough day?',
  'Heeey, I’m sensitive, you know! 😄 Want to tell me what’s going on?',
];
// When danger words came up earlier: no jokes.
export const QUIET_CARE =
  'Okay, I’ll give you some space. I still care about you, and your LifeCircle and 988, the free Suicide and Crisis Lifeline, are there any time you need them.';
