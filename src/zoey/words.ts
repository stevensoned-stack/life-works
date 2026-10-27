// Everyday words and short replies (Ed, 2026-10-25: "when they say a word like
// sorry, look it up and come up with a response that meets the definition").
// Zoey has no live AI yet, so each common word gets authored replies that fit
// what it means: "sorry" is an apology, so she reassures; "bye" is leaving, so
// she says goodbye. Any word at all would need the live model, behind a BAA.
import { clean } from './feelings';
import { partOfDay } from './greet';

export type WordKey = 'sorry' | 'thanks' | 'ok' | 'laugh' | 'unsure' | 'whatever' | 'sigh' | 'messedUp' | 'bye' | 'goodnight' | 'love' | 'compliment';

const Z = '(?: (?:zoey|lol|so much|a lot|again|anyway|tho|though))*';
const LEAD = '(?:(?:oh|ok|okay|well|um|ugh|zoey|hey|man|aw|aww|omg) )*';
const whole = (body: string) => new RegExp(`^${LEAD}(?:${body})${Z}$`);

// Most specific first: "ok thanks" is thanks, "ok bye" is bye.
const WORDS: [WordKey, RegExp][] = [
  ['sorry', whole('sorry|im sorry|i am sorry|so sorry|im so sorry|sry|soz|my bad|my fault|oops|whoops|i apologize|apologies|sorry about that|sorry for (?:that|being (?:rude|mean|a jerk)|what i said|saying that|yelling|snapping)|im sorry for (?:that|being (?:rude|mean)|what i said)|sorry i was (?:rude|mean)|i didnt mean (?:it|that)|didnt mean (?:it|that)')],
  ['thanks', whole('thanks|thank you|thx|thnx|ty|tysm|thank u|thanks you|appreciate it|i appreciate (?:it|you|that)|that helps|that helped|that was helpful|thats helpful|thanks for (?:the help|helping|helping me|listening|that|everything)|ok thanks|okay thanks|cool thanks|thanks anyway')],
  ['goodnight', whole('good night|goodnight|night|nite|night night|gn|nighty night|im going to bed|going to bed|im off to bed|off to bed|time for bed|time to sleep|im going to sleep|going to sleep')],
  ['bye', whole('bye|goodbye|bye bye|bye now|see ya|see you|see you later|see ya later|later|laters|ttyl|talk later|talk to you later|talk soon|gotta go|got to go|i have to go|i gotta go|i got to go|gtg|g2g|i need to go|im out|peace|peace out|catch you later|take care')],
  ['love', whole('i love you|love you|ily|love u|i love u|i love you zoey|i like you|i like you zoey')],
  ['compliment', whole('(?:youre|you are|ur|your) (?:the best|awesome|amazing|great|so nice|so sweet|sweet|nice|helpful|so helpful|smart|so smart|cool|funny|so funny|a good friend|the greatest)|good job|nice job|great job|good bot|good girl|you rock|well done|nice one|you get me')],
  ['laugh', whole('(?:lo)+l|lmao+|lmfao+|rofl|(?:ha)+h?|ha ha(?: ha)*|(?:he){2,}h?|heh|thats funny|that was funny|so funny|xd')],
  ['messedUp', whole('i (?:really |totally )?(?:messed up|screwed up|blew it|failed|fucked up|effed up|messed everything up|screwed everything up|ruined it|ruined everything)|i made a mistake|i made a big mistake|i made a bad choice|i did something stupid|i did something dumb')],
  ['unsure', whole('idk|i dont know|i dont really know|dunno|i dunno|not sure|im not sure|no idea|i have no idea|who knows')],
  ['whatever', whole('whatever|whatevs|nevermind|never mind|nvm|forget it|forget about it|meh|eh|its fine|its whatever|nothing')],
  ['sigh', whole('ugh|ughh+|sigh|smh|bleh|blah|argh|arg|ugh whatever|ugh fine')],
  ['ok', whole('ok|okay|k|kk|okie|okey|alright|all right|cool|got it|gotcha|sounds good|good to know|makes sense|i see|oh i see|ok cool|okay cool|cool cool|will do|for sure|bet|nice|neat|perfect|yeah ok|ok then')],
];

export function findWord(text: string): WordKey | null {
  const t = clean(text);
  if (!t) return null;
  for (const [k, re] of WORDS) if (re.test(t)) return k;
  return null;
}

