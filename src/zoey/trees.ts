// Yes/no decision trees for the check-in (Layer 2, build plan sec. 04: "conversation
// graphs authored as versioned JSON ... signed off before publication"). Every
// question can be answered with a tap. All the wording lives here so a
// clinician can review it in one place; the check-in screen only walks it.
//
// How a node works:
//   say      what Zoey says. {coord}, {sponsor} and {name} are filled in.
//   alts     other ways to say the same thing; Zoey picks one at random so she
//            doesn't sound like a script (Ed, 2026-10-24). Same meaning, same buttons.
//   clarify  how Zoey rephrases the question after "what do you mean?" / "huh?".
//   why      why Zoey is asking, after "why?" (Ed, 2026-10-24: never answer a
//            "why" or a "what do you mean" as if it were an answer). Both end
//            by asking again; without them Zoey says sorry and asks again.
//   none     on a share node: where "no", "nothing" or "I don't know" goes.
//   topics   buttons that start another tree (`tree`) or jump to a node here (`node`).
//   yes/no   the node is a Yes / No question; each points at the next node.
//   notSure  adds an "I'm not sure" button (otherwise it follows `no`).
//   share    asks them to type something (or tap "I'd rather not"), then goes on.
//   offer    buttons that do something (call, breathing...), then go to `next`.
//   next     a plain statement that moves straight on.
//   typed    on a yes/no node: where to go if they type something that isn't
//            a yes or a no (for "Can you tell me more?", typing IS telling more).
//   tags     tags added to today's mood when this node is reached.
//   save     saves this line to "Saved for my team" (for the next appointment).
//   saveShared  on a share node: what they type is saved for the next appointment.
//   safety   reaching this node raises the same help as typing danger words.
// 'END' finishes the tree and the check-in carries on.
//
// Typed answers still go through the safety screen first, every time.

export const TREES_VERSION = 'checkin-trees@0.1-draft';

export type TreeAction =
  | 'callCoordinator'
  | 'callSponsor'
  | 'textSponsor'
  | 'breathing'
  | 'findMeeting'
  | 'localHelp'
  | 'call211'
  | 'openLifeCircle'
  | 'callCounselor';

export type Offer = { action: TreeAction; label: string };
export type Topic = { label: string; tree?: string; node?: string };

export type TreeNode = {
  say: string;
  alts?: string[];
  clarify?: string;
  why?: string;
  none?: string;
  topics?: Topic[];
  yes?: string;
  no?: string;
  notSure?: string;
  share?: string; // next node after they share (or skip)
  offer?: Offer[];
  next?: string;
  typed?: string;
  tags?: string[];
  save?: string;
  saveShared?: boolean;
  safety?: 'abuse' | 'housing' | 'withdrawal';
  // Where a typed plan to stay away from people goes ("I'm just not going to talk to them").
  avoid?: string;
};

// `entries`: other nodes a screen may start at (e.g. after "I'm sad because...").
export type Tree = { id: string; title: string; start: string; entries?: string[]; nodes: Record<string, TreeNode> };

export const END = 'END';

const reachOut: Offer[] = [
  { action: 'callSponsor', label: 'Call {sponsor}' },
  { action: 'callCoordinator', label: 'Call {coord}' },
];

// "No" to "Can you tell me more?" (Ed, 2026-10-27): gently ask why, then "I hope you
// don't shut down your feelings", with their LifeCircle and counselor a tap away.
// `share`: where telling more goes on to; `skip`: where it goes when they still don't.
const declineNodes = (share: string, skip: string): Record<string, TreeNode> => ({
  whyNo: {
    say: 'That’s okay. Can I ask what’s making you not want to talk about it?',
    alts: [
      'Okay, that’s alright. Can I ask why you’d rather not talk about it?',
      'I hear you. Is something making it hard to talk about right now?',
      'That’s fair. Can I ask what’s holding you back from talking about it?',
    ],
    clarify: 'I mean: is there a reason you don’t want to talk about it, like it’s too much right now, or you’re not sure I can help?',
    why: 'I’m not trying to push. Sometimes knowing why helps me support you better. What’s making you not want to talk about it?',
    share: 'whyNoHeard',
    none: 'openUp',
  },
  whyNoHeard: {
    say: 'That makes sense. Thank you for being honest with me.',
    alts: ['I get that. I appreciate you explaining.', 'That’s really understandable. I appreciate you sharing that.'],
    next: 'openUp',
  },
  openUp: {
    say: 'I hope you don’t shut down your feelings. Please tell me more, or reach out to someone in your LifeCircle or your counselor.',
    alts: [
      'I just don’t want you to bottle it up. You can tell me more any time, or reach out to someone in your LifeCircle or your counselor.',
      'Your feelings matter, and holding them in can make them heavier. Tell me more whenever you’re ready, or talk to someone in your LifeCircle or your counselor.',
      'Please don’t keep it all inside. I’m here if you want to tell me more, and so are your LifeCircle and your counselor.',
    ],
    offer: [
      { action: 'openLifeCircle', label: 'Open my LifeCircle' },
      { action: 'callCounselor', label: 'Call my counselor' },
    ],
    share,
    next: skip,
  },
});

// Mood was Sad or Very Sad. Ed's example: do you know why? If yes, share it.
// If no, a few quick yes/no questions to help find it.
const feelingBad: Tree = {
  id: 'feeling-bad',
  title: 'Feeling bad',
  start: 'know',
  nodes: {
    know: { say: 'Do you know why you’re feeling bad?', yes: 'share', no: 'help', notSure: 'help' },
    share: { say: 'Would you share what’s going on? A few words is fine.', share: 'thanks', none: 'whyNo' },
    thanks: {
      say: 'That’s a lot to carry. Thank you for telling me. I saved it with today’s check-in, so it’s there when you talk with your team.',
      alts: ['I hear you. That’s saved with today’s check-in.', 'That makes sense, and I’m glad it’s out of your head and written down. It’s saved with today’s check-in.'],
      next: END,
    },
    help: { say: 'That’s okay. Sometimes it’s hard to tell. Can I ask a few quick yes or no questions?', yes: 'sleep', no: 'skip' },
    skip: { say: 'Okay. You can always tell me later.', alts: ['No pressure. I’m here whenever you want to talk.'], next: END },
    sleep: { say: 'Did you sleep okay last night?', alts: ['Did you sleep alright last night?', 'Did you get some decent sleep last night?'], yes: 'craving', no: 'sleepNo' },
    sleepNo: { say: 'Oh, I’m sorry. Bad sleep makes everything feel heavier.', alts: ['Rough night. That makes the day harder.'], tags: ['Sleep'], next: 'craving' },
    craving: { say: 'Have you had any cravings today?', alts: ['Any cravings today?', 'Have cravings been bugging you today?'], yes: 'cravingYes', no: 'alone' },
    cravingYes: {
      say: 'That took guts to say. I’m proud of you for being honest.',
      alts: ['Being honest about cravings is how you get ahead of them.', 'Cravings are real, and you’re not weak for having them.'],
      tags: ['Cravings'],
      next: 'alone',
    },
    alone: { say: 'Have you been feeling alone?', alts: ['Have you been feeling lonely?', 'Has it felt like you’re on your own lately?'], yes: 'aloneYes', no: 'worry' },
    aloneYes: { say: 'Aw, feeling alone is so hard. I’m glad you’re talking to me.', alts: ['That’s a hard one. You’re not as alone as it feels.'], tags: ['Feeling alone'], next: 'worry' },
    worry: { say: 'Is something stressing you, like money, housing, work or someone in your life?', alts: ['Is anything weighing on you, like money, housing, work or someone in your life?', 'Is something on your mind, like money, housing, work or a person in your life?'], yes: 'worryYes', no: 'none' },
    worryYes: { say: 'Do you want to tell me a little about it?', alts: ['Want to tell me a bit about it?', 'Would you like to talk about it a little?'], share: 'thanks', none: 'whyNo' },
    none: {
      say: 'Some days are just hard, and you don’t always need a reason. That’s okay.',
      alts: ['Sometimes a bad day is just a bad day. You still showed up and checked in, and that counts.'],
      next: END,
    },
    ...declineNodes('thanks', END),
  },
};

