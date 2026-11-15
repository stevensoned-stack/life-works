// "Nothing" (Ed, 2026-11-14: "when the client says nothing after Zoey asks what's going
// on, respond with: Nothing, really? Something must be going on. Do you want to tell me?
// Build more responses ... and anticipate where nothing will come up elsewhere").
//
// What "nothing" means depends on the question she just asked, so the reply is picked
// from her last line:
//   going  "What's going on?", "What happened?", "Why do you feel that way?", "Tell me
//          more": Ed's "Nothing, really? Something must be going on. Do you want to tell
//          me?" with Yes / No. No goes on to the gentle "can I ask why?" flow.
//   hope   "What gives you hope?", "What inspires you?": "nothing" there can mean no hope,
//          so it goes to the safety check, the same as typing "nothing gives me hope".
//   help   "What do you need help with?": no pressure, she's here.
//   else   "Anything else on your mind?": a friendly close.
//   talk   "What would you like to talk about?": we can just hang out.
//   news   "What's new?", "What's up?": quiet days are good, then "how are you?".
//   plans  "What are your plans today?": an open day, maybe a meeting or a walk.
//   well   "What's been going well?": even something small counts.
//   good   "What's got you in a good mood?": no reason needed.
//   helps  "What would help?": it can be hard to see; your LifeCircle can help.
// Not here: "What's your plan?" and "Can I ask why you'd rather not talk about it?"
// already have their own kind answer to "nothing" (trees.ts `none`).
// Danger words never get here: the safety screen reads every message first.

import { clean } from './feelings';

export type NothingWord = 'Nothing' | 'Not much' | 'No reason';

// Their whole message is some way of saying "nothing". Returns the words to say back.
const LEAD = '(?:(?:um|uh|umm|well|honestly|eh|oh|ah|hmm|nah|no|just|zoey|lol|idk|i guess|i mean|really|seriously|i dont know|actually|not really) )*';
const NOTHING = 'nothing|nothin|nuthin|nuthing|nothen|nothng|nothinf|nada|zilch|zip|nm|nmu|nmh|nmjc|not a thing|not anything|nothing much|nothing really|nothing at all|nothing special|nothing new|nothing big|nothing in particular|nothing i guess|its nothing|it s nothing|it was nothing|its really nothing|nothings wrong|nothing s wrong|nothing is wrong|nothings up|nothing s up|nothing happened|nothing really happened|nothings going on|nothing s going on|nothing is going on|nothing going on|theres nothing|there s nothing|there is nothing|theres nothing to tell|nothing to tell|nothing to talk about|nothing to say|i have nothing to say|ive got nothing|i got nothing|got nothing';
const NOT_MUCH = 'not much|not a lot|not too much|nm much|not much really|not much going on|not much happening|not much new';
const NO_REASON = 'no reason|no reason really|no real reason|for no reason|i dont have a reason|theres no reason|there s no reason';
const TAIL = '(?: (?:really|much|at all|zoey|i guess|i think|right now|rn|today|honestly|lol|tbh|haha|for real|either|though|tho|i swear|its fine|im fine|i promise|you|u|just tired))*';
const RE = new RegExp(`^${LEAD}(?:(${NOTHING})|(${NOT_MUCH})|(${NO_REASON}))${TAIL}$`);

export function findNothing(text: string): NothingWord | null {
  // "Nothing?" back at her is a question, not an answer.
  if (/\?\s*$/.test(text)) return null;
  const m = RE.exec(clean(text));
  if (!m) return null;
  return m[1] ? 'Nothing' : m[2] ? 'Not much' : 'No reason';
}

export type NothingAsk = 'going' | 'hope' | 'help' | 'else' | 'talk' | 'news' | 'plans' | 'well' | 'good' | 'helps';

// Her last question, sorted. The order matters: the first match wins.
const KINDS: [NothingAsk | null, RegExp][] = [
  // Her own gentle follow-ups already answer "nothing" kindly.
  [null, /\b(?:not want to talk|rather not talk|holding you back|hard to talk about|whats your plan|what is your plan|plan for what|idea of what you want to do|want to do next|thinking of doing|what day|what city|city and state|favorite|love most about|what is it|what was it|what did (?:they|your doctor|the doctor) (?:say|tell you))\b/],
  ['hope', /\b(?:gives? you hope|inspires? you|keeps you going|lights you up|even tiny|look(?:ing)? forward to)\b/],
  ['else', /\b(?:anything else|what else|something else)\b/],
  ['help', /\b(?:help you with|help with|need help|i help you|can i do for you|what can i do|what do you need|anything you need|something you need)\b/],
  ['talk', /\b(?:like to talk about|want to talk about|wanna talk about|should we talk about)\b/],
  ['plans', /\b(?:your plans|any plans|plans for|what are you doing|what are you up to (?:today|tonight|this)|doing (?:today|tonight|this weekend|later)|got going on (?:today|tonight))\b/],
  ['news', /^(?:(?:so|hey|hi|okay|ok|anyway|and) )?(?:whats new|anything new|whats up|sup|wassup|whats good|what have you been up to|whatve you been up to|what are you up to)(?: (?:with you|lately|today|these days|zoey))?$/],
  ['well', /\b(?:going well|went well|grateful|thankful|made you smile|good thing|best part|proud of)\b/],
  ['good', /\b(?:good mood|helping you feel|got you (?:so )?(?:happy|excited|smiling)|makes? you (?:happy|smile)|so happy)\b/],
  ['helps', /\b(?:would help|might help|could help|can help|would be helpful|helpful for you|help (?:in the long run|over time|things get better)|make it better)\b/],
  ['going', /\b(?:going on|happening|happened|whats wrong|what is wrong|whats up|bothering|weighing|on your mind|whats making|what is making|what makes|what made|made it|got you|why|how come|tell me more|a little more|tell me (?:a bit|a little|why|what)|want to tell me|like to tell me|talk about (?:it|what)|set it off|behind it|what do you mean|what s going|whats got|matter|what is it about)\b/],
];