export const LINES: Record<WordKey, string[]> = {
  // An apology: let them off the hook.
  sorry: [
    'No need to apologize, {name}. You’re doing fine. What’s on your mind?',
    'It’s okay, really. Nothing to be sorry about. What can I help with?',
    'No worries at all. I’m right here. What’s going on?',
  ],
  // Thanks: you're welcome, and the door stays open.
  thanks: [
    'You’re welcome, {name}! I’m always here.',
    'Anytime! Is there anything else on your mind?',
    'Happy to help. You’re doing great, you know.',
  ],
  // Okay, got it: they heard her. Keep it light.
  ok: [
    'Sounds good. Anything else I can help with?',
    'Okay! I’m here if anything else comes up.',
    'Cool. What else is on your mind?',
  ],
  // Laughing: enjoy it with them.
  laugh: [
    'Ha! 😄 Glad I could make you smile.',
    '😄 I love hearing you laugh. What’s got you in a good mood?',
    'Haha! Laughing is good for you. What else is going on?',
  ],
  // Not knowing: that's okay.
  unsure: [
    'That’s okay. You don’t have to have it all figured out. Want to tell me how today is going?',
    'That’s alright. Sometimes it’s hard to put into words. I’m here when you’re ready.',
    'Not knowing is okay too. Want to just talk for a minute?',
  ],
  // Whatever, never mind: no pressure, but she noticed.
  whatever: [
    'Okay, no pressure. If something’s bugging you, I’m here to listen.',
    'That’s okay. We can talk about something else, or nothing at all. I’m here when you need me.',
    'Fair enough. Sounds like maybe it’s been a day. Want to talk about it?',
  ],
  // A sigh: something's heavy.
  sigh: [
    'That sounds like a heavy sigh. What’s going on?',
    'Ugh, one of those moments? Tell me about it.',
    'I hear you. What’s weighing on you?',
  ],
  // A mistake: kindness first, then what happened.
  messedUp: [
    'It’s okay, {name}. Everyone messes up sometimes, and it doesn’t erase how far you’ve come. Do you want to tell me what happened?',
    'Hey, be gentle with yourself. One mistake doesn’t define you. What happened?',
    'Mistakes are part of being human, and you’re still here trying. Want to talk about what happened?',
  ],
  // Leaving during the day.
  bye: [
    'Bye, {name}! Take care of yourself today. I’m here any time.',
    'See you later, {name}! You’re doing great.',
    'Okay, talk soon! Come back any time you need me.',
  ],
  // Leaving at night, or going to bed.
  goodnight: [
    'Good night, {name}! Sleep well. I’m proud of you for today.',
    'Good night! Rest up. Tomorrow is a new day.',
    'Sweet dreams, {name}. I’m here any time you need me.',
  ],
  love: [
    'Aww! 😊 I’m just an app, but I’m always in your corner. Your LifeCircle loves you too.',
    'Aww, that’s sweet! 😊 I’m always rooting for you, {name}.',
  ],
  compliment: [
    'Aww, thank you! 😊 You’re pretty great yourself.',
    'That made my day, {name}! 😊 What can I do for you?',
    'Thank you! 😊 I think you’re doing an amazing job too.',
  ],
};

// "Sorry" right after she joked about being called names.
export const SORRY_AFTER_JOKE = [
  'Apology accepted! 😄 I knew you didn’t mean it. What’s going on?',
  'All forgiven, {name}! 😄 Is something bothering you today?',
];

// Laughing at her joke (Ed, 2026-10-27: "if they say haha say I am glad you liked it").
export const GLAD_JOKE = ['I’m glad you liked it! 😄'];

// After danger words: no jokes, and no goodbye without pointing to help.
export const BYE_WORRIED = [
  'Okay, {name}. Before you go, please reach out to someone in your LifeCircle. 988, the free Suicide and Crisis Lifeline, is there any time, day or night.',
  'Okay. I’m still thinking about you. Please text or call someone in your LifeCircle tonight, and 988, the free Suicide and Crisis Lifeline, is there any time.',
];

export function wordLine(
  key: WordKey,
  o: { name: string; now: Date; afterJoke?: boolean; toldJoke?: boolean; worried?: boolean },
  rand: () => number = Math.random,
): string | null {
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length) % xs.length].replace(/\{name\}/g, o.name);
  if (o.worried) {
    if (key === 'bye' || key === 'goodnight') return pick(BYE_WORRIED);
    // Laughing and small talk: the worried check-in already says it.
    if (key === 'laugh' || key === 'ok' || key === 'love' || key === 'compliment') return null;
  }
  // "Haha" right after her joke (Ed, 2026-10-27).
  if (key === 'laugh' && o.toldJoke) return pick(GLAD_JOKE);
  if (key === 'sorry' && o.afterJoke) return pick(SORRY_AFTER_JOKE);
  // "Bye" in the evening is good night.
  if (key === 'bye' && partOfDay(o.now) === 'evening' && o.now.getHours() >= 20) return pick(LINES.goodnight);
  return pick(LINES[key]);
}