const sleep: Tree = {
  id: 'Sleep',
  title: 'Sleep',
  start: 'nights',
  nodes: {
    nights: { say: 'Has sleep been hard for more than a few nights?', yes: 'tell', no: 'try' },
    tell: {
      say: 'That’s worth bringing up with {coord} or your doctor. Want me to save it for your next appointment?',
      yes: 'saved',
      no: 'try',
    },
    saved: { say: 'Saved for your next appointment.', save: 'Sleep has been hard for more than a few nights.', next: 'try' },
    try: { say: 'Would you like a breathing exercise that can help you fall asleep tonight?', yes: 'show', no: END },
    show: { say: 'Here it is. Try it in bed tonight.', offer: [{ action: 'breathing', label: 'Show me' }], next: END },
  },
};

const cravings: Tree = {
  id: 'Cravings',
  title: 'Cravings',
  start: 'now',
  nodes: {
    now: { say: 'Are you having a craving right now?', yes: 'safePlace', no: 'passed' },
    safePlace: { say: 'Are you somewhere you feel safe from using?', yes: 'talk', no: 'move', notSure: 'move' },
    move: { say: 'Can you get to a safer place, like a meeting or a friend’s?', yes: 'go', no: 'callNow' },
    go: { say: 'Go now if you can. Want to call someone on the way?', offer: reachOut, next: END },
    callNow: {
      say: 'Please call {sponsor} or {coord} now. You don’t have to get through this alone.',
      offer: reachOut,
      next: END,
    },
    talk: { say: 'Good. Would it help to talk to someone right now?', yes: 'talkYes', no: 'wait' },
    talkYes: { say: 'Who would you like to call?', offer: reachOut, next: END },
    wait: {
      say: 'Okay. Cravings pass. Waiting 20 minutes, drinking water, or getting out for a walk can help. Want to find a meeting today?',
      yes: 'meeting',
      no: END,
    },
    meeting: { say: 'Here are meetings you can get to.', alts: ['Here are some meetings near you.', 'Here are a few meetings you could get to.'], offer: [{ action: 'findMeeting', label: 'Find a meeting' }], next: END },
    passed: { say: 'Glad it’s not strong right now. Do you know what set it off?', yes: 'trigger', no: END },
    trigger: { say: 'What was it? Knowing your triggers helps you and {sponsor} plan.', share: 'noted' },
    noted: {
      say: 'That’s really good to know. Spotting your triggers is half the battle, and I saved it with today’s check-in.',
      alts: ['That’s useful to know. It’s saved with today’s check-in, so you and {sponsor} can plan around it.'],
      next: END,
    },
  },
};

// "I wanted to use", "I'm craving": thank them, ask what's behind it, then help ride
// it out (Ed, 2026-10-27: "say something like thanks for telling me that is important,
// what is going on that makes you want to use"). A deliberate exception to "no thanks
// after danger words": wanting to use is a disclosure to welcome. "I used", using
// alone or an overdose still go to the urgent help first (safety.ts).
const urge: Tree = {
  id: 'urge',
  title: 'Wanting to use',
  start: 'ask',
  nodes: {
    ask: {
      say: 'Thanks for telling me, that’s important. What’s going on that makes you want to use?',
      alts: [
        'Thank you for telling me. That’s really important. What’s going on that’s making you want to use?',
        'I’m glad you told me, that matters. What’s happening right now that makes you want to use?',
        'Thanks for being honest with me, that’s important. What’s going on that has you wanting to use?',
      ],
      clarify: 'I’m asking what’s behind the urge, like a feeling, a person, a place or something that happened. Knowing that helps us get through it.',
      why: 'Cravings usually have a trigger. Knowing yours helps you get ahead of it next time.',
      share: 'wave',
    },
    wave: {
      say: 'That makes sense, and you don’t have to fight it alone. Cravings rise and fall like a wave, and most pass in 20 to 30 minutes. Want to try riding it out with a breathing exercise?',
      alts: [
        'Thank you for sharing that. Urges are strong, but they pass, usually within 20 to 30 minutes. Would a breathing exercise help you ride it out?',
        'That’s a lot, and it makes sense you’d feel the pull. The urge will peak and then fade, often in 20 to 30 minutes. Want to breathe through it with me?',
      ],
      tags: ['Cravings'],
      yes: 'breathe',
      no: 'reach',
    },
    breathe: { say: 'Here it is. Breathe along until the wave passes.', offer: [{ action: 'breathing', label: 'Breathe with me' }], next: 'reach' },
    reach: { say: 'Would it help to call your sponsor or someone in your LifeCircle right now?', yes: 'who', no: 'meeting' },
    who: { say: 'Who would you like to reach?', alts: ['Who would you like to talk to?', 'Who should we reach out to?'], offer: [...reachOut, { action: 'openLifeCircle', label: 'Open LifeCircle' }], next: END },
    meeting: { say: 'Could you get to a meeting today? Being around people in recovery really helps.', yes: 'find', no: 'stay' },
    find: { say: 'Here are meetings you can get to.', alts: ['Here are some meetings near you.', 'Here are a few meetings you could get to.'], offer: [{ action: 'findMeeting', label: 'Find a meeting' }], next: END },
    stay: {
      say: 'Okay. I’m right here if it gets stronger. Telling me was the right move, and you can get through this.',
      alts: ['That’s okay. I’m here if the urge gets stronger. You did the right thing by saying it out loud.'],
      next: END,
    },
  },
};

// "I hate my family", "I can't stand my roommate" (Ed, 2026-10-27: "Oh no, why do you
// feel that way"). Also their answer to her
// "what do you mean?". "I hate my life" or "I hate myself" go to the safety screen
// and self-worth first.
// "I don't want to talk about it" out of the blue (Ed, 2026-10-27): ask gently why,
// then "I hope you don't shut down your feelings".
const noTalk: Tree = {
  id: 'noTalk',
  title: 'Not wanting to talk',
  start: 'whyNo',
  nodes: {
    ...declineNodes('heard', END),
    heard: {
      say: 'I’m really glad you shared that. It sounds like a lot to hold.',
      alts: ['I’m really glad you told me. That’s a lot to carry.', 'I appreciate you opening up. I’m here with you.'],
      next: END,
    },
  },
};

