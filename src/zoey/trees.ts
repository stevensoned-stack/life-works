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
  | 'call211';

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
};

// `entries`: other nodes a screen may start at (e.g. after "I'm sad because...").
export type Tree = { id: string; title: string; start: string; entries?: string[]; nodes: Record<string, TreeNode> };

export const END = 'END';

const reachOut: Offer[] = [
  { action: 'callSponsor', label: 'Call {sponsor}' },
  { action: 'callCoordinator', label: 'Call {coord}' },
];

// Mood was Sad or Very Sad. Ed's example: do you know why? If yes, share it.
// If no, a few quick yes/no questions to help find it.
const feelingBad: Tree = {
  id: 'feeling-bad',
  title: 'Feeling bad',
  start: 'know',
  nodes: {
    know: { say: 'Do you know why you’re feeling bad?', yes: 'share', no: 'help', notSure: 'help' },
    share: { say: 'Would you share what’s going on? A few words is fine.', share: 'thanks' },
    thanks: { say: 'Thank you for telling me. I’ve saved that with today’s check-in.', next: END },
    help: { say: 'That’s okay. Sometimes it’s hard to tell. Can I ask a few quick yes or no questions?', yes: 'sleep', no: 'skip' },
    skip: { say: 'Okay. You can always tell me later.', next: END },
    sleep: { say: 'Did you sleep okay last night?', yes: 'craving', no: 'sleepNo' },
    sleepNo: { say: 'Okay, I’ve noted sleep.', tags: ['Sleep'], next: 'craving' },
    craving: { say: 'Have you had any cravings today?', yes: 'cravingYes', no: 'alone' },
    cravingYes: { say: 'Thanks for being honest. I’ve noted cravings.', tags: ['Cravings'], next: 'alone' },
    alone: { say: 'Have you been feeling alone?', yes: 'aloneYes', no: 'worry' },
    aloneYes: { say: 'I’ve noted that.', tags: ['Feeling alone'], next: 'worry' },
    worry: { say: 'Is something stressing you, like money, housing, work or someone in your life?', yes: 'worryYes', no: 'none' },
    worryYes: { say: 'Do you want to tell me a little about it?', share: 'thanks' },
    none: { say: 'Thanks for going through those. Some days are just hard, and that’s okay.', next: END },
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
    meeting: { say: 'Here are meetings you can get to.', offer: [{ action: 'findMeeting', label: 'Find a meeting' }], next: END },
    passed: { say: 'Glad it’s not strong right now. Do you know what set it off?', yes: 'trigger', no: END },
    trigger: { say: 'What was it? Knowing your triggers helps you and {sponsor} plan.', share: 'noted' },
    noted: { say: 'Thanks. I’ve saved it with today’s check-in.', next: END },
  },
};

const alone: Tree = {
  id: 'Feeling alone',
  title: 'Feeling alone',
  start: 'reach',
  nodes: {
    reach: { say: 'Would it help to reach out to someone today?', yes: 'who', no: 'meeting' },
    who: {
      say: 'Who would you like to reach?',
      offer: [...reachOut, { action: 'textSponsor', label: 'Text {sponsor}' }],
      next: END,
    },
    meeting: { say: 'Okay. Could you get to a meeting this week? Being around people can help.', yes: 'find', no: END },
    find: { say: 'Here are meetings you can get to.', offer: [{ action: 'findMeeting', label: 'Find a meeting' }], next: END },
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
    noted: { say: 'Okay. I’ve noted it so you and {coord} can talk it through.', next: END },
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
    noted: { say: 'Okay. I’ve noted it so you and {coord} can talk it through.', next: END },
  },
};

const people: Tree = {
  id: 'People',
  title: 'People',
  start: 'safe',
  nodes: {
    safe: { say: 'Do you feel safe with the people around you?', yes: 'talk', no: 'unsafe', notSure: 'unsafe' },
    unsafe: { say: '', safety: 'abuse', next: END },
    talk: { say: 'Would it help to talk it through with someone?', yes: 'who', no: 'noted' },
    who: { say: 'Who would you like to reach?', offer: reachOut, next: END },
    noted: { say: 'Okay. I’ve noted it on your LifePath.', next: END },
  },
};

const meds: Tree = {
  id: 'Meds',
  title: 'Meds',
  start: 'stopped',
  nodes: {
    stopped: { say: 'Have you stopped taking any of your medicines?', yes: 'stoppedYes', no: 'question' },
    stoppedYes: {
      say: 'Thanks for telling me. Stopping some medicines suddenly can make you sick, so please talk to {coord} or your prescriber today.',
      offer: [{ action: 'callCoordinator', label: 'Call {coord}' }],
      next: END,
    },
    question: { say: 'Is there something you want to ask your prescriber?', yes: 'ask', no: 'noted' },
    ask: { say: 'What would you like to ask? I’ll save it for your next appointment.', share: 'saved', saveShared: true },
    saved: { say: 'Saved for your next appointment.', next: END },
    noted: { say: 'Okay. I’ve noted it with today’s check-in.', next: END },
  },
};

