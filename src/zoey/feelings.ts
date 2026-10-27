// Spotting a typed feeling ("I'm sad", "feeling really anxious today") so Zoey
// can ask if they know why (Ed, 2026-10-22). Only short statements count: a
// question goes to the answer library, and "I'm sad because..." already says why.
// The safety screen always runs before this.
import { END, FeelingKey, isHardFeeling, skipAfterShare, Tree, TREES } from './trees';

export const FEELING_WORDS: Record<FeelingKey, string[]> = {
  sad: ['sad', 'down', 'depressed', 'blue', 'upset', 'unhappy', 'miserable', 'low', 'bummed', 'like crying', 'teary', 'heartbroken'],
  angry: ['angry', 'mad', 'pissed', 'pissed off', 'furious', 'irritated', 'annoyed', 'livid', 'heated', 'fed up', 'so mad', 'raging'],
  frustrated: ['frustrated'],
  anxious: ['anxious', 'nervous', 'worried', 'on edge', 'panicky', 'uneasy', 'restless'],
  scared: ['scared', 'afraid', 'frightened', 'terrified'],
  lonely: ['lonely', 'alone', 'isolated'],
  stressed: ['stressed', 'stressed out', 'overwhelmed'],
  numb: ['numb', 'empty'],
  guilty: ['guilty'],
  ashamed: ['ashamed', 'embarrassed'],
  tired: ['tired', 'exhausted', 'drained', 'worn out'],
  bored: ['bored'],
  happy: ['happy', 'great', 'glad', 'awesome', 'amazing'],
  proud: ['proud', 'proud of myself'],
  grateful: ['grateful', 'thankful', 'blessed'],
  excited: ['excited'],
  hopeful: ['hopeful', 'optimistic'],
  calm: ['calm', 'peaceful', 'relaxed', 'at peace'],
};

const LEAD = '(?:(?:honestly|today|tonight|ugh|well|zoey|hey zoey|hi zoey|tbh|lately|right now|just|so) )*';
const SUBJECT = '(?:i am|im|i feel|i felt|i feel like im|i have been|ive been|i been|been|feeling|im feeling|i am feeling|i keep feeling|i just feel|i get)';
const DEGREE = '(?:(?:so|fucking|freaking|effing|damn|really|very|kinda|kind of|pretty|a little|a bit|a little bit|super|just|quite|extremely|too|feeling|sort of|somewhat) )*';
const TAIL = '(?: (?:today|right now|now|lately|tonight|again|all day|this morning|this week|these days|rn))*';

const ENTRIES = Object.entries(FEELING_WORDS).flatMap(([k, ws]) => ws.map((w) => [w, k as FeelingKey] as const));
// Longest first, so "pissed off" wins over "pissed".
ENTRIES.sort((a, b) => b[0].length - a[0].length);
const WORD_RE = ENTRIES.map(([w]) => w.replace(/ /g, ' ')).join('|');
const STATEMENT = new RegExp(
  `^${LEAD}(?:${SUBJECT} )?${DEGREE}(${WORD_RE})(?: (?:and|but) ${DEGREE}(?:${WORD_RE}))?${TAIL}$`,
);
// One word on its own ("down", "great") is too vague; "sad" alone is clear enough.
const NEEDS_SUBJECT = new Set(['low', 'down', 'blue', 'alone', 'empty', 'great', 'calm', 'mad']);

export type Feeling = { key: FeelingKey; word: string };

export function findFeeling(text: string): Feeling | null {
  if (/\?\s*$/.test(text)) return null;
  const t = text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = t.match(STATEMENT);
  if (!m) return null;
  const word = m[1];
  if (NEEDS_SUBJECT.has(word) && t === word) return null;
  const key = ENTRIES.find(([w]) => w === word)![1];
  return { key, word };
}

export const clean = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// "I'm sick", "I have the flu", "my stomach hurts" (Ed, 2026-10-24). Only about
// themselves: "my mom is sick" is not this. "Sick of" means fed up, not ill.
// Sick after using, withdrawal and chest pain go to the safety screen first.
const ME = '(?:i am|im|i feel|i felt|i feel like|feeling|im feeling|i am feeling|ive been|i have been|i been|been|i think im|i got|i get|getting|im getting)';
const DEG = '(?:(?:so|really|very|kinda|kind of|pretty|a little|a bit|super|just|still|feeling|sort of|real) )*';
const SICK_RES = [
  new RegExp(`\\b${ME} ${DEG}(?:sick|ill|unwell|nauseous|nauseated|queasy|feverish|under the weather|sick to my stomach|achy|run down)\\b(?! of\\b| and tired\\b)`),
  /\b(?:i dont|i do not|im not|i am not|not) (?:feel|feeling) (?:so |very |too |that )?(?:well|good|great|right|so hot)\b/,
  /\b(?:i have|ive got|i got|i caught|i think i have|i think i got|got|have) (?:a |the |an |some )?(?:bad |really bad |terrible |little )?(?:cold|flu|fever|headache|migraine|stomach ache|stomachache|stomach bug|sore throat|cough|infection|covid|virus|toothache|earache|tooth ache|food poisoning)\b/,
  /\bmy (?:head|stomach|tummy|back|tooth|teeth|throat|ear|ears|body|chest) (?:hurts|is hurting|aches|is killing me|really hurts)\b/,
  /\b(?:i threw up|ive been throwing up|im throwing up|been throwing up|i keep throwing up|im vomiting|i cant stop throwing up|i have diarrhea)\b/,
  /\b(?:im|i am) in (?:a lot of )?pain\b/,
];