// A plan to avoid people ("not talk to them", "ignore them"): "Do you think that's
// a good long-term plan?" (Ed, 2026-10-27), then kindly on either way.
// `then`: a node of the tree to carry on to (like "reach"); without it she offers to reach out herself.
const avoidNodes = (then?: string): Record<string, TreeNode> => ({
  avoid: {
    say: 'Do you think that’s a good long-term plan?',
    alts: ['Hmm. Do you think that’ll work in the long run?', 'I get wanting some space. Do you think that’s a good plan for the long run?', 'Do you think that’s something that will help in the long run?'],
    clarify: 'I mean: staying away from them might help today, but do you think it will work over time?',
    why: 'Sometimes stepping back helps for a while, but not talking can also keep things stuck. I want to help you think it through. Do you think it’s a good long-term plan?',
    yes: 'avoidYes',
    no: 'avoidNo',
    notSure: 'avoidNo',
  },
  avoidYes: then
    ? { say: 'Okay. Sometimes a little space really does help.', alts: ['Fair enough. Taking some space can be healthy.'], next: then }
    : {
        say: 'Okay. Sometimes a little space really does help. If it starts to weigh on you, talking it through with {sponsor} or {coord} could help too.',
        alts: ['Fair enough. Taking some space can be healthy. If it gets heavy, {sponsor} and {coord} are always there to talk it through.'],
        next: END,
      },
  avoidNo: {
    say: 'That’s really honest of you. What do you think might help in the long run?',
    alts: ['I appreciate you being real about it. What do you think could help over time?', 'That takes honesty. What might help things get better down the road?'],
    share: 'avoidThink',
    none: then ?? 'avoidHelp',
  },
  avoidThink: {
    say: 'That sounds like a healthier way forward. I’m proud of you for thinking it through.',
    alts: ['I like that. It sounds like a good step, and you thought it through.', 'That sounds really wise. Small steps like that can make a big difference.'],
    next: then ?? END,
  },
  ...(then
    ? {}
    : {
        avoidHelp: {
          say: 'That’s okay. It can help to talk it over with someone you trust, like {sponsor} or {coord}. Want to reach out?',
          alts: ['No problem. Someone who knows you, like {sponsor} or {coord}, could help you figure it out. Want to reach out?'],
          offer: reachOut,
          next: END,
        },
      }),
});

const big: Tree = {
  id: 'big',
  title: 'Something big',
  start: 'ask',
  nodes: {
    ask: {
      // Ed, 2026-10-27: "say something like 'Oh no, why do you feel that way'".
      // "Ohhh" is stretched so she draws the word out when she says it (Ed, 2026-10-27).
      say: 'Ohhh no, why do you feel that way?',
      alts: [
        'Ohhh no. Why do you feel that way?',
        'Ohhh no, what’s making you feel that way?',
        'Ohhh no. Can you tell me why you feel that way?',
      ],
      clarify: 'I mean: what’s happened that makes you feel this way? A few words is fine.',
      why: 'Big feelings usually have a story behind them, and talking it through can make it lighter. What makes you feel that way?',
      share: 'heard',
      none: 'whyNo',
      avoid: 'avoid',
    },
    heard: {
      say: 'That sounds really hard. It makes sense you’d feel that way.',
      alts: ['That’s a lot to deal with. No wonder you feel that way.', 'I’m sorry. That would be hard for anyone.'],
      next: 'reach',
    },
    reach: {
      say: 'Would it help to talk it through with someone you trust, like your sponsor or {coord}?',
      alts: ['It can help to talk this through with someone who knows you. Want to reach out?'],
      offer: reachOut,
      next: END,
    },
    ...avoidNodes('reach'),
    ...declineNodes('heard', 'reach'),
  },
};

const alone: Tree = {
  id: 'Feeling alone',
  title: 'Feeling alone',
  start: 'reach',
  nodes: {
    reach: { say: 'Would it help to reach out to someone today?', yes: 'who', no: 'meeting' },
    who: {
      say: 'Who would you like to reach?', alts: ['Who would you like to talk to?', 'Who should we reach out to?'],
      offer: [...reachOut, { action: 'textSponsor', label: 'Text {sponsor}' }],
      next: END,
    },
    meeting: { say: 'Okay. Could you get to a meeting this week? Being around people can help.', yes: 'find', no: END },
    find: { say: 'Here are meetings you can get to.', alts: ['Here are some meetings near you.', 'Here are a few meetings you could get to.'], offer: [{ action: 'findMeeting', label: 'Find a meeting' }], next: END },
  },
};

const housing: Tree = {
  id: 'Housing',
  title: 'Housing',
  start: 'tonight',
  nodes: {
    tonight: { say: 'Do you have a safe place to sleep tonight?', yes: 'risk', no: 'noPlace', notSure: 'noPlace' },
    noPlace: { say: '', safety: 'housing', next: END },
    risk: { say: 'Is that place at risk, like an eviction notice or being asked to leave?', yes: 'atRisk', no: 'noted' },
    atRisk: {
      say: 'There’s free legal help for evictions, and {coord} can help too. The sooner the better.',
      offer: [
        { action: 'callCoordinator', label: 'Call {coord}' },
        { action: 'localHelp', label: 'Eviction help' },
      ],
      next: END,
    },
    noted: {
      say: 'Okay. I saved it so you and {coord} can talk it through. You don’t have to figure it out alone.',
      alts: ['Glad you have a place for now. I saved it so you and {coord} can talk it through.'],
      next: END,
    },
  },
};

const money: Tree = {
  id: 'Money',
  title: 'Money',
  start: 'week',
  nodes: {
    week: { say: 'Is there rent, food or a bill you can’t cover this week?', yes: 'help', no: 'noted' },
    help: {
      say: '211 can help with rent, food and bills, and {coord} can help you apply for help.',
      offer: [
        { action: 'call211', label: 'Call 211' },
        { action: 'callCoordinator', label: 'Call {coord}' },
      ],
      next: END,
    },
    noted: {
      say: 'Okay. I saved it so you and {coord} can talk it through. You don’t have to figure it out alone.',
      alts: ['Money stress wears on you. I saved it so you and {coord} can look at it together.'],
      next: END,
    },
  },
};

const people: Tree = {
  id: 'People',
  title: 'People',
  start: 'safe',
  nodes: {
    safe: { say: 'Do you feel safe with the people around you?', yes: 'talk', no: 'unsafe', notSure: 'unsafe' },
    unsafe: { say: '', safety: 'abuse', next: END },
    talk: { say: 'Would it help to talk it through with someone?', alts: ['Would talking it over with someone help?', 'Do you think it would help to talk to someone about it?'], yes: 'who', no: 'noted' },
    who: { say: 'Who would you like to reach?', alts: ['Who would you like to talk to?', 'Who should we reach out to?'], offer: reachOut, next: END },
    noted: { say: 'Okay. I’m here if you want to talk about it more.', alts: ['People can be the hardest part. I’m sorry you’re dealing with that.'], next: END },
  },
};

const meds: Tree = {
  id: 'Meds',
  title: 'Meds',
  start: 'stopped',
  nodes: {
    stopped: { say: 'Have you stopped taking any of your medicines?', yes: 'stoppedYes', no: 'question' },
    stoppedYes: {
      say: 'I’m glad you told me. Stopping some medicines suddenly can make you sick, so please talk to {coord} or your prescriber today.',
      offer: [{ action: 'callCoordinator', label: 'Call {coord}' }],
      next: END,
    },
    question: { say: 'Is there something you want to ask your prescriber?', yes: 'ask', no: 'noted' },
    ask: { say: 'What would you like to ask? I’ll save it for your next appointment.', share: 'saved', saveShared: true },
    saved: { say: 'Saved for your next appointment.', next: END },
    noted: { say: 'Sounds good. Thanks for keeping up with your meds.', alts: ['Okay, good. Thanks for letting me know.'], next: END },
  },
};