export function nothingAsk(line: string | null | undefined): NothingAsk | null {
  // A question, or "Please tell me more." (her "OK?" replies end that way).
  const asking = (s: string) => /\?\s*$/.test(s) || /\b(?:tell me more|hear more)[.!]?\s*$/i.test(s);
  if (!line || !asking(line)) return null;
  const last = clean(line.split(/(?<=[.!?])\s+/).filter(asking).pop() ?? '');
  for (const [kind, re] of KINDS) if (re.test(last)) return kind;
  return null;
}

// {E} is their word said back, capitalized ("Nothing", "Not much"); {e} in a sentence.
// GOING[0] is Ed's own wording. Each ends by asking if they want to tell her, so Yes / No fit.
export const GOING = [
  '{E}, really? Something must be going on. Do you want to tell me?',
  '{E}? Hmm, I have a feeling something’s on your mind. Do you want to tell me?',
  'Really, {e}? It sounds like there might be something. Do you want to talk about it?',
  '{E}, huh? Sometimes “{e}” is really something. Do you want to tell me about it?',
  'Are you sure? It’s okay if it’s something small. Do you want to tell me?',
  '{E}? I’m right here, and I’m not going anywhere. Do you want to tell me what’s going on?',
  'Hmm, {e}? It’s okay if it’s hard to put into words. Do you want to tell me?',
  'Really? Something seems to be on your mind. I’m listening. Do you want to tell me?',
];
// After "Yes".
export const GOING_YES = ['Okay, I’m listening. What’s going on?', 'Thank you. Take your time. What’s been happening?', 'I’m right here with you. Tell me whatever you want.'];

export const NOTHING_LINES: Record<Exclude<NothingAsk, 'going' | 'hope'>, string[]> = {
  help: [
    '{E} right now? That’s okay. I’m here whenever you need me.',
    'Okay, nothing for now. If something comes up, just ask. I’m always here.',
    'No problem! You know where to find me if you need anything.',
    'That’s okay. Sometimes it’s nice just to check in. I’m here any time.',
  ],
  else: [
    'Okay! I’m really glad we talked. I’m here any time you need me.',
    'Sounds good. Take care of yourself today, and come back any time.',
    'Alright! I enjoyed talking with you. I’m always here.',
    'Okay. Remember, you’re doing the work, one day at a time. Talk soon!',
  ],
  talk: [
    '{E} in particular? That’s okay. We can just hang out. I’m here if something comes to mind.',
    'That’s fine! We don’t have to talk about anything. I’m here when you want to.',
    'Okay! Sometimes it’s nice just to have company. Let me know if something comes up.',
  ],
  news: [
    '{E}, huh? Quiet days can be good days. How are you feeling today?',
    'A quiet one, huh? Sometimes that’s just what we need. How are you doing?',
    '{E} new? That’s okay. Calm can be a really good thing in recovery. How are you feeling?',
  ],
  plans: [
    'No plans? That can be nice too. Want an idea, like a meeting, a walk, or calling someone in your LifeCircle?',
    'Nothing planned? A free day can be a gift. Maybe a meeting, some fresh air, or a call to someone you trust?',
    'An open day, huh? A little plan can help the day go well. Want to find a meeting or something fun to do?',
  ],
  well: [
    '{E}? Hmm, let’s look a little closer. Even something small counts, like a good cup of coffee or a nice text. Anything come to mind?',
    'Not even a little thing? Getting through the day counts, and so does checking in with me. Is there anything, even tiny?',
    'That’s okay. Some days it’s harder to see. You showed up today, and that’s something. Does anything small come to mind?',
  ],
  good: [
    '{E} in particular? That’s okay, sometimes a good mood just shows up. Enjoy it!',
    'No reason needed! I’m just glad you’re feeling good.',
    'Sometimes good days just happen. I’m happy for you!',
  ],
  helps: [
    '{E} comes to mind? That’s okay, it can be hard to see when you’re in it. Someone in your LifeCircle or your counselor can help you think it through.',
    'That’s alright. It’s not always easy to know what would help. Talking it over with your counselor or your LifeCircle can bring up ideas.',
    'That’s okay. Sometimes nothing feels like it would help, and that feeling can pass. Your LifeCircle and your counselor are there to help you figure it out.',
  ],
};
// Their answer to "Is there anything, even tiny?" after "What's been going well?"
export const WELL_HEARD = ['I love that. Small things add up.', 'That counts! I’m glad you have that.', 'See? There’s something good there. Hold on to it.'];
export const WELL_NONE = ['That’s okay. Some days are like that. I’m still proud of you for showing up.', 'That’s alright. Tomorrow’s a new day, and you’re still here doing the work.'];

// Fill {E} / {e}. "Nothing" said back in a sentence is lowercase: "nothing".
// "No reason" only fits a "why" question; anywhere else it's said back as "nothing".
export function nothingLine(line: string, word: NothingWord, kind: NothingAsk = 'going') {
  if (word === 'No reason' && kind !== 'going') word = 'Nothing';
  return line.replace(/\{E\}/g, word).replace(/\{e\}/g, word.toLowerCase());
}