export function findSick(text: string): boolean {
  const t = ` ${clean(text)} `;
  return SICK_RES.some((r) => r.test(t));
}

// For anything the answer library can't place: a hard or good feeling named
// anywhere in what they wrote ("my dog died and im so sad"). Never a fallback
// for a feeling (Ed, 2026-10-24). "not sad" doesn't count.
const SKIP_LOOSE = new Set(['down', 'low', 'blue', 'alone', 'empty', 'great', 'calm', 'mad', 'tired', 'upset', 'restless', 'awesome', 'amazing', 'glad', 'blessed']);
const LOOSE = ENTRIES.filter(([w]) => !SKIP_LOOSE.has(w));
const LOOSE_RE = new RegExp(`(?:^| )(not |never |no longer |)(?:${DEGREE})(${LOOSE.map(([w]) => w).join('|')})(?= |$)`, 'g');

export function mentionedFeeling(text: string): Feeling | null {
  const t = clean(text);
  for (const m of t.matchAll(LOOSE_RE)) {
    if (m[1]) continue;
    const word = m[2];
    return { key: LOOSE.find(([w]) => w === word)![1], word };
  }
  return null;
}

// A typed answer to one of Zoey's yes / no questions. `rest` is anything they
// said after it ("yes, she said to rest"), so Zoey doesn't ask for it again.
const YES = ['yes', 'yeah', 'yea', 'yep', 'yup', 'ya', 'sure', 'ok', 'okay', 'of course', 'definitely', 'i did', 'i have', 'i do', 'kind of', 'kinda', 'sort of', 'y'];
const NO = ['no', 'nope', 'nah', 'not yet', 'not really', 'i didnt', 'i havent', 'i dont', 'no i havent', 'no i didnt', 'not now', 'n'];

export function yesNo(text: string): { answer: 'yes' | 'no'; rest: string } | null {
  const t = clean(text);
  const hit = (ws: string[]) => ws.filter((w) => t === w || t.startsWith(`${w} `)).sort((a, b) => b.length - a.length)[0];
  const no = hit(NO);
  const yes = hit(YES);
  // "i dont know" and "i do not" are not a yes.
  if (/^(i dont know|idk|not sure|im not sure|maybe)\b/.test(t)) return null;
  const w = no && (!yes || no.length >= yes.length) ? no : yes;
  if (!w) return null;
  return { answer: w === no ? 'no' : 'yes', rest: t.slice(w.length).trim() };
}

// Replies that aren't an answer to Zoey's question (Ed, 2026-10-24: "what do
// you mean?" must never get "that sounds like a good plan", and "why?" must
// never get "oh that's good").
const CLARIFY = /^(?:(?:um|uh|sorry|wait|zoey|but) )*(?:what|huh|hmm|eh|wdym|what do you mean|what do u mean|whatchu mean|what does that mean|what you mean|what do you mean by that|meaning|i dont understand|i dont get it|i dont get what you mean|i dont understand the question|im confused|confused|say that again|can you say that again|what are you asking|what was the question|what do you want me to say|can you explain|explain|come again|pardon)(?: zoey)?$/;
const WHY = /^(?:(?:but|and|ok|okay|zoey|um) )*(?:why|why do you ask|why are you asking|why do you want to know|why do you need to know|why does it matter|why does that matter|why is that important|why would i|why should i|whys that|why is that|how come|what for|whats it to you)(?: that| zoey)?$/;
const DECLINE = /^(?:(?:um|well|honestly) )*(?:no|nope|nah|no thanks|not really|i dont want to|i dont wanna|i would rather not|id rather not|rather not|nothing|not now|pass|skip|none|no i dont|i dont have one|i dont have a plan|no plan|i cant)(?: right now| zoey| thanks)*$/;
const UNSURE = /^(?:(?:um|well|honestly) )*(?:i dont know|i dont really know|idk|not sure|im not sure|dunno|i dunno|maybe|no idea|i have no idea|i guess|beats me)(?: zoey)?$/;