const work: Tree = {
  id: 'Work or school',
  title: 'Work or school',
  start: 'talk',
  nodes: {
    talk: { say: 'Would it help to talk it through with someone?', alts: ['Would talking it over with someone help?', 'Do you think it would help to talk to someone about it?'], yes: 'who', no: 'noted' },
    who: { say: 'Who would you like to reach?', alts: ['Who would you like to talk to?', 'Who should we reach out to?'], offer: reachOut, next: END },
    noted: { say: 'That’s a lot to juggle. Be gentle with yourself today.', alts: ['Work and school stress adds up. Take it one thing at a time.'], next: END },
  },
};

// Morning meds answered "Not yet".
const medsNotYet: Tree = {
  id: 'meds-not-yet',
  title: 'Morning meds',
  start: 'have',
  nodes: {
    have: { say: 'Do you have them with you?', yes: 'take', no: 'getting' },
    take: { say: 'Could you take them now? I’ll wait.', yes: 'done', no: 'later' },
    done: { say: 'Nice work. That’s one thing done for today.', alts: ['Great. Taking care of yourself counts.'], next: END },
    later: { say: 'Okay. Try to take them when you can.', alts: ['No problem. Maybe set a reminder so you don’t forget?'], next: END },
    getting: { say: 'Is something getting in the way of getting them, like a refill or a ride?', yes: 'block', no: 'later' },
    block: {
      say: '{coord} can help with refills and rides.',
      offer: [{ action: 'callCoordinator', label: 'Call {coord}' }],
      next: END,
    },
  },
};

// Mood was Happy or Very Happy.
const goingWell: Tree = {
  id: 'going-well',
  title: 'Going well',
  start: 'remember',
  nodes: {
    remember: { say: 'Is there something good from today you want to remember?', yes: 'share', no: END },
    share: { say: 'What was it?', share: 'saved' },
    saved: { say: 'I love that. I saved it on your LifePath so you can look back on it.', next: END },
  },
};

// Evening check-ins, when no meeting is logged this week.
const meetings: Tree = {
  id: 'meetings',
  title: 'Meetings',
  start: 'week',
  nodes: {
    week: { say: 'Have you been to a meeting this week?', yes: 'good', no: 'find' },
    good: { say: 'Nice. Want to log it on your calendar?', yes: 'log', no: END },
    log: { say: 'Here’s your meeting list.', offer: [{ action: 'findMeeting', label: 'Open meetings' }], next: END },
    find: { say: 'Would you like to find one for tomorrow?', yes: 'log', no: END },
  },
};

// Typed feelings ("I'm sad", "I feel proud"), in AskZoey and the check-in.
// Ed (2026-10-24): for a hard feeling, start with "I'm sorry to hear that. Can
// you tell me more?", then "Okay, what is your plan?". Every question is a yes
// or no with its own reply, and the replies stay positive. If they can't say
// more, the quick questions from feeling-bad help find it, then the plan.
export type FeelingKey =
  | 'sad' | 'angry' | 'frustrated' | 'anxious' | 'scared' | 'lonely' | 'stressed'
  | 'numb' | 'guilty' | 'ashamed' | 'tired' | 'bored'
  | 'happy' | 'proud' | 'grateful' | 'excited' | 'hopeful' | 'calm';

const breathe: Offer[] = [{ action: 'breathing', label: 'Try breathing' }];

// What comes when they don't have a plan yet, by feeling. `say` leads to the offer buttons.
const FEELING_AFTER: Partial<Record<FeelingKey, TreeNode>> = {
  sad: { say: 'I’m sorry you’re feeling sad. Talking to someone you trust can really help. Want to reach out?', offer: reachOut },
  lonely: { say: 'Feeling lonely is so hard. Even a short call or text can help. Want to reach out to someone?', offer: reachOut },
  angry: { say: 'It’s okay to feel angry. A few slow breaths can help before you act on it. Want to try with me?', offer: breathe },
  frustrated: { say: 'That’s frustrating. A few slow breaths can take the edge off. Want to try with me?', offer: breathe },
  anxious: { say: 'I’m here. Breathing slowly for a minute can help calm your body. Want to try it with me?', offer: breathe },
  scared: { say: 'I’m right here with you. Slow breathing can help when you feel scared. Want to try it, or talk to someone?', offer: [...breathe, ...reachOut] },
  stressed: { say: 'That sounds like a lot. A minute of slow breathing can help. Want to try it with me?', offer: breathe },
  numb: { say: 'Feeling numb can mean you’re carrying a lot right now. Talking to someone can help. Want to reach out?', offer: reachOut },
  guilty: { say: 'Guilt is so common in recovery, and it’s heavy. Talking it through with someone can help. Want to reach out?', offer: reachOut },
  ashamed: { say: 'Shame is common in recovery, and you’re not alone in it. Want to talk to someone?', offer: reachOut },
  bored: { say: 'Boredom can sneak up on you as a trigger. A meeting or a call might help. Want to find one?', offer: [{ action: 'findMeeting', label: 'Find a meeting' }, ...reachOut] },
};

const HARD: FeelingKey[] = ['sad', 'angry', 'frustrated', 'anxious', 'scared', 'lonely', 'stressed', 'numb', 'guilty', 'ashamed', 'tired', 'bored'];

export const isHardFeeling = (k: FeelingKey) => HARD.includes(k);

// "Okay, what is your plan?" Shared by the hard feelings and feeling sick.
// `close` is the warm line after they share a plan; `none` is where "no plan yet" goes.
// `avoid`: listen for a plan to stay away from people (not for feeling sick).
const planNodes = (close: string[], none: string, avoid = true): Record<string, TreeNode> => ({
  plan: {
    say: 'Okay. Do you have a plan for what you’ll do next?',
    alts: [
      'That’s heavy. Do you have a plan for what comes next?',
      'That sounds hard. Have you thought about a plan for getting through today?',
      'I hear you. Do you have an idea of what you want to do next?',
    ],
    clarify: 'I mean: do you have an idea of what you’ll do next to take care of yourself, like calling someone, going to a meeting, or resting? Yes or no is fine.',
    why: 'Even a small plan can make a hard time easier to get through, and it helps me know how to support you. Do you have a plan for what’s next?',
    yes: 'planTell',
    no: 'planNo',
    typed: 'planGood',
    ...(avoid ? { avoid: 'avoid' } : {}),
  },
  planTell: {
    say: 'Great! What is your plan?',
    alts: ['That’s great. Tell me about your plan.', 'Good for you. What are you thinking of doing?'],
    clarify: 'What will you do next? It can be something small, like calling your sponsor or taking a walk.',
    why: 'Saying a plan out loud makes it more likely to happen. What’s your plan?',
    share: 'planGood',
    none: 'planNo',
    ...(avoid ? { avoid: 'avoid' } : {}),
  },
  planGood: { say: close[0], alts: close.slice(1), next: END },
  planNo: {
    say: 'That’s okay. We can start one together. Small steps count.',
    alts: [
      'That’s okay, you don’t have to have it all figured out. Let’s take one small step together.',
      'No problem. A plan can be one small thing, and we can find it together.',
    ],
    next: none,
  },
  ...(avoid ? avoidNodes() : {}),
});