// "What time is it?", "what day is it?", "what's the weather?"
const CLOCK: [('time' | 'day' | 'weather'), RegExp][] = [
  ['time', /^(?:(?:hey|zoey|um|so) )*(?:what time is it|whats the time|what is the time|do you know what time it is|time)(?: (?:now|right now|zoey))*$/],
  ['day', /^(?:(?:hey|zoey|um|so) )*(?:what day is it|what day is today|whats the date|what is the date|whats today|what is today|whats todays date|what is todays date|what month is it)(?: (?:today|zoey))*$/],
  ['weather', /\b(?:weather|forecast|is it (?:cold|hot|raining|snowing|going to rain|gonna rain|going to snow|gonna snow)|will it (?:rain|snow)|how cold is it|how hot is it|do i need (?:a|my) (?:coat|jacket|umbrella))\b/],
];
export function findClock(text: string) {
  const t = clean(text);
  for (const [k, re] of CLOCK) if (re.test(t) && !(k === 'weather' && /\b(?:makes me|feel|sad|depress|mood)\b/.test(t))) return k;
  return null;
}
export function clockLine(k: 'time' | 'day', now: Date) {
  return k === 'time'
    ? `It’s ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`
    : `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.`;
}
export const NO_WEATHER = 'I couldn’t get the forecast right now. Try a weather app, and dress for the day!';

// "Can you be funny?" (Ed, 2026-10-27): "I have a joke! Do you want to hear it?"
// Yes tells the otter joke; no is "Okay, maybe later." "Tell me a joke" goes straight to it.
const FUNNY_ASK = /^(?:(?:hey|hi|zoey|so|um|ok|okay) )*(?:(?:can|could|will|would) (?:you|u) (?:be|act|try to be|try being) (?:funny|silly|fun)|(?:are|r) (?:you|u) (?:funny|any fun)|(?:do|d) (?:you|u) (?:know|have) (?:a|any) (?:joke|jokes|funny ones)|(?:got|have you got) (?:a|any) (?:joke|jokes)|(?:you|u) know any jokes|be funny)(?: (?:zoey|please|for me|today|right now|at all))*$/;
export const findFunnyAsk = (text: string) => FUNNY_ASK.test(text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim());
export const JOKE_OFFER = 'I have a joke! Do you want to hear it?';
export const JOKE_LATER = ['Okay, maybe later.', 'Okay, maybe later! It’ll keep. 😄'];

// "You just said that" (Ed, 2026-10-27): "Oh yes, I guess I did. Sorry!" and then
// something kind and true about them. Works at any point; her open question stays open.
const REPEAT = new RegExp(
  `^${LEAD}(?:` +
    [
      'you (?:just |already |literally )?(?:said|asked|told me|asked me) (?:that|this|the same thing|that already|that before)(?: (?:already|before|again|twice|a minute ago|earlier|like (?:a minute|two seconds) ago))?',
      'you (?:keep|kept) (?:saying|asking|telling me) (?:that|this|the same thing)(?: over and over)?',
      '(?:you(?:re| are|r)?|ur|u r) (?:repeating|saying the same thing)(?: yourself| it)?(?: again)?',
      'you repeated (?:yourself|that)',
      'stop repeating (?:yourself|that|it)',
      '(?:thats|that is) what you (?:just )?said',
      'same thing (?:again|twice)',
      'deja vu',
    ].join('|') +
    `)${Z}$`,
);
export const findRepeat = (text: string) => REPEAT.test(clean(text));
export const REPEAT_SORRY = ['Oh yes, I guess I did. Sorry!', 'Oh, you’re right, I did say that. Sorry!', 'Oops, I guess I did! Sorry about that.'];
export const AFFIRM = [
  'You’re stronger than you know.',
  'You’re doing better than you think, {name}.',
  'You’ve already come so far, and I’m proud of you.',
  'Every day you keep going matters.',
  'You deserve good things, {name}.',
  'Showing up for yourself today counts.',
  'You’re worth the work you’re putting in.',
  'You have more courage than you give yourself credit for.',
];