// "You didn't answer my question", "that's not what I asked" (Ed, 2026-10-25):
// never an answer to Zoey's question. complaints.ts has the reply.
const COMPLAINT_LEAD = '(?:(?:no|nope|um|uh|ugh|zoey|but|well|dude|bro|omg|seriously|hey|lol) )*';
const BODY = [
  'you (?:didnt|did not|never|dont|do not|wont|still didnt|still havent|havent) (?:really )?answer(?:ed)?(?: (?:my|the|me|that|it)(?: question)?)?',
  'answer (?:my|the) question(?: please)?',
  'just answer (?:me|the question|my question)',
  'i asked (?:you )?(?:a|my) question',
  'i asked you something',
  '(?:thats|that is|that was|this is|thats just) not (?:what i (?:asked|said|meant|wanted)|my question|it|right|helpful|an answer|the answer)',
  'not what i (?:asked|said|meant)',
  'i didnt ask (?:that|you that|about that|for that)',
  'you(?:re| are) not listening(?: to me)?',
  'you (?:dont|never|arent) listen(?:ing)?(?: to me)?',
  '(?:that|this|it) (?:doesnt|does not|didnt) make (?:any )?sense',
  '(?:that|it) makes no sense',
  'you(?:re| are|r)? (?:not|arent) making (?:any )?sense',
  'you (?:make no|dont make|dont make any) sense',
  'not making sense',
  'makes no sense',
  'doesnt make sense',
  'wrong answer',
  '(?:thats|that is|that was|that answer is|your answer is) (?:wrong|the wrong answer|not right|a bad answer|off)',
  'bad answer',
  'try again',
  'try that again',
  'you (?:dont|do not|didnt|did not) (?:understand|get it|get me|get what i said)(?: me)?',
  '(?:that|you|this) (?:didnt|did not|doesnt|does not) help(?: (?:at all|me|much))?',
  'you(?:re| are) not (?:helping|helpful)',
  '(?:thats|that is|that was|that wasnt|that was not|not) (?:very )?(?:un)?helpful',
  'what are you (?:talking about|saying)',
  '(?:that|this) has nothing to do with (?:it|what i (?:said|asked)|my question|anything)',
  'you (?:already said that|said that already|keep saying (?:that|the same thing)|are repeating yourself)',
  'stop repeating yourself',
  'read my question',
  'huh thats not it',
];
const COMPLAINT = new RegExp(`^${COMPLAINT_LEAD}(?:${BODY.join('|')})(?: (?:zoey|please|again|lol|bro|dude|man|at all))*$`);

export const findComplaint = (text: string) => COMPLAINT.test(clean(text));

const ASKING_RE = /^(?:how do i|how can i|how much|how long|where is|where are|where can|when is|what time|can you tell|is there|are there|what is|whats a|what are|who is)\b/;
const ASKING = { test: (t: string) => ASKING_RE.test(clean(t)) };

export type Meta = 'clarify' | 'why' | 'decline' | 'unsure';

export function metaReply(text: string): Meta | null {
  const t = clean(text);
  if (CLARIFY.test(t)) return 'clarify';
  if (WHY.test(t)) return 'why';
  if (UNSURE.test(t)) return 'unsure';
  if (DECLINE.test(t)) return 'decline';
  return null;
}

const pickOne = (xs: string[], rand: () => number) => xs[Math.floor(rand() * xs.length) % xs.length];
const SORRY = ['Sorry, I wasn’t clear.', 'Let me say that another way.', 'Good question, I’ll put it differently.'];
const WHY_DEFAULT = [
  'I ask because I care how you’re doing, and it helps me point you to the right help.',
  'Fair question. Knowing a little more helps me find the right support for you.',
];
const DECLINE_LINES = ['That’s okay. You don’t have to.', 'No problem. We can skip that.', 'That’s okay. We can come back to it any time.'];
const UNSURE_LINES = ['That’s okay. Not knowing is okay too.', 'That’s alright. You don’t need to have the answer right now.'];

// What Zoey does with something typed while she waits on one of her questions:
//   to     the next node; `told` if they said something worth keeping.
//   say    a line to say first ("That's okay. You don't have to.").
//   again  stay on this node: `say` rephrases it or says why she asks, and the
//          same buttons come back. The node's own line isn't said again.
// null: it isn't an answer (a new question, say), so it goes to the safety
// screen and answer library like any message. Crisis words never get here:
// the safety screen runs before this.
export type Typed = { to: string; told: boolean; say?: string; again?: boolean };

export function typedAnswer(tree: Tree, nodeId: string, text: string, rand: () => number = Math.random): Typed | null {
  const n = tree.nodes[nodeId];
  if (!n || !(n.yes || n.no || n.share || n.topics)) return null;
  if (findComplaint(text)) return null;
  const meta = metaReply(text);
  if (meta === 'clarify') return { to: nodeId, told: false, again: true, say: n.clarify ?? `${pickOne(SORRY, rand)} ${n.say}` };
  if (meta === 'why') return { to: nodeId, told: false, again: true, say: n.why ?? `${pickOne(WHY_DEFAULT, rand)} ${n.say}` };
  if (n.topics) return null;
  if (n.share) {
    // "No", "nothing", "I don't know" to "What is your plan?" is not a plan.
    // A node with its own `none` already answers kindly ("That's okay. We can
    // start one together."), so no extra line before it.
    if (meta === 'decline' || meta === 'unsure') {
      const to = skipAfterShare(tree, nodeId);
      return n.none ? { to, told: false } : { to, told: false, say: pickOne(meta === 'decline' ? DECLINE_LINES : UNSURE_LINES, rand) };
    }
    // "How do I find a meeting?" while she asked what's going on: a new question, not a share.
    if (ASKING.test(text)) return null;
    return { to: n.share, told: true };
  }
  // "I don't know" to a yes / no question: "I'm not sure" if it has one, else no.
  if (meta === 'unsure') return { to: (n.notSure ?? n.no) ?? END, told: false };
  const yn = yesNo(text);
  if (yn) {
    const to = (yn.answer === 'yes' ? n.yes : n.no) ?? END;
    const after = tree.nodes[to];
    // "Yes, she said to rest": they already answered "What did they say?"
    if (after?.share && yn.rest.split(' ').length >= 2) return { to: after.share, told: true };
    return { to, told: false };
  }
  if (!n.typed || /\?\s*$/.test(text)) return null;
  return { to: n.typed, told: true };
}

