// What Zoey's name means (Ed, 2026-11-15). The name Zoey comes from the Greek word
// zoe (ζωή, Strong's G2222), which appears about 135 times in the Greek New Testament,
// where it is translated "life". Keep the wording accurate: it is the Greek word "zoe"
// that appears in the New Testament, not the name "Zoey", and it is "about" 135 times.
//
// Two uses:
// 1. Asked: "why are you called Zoey?", "what does your name mean?".
// 2. Rarely, at the end of a hard talk when someone is feeling down, as a note about
//    life (at most once a chat, AskScreen). Never after danger words: the screen skips
//    it then, the same as the affirmations, so it never stands in for the safety flow.
//
// Someone who said religion isn't for them ("I'm not religious", findFaith) gets the
// versions without the New Testament: just the Greek word and what it means.
import { clean } from './feelings';

// Lead-ins that don't change the question ("hey zoey, so why are you called zoey").
const LEAD = '^(?:(?:hey|hi|hello|so|um|ok|okay|zoey|zoe|wait|just wondering|i was wondering|can i ask|quick question|out of curiosity|curious|btw|by the way|and|but|also) )*';
const TAIL = '(?: (?:anyway|anyways|zoey|zoe|lol|haha|though|just wondering|i wonder|by the way|btw|exactly|again|really))*$';
// "zoey" may already be taken out of the message (name.ts strips her name), so it is optional.
const NAME = '(?:zoey|zoe|zoie|zooey|zowey)';
const ASKS = [
  // why are you called zoey / why is your name zoey / why were you named zoey / why zoey
  `why (?:are you (?:called|named)|is your name|were you (?:called|named)|did (?:they|someone|somebody|ed|he|she|the app|your makers|your creators) (?:call|name) you|do they call you|the name|that name|${NAME})(?: ${NAME})?`,
  // what does your name mean / what does zoey mean / what does your name stand for
  `what (?:does|do) (?:your name|your name ${NAME}|the name ${NAME}|${NAME}|that name|the name) (?:mean|stand for)`,
  // whats the meaning of your name / meaning of zoey / meaning behind your name
  `(?:what is |whats |what s )?(?:the )?(?:meaning|origin|story) (?:of|behind) (?:your name|the name ${NAME}|${NAME}|that name|your name ${NAME})`,
  // where does your name come from / where did you get your name
  `where (?:does|did) (?:your name|the name ${NAME}|${NAME}|that name) come from`,
  `where did you get (?:your|that) name`,
  `how did you get (?:your|that) name`,
  // who named you / who picked your name
  `who (?:named you|gave you (?:your|that) name|picked your name|chose your name)`,
  // does your name mean something / does zoey mean anything / is zoey a bible name
  `(?:does|do) (?:your name|${NAME}|the name ${NAME}) (?:mean|stand for) (?:something|anything)`,
  `is (?:your name|${NAME}) (?:a bible name|from the bible|biblical|greek|a greek name)`,
  `(?:tell me )?(?:about )?(?:your name|the name ${NAME})(?: meaning)?`,
];
const ASK_RE = new RegExp(`${LEAD}(?:${ASKS.join('|')})${TAIL}`);

export const findNameMeaning = (text: string) => {
  const t = clean(text);
  // "tell me about your name" alone, not "your name" said in passing.
  if (/^(?:your name|the name)/.test(t) && !/^(?:tell me|about)/.test(t)) return false;
  return ASK_RE.test(t);
};

// Asked. Each says it's the Greek word zoe, "about 135 times", translated "life".
export const NAME_MEANING = [
  'Great question! My name comes from the Greek word zoe, which means life. Zoe shows up about 135 times in the Greek New Testament, and in English it’s translated as “life.” I like to think of it as a reminder that your life matters.',
  'Zoey comes from zoe, the Greek word for life. It appears about 135 times in the Greek New Testament, where it’s translated “life.” That’s what I’m here for: helping you build a life you love, one day at a time.',
  'I’m glad you asked! The name Zoey grows out of the Greek word zoe. In the Greek New Testament, zoe is used about 135 times, and in English it reads “life.” Recovery is all about getting your life back, so it fits.',
  'My name has a story! Zoey comes from zoe, an old Greek word that means life. It’s in the Greek New Testament about 135 times, translated as “life.” Every time you say my name, you’re saying something about life.',
  'Zoey comes from the Greek word zoe. It means life, and it’s written about 135 times in the Greek New Testament, where English Bibles say “life.” I hope I can be a little reminder of how much your life is worth.',
];
// The same answer without the New Testament, for someone who said religion isn't for them.
export const NAME_MEANING_PLAIN = [
  'Great question! My name comes from the Greek word zoe, which means life. I like to think of it as a reminder that your life matters.',
  'Zoey comes from zoe, the Greek word for life. That’s what I’m here for: helping you build a life you love, one day at a time.',
  'I’m glad you asked! Zoey comes from zoe, an old Greek word that means life. Recovery is all about getting your life back, so it fits.',
];

// When they're feeling down: a note about life, ending on them, not a question.
export const LIFE_NOTES = [
  'Here’s something about my name: Zoey comes from the Greek word zoe, which means life. Zoe appears about 135 times in the Greek New Testament, translated “life.” That’s a lot of reminders that life is worth holding onto, and so is yours.',
  'Here’s a little something to hold onto. My name comes from zoe, the Greek word for life, and it shows up about 135 times in the Greek New Testament. Even on a hard day like today, your life is still being written.',
  'Fun fact: my name means life. It comes from the Greek word zoe, which is in the Greek New Testament about 135 times, translated “life.” Your life matters, today included.',
  'When things feel heavy, I think about where my name comes from. The Greek word zoe means life, and the Greek New Testament uses it about 135 times. You’re still here, and your life still counts. That’s worth something.',
  'Something about my name: Zoey comes from zoe, Greek for life. In the Greek New Testament it appears about 135 times, translated “life.” Hard days are part of it, but they aren’t the whole story of your life.',
];
export const LIFE_NOTES_PLAIN = [
  'Here’s something about my name: Zoey comes from the Greek word zoe, which means life. On a hard day, I hope it reminds you that your life is worth holding onto.',
  'Here’s a little something: my name comes from zoe, the Greek word for life. Even on a hard day like today, your life is still being written.',
  'Fun fact: my name means life. It comes from zoe, the Greek word for life. Hard days are part of it, but they aren’t the whole story of your life.',
];

// Not the same line twice in a row.
const last = new Map<string, string>();
const fresh = (key: string, xs: string[], rand: () => number) => {
  const pool = xs.length > 1 ? xs.filter((x) => x !== last.get(key)) : xs;
  const x = pool[Math.floor(rand() * pool.length) % pool.length];
  last.set(key, x);
  return x;
};

export const nameMeaning = (opts: { noFaith?: boolean } = {}, rand: () => number = Math.random) =>
  opts.noFaith ? fresh('plain', NAME_MEANING_PLAIN, rand) : fresh('meaning', NAME_MEANING, rand);

export const lifeNote = (opts: { noFaith?: boolean } = {}, rand: () => number = Math.random) =>
  opts.noFaith ? fresh('notePlain', LIFE_NOTES_PLAIN, rand) : fresh('note', LIFE_NOTES, rand);

// How often the note replaces an affirmation at the end of a hard talk (once a chat at most).
export const LIFE_NOTE_CHANCE = 1 / 3;
