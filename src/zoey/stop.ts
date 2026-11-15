// "Stop" (Ed, 2026-11-14: "if they say stop, ask what should I stop, should I stop
// talking, can I ask what's going on? You don't sound good. Build other responses").
//
// A bare "stop" can mean a few things, so she reads what was happening:
//   breathing  the breathing timer is running: it stops, and she asks how they feel.
//   voice      she is reading out loud: she goes silent first, then the check-in.
//   ask        anything else: the caring check-in with "Stop talking" / "Tell Zoey".
// "Stop talking", "be quiet please": she goes quiet ("I'll be here when you need me").
// "Leave me alone", "go away": space, with care. "Stop asking me questions": no more questions.
// "Shut up" keeps Ed's own joke reply (greet.ts), unless danger words came up.
// Danger words never get here: the safety screen reads every message first, so
// "stop, I want to die" opens the crisis help. "I want it all to stop" and "make it
// stop" are danger phrases there too (safety.ts CHECK).

import { clean } from './feelings';

export type StopKind = 'stop' | 'talking' | 'space' | 'questions';

const LEAD = '(?:(?:just|please|pls|plz|ok|okay|zoey|zoe|omg|ugh|oh|god|man|dude|bro|no|nope|hey|can you|could you|will you|would you|can u|would u) )*';
const TAIL = '(?: (?:please|pls|plz|zoey|zoe|now|already|right now|ok|okay|for now|for a while|for a bit|a minute|a sec|lol|man|dude|bro|thanks|thank you|seriously|for real))*';
// One letter off or stretched ("stopp", "stp", "sotp", "stahp").
const STOP = '(?:stop|stp|sotp|stpo|stoop|stahp|stawp|stopit)';
const RES: [StopKind, RegExp][] = [
  ['talking', new RegExp(`^${LEAD}(?:${STOP} (?:talking|speaking|reading|reading out loud|reading to me|talking out loud|talking to me|texting me|messaging me|with the voice|the voice)|be quiet|quiet|hush|quiet down|go quiet|stop with the talking|i dont want to talk to you(?: right now)?|dont talk to me|no more talking|give it a rest)${TAIL}$`)],
  ['space', new RegExp(`^${LEAD}(?:leave me alone|leave me be|go away|get away|back off|give me space|give me some space|i need space|i need some space|let me be|i want to be alone)${TAIL}$`)],
  ['questions', new RegExp(`^${LEAD}(?:${STOP} (?:asking(?: me)?(?: so many| all these| these| any more)? questions|asking me stuff|asking me things|asking|with the questions|questioning me|interrogating me|bugging me|bothering me|nagging me|pestering me)|no more questions|enough questions|too many questions|quit asking(?: me)?(?: questions)?)${TAIL}$`)],
  ['stop', new RegExp(`^${LEAD}(?:${STOP}|${STOP} it|${STOP} that|${STOP} this|stop stop|stop stop stop|thats enough|enough already|quit it|cut it out|knock it off|no stop)${TAIL}$`)],
];

// "Enough" and "quit" alone can answer a question ("Did you sleep enough?"), so they
// only mean stop when none of her questions is waiting.
const SOFT = new RegExp(`^${LEAD}(?:enough|quit)${TAIL}$`);

export function findStop(text: string, open = false): StopKind | null {
  // "Stop?" back at her is a question, not an ask: let the usual answers have it.
  if (/\?\s*$/.test(text)) return null;
  // "stoppppp", "stooop", "quiiiet": squash stretched letters.
  const t = clean(text).replace(/([a-z])\1{2,}/g, '$1$1').replace(/\bstoo+p\b/g, 'stop').replace(/\bstopp+\b/g, 'stop');
  for (const [kind, re] of RES) if (re.test(t)) return kind;
  return !open && SOFT.test(t) ? 'stop' : null;
}