// "Help", "I need help", "can you help me?" on its own, with nothing about what
// with (Ed, 2026-10-24). "Help me find a meeting" says what, so it goes to the
// answer library instead.
const HELP = new RegExp(
  '^(?:(?:hey|hi|ok|okay|zoey|please|so|um|uh) )*' +
    '(?:(?:i|i really|i just|i think i) (?:need|want|could use|would like) (?:some |a little |your )?help' +
    '|(?:can|could|will|would) (?:you|u) (?:please )?help(?: me)?' +
    '|(?:please )?help(?: me)?(?: out)?' +
    '|i need (?:some )?(?:support|someone to help me)' +
    '|i dont know what to do' +
    '|im (?:really )?struggling' +
    '|sos)' +
    '(?: (?:please|pls|zoey|now|right now|asap|out|me|plz|help))*$',
);

export const findHelp = (text: string) => HELP.test(clean(text));

// "I don't believe in God", "I'm not religious", "the higher power thing
// doesn't work for me" (Ed, 2026-10-24).
const GODS = '(?:god|a god|any god|in god|a higher power|higher power|any higher power|religion|religious stuff|the god stuff|the god thing|the higher power stuff|the higher power thing|jesus|prayer|praying|any of that|all that god stuff)';
const FAITH_RES = [
  new RegExp(`\\b(?:i dont|i do not|i dont really|i never|i cant|i stopped|i quit) (?:believe|believed|have faith) (?:in )?${GODS}\\b`),
  /\b(?:im|i am|i was raised|im kind of|im kinda) (?:an? )?(?:atheist|agnostic|not religious|not spiritual|not a believer|not a religious person|not into god|not into religion|not into the god stuff|not christian)\b/,
  /\b(?:theres|there is|there aint) no god\b/,
  /\bgod (?:isnt|is not|aint) real\b/,
  /\bi (?:dont|do not) (?:have|want) (?:a )?higher power\b/,
  /\b(?:the )?(?:god|higher power|religious|religion|spiritual) (?:thing |stuff |part |talk )?(?:doesnt|does not|dont|wont|isnt) (?:work|fit|make sense|help|for me)\b/,
  /\bi (?:hate|dont like|cant stand|cant do|dont get|dont buy) (?:the |all the |all that )?(?:god|religious|religion|higher power|jesus|church|prayer)(?: stuff| part| thing| talk)?\b/,
  /\b(?:do|must|should) i (?:have to|need to|got to) believe in (?:god|a higher power)\b/,
  /\bi dont pray\b/,
];

// AA, NA, Celebrate Recovery, the 12 steps (Ed, 2026-10-24).
const PROGRAMS = '(?:aa|na|ca|alcoholics anonymous|narcotics anonymous|celebrate recovery|the 12 steps|12 steps|twelve steps|the twelve steps|the steps|12 step|twelve step|meetings|the meetings|the program|my sponsor stuff|sponsors)';
const PROGRAM_RES = [
  new RegExp(`\\bi (?:really |just |kind of |kinda )?(?:hate|dont like|cant stand|dont believe in|dont trust|dont get|dont buy|am done with|im done with|dont want) ${PROGRAMS}\\b`),
  new RegExp(`\\b${PROGRAMS} (?:doesnt|does not|dont|do not|isnt|is not|arent|are not|never) (?:work|works|worked|help|helps|helped|for me|my thing|it|fit)\\b`),
  new RegExp(`\\b${PROGRAMS} (?:is|are) (?:bs|bullshit|stupid|dumb|a cult|not for me|pointless|useless|a joke)\\b`),
  new RegExp(`\\bim (?:done with|over|sick of|tired of) ${PROGRAMS}\\b`),
];

export const findProgramDoubt = (text: string) => {
  const t = ` ${clean(text)} `;
  return PROGRAM_RES.some((r) => r.test(t));
};

export const findFaith = (text: string) => {
  const t = ` ${clean(text)} `;
  return FAITH_RES.some((r) => r.test(t));
};

// Anger said with a curse or a vent, not a feeling word: "fuck this",
// "this is bullshit", "I want to punch a wall" (Ed, 2026-10-24: don't judge,
// ask what happened). Threats to people are the safety screen's, first.
const ANGER = /^(?:(?:ugh|man|god|omg|honestly|zoey) )*(?:fuck (?:this|that|it|everything|everyone|my life|this shit|him|her|them)|this is (?:bullshit|bs|so stupid|fucked up|ridiculous)|(?:im |i am )?so (?:sick of|over) (?:this|everything|it)|i want to (?:punch|hit|break|throw) (?:a wall|something|stuff|things)|(?:im|i am) about to lose it|i could scream|im losing my temper)\b/;