// Bored and tired aren't "really hard" (Ed, 2026-10-25: replies that fit what they said).
const HEARD: Partial<Record<FeelingKey, TreeNode>> = {
  bored: { say: 'Boredom is tough, and it can sneak up on you as a trigger.', alts: ['Bored days can be harder than they sound.'], next: 'plan' },
  tired: { say: 'Being worn out makes everything feel harder.', alts: ['That sounds exhausting. No wonder you’re tired.'], next: 'plan' },
};

function feelingTree(k: FeelingKey): Tree {
  const id = `feeling:${k}`;
  if (!isHardFeeling(k)) {
    return {
      id,
      title: `Feeling ${k}`,
      start: 'know',
      entries: ['glad'],
      nodes: {
        // When they already said what it is ("I got the job and I'm so happy").
        glad: {
          say: 'That’s wonderful! It’s good to notice what helps, so you can come back to it.',
          alts: ['I love hearing that! Hold on to that feeling.', 'That’s really great news. I’m so glad for you!', 'Yes! That made my day. Enjoy it.'],
          next: END,
        },
        know: {
          say: `That’s great to hear! Do you know what’s making you feel ${k}?`,
          alts: [`I’m so glad! Do you know what’s helping you feel ${k}?`, `That’s wonderful. Do you know what’s making you feel ${k} today?`],
          clarify: `I mean: do you know what’s helping you feel ${k}? Yes or no is fine.`,
          why: 'Noticing what helps you feel good means you can come back to it on harder days. Do you know what it is?', yes: 'share', no: 'notice', notSure: 'notice', typed: 'thanks' },
        share: { say: 'What is it? I’d love to hear.', alts: ['Ooh, tell me!', 'What is it? I want to hear the good stuff.'], share: 'thanks' },
        thanks: {
          say: 'I love that. It’s good to notice what helps, so you can come back to it.',
          alts: ['That’s awesome. Remember that one on harder days.', 'That’s really good to hear. Hold on to it.'],
          next: END,
        },
        notice: { say: 'That’s okay. It’s still good to notice. Enjoy it.', alts: ['No need to know why. Just enjoy it.'], next: END },
      },
    };
  }
  const after = FEELING_AFTER[k];
  const end = after ? 'after' : 'reach';
  // Anger (Ed, 2026-10-24): don't judge, ask caringly what happened.
  const angry = k === 'angry' || k === 'frustrated';
  // The quick questions (sleep, cravings, alone, worry) come from feeling-bad.
  const { know: _k, share: _s, thanks: _t, skip: _sk, whyNo: _w, whyNoHeard: _wh, openUp: _o, ...quick } = feelingBad.nodes;
  return {
    id,
    title: `Feeling ${k}`,
    start: 'more',
    entries: ['heard'],
    nodes: {
      ...quick,
      more: angry
        ? {
            say: 'I can hear that you’re upset, and that’s okay. What happened?',
            alts: [
              'That sounds really frustrating. Do you want to tell me what happened?',
              'Being angry makes sense sometimes. What’s got you feeling this way?',
              'I’m not here to judge. What happened that got you so worked up?',
              'Ugh, that sounds rough. What’s going on?',
            ],
            clarify: 'I mean: what happened, or who or what made you feel this way?',
            why: 'Anger usually has a reason behind it, and talking it out can take some of the heat off. What happened?',
            share: 'plan',
            none: 'help',
          }
        : {
            say: 'I’m sorry to hear that. Can you tell me more?',
            alts: [
              'I’m really sorry you’re feeling this way. Can you tell me more about it?',
              'That sounds hard, and I’m glad you told me. Would you tell me a little more?',
              'I’m sorry. You don’t have to go through it alone. Can you tell me more?',
            ],
            clarify: 'I mean: would you like to tell me what’s going on, or what’s making you feel this way? You can tap Yes or No, or just tell me.',
            why: 'Talking about it can make it feel a little lighter, and it helps me point you to the right support. Would you like to tell me more?',
            yes: 'share',
            no: 'whyNo',
            notSure: 'help',
            typed: 'plan',
          },
      // Anger's "What happened?" is itself the place to share.
      ...(angry ? {} : {
      share: {
        say: 'I’m listening. What’s going on?',
        alts: ['Take your time. I’m here. What’s been going on?', 'I’m right here with you. What’s happening?'],
        clarify: 'Just tell me in your own words what’s been happening. A few words is fine.',
        why: 'Putting it into words can help, and I want to understand so I can help. What’s going on?',
        share: 'plan',
        none: 'whyNo',
      },
      }),
      // When they already said why ("I'm sad because..."), Zoey starts here.
      heard: HEARD[k] ?? {
        say: 'I’m sorry. That sounds really hard.',
        alts: ['Ohhh, that’s rough. I’m sorry you’re going through it.', 'I’m so sorry you’re dealing with that.', 'That’s a lot. No wonder you feel this way.'],
        next: 'plan',
      },
      help: {
        say: 'That’s okay. Sometimes it’s hard to put into words. Can I ask a few quick yes or no questions?', alts: ['That’s alright. It’s not always easy to put into words. Can I ask a few quick yes or no questions?', 'No worries. Feelings can be hard to name. Is it okay if I ask a few quick yes or no questions?'],
        clarify: 'I mean: can I ask you a few short questions, like how you slept? You can answer each with yes or no.',
        why: 'Sometimes a few simple questions help find what’s behind a feeling. Can I ask a few?',
        yes: 'sleep',
        no: 'plan',
      },
      worryYes: { say: 'Do you want to tell me a little about it?', alts: ['Want to tell me a bit about it?', 'Would you like to talk about it a little?'], share: 'plan', none: 'whyNo' },
      none: {
        say: 'Some days are just hard, and you don’t always need a reason. That’s okay.',
        alts: ['Sometimes a bad day is just a bad day. You still showed up, and that counts.'],
        next: 'plan',
      },
      ...planNodes(
        [
          'That sounds like a good plan. You’re taking care of yourself, and that matters. I’m proud of you for reaching out.',
          'I like that plan. Reaching out today was a strong step, and you should be proud of it.',
          'That’s a good plan. You’re doing the work, one step at a time, and it shows.',
        ],
        end,
      ),
      ...declineNodes('plan', 'plan'),
      ...(after
        ? { after: { ...after, next: END } }
        : { reach: { say: 'Rest can help, and so can talking to someone. Want to reach out?', offer: reachOut, next: END } }),
    },
  };
}