const work: Tree = {
  id: 'Work or school',
  title: 'Work or school',
  start: 'talk',
  nodes: {
    talk: { say: 'Would it help to talk it through with someone?', yes: 'who', no: 'noted' },
    who: { say: 'Who would you like to reach?', offer: reachOut, next: END },
    noted: { say: 'That’s a lot to juggle. I’ve noted it on your LifePath.', next: END },
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
    done: { say: 'Great, thanks.', next: END },
    later: { say: 'Okay. I’ve noted it for today.', next: END },
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
    saved: { say: 'Saved to your LifePath. It’s good to look back on.', next: END },
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
  sad: { say: 'Talking to someone can help when you feel sad. Want to reach out?', offer: reachOut },
  lonely: { say: 'Feeling lonely is hard. A short call or text can help. Want to reach out?', offer: reachOut },
  angry: { say: 'Anger is a normal feeling. A few slow breaths can help before you act on it. Want to try?', offer: breathe },
  frustrated: { say: 'A few slow breaths can take the edge off. Want to try?', offer: breathe },
  anxious: { say: 'A one-minute breathing exercise can help calm your body. Want to try it?', offer: breathe },
  scared: { say: 'Slow breathing can help when you feel scared. Want to try it, or talk to someone?', offer: [...breathe, ...reachOut] },
  stressed: { say: 'A one-minute breathing exercise can help. Want to try it?', offer: breathe },
  numb: { say: 'Feeling numb can be a sign you’re carrying a lot. Talking to someone can help. Want to reach out?', offer: reachOut },
  guilty: { say: 'Guilt is common in recovery. Talking it through with someone can help. Want to reach out?', offer: reachOut },
  ashamed: { say: 'Shame is common in recovery, and you’re not alone in it. Want to talk to someone?', offer: reachOut },
  bored: { say: 'Boredom can be a trigger. A meeting or a call might help. Want to find one?', offer: [{ action: 'findMeeting', label: 'Find a meeting' }, ...reachOut] },
};

const HARD: FeelingKey[] = ['sad', 'angry', 'frustrated', 'anxious', 'scared', 'lonely', 'stressed', 'numb', 'guilty', 'ashamed', 'tired', 'bored'];

export const isHardFeeling = (k: FeelingKey) => HARD.includes(k);

// "Okay, what is your plan?" Shared by the hard feelings and feeling sick.
// `close` is the warm line after they share a plan; `none` is where "no plan yet" goes.
const planNodes = (close: string[], none: string): Record<string, TreeNode> => ({
  plan: {
    say: 'Okay. Do you have a plan for what you’ll do next?',
    alts: [
      'Thank you for trusting me with that. Do you have a plan for what comes next?',
      'Okay. Have you thought about a plan for getting through today?',
      'I hear you. Do you have an idea of what you want to do next?',
    ],
    clarify: 'I mean: do you have an idea of what you’ll do next to take care of yourself, like calling someone, going to a meeting, or resting? Yes or no is fine.',
    why: 'Even a small plan can make a hard time easier to get through, and it helps me know how to support you. Do you have a plan for what’s next?',
    yes: 'planTell',
    no: 'planNo',
    typed: 'planGood',
  },
  planTell: {
    say: 'Great! What is your plan?',
    alts: ['That’s great. Tell me about your plan.', 'Good for you. What are you thinking of doing?'],
    clarify: 'What will you do next? It can be something small, like calling your sponsor or taking a walk.',
    why: 'Saying a plan out loud makes it more likely to happen. What’s your plan?',
    share: 'planGood',
    none: 'planNo',
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
});

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
          say: 'That’s wonderful! Thank you for sharing it with me. It’s good to notice what helps, so you can come back to it.',
          alts: ['I love hearing that! Thank you for telling me. Hold on to that feeling.', 'That’s really great news. I’m so glad for you!'],
          next: END,
        },
        know: {
          say: `That’s great to hear! Do you know what’s making you feel ${k}?`,
          alts: [`I’m so glad! Do you know what’s helping you feel ${k}?`, `That’s wonderful. Do you know what’s making you feel ${k} today?`],
          clarify: `I mean: do you know what’s helping you feel ${k}? Yes or no is fine.`,
          why: 'Noticing what helps you feel good means you can come back to it on harder days. Do you know what it is?', yes: 'share', no: 'notice', notSure: 'notice', typed: 'thanks' },
        share: { say: 'What is it? I’d love to hear.', share: 'thanks' },
        thanks: { say: 'Thank you for sharing. It’s good to notice what helps, so you can come back to it.', next: END },
        notice: { say: 'That’s okay. It’s still good to notice. Enjoy it.', next: END },
      },
    };
  }
  const after = FEELING_AFTER[k];
  const end = after ? 'after' : 'reach';
  // The quick questions (sleep, cravings, alone, worry) come from feeling-bad.
  const { know: _k, share: _s, thanks: _t, skip: _sk, ...quick } = feelingBad.nodes;
  return {
    id,
    title: `Feeling ${k}`,
    start: 'more',
    entries: ['heard'],
    nodes: {
      ...quick,
      more: {
        say: 'I’m sorry to hear that. Can you tell me more?',
        alts: [
          'I’m really sorry you’re feeling this way. Can you tell me more about it?',
          'That sounds hard, and I’m glad you told me. Would you tell me a little more?',
          'I’m sorry. You don’t have to go through it alone. Can you tell me more?',
        ],
        clarify: 'I mean: would you like to tell me what’s going on, or what’s making you feel this way? You can tap Yes or No, or just tell me.',
        why: 'Talking about it can make it feel a little lighter, and it helps me point you to the right support. Would you like to tell me more?',
        yes: 'share',
        no: 'help',
        notSure: 'help',
        typed: 'plan',
      },
      share: {
        say: 'I’m listening. What’s going on?',
        alts: ['Take your time. I’m here. What’s been going on?', 'I’m right here with you. What’s happening?'],
        clarify: 'Just tell me in your own words what’s been happening. A few words is fine.',
        why: 'Putting it into words can help, and I want to understand so I can help. What’s going on?',
        share: 'plan',
      },
      // When they already said why ("I'm sad because..."), Zoey starts here.
      heard: {
        say: 'I’m sorry to hear that. Thank you for telling me.',
        alts: ['That sounds really hard. Thank you for sharing it with me.', 'I’m so sorry you’re dealing with that. I’m glad you told me.'],
        next: 'plan',
      },
      help: {
        say: 'That’s okay. Sometimes it’s hard to put into words. Can I ask a few quick yes or no questions?',
        clarify: 'I mean: can I ask you a few short questions, like how you slept? You can answer each with yes or no.',
        why: 'Sometimes a few simple questions help find what’s behind a feeling. Can I ask a few?',
        yes: 'sleep',
        no: 'plan',
      },
      worryYes: { say: 'Do you want to tell me a little about it?', share: 'plan' },
      none: { say: 'Thanks for going through those. Some days are just hard, and that’s okay.', next: 'plan' },
      ...planNodes(
        [
          'That sounds like a good plan. You’re taking care of yourself, and that matters. I’m proud of you for reaching out.',
          'I like that plan. Reaching out today was a strong step, and you should be proud of it.',
          'That’s a good plan. You’re doing the work, one step at a time, and it shows.',
        ],
        end,
      ),
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
        'Oh no, I’m sorry you’re not feeling well. Have you been able to talk to your doctor?',
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

export const FEELING_KEYS: FeelingKey[] = [...HARD, 'happy', 'proud', 'grateful', 'excited', 'hopeful', 'calm'];

export const TREES: Record<string, Tree> = Object.fromEntries(
  [feelingBad, sleep, cravings, alone, housing, money, people, meds, work, medsNotYet, goingWell, meetings, sick, help, ...FEELING_KEYS.map(feelingTree)].map(
    (t) => [t.id, t],
  ),
);

export type TreeVars = { coord: string; sponsor: string | null; name: string };

export const fill = (s: string, v: TreeVars) =>
  s
    .replace(/\{coord\}/g, v.coord)
    .replace(/\{sponsor\} or /g, v.sponsor ? `${v.sponsor} or ` : '')
    .replace(/\{sponsor\}/g, v.sponsor ?? 'someone you trust')
    .replace(/\{name\}/g, v.name);

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

// Every path a person could tap through, for tests and for the clinician review outline.
export function paths(tree: Tree): string[][] {
  const out: string[][] = [];
  const walk = (id: string, trail: string[]) => {
    if (id === END) return out.push(trail);
    if (trail.includes(id)) throw new Error(`${tree.id}: loop at ${id}`);
    const n = tree.nodes[id];
    if (!n) throw new Error(`${tree.id}: missing node ${id}`);
    const nexts = [n.yes, n.no, n.notSure, n.typed, n.share, n.next, ...(n.topics ?? []).map((t) => t.node)].filter((x): x is string => !!x);
    if (!nexts.length) throw new Error(`${tree.id}: dead end at ${id}`);
    for (const x of new Set(nexts)) walk(x, [...trail, id]);
  };
  for (const start of [tree.start, ...(tree.entries ?? [])]) walk(start, []);
  return out;
}