export const findAnger = (text: string) => ANGER.test(clean(text));

// "God hates me", "Jim hates me", "my mom can't stand me", "everyone hates me"
// (Ed, 2026-10-24). `who` is how Zoey names them back: "Jim", "your mom", "God".
const HATES = /^(?:(?:i think|i feel like|i know|i swear|honestly|it feels like|ugh|man) )*((?:my |the )?[a-z]+(?: [a-z]+)?) (?:hates|hate|doesnt like|dont like|cant stand|is mad at|is against|has it out for) me\b/;
const NOT_WHO = new Set(['it', 'this', 'that', 'he', 'she', 'they', 'who', 'what', 'why', 'i', 'you', 'nobody', 'no one']);

export function findHates(text: string): { node: 'why' | 'god' | 'everyone'; who: string } | null {
  const t = clean(text);
  const m = t.match(HATES);
  if (!m) return null;
  const raw = m[1];
  if (/^(god|the lord|jesus|my higher power|the universe|my god)$/.test(raw)) return { node: 'god', who: 'God' };
  if (/^(everyone|everybody|the world|people|all of them|everyone here|the whole world)$/.test(raw)) return { node: 'everyone', who: 'everyone' };
  if (NOT_WHO.has(raw) || raw.split(' ').some((w) => NOT_WHO.has(w))) return null;
  // "my mom" -> "your mom"; a name -> "Jim".
  if (raw.startsWith('my ')) return { node: 'why', who: `your ${raw.slice(3)}` };
  if (raw.startsWith('the ')) return { node: 'why', who: raw };
  return { node: 'why', who: raw.replace(/\b[a-z]/g, (c) => c.toUpperCase()) };
}

// "I hate my family", "I can't stand my roommate", "I hate everyone" (Ed, 2026-10-27):
// a big feeling about someone or something. Not "I hate myself" or "my life" (safety
// and self-worth have those), not "I hate you" (that's at Zoey), and not "I hate AA"
// (the program flow has that).
const BIG = /^(?:(?:like|honestly|ugh|man|i think|i swear|i just|sometimes|right now|tbh|zoey) )*i (?:(?:really|just|fucking|so|kinda|kind of|honestly|literally) )*(?:hate|despise|loathe|resent|cant stand|cannot stand|am done with|m done with|want nothing to do with) (.+)$/;
const NOT_BIG = /^(?:me|myself|my ?self|my life|life|my body|you|u|zoey|this app|living|being alive|aa|na|meetings?|the program|my program|the steps|12 steps|twelve steps|my sponsor)\b/;

export function findBig(text: string): boolean {
  if (isQuestion(text)) return false;
  const m = clean(text).replace(/\bim\b/g, 'i m').replace(/\bi m done\b/, 'i am done').match(BIG);
  return !!m && !NOT_BIG.test(m[1]);
}

const QUESTION = /^(how|what|whats|why|when|where|who|which|is|are|am i|can|could|should|do|does|did|will|would|have|has)\b/;
export const isQuestion = (text: string) => /\?\s*$/.test(text) || QUESTION.test(clean(text));

