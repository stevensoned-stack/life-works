// Yes/no decision trees for the check-in (Layer 2, build plan sec. 04: "conversation
// graphs authored as versioned JSON ... signed off before publication"). Every
// question can be answered with a tap. All the wording lives here so a
// clinician can review it in one place; the check-in screen only walks it.
//
// How a node works:
//   say      what Zoey says. {coord}, {sponsor} and {name} are filled in.
//   yes/no   the node is a Yes / No question; each points at the next node.
//   notSure  adds an "I'm not sure" button (otherwise it follows `no`).
//   share    asks them to type something (or tap "I'd rather not"), then goes on.
//   offer    buttons that do something (call, breathing...), then go to `next`.
//   next     a plain statement that moves straight on.
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

export type TreeNode = {
  say: string;
  yes?: string;
  no?: string;
  notSure?: string;
  share?: string; // next node after they share (or skip)
  offer?: Offer[];
  next?: string;
  tags?: string[];
  save?: string;
  saveShared?: boolean;
  safety?: 'abuse' | 'housing' | 'withdrawal';
};

export type Tree = { id: string; title: string; start: string; nodes: Record<string, TreeNode> };

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
// Ed: ask if they know why, then ask them to share, for every feeling.
// A hard feeling reuses the quick questions from feeling-bad when they don't
// know why, then ends with an offer that fits the feeling.
export type FeelingKey =
  | 'sad' | 'angry' | 'frustrated' | 'anxious' | 'scared' | 'lonely' | 'stressed'
  | 'numb' | 'guilty' | 'ashamed' | 'tired' | 'bored'
  | 'happy' | 'proud' | 'grateful' | 'excited' | 'hopeful' | 'calm';

const breathe: Offer[] = [{ action: 'breathing', label: 'Try breathing' }];

// What comes after they share, by feeling. `say` leads to the offer buttons.
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

function feelingTree(k: FeelingKey): Tree {
  const id = `feeling:${k}`;
  if (!isHardFeeling(k)) {
    return {
      id,
      title: `Feeling ${k}`,
      start: 'know',
      nodes: {
        know: { say: `That’s great to hear! Do you know what’s making you feel ${k}?`, yes: 'share', no: 'notice', notSure: 'notice' },
        share: { say: 'What is it? I’d love to hear.', share: 'thanks' },
        thanks: { say: 'Thank you for sharing. It’s good to notice what helps, so you can come back to it.', next: END },
        notice: { say: 'That’s okay. It’s still good to notice. Enjoy it.', next: END },
      },
    };
  }
  const after = FEELING_AFTER[k];
  return {
    id,
    title: `Feeling ${k}`,
    start: 'know',
    nodes: {
      ...feelingBad.nodes,
      know: { say: `Do you know why you’re feeling ${k}?`, yes: 'share', no: 'help', notSure: 'help' },
      share: { say: `Would you share what’s making you feel ${k}? A few words is fine.`, share: 'thanks' },
      thanks: { say: 'Thank you for telling me.', next: after ? 'after' : END },
      worryYes: { say: 'Do you want to tell me a little about it?', share: 'thanks' },
      none: { say: 'Thanks for going through those. Some days are just hard, and that’s okay.', next: after ? 'after' : END },
      ...(after ? { after: { ...after, next: END } } : {}),
    },
  };
}

export const FEELING_KEYS: FeelingKey[] = [...HARD, 'happy', 'proud', 'grateful', 'excited', 'hopeful', 'calm'];

export const TREES: Record<string, Tree> = Object.fromEntries(
  [feelingBad, sleep, cravings, alone, housing, money, people, meds, work, medsNotYet, goingWell, meetings, ...FEELING_KEYS.map(feelingTree)].map(
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

// Every path a person could tap through, for tests and for the clinician review outline.
export function paths(tree: Tree): string[][] {
  const out: string[][] = [];
  const walk = (id: string, trail: string[]) => {
    if (id === END) return out.push(trail);
    if (trail.includes(id)) throw new Error(`${tree.id}: loop at ${id}`);
    const n = tree.nodes[id];
    if (!n) throw new Error(`${tree.id}: missing node ${id}`);
    const nexts = [n.yes, n.no, n.notSure, n.share, n.next].filter((x): x is string => !!x);
    if (!nexts.length) throw new Error(`${tree.id}: dead end at ${id}`);
    for (const x of new Set(nexts)) walk(x, [...trail, id]);
  };
  walk(tree.start, []);
  return out;
}