// "I'm sick", "I have the flu". Ed (2026-10-24): ask if they've talked to their
// doctor; yes -> what did they say, then a plan; no -> encourage the doctor or
// coordinator. No medical advice: Zoey only points to their doctor and team.
// Feeling sick after using, withdrawal and chest pain are caught by the safety
// screen before this ever runs.
const sick: Tree = {
  id: 'sick',
  title: 'Feeling sick',
  start: 'doctor',
  nodes: {
    doctor: {
      say: 'I’m sorry to hear that. Have you talked to your doctor about it?',
      alts: [
        'Ohhh no, I’m sorry you’re not feeling well. Have you been able to talk to your doctor?',
        'I’m sorry you’re sick. That’s no fun. Have you talked to your doctor about it yet?',
      ],
      clarify: 'I mean: have you told a doctor or nurse that you’re not feeling well?',
      why: 'Your doctor knows your health best, so they’re the right person to help you feel better. Have you talked to them?',
      yes: 'said',
      no: 'call',
      notSure: 'call',
    },
    said: {
      say: 'Good, I’m glad you did. What did they say?',
      alts: ['That’s great that you reached out. What did your doctor say?', 'Good for you for checking in with them. What did they tell you?'],
      clarify: 'What did your doctor tell you to do, or what did they think it was?',
      why: 'Knowing what your doctor said helps me help you stick with it. What did they say?',
      share: 'plan',
    },
    ...planNodes(
      [
        'That sounds like a good plan. Be gentle with yourself, and I hope you feel better soon.',
        'Good plan. Take care of yourself, and I hope you’re feeling better soon.',
      ],
      'planHelp',
      false,
    ),
    planHelp: {
      say: 'Following what your doctor said is a great first step. {coord} can help too, like with a ride or a refill. Want to call?',
      offer: [{ action: 'callCoordinator', label: 'Call {coord}' }],
      next: 'worse',
    },
    call: {
      say: 'It’s a good idea to let your doctor know, and {coord} can help you set up a visit. Would you like to call {coord} now?',
      clarify: 'I mean: would you like to call {coord} now, to help you set up a doctor visit?',
      why: '{coord} can help with things like appointments and rides, so you don’t have to sort it out alone. Want to call now?',
      yes: 'callNow',
      no: 'later',
    },
    callNow: { say: 'Great. Tap below to call.', offer: [{ action: 'callCoordinator', label: 'Call {coord}' }], next: 'worse' },
    later: {
      say: 'Okay. Want me to save it so you remember to bring it up with your doctor?',
      clarify: 'I mean: should I save a note for your next appointment that you’ve been feeling sick?',
      why: 'So it doesn’t slip your mind next time you see your doctor. Want me to save it?',
      yes: 'saved',
      no: 'worse',
    },
    saved: { say: 'Saved for your next appointment.', save: 'I’ve been feeling sick.', next: 'worse' },
    worse: {
      say: 'I hope you feel better soon. If it gets worse fast, or you have trouble breathing or chest pain, call 911.',
      alts: ['Feel better soon. I’m here if you need me. If it gets worse fast, or you have trouble breathing or chest pain, call 911.'],
      next: END,
    },
  },
};

// "Help", "I need help" (Ed, 2026-10-24): ask warmly what they need help
// with, so Zoey can actually help. The buttons start the tree that fits;
// anything they type instead goes through the safety screen and the answer
// library like any other message. Danger words in the same message ("help, I
// want to die") never get here: the safety screen runs first.
const help: Tree = {
  id: 'help',
  title: 'Asking for help',
  start: 'ask',
  nodes: {
    ask: {
      say: 'I’m here for you, and I want to help. What do you need help with?',
      alts: [
        'Of course. I’m glad you reached out. What do you need help with right now?',
        'I’m right here. Tell me what’s going on, and we’ll figure it out together. What do you need help with?',
        'You don’t have to handle this alone. What can I help you with?',
        'Thank you for asking. That takes strength. What do you need help with today?',
      ],
      clarify: 'I mean: what’s going on that I can help with? Tap one of the buttons, or tell me in your own words.',
      why: 'I want to make sure I help with the right thing. What do you need help with?',
      topics: [
        { label: 'Cravings', tree: 'Cravings' },
        { label: 'How I’m feeling', node: 'feel' },
        { label: 'I’m sick', tree: 'sick' },
        { label: 'Housing', tree: 'Housing' },
        { label: 'Money or bills', tree: 'Money' },
        { label: 'Talk to someone', node: 'talk' },
        { label: 'Something else', node: 'other' },
      ],
      next: END,
    },
    feel: {
      say: 'Of course. How are you feeling right now? You can say it in your own words.',
      alts: ['I’d like to hear. How are you feeling right now?'],
      next: END,
    },
    talk: {
      say: 'Reaching out is a great step. Who would you like to talk to?',
      alts: ['Talking to someone can really help. Who would you like to reach?'],
      offer: reachOut,
      next: END,
    },
    other: {
      say: 'Okay. Tell me what’s going on in your own words, and we’ll figure it out together.',
      alts: ['Sure. Tell me a little about it. I’m listening.'],
      next: END,
    },
  },
};

// "I don't believe in God", "the higher power stuff isn't for me" (Ed,
// 2026-10-24): no judgment, then ask what gives them hope. Recovery doesn't
// need God; SMART Recovery and other groups don't use a higher power at all.
// A no-hope answer ("nothing gives me hope") is caught by the safety screen
// before it gets here, and gets "are you safe right now?".
const faith: Tree = {
  id: 'faith',
  title: 'Faith and hope',
  start: 'judge',
  nodes: {
    judge: {
      say: 'That’s okay, I’m not here to judge. Lots of people in recovery don’t believe in God, and they do really well. Can I ask, what in your life gives you hope?',
      alts: [
        'That’s totally okay. No judgment here. Recovery doesn’t depend on believing in God. What in your life gives you hope?',
        'Fair enough, and that’s okay with me. You don’t need God to do well in recovery. So tell me, what gives you hope?',
        'I hear you, and I’m not here to judge. Everyone’s path is different. What’s something in your life that gives you hope?',
      ],
      clarify: 'I mean: what keeps you going? It could be a person, a pet, a goal, music, anything that makes tomorrow worth it.',
      why: 'Knowing what gives you hope helps on the hard days, and it can be anything, not just God. What gives you hope?',
      share: 'hope',
      none: 'hard',
    },
    hope: {
      say: 'That’s a real thing to hold on to. Hope doesn’t have to come from anywhere special. It just has to be yours.',
      alts: ['I love that. That’s worth fighting for.', 'That’s a good one. Lean on it when things get hard.'],
      next: 'meetings',
    },
    hard: {
      say: 'That’s okay. Some days hope is hard to find. It can start small, like a person, a pet, a song, or one good day. Would it help to talk to someone about it?',
      alts: ['That’s alright. Hope can be hard to feel sometimes, and it can start really small. Would it help to talk to someone?'],
      yes: 'talk',
      no: 'meetings',
    },
    talk: { say: 'Good call. Who would you like to reach?', offer: reachOut, next: END },
    meetings: {
      say: 'Some groups, like SMART Recovery, don’t use God or a higher power at all. Would you like to find one?',
      alts: ['If the God part of meetings doesn’t fit, there are groups like SMART Recovery that skip it. Want to find one?'],
      clarify: 'I mean: would you like to see recovery meetings that don’t talk about God, like SMART Recovery?',
      why: 'If the God talk at some meetings turns you off, a group without it might feel like a better fit. Want to find one?',
      yes: 'find',
      no: 'yours',
    },
    find: {
      say: 'Here are meetings you can get to. SMART Recovery is in the list.',
      offer: [{ action: 'findMeeting', label: 'Find a meeting' }],
      next: END,
    },
    yours: {
      say: 'That’s okay. Your recovery is yours, and there’s no one right way to do it.',
      alts: ['No problem. There’s no one right way to do recovery. You get to find what works for you.'],
      next: END,
    },
  },
};