// After the safety screen: does what they typed start a follow-up conversation
// instead of a library answer or a fallback? `reply` is what ask() would show.
//   "I'm sad"                    -> I'm sorry to hear that. Can you tell me more?
//   "I'm sick"                   -> Have you talked to your doctor?
//   "I need help"                -> What do you need help with?
//   "I don't believe in God"     -> No judgment. What in your life gives you hope?
//   "I hate AA"                  -> the same, then other paths (SMART, counseling)
//   "Jim hates me"               -> Now why would Jim hate you? (then sponsor/counselor)
//   "fuck this" / "I'm so angry" -> no judgment: what happened?
//   "my dog died and I'm so sad" -> I'm sorry to hear that. Thank you for telling me. (then the plan)
// Questions ("is it normal to feel sad?") keep their library answer, and
// medicine questions keep the prescriber reply.
// "I had a bad day", "work was rough", "today sucked": Zoey says it back and asks what
// made it bad (Ed, 2026-10-27: "reflect back what they said and ask what made it bad").
export type BadDay = { adj: string; when: string };
const BAD_ADJ = '(?:bad|rough|terrible|awful|horrible|crappy|shitty|hard|tough|long|stressful|sucky|crap|lousy|miserable|exhausting|hectic|frustrating|depressing|sad|bad bad|really bad|the worst|garbage|trash|rubbish|not good|not great|bleh)';
const BAD_WHEN = '(?:day|night|morning|afternoon|evening|week|shift|weekend)';
const BAD_SUBJ = '(?:today|my day|this day|the day|tonight|this morning|this week|my week|work|school|my shift|class|group|therapy|court)';
const DEG3 = '(?:(?:really|very|so|pretty|super|such a|kind of|kinda|a|an|the|one|just|bit of a|fucking|freaking) )*';
const BAD_RES: RegExp[] = [
  new RegExp(`^(?:(?:ugh|man|honestly|zoey|well|so|yeah|omg|i mean) )*(?:i |ive |i have |i just |just |im |i am )?(?:had|having|have had|been having|got|had myself) ${DEG3}(${BAD_ADJ}) (${BAD_WHEN})(?: today| tonight| at work| at school| zoey)*$`),
  new RegExp(`^(?:(?:ugh|man|honestly|zoey|well|so|yeah|omg) )*(${BAD_SUBJ})(?: today| tonight)? (?:was|has been|is|been|went|felt)(?: just)? ${DEG3}(${BAD_ADJ})(?: today| tonight| zoey)*$`),
  new RegExp(`^(?:(?:ugh|man|honestly|zoey|well|so|yeah|omg) )*(${BAD_SUBJ}) (?:sucked|sucks|was the worst|was a mess|went badly|went bad|blew|stunk)(?: today| tonight)*$`),
  new RegExp(`^(?:(?:ugh|man|honestly|zoey|well|so|yeah|omg) )*(?:(?:it was|that was|its been|it has been|this is|today was|today is) )?(?:a |such a |what a |worst )?${DEG3}(${BAD_ADJ}) (${BAD_WHEN})(?: ever| today| zoey)*$`),
  /^(?:(?:ugh|man|honestly|zoey|well|so|yeah|omg) )*(?:worst day ever|what a day|today was the worst|this day sucks|this day sucked)$/,
];
const SOFT: Record<string, string> = { crappy: 'rough', shitty: 'rough', sucky: 'rough', crap: 'rough', garbage: 'rough', trash: 'rough', rubbish: 'rough', bleh: 'rough', 'bad bad': 'bad', 'the worst': 'really hard', 'not good': 'hard', 'not great': 'hard', 'really bad': 'really bad', sad: 'sad' };
export function findBadDay(text: string): BadDay | null {
  const t = clean(text).replace(/\b(?:a )?(?:really|very|so|pretty|super|kinda|kind of|fucking|freaking) (?=(?:bad|rough|terrible|awful|horrible|hard|tough|long|stressful))/g, '');
  if (/\b(?:not a bad|wasnt bad|wasnt that bad|not that bad|not too bad|no bad)\b/.test(t)) return null;
  for (const re of BAD_RES) {
    const m = re.exec(t);
    if (!m) continue;
    const words = m.slice(1).filter(Boolean);
    const adjRaw = words.find((w) => new RegExp(`^${BAD_ADJ}$`).test(w)) ?? 'rough';
    const subj = words.find((w) => new RegExp(`^${BAD_SUBJ}$`).test(w));
    const unit = words.find((w) => new RegExp(`^${BAD_WHEN}$`).test(w));
    const when = subj
      ? subj.replace(/^my (?=day|week|shift)/, 'your ').replace(/^(?:this day|the day|my day)$/, 'today')
      : !unit || unit === 'day' ? 'today' : unit === 'night' ? 'your night' : unit === 'evening' ? 'tonight' : unit === 'shift' ? 'your shift' : `this ${unit}`;
    return { adj: SOFT[adjRaw] ?? adjRaw, when };
  }
  return null;
}
const was = (when: string) => `${when} was`;
export const BAD_DAY_LINES: ((b: BadDay) => string)[] = [
  (b) => `It sounds like ${was(b.when)} really ${b.adj}. I’m sorry. What made it ${b.adj}?`,
  (b) => `I hear you, ${was(b.when)} ${b.adj}. What happened that made it that way?`,
  (b) => `Ugh, I’m sorry ${was(b.when)} so ${b.adj}. Do you want to tell me what made it ${b.adj}?`,
  (b) => `${b.when[0].toUpperCase()}${b.when.slice(1)} was ${b.adj}, huh? ${/hard/.test(b.adj) ? 'I’m sorry.' : 'That’s hard.'} What made it ${b.adj}?`,
];
export const badDayLine = (b: BadDay, rand: () => number = Math.random) =>
  BAD_DAY_LINES[Math.floor(rand() * BAD_DAY_LINES.length) % BAD_DAY_LINES.length](b).replace('really really', 'really').replace('so really', 'really');