// The caring check-in. ASK[0] is Ed's own words, with the question last so it is the
// question her buttons and "nothing" (nothing.ts) answer.
export const ASK = [
  'What should I stop? Should I stop talking? You don’t sound good. Can I ask what’s going on?',
  'Okay. What would you like me to stop? Should I stop talking? You don’t sound like yourself. Is something going on?',
  'Stop? I can do that. Do you want me to stop talking? Something sounds off. Can I ask what’s happening?',
  'I hear you. What should I stop? I can go quiet, but you don’t sound good. Do you want to tell me what’s going on?',
  'Sure. Should I stop talking for a bit? I’m a little worried, you don’t sound okay. Can I ask what’s going on?',
  'Okay, okay. What do you want me to stop? I want to help, and you don’t sound good. What’s going on?',
  'Stop what, friend? Should I stop talking? I can tell something might be up. Can I ask what’s going on?',
];
// She was reading out loud: she stops first.
export const ASK_VOICE = [
  'Okay, I stopped talking out loud. Should I stay quiet? You don’t sound good. Can I ask what’s going on?',
  'Okay, I stopped reading. Do you want me to stay quiet for a while? Something sounds off. Can I ask what’s going on?',
  'Done, no more talking out loud. Should I stop talking for now? You don’t sound good. Do you want to tell me what’s going on?',
];
// "Stop talking" (button or typed): she goes quiet. Index 0 is from the coordinator's ask.
export const QUIET = [
  'Okay, I’ll be here when you need me.',
  'Okay, I’ll be quiet. I’m right here whenever you want to talk.',
  'Got it. I’ll give you some quiet. Come back any time, I’ll be here.',
  'Okay. I’ll stop for now. I’m here when you’re ready.',
  'Sure thing. I’ll be right here if you need me.',
];
// "Leave me alone", "go away".
export const SPACE = [
  'Okay, I’ll give you some space. You don’t sound good, and I care about you. I’ll be right here when you’re ready.',
  'Okay, I’ll back off. I just want you to know I care. Come back any time, even just to say hi.',
  'That’s okay, everyone needs space sometimes. I’ll be here whenever you want to talk.',
  'Okay. I’ll leave you be for now. If things get heavy, your LifeCircle is there for you, and so am I.',
];
// "Stop asking me questions".
export const NO_QUESTIONS = [
  'Okay, no more questions. I’m here if you want to talk.',
  'Fair enough! I’ll stop asking. I’m right here if you want to say anything.',
  'Got it, I’ll ease up on the questions. You can just talk, and I’ll listen.',
  'Okay, sorry about that. No more questions for now. I’m here whenever you want.',
];
// "Tell Zoey": she listens.
export const TELL = [
  'Okay, I’m listening. What’s going on?',
  'Thank you. Take your time. What’s happening?',
  'I’m right here with you. Tell me whatever you want.',
  'I’m glad you want to talk. What’s going on?',
];
// "No" to "Should I stop talking?": she stays and asks gently.
export const KEEP_TALKING = [
  'Okay, I’ll stay. Can I ask what’s going on?',
  'Okay, I’m still here. What’s going on?',
  'Alright, I’m not going anywhere. What’s happening?',
];
// The breathing timer stops. With nothing after it, she asks how they feel.
export const BREATH_STOP = [
  'Okay, we can stop there. Even a few slow breaths help. How are you feeling now?',
  'Sure, let’s stop. That’s okay. How do you feel right now?',
  'Okay, breathing stopped. You can come back to it any time. How are you feeling?',
];
export const BREATH_STOP_NEXT = ['Okay, we can stop there.', 'Sure, let’s stop there. Even a few breaths help.', 'Okay, breathing stopped.'];

// Their answer to her stop check-in. 'quiet': stop talking. 'stay': "no", she stays
// and asks. null: something else (they tell her, or ask, or say "nothing").
export function stopAnswer(text: string): 'quiet' | 'stay' | null {
  const t = clean(text);
  if (/^(?:(?:yes|yeah|yea|yep|ya|yup|sure|please|pls|ok|okay|i guess|just) )*(?:stop talking|be quiet|quiet|stop|shh+|hush|yes|yeah|yea|yep|ya|yup|please|sure|yes please|yeah please|ok|okay|go quiet|for now)(?: (?:please|pls|zoey|for now|thanks|thank you))*$/.test(t)) return 'quiet';
  if (/^(?:(?:no|nah|nope|no no) )*(?:no|nah|nope|dont stop|dont|keep talking|you can stay|stay|its fine|its okay|its ok|never mind|nevermind|nvm|sorry|my bad)(?: (?:its fine|its okay|its ok|sorry|zoey|you can stay|stay))*$/.test(t)) return 'stay';
  return null;
}