// "I hate AA", "I don't believe in the 12 steps", "NA isn't for me",
// "Celebrate Recovery doesn't work" (Ed, 2026-10-24): the same as faith. No
// judgment, ask what gives them hope, and mention other paths without pushing.
const { find: _find, ...faithNodes } = faith.nodes;
const program: Tree = {
  id: 'program',
  title: 'Meetings that don’t fit',
  start: 'judge',
  nodes: {
    ...faithNodes,
    judge: {
      say: 'That’s okay, I’m not here to judge. The 12 steps aren’t for everyone, and that doesn’t mean recovery isn’t for you. Can I ask, what in your life gives you hope?',
      alts: [
        'Fair enough. No judgment here. Lots of people find their own way, with or without the steps. What gives you hope right now?',
        'I hear you. Those groups don’t click for everyone, and that’s okay. What’s something in your life that gives you hope?',
        'That’s honest, and that’s okay. There’s more than one road in recovery. What keeps you going? What gives you hope?',
      ],
      clarify: faith.nodes.judge.clarify,
      why: 'Knowing what gives you hope helps on the hard days, whatever path you take. What gives you hope?',
      share: 'hope',
      none: 'hard',
    },
    meetings: {
      say: 'There are other paths too, like SMART Recovery, which is tools-based with no steps, or working one-on-one with a counselor. {coord} can help you find what fits. Want to look at other options?',
      alts: ['If AA or NA isn’t your thing, SMART Recovery and counseling are good options, and {coord} can help you sort it out. Want to look?'],
      clarify: 'I mean: would you like to see other kinds of support, like SMART Recovery meetings or talking with {coord} about counseling?',
      why: 'The best support is the one you’ll actually stick with, so it’s worth finding one that fits you. Want to look at other options?',
      yes: 'options',
      no: 'yours',
    },
    options: {
      say: 'Here are a couple of ways to start.',
      offer: [
        { action: 'findMeeting', label: 'Find a SMART meeting' },
        { action: 'callCoordinator', label: 'Call {coord}' },
      ],
      next: END,
    },
  },
};

// "It's hopeless" (Ed, 2026-10-24: ask what inspires them, and be curious).
// Hopelessness can be a suicide warning sign, so the safety screen catches it
// first and asks "are you safe right now?". Only after "Yes, I'm safe" does
// Zoey start this. Needs clinician review.
const hopeless: Tree = {
  id: 'hopeless',
  title: 'Feeling hopeless',
  start: 'what',
  nodes: {
    what: {
      say: 'I want to understand you better. What inspires you, even a little?',
      alts: [
        'Can I ask you something? What inspires you? It can be anything at all.',
        'When things feel hopeless, it helps to look for a spark. What’s something that inspires you?',
        'I’m curious. What lights you up, even on a bad day?',
        'Who or what inspires you? I’d really like to know.',
      ],
      clarify: 'I mean: is there a person, a goal, music, faith, your kids, a place, anything that makes you want to keep going?',
      why: 'Even when things feel hopeless, there’s usually a spark somewhere, and I’d love to help you find it. What inspires you?',
      share: 'curious',
      none: 'small',
    },
    curious: {
      say: 'Ooh, tell me more. What is it about that that inspires you?',
      alts: [
        'I like that. How did that come into your life?',
        'That’s interesting. What does it make you feel when you think about it?',
        'Tell me more about that. When did you first notice it inspired you?',
      ],
      clarify: 'I mean: why does that matter to you? What does it give you?',
      why: 'Because what inspires you can carry you through the hard days, and I want to know you better. What is it about it?',
      share: 'heard',
      none: 'heard',
    },
    heard: {
      say: 'That’s worth holding on to. Feeling hopeless doesn’t mean things are hopeless, even when it really feels that way.',
      alts: ['That’s a real reason to keep going. Feeling hopeless is real, but it isn’t the final word.', 'I can hear how much that means to you. Hold on to it, especially today.'],
      next: 'talk',
    },
    small: {
      say: 'That’s okay. When everything feels hopeless, it’s hard to think of anything. Even something small counts, like a song, a person, a pet, or a dream you used to have. Does anything come to mind?',
      alts: ['That’s alright. Hopeless days make it hard to see anything good. Is there anything at all, even tiny, like a song or a person you care about?'],
      clarify: 'I mean: is there even one small thing, like a song, a person, or a pet, that you care about?',
      why: 'Small things can be a starting point when big things feel impossible. Does anything come to mind?',
      yes: 'tellSmall',
      no: 'talk',
    },
    tellSmall: { say: 'What is it? I’d love to hear.', alts: ['Tell me about it.'], share: 'curious', none: 'talk' },
    talk: {
      say: 'You don’t have to carry this by yourself. Would you be willing to talk to someone today?',
      alts: ['Talking to someone can really help with this. Would you reach out to someone today?'],
      clarify: 'I mean: would you call or text someone you trust today, like {sponsor} or {coord}?',
      why: 'Hopeless feelings get lighter when you share them with a real person. Would you reach out today?',
      yes: 'who',
      no: 'later',
    },
    who: { say: 'I’m really glad. Who would you like to reach?', offer: [...reachOut, { action: 'textSponsor', label: 'Text {sponsor}' }], next: END },
    later: {
      say: 'Okay. I’m here any time. If it gets heavier, you can call or text 988, the free Suicide and Crisis Lifeline, any time, day or night.',
      next: END,
    },
  },
};

// "God hates me", "Jim hates me", "everyone hates me" (Ed, 2026-10-24): ask
// why they think that, using the name, then nudge them to talk it through
// with their sponsor, counselor or mentor. Threats ("he hates me and said
// he'd kill me") and hopelessness are caught by the safety screen first.
const hates: Tree = {
  id: 'hates',
  title: 'Someone hates me',
  start: 'why',
  entries: ['god', 'everyone'],
  nodes: {
    why: {
      say: 'Now why would {who} hate you?',
      alts: ['Why do you think {who} hates you?', 'What makes you feel like {who} hates you?', 'That hurts to feel. What happened with {who}?'],
      clarify: 'I mean: what happened with {who} that makes you feel that way?',
      why: 'Sometimes it helps to say it out loud, and I want to understand what’s going on. Why do you think {who} hates you?',
      share: 'heard',
      none: 'unsure',
      avoid: 'avoid',
    },
    god: {
      say: 'Why do you think God would hate you?',
      alts: ['Now why would God hate you?', 'What makes you feel like God hates you?', 'That’s a heavy thing to carry. What makes you think that?'],
      clarify: 'I mean: what’s happened that makes you feel like God is against you?',
      why: 'That’s a painful thing to believe about yourself, and I want to understand it. Why do you think God would hate you?',
      share: 'heard',
      none: 'unsure',
      avoid: 'avoid',
    },
    everyone: {
      say: 'That sounds really lonely. What makes it feel like everyone hates you?',
      alts: ['Why does it feel like everyone hates you right now?', 'That’s a hard way to feel. What happened that makes it seem like everyone hates you?'],
      clarify: 'I mean: what’s been happening with the people around you that makes you feel that way?',
      why: 'When it feels like everyone is against you, talking about it can help sort out what’s real. What makes it feel that way?',
      share: 'heard',
      none: 'unsure',
      avoid: 'avoid',
    },
    heard: {
      say: 'That sounds painful. That’s worth talking through with someone who knows you.',
      alts: ['I can see why that would get to you. Someone who knows you could really help you sort it out.', 'That’s a lot to sit with. You don’t have to figure it out alone.'],
      next: 'reach',
    },
    unsure: {
      say: 'That’s okay. Sometimes it just feels that way, even when it’s hard to say why.',
      alts: ['That’s alright. Feelings like that don’t always come with a clear reason.'],
      next: 'reach',
    },
    reach: {
      say: 'Would you be willing to talk it over with {sponsor}, your counselor, or a mentor?',
      alts: ['This is a good one to talk through with {sponsor}, your counselor, or a mentor. Would you reach out to one of them?', 'Could you call {sponsor}, your counselor, or a mentor about it today?'],
      clarify: 'I mean: would you call or text {sponsor}, your counselor, or a mentor and talk about this?',
      why: 'Someone who knows you can help you see it more clearly, and you don’t have to carry it alone. Would you reach out?',
      yes: 'call',
      no: 'later',
    },
    call: { say: 'Good. Who would you like to reach?', offer: [...reachOut, { action: 'textSponsor', label: 'Text {sponsor}' }], next: END },
    later: {
      say: 'Okay. If you change your mind, {sponsor} and {coord} are just a tap away. I’m here too.',
      alts: ['That’s okay. The offer stands. {coord} and {sponsor} are here when you’re ready, and so am I.'],
      next: END,
    },
    ...avoidNodes('reach'),
  },
};