// "I wanted to use", "I feel like using", "I'm craving": the urge itself, not a
// question about cravings. Not "I don't want to use", "use the bathroom" or "I used".
const URGE_LEAD = '(?:(?:honestly|today|tonight|ugh|man|zoey|tbh|lately|right now|just|so|and|but|i think) )*';
const USE_OBJ = '(?! (?:the|my|a|an|this|that|your|it|his|her|our|their|some|bathroom|restroom|phone|app|computer|car|help)\\b)';
const URGE = [
  new RegExp(`^${URGE_LEAD}(?:i |im |i am |i was |ive |i have |i keep |i still |still |been |kinda |really |so )*(?:really |so |kinda |kind of |just |bad |badly |still |been )*(?:want|wanted|wanna|wanting|feel like|felt like|feeling like|need|needed|have been wanting|keep wanting|am wanting|was wanting|been wanting|thinking about|thought about|been thinking about|have the urge to|had the urge to|got the urge to) (?:to )?(?:use|using|drink|drinking|get high|getting high|get drunk|getting drunk|get loaded|relapse|relapsing|pick up|go out and use|a drink|a hit|a beer|a shot|smoke|smoking)${USE_OBJ}\\b`),
  /^(?:(?:honestly|today|tonight|ugh|man|zoey|so) )*(?:im|i am|i was|ive been|i have been|been|i keep|i)(?: (?:really|so|kinda|still|just))* (?:craving|having cravings|having a craving|having bad cravings|having urges|having an urge|jonesing|itching to use|tempted to use|tempted to drink|tempted)\b/,
  /^(?:(?:honestly|today|tonight|ugh|man|zoey|so) )*i (?:have|had|got|have got|still have) (?:a |an |some |really bad |bad |strong |a strong |a bad |big )?(?:craving|cravings|urge|urges)(?: to (?:use|drink|get high))?\b/,
  /^(?:(?:honestly|today|tonight|ugh|man|zoey|so) )*(?:i )?miss (?:using|drinking|getting high|the high|my drug|meth|dope|weed|alcohol)\b/,
];
export const findUrge = (text: string) => {
  const t = clean(text);
  if (/\b(?:dont|do not|never|not|no longer|stopped)\b.*\b(?:want|wanna|craving|need)\b/.test(t) || isQuestion(text)) return false;
  return URGE.some((re) => re.test(t));
};

export function followUp(
  text: string,
  reply: 'answer' | 'medication' | 'fallback' | string,
): { tree: string; node: string; who?: string } | null {
  if (reply !== 'answer' && reply !== 'medication' && reply !== 'fallback') return null;
  if (findHelp(text)) return { tree: 'help', node: TREES.help.start };
  const h = reply !== 'medication' ? findHates(text) : null;
  if (h) return { tree: 'hates', node: h.node, who: h.who };
  if (reply !== 'medication' && findAnger(text)) return { tree: 'feeling:angry', node: TREES['feeling:angry'].start };
  if (reply !== 'medication' && findFaith(text)) return { tree: 'faith', node: TREES.faith.start };
  if (reply !== 'medication' && findProgramDoubt(text)) return { tree: 'program', node: TREES.program.start };
  if (reply !== 'medication' && findUrge(text)) return { tree: 'urge', node: TREES.urge.start };
  if (reply !== 'medication' && findBig(text)) return { tree: 'big', node: TREES.big.start };
  const f = findFeeling(text);
  if (f) return { tree: `feeling:${f.key}`, node: TREES[`feeling:${f.key}`].start };
  if (reply === 'medication') return null;
  if (findSick(text)) return { tree: 'sick', node: TREES.sick.start };
  if (isQuestion(text)) return null;
  const m = mentionedFeeling(text);
  if (!m) return null;
  const tree = TREES[`feeling:${m.key}`];
  return { tree: tree.id, node: tree.entries?.[0] ?? tree.start };
}

// Safety-check words that mean hopelessness ("it's hopeless", "no point").
// After "Yes, I'm safe", Zoey asks what's making it feel that way.
export const isHopelessCheck = (matched: string) => /hope|no point|whats the point|give up|giving up|nothing matters|no way out/.test(matched);

// One word on its own, like "bad", "tired" or "meh" (Ed, 2026-10-27: "repeat the word
// and ask what they mean by bad. do the same thing with other one-word responses").
// `key` is the feeling flow their answer goes on into; null for "fine" or "meh",
// where their answer just goes through as usual. The safety screen runs first.
const ONE_MORE: Record<string, FeelingKey | null> = {
  bad: 'sad', rough: 'sad', terrible: 'sad', awful: 'sad', horrible: 'sad', crappy: 'sad', shitty: 'sad', lousy: 'sad', hurt: 'sad', hurting: 'sad', sucks: 'sad', crummy: 'sad',
  sick: null, fine: null, meh: null, eh: null, blah: null, okayish: null, weird: null, off: null, confused: null, lost: null, stuck: null,
  good: 'happy', great: 'happy', awesome: 'happy', amazing: 'happy', wonderful: 'happy', fantastic: 'happy', blessed: 'grateful', relaxed: 'calm',
};
const ONE_WORDS = new Map<string, FeelingKey | null>([
  ...ENTRIES.filter(([w]) => !w.includes(' ')).map(([w, k]) => [w, k] as const),
  ...Object.entries(ONE_MORE),
]);

export type OneWord = { word: string; key: FeelingKey | null };