// After "Yes, I'm safe" (Ed, 2026-10-25): still ask what's behind it, then
// point them to their LifeCircle. Danger memory stays on (watch.ts).
const afterSafe: Tree = {
  id: 'after-safe',
  title: 'After "I’m safe"',
  start: 'why',
  nodes: {
    why: {
      say: 'Can you tell me what’s making you feel this way?',
      alts: [
        'What’s been going on that’s making you feel like this?',
        'I still want to understand. What’s been weighing on you?',
        'Would you tell me a little about what’s behind it?',
        'What happened today that brought this up?',
      ],
      clarify: 'I mean: what’s been happening that’s making things feel this hard?',
      why: 'Because you matter to me, and talking about it can make it a little lighter. What’s going on?',
      share: 'heard',
      none: 'unsure',
    },
    heard: {
      say: 'That’s a lot to carry. I’m really glad you’re talking to me about it.',
      alts: ['That sounds really hard. I’m glad you’re not keeping it all inside.', 'I can see why you’d feel that way. You don’t have to carry it alone.', 'That makes sense, and it’s a lot. I’m right here with you.'],
      next: 'circle',
    },
    unsure: {
      say: 'That’s okay. Sometimes it’s hard to put into words.',
      alts: ['That’s alright. You don’t need a reason for it to be real.', 'That’s okay. Feelings like that don’t always come with a clear reason.'],
      next: 'circle',
    },
    circle: {
      say: 'This is exactly why you have a LifeCircle. Would you reach out to one of them today?',
      alts: ['Your LifeCircle is there for days like this. Could you call or text one of them now?', 'Would you talk to someone in your LifeCircle about it today? That’s what they’re there for.'],
      clarify: 'I mean: would you call or text {sponsor}, {coord}, or someone else in your LifeCircle?',
      why: 'Talking to someone who knows you can really help, and you don’t have to do this alone. Would you reach out?',
      yes: 'call',
      no: 'later',
    },
    call: {
      say: 'I’m really glad. Who would you like to reach?',
      offer: [...reachOut, { action: 'openLifeCircle', label: 'Open my LifeCircle' }],
      next: END,
    },
    later: {
      say: 'Okay. I’ll keep checking on you. {sponsor} and {coord} are just a tap away, and 988 is there any time.',
      alts: ['That’s okay. The offer stands. Your LifeCircle is a tap away, and so am I.'],
      next: END,
    },
  },
};

export const FEELING_KEYS: FeelingKey[] = [...HARD, 'happy', 'proud', 'grateful', 'excited', 'hopeful', 'calm'];

export const TREES: Record<string, Tree> = Object.fromEntries(
  [feelingBad, sleep, cravings, urge, big, alone, housing, money, people, meds, work, medsNotYet, goingWell, meetings, sick, help, faith, program, hopeless, hates, afterSafe, noTalk, ...FEELING_KEYS.map(feelingTree)].map(
    (t) => [t.id, t],
  ),
);

// `who`: the person in "Jim hates me", for the `hates` tree.
export type TreeVars = { coord: string; sponsor: string | null; name: string; who?: string | null };

export const fill = (s: string, v: TreeVars) =>
  s
    .replace(/\{coord\}/g, v.coord)
    .replace(/\{sponsor\} or /g, v.sponsor ? `${v.sponsor} or ` : '')
    .replace(/\{sponsor\}/g, v.sponsor ?? 'someone you trust')
    .replace(/\{name\}/g, v.name)
    .replace(/\{who\}/g, v.who ?? 'they');

// Where "I'd rather not" (or "no", "nothing") goes from a share node: past the
// "thanks for sharing" line that would follow it.
export const skipAfterShare = (tree: Tree, nodeId: string) => {
  const n = tree.nodes[nodeId];
  if (n.none) return n.none;
  const to = n.share ?? END;
  const after = tree.nodes[to];
  return after && !after.yes && !after.no && !after.share && !after.offer && !after.safety && !after.topics ? (after.next ?? END) : to;
};

// One of the ways to say a node's line, at random (`rand` for tests).
export const lineFor = (n: TreeNode, rand: () => number = Math.random) => {
  const all = [n.say, ...(n.alts ?? [])];
  return all[Math.floor(rand() * all.length) % all.length];
};

// The same, but never the line this node said last time, so a flow that comes
// back around doesn't say it word for word again (Ed, 2026-10-27: "you just said that").
const lastLine = new WeakMap<TreeNode, string>();
export const freshLine = (n: TreeNode, rand: () => number = Math.random) => {
  const all = [n.say, ...(n.alts ?? [])];
  const fresh = all.length > 1 ? all.filter((x) => x !== lastLine.get(n)) : all;
  const said = fresh[Math.floor(rand() * fresh.length) % fresh.length];
  lastLine.set(n, said);
  return said;
};

// Every path a person could tap through, for tests and for the clinician review outline.
export function paths(tree: Tree): string[][] {
  const out: string[][] = [];
  const walk = (id: string, trail: string[]) => {
    if (id === END) return out.push(trail);
    if (trail.includes(id)) throw new Error(`${tree.id}: loop at ${id}`);
    const n = tree.nodes[id];
    if (!n) throw new Error(`${tree.id}: missing node ${id}`);
    const nexts = [n.yes, n.no, n.notSure, n.typed, n.share, n.none, n.next, n.avoid, ...(n.topics ?? []).map((t) => t.node)].filter((x): x is string => !!x);
    if (!nexts.length) throw new Error(`${tree.id}: dead end at ${id}`);
    for (const x of new Set(nexts)) walk(x, [...trail, id]);
  };
  for (const start of [tree.start, ...(tree.entries ?? [])]) walk(start, []);
  return out;
}