export function findOneWord(text: string): OneWord | null {
  if (/\?\s*$/.test(text)) return null;
  const word = clean(text);
  if (!/^[a-z]+$/.test(word) || !ONE_WORDS.has(word)) return null;
  return { word, key: ONE_WORDS.get(word)! };
}

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
// The word she repeats back is drawn out, like a person would: "Baad?" (Ed, 2026-10-27:
// two a's, because "Baaad" did not sound right on the phone voice).
const STRETCH: Record<string, string> = { bad: 'Baad' };
const echo = (w: string) => STRETCH[w] ?? cap(w);
const ONE_HARD: ((w: string) => string)[] = [
  (w) => `${echo(w)}? What do you mean by ${w}?`,
  (w) => `${echo(w)}, huh? What do you mean by ${w}?`,
  (w) => `${echo(w)}? Tell me what you mean by ${w}.`,
  (w) => `When you say ${w}, what do you mean?`,
];
const ONE_GOOD: ((w: string) => string)[] = [
  (w) => `${cap(w)}? I love hearing that! What do you mean by ${w}?`,
  (w) => `${cap(w)}! That’s good to hear. What do you mean by ${w}?`,
  (w) => `${cap(w)}? Tell me more, what do you mean by ${w}?`,
];

// Words that mean the same thing, so she doesn't always say theirs back (Ed,
// 2026-10-27: "get creative, use words that mean the same thing").
const ROUGH = ['rough', 'down', 'not so great'];
const VERY_ROUGH = ['really rough', 'so low', 'really down'];
const GREAT = ['really good', 'wonderful', 'awesome'];
export const SAME: Record<string, string[]> = {
  bad: ROUGH, crappy: ROUGH, lousy: ROUGH, crummy: ROUGH, sucks: ROUGH, shitty: ROUGH,
  rough: ['down', 'not so great', 'worn down'],
  terrible: VERY_ROUGH, awful: VERY_ROUGH, horrible: VERY_ROUGH, miserable: VERY_ROUGH,
  hurt: ['hurt inside', 'in pain'], hurting: ['hurt inside', 'in pain'],
  sad: ['down', 'low', 'blue'], down: ['sad', 'low', 'blue'], low: ['down', 'sad'], blue: ['down', 'sad'], unhappy: ['down', 'sad'], depressed: ['really low', 'down'],
  upset: ['shaken up', 'down'], bummed: ['down', 'let down'],
  angry: ['mad', 'fired up', 'upset'], mad: ['angry', 'fired up', 'upset'], pissed: ['really mad', 'fired up'], furious: ['really angry', 'fired up'],
  annoyed: ['irritated', 'bugged'], irritated: ['annoyed', 'bugged'], frustrated: ['fed up', 'irritated'],
  anxious: ['on edge', 'uneasy', 'nervous'], nervous: ['on edge', 'uneasy'], worried: ['uneasy', 'on edge'], restless: ['on edge', 'uneasy'],
  scared: ['afraid', 'frightened'], afraid: ['scared', 'frightened'],
  lonely: ['alone', 'cut off'], alone: ['lonely', 'cut off'], isolated: ['alone', 'cut off'],
  stressed: ['tense', 'wound up', 'under a lot of pressure'], overwhelmed: ['swamped', 'buried'],
  tired: ['worn out', 'drained', 'wiped out'], exhausted: ['worn out', 'wiped out'], drained: ['worn out', 'wiped out'],
  numb: ['empty', 'flat'], empty: ['numb', 'flat'],
  bored: ['restless', 'kind of stuck'],
  sick: ['under the weather', 'unwell'],
  meh: ['so-so', 'kind of blah'], blah: ['so-so', 'kind of meh'], eh: ['so-so'], fine: ['okay', 'alright'], okayish: ['so-so', 'alright'],
  good: ['great', 'happy'], great: GREAT, awesome: ['great', 'really good'], amazing: ['great', 'wonderful'], wonderful: ['great', 'really good'], fantastic: ['great', 'wonderful'],
  happy: ['good', 'cheerful'], glad: ['happy', 'good'], blessed: ['grateful', 'thankful'], grateful: ['thankful'], thankful: ['grateful'],
  relaxed: ['calm', 'at ease'], calm: ['at ease', 'peaceful'], proud: ['good about yourself'], excited: ['pumped', 'fired up'], hopeful: ['optimistic', 'good about things'],
};
const SAME_HARD: ((s: string) => string)[] = [
  (s) => `Feeling ${s}, huh? What’s going on?`,
  (s) => `Aw, I’m sorry you’re feeling ${s}. What’s been happening?`,
  (s) => `Sounds like you’re feeling ${s}. Can you tell me more?`,
];
const SAME_GOOD: ((s: string) => string)[] = [
  (s) => `Feeling ${s}? I love that! What’s going on?`,
  (s) => `Oh, ${s}! That makes me happy. What’s been going well?`,
];

// Index 0 is always her first way, saying their word back ("Baaad? What do you
// mean by bad?"); the rest mix that with a word that means the same.
export const oneWordLine = (o: OneWord, rand: () => number = Math.random) => {
  const good = o.key && !isHardFeeling(o.key);
  const same = SAME[o.word] ?? [];
  const lines: ((w: string) => string)[] = [
    ...(good ? ONE_GOOD : ONE_HARD),
    ...(same.length ? (good ? SAME_GOOD : SAME_HARD).map((f) => (_: string) => f(same[Math.floor(rand() * same.length)])) : []),
  ];
  return lines[Math.floor(rand() * lines.length)](o.word);
};
