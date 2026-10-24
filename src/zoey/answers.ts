// Zoey's answer library (step 3). Every answer is authored text, written to be
// signed off by a clinician before real use, the same as the check-in flow.
// Zoey gives general information and routes to people. She does not diagnose,
// interpret, or give medication or treatment advice (build plan, section 02).
//
// `keys` are words and phrases that point to an answer. A longer phrase match
// counts for more than a single word (see ask.ts).

import { Route } from '../modules';

export const LIBRARY_VERSION = 'answers@0.1-draft';

export type AnswerContext = {
  name: string;
  coordinatorName: string;
  sponsorName: string | null;
  cleanDays: number | null;
  nextMilestone: string | null;
  daysToNext: number | null;
  nextEvent: { title: string; when: string } | null;
  meetingsThisWeek: number;
};

export type AnswerAction =
  | { kind: 'route'; label: string; route: Route }
  | { kind: 'call'; label: string; who: 'sponsor' | 'coordinator' }
  | { kind: 'text'; label: string; who: 'sponsor' | 'coordinator'; body?: string }
  | { kind: 'url'; label: string; url: string }
  | { kind: 'phone'; label: string; number: string }
  | { kind: 'crisis'; label: string }
  | { kind: 'save'; label: string };

export type Topic =
  | 'Cravings and slips'
  | 'Meetings and sponsors'
  | 'Feelings and sleep'
  | 'Housing, food and money'
  | 'My program'
  | 'Using Life Works';

export type Answer = {
  id: string;
  topic: Topic;
  q: string;
  keys: string[];
  text: string | ((c: AnswerContext) => string);
  actions?: (c: AnswerContext) => AnswerAction[];
  related?: string[];
};

export const TOPICS: Topic[] = [
  'Cravings and slips',
  'Meetings and sponsors',
  'Feelings and sleep',
  'Housing, food and money',
  'My program',
  'Using Life Works',
];

const callSponsorOrMaya = (c: AnswerContext): AnswerAction[] =>
  c.sponsorName
    ? [
        { kind: 'call', label: `Call ${c.sponsorName}`, who: 'sponsor' },
        { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' },
      ]
    : [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }];

// 211 is the free United Way line for local help with housing, food and bills.
const call211: AnswerAction = { kind: 'phone', label: 'Call 211', number: '211' };

export const ANSWERS: Answer[] = [
  // Cravings and slips
  {
    id: 'craving-now',
    topic: 'Cravings and slips',
    q: 'What can I do when I have a craving?',
    keys: ['craving', 'cravings', 'crave', 'urge', 'want to use', 'wanna use', 'want to drink', 'tempted', 'trigger', 'triggered'],
    text: (c) =>
      `Cravings are a normal part of recovery, and they pass. Some things people find helpful: call or text someone, leave the place you're in, wait it out for 20 minutes, drink water or eat something, or go to a meeting. ${c.sponsorName ? `${c.sponsorName} said to call any time.` : 'Your coordinator can help too.'} Your counselor can help you make a plan that fits you.`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }],
    related: ['craving-length', 'slip'],
  },
  {
    id: 'craving-length',
    topic: 'Cravings and slips',
    q: 'How long does a craving last?',
    keys: ['how long craving', 'craving last', 'cravings last', 'urge last', 'go away', 'ever stop'],
    text: 'Cravings usually build, peak, and then fade, like a wave. Many people say a craving passes in about 20 to 30 minutes if they ride it out. Over time they tend to come less often.',
    actions: (c) => callSponsorOrMaya(c),
    related: ['craving-now'],
  },
  {
    id: 'slip',
    topic: 'Cravings and slips',
    q: 'I slipped. What do I do now?',
    keys: ['slipped', 'slip', 'relapsed', 'relapse', 'used again', 'drank again', 'messed up', 'i used', 'got high', 'fell off'],
    text: (c) =>
      `Thank you for being honest. A slip doesn't erase the work you've done. The most helpful next step is to tell someone you trust, like ${c.sponsorName ?? c.coordinatorName}. If you used after a break, your body may not handle the amount it used to, so please don't use alone. If someone may be overdosing, call 911.`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'route', label: 'Clean time', route: { name: 'milestones' } }],
    related: ['overdose', 'craving-now'],
  },
  {
    id: 'overdose',
    topic: 'Cravings and slips',
    q: 'What are signs of an overdose?',
    keys: ['overdose', 'od', 'naloxone', 'narcan', 'signs of overdose', 'not breathing', 'wont wake up'],
    text: 'Signs of an opioid overdose include: won’t wake up, slow or no breathing, blue or gray lips, and tiny pupils. Call 911 right away. Naloxone (Narcan) can reverse an opioid overdose. Pharmacies sell it without a prescription. Stay with the person until help arrives.',
    actions: () => [{ kind: 'phone', label: 'Call 911', number: '911' }],
    related: ['slip'],
  },

  // Meetings and sponsors
  {
    id: 'meeting-what',
    topic: 'Meetings and sponsors',
    q: 'What happens at a meeting?',
    keys: ['what happens at a meeting', 'first meeting', 'meeting like', 'go to a meeting', 'nervous meeting', 'meeting'],
    text: 'Most meetings last about an hour. People sit together, someone reads a short opening, and people take turns sharing about their own recovery. You can just listen. Nobody has to talk, and there’s no cost. Arriving a few minutes early is a good way to meet people.',
    actions: () => [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }],
    related: ['meeting-talk', 'meeting-open', 'meeting-types'],
  },
  {
    id: 'meeting-talk',
    topic: 'Meetings and sponsors',
    q: 'Do I have to talk at a meeting?',
    keys: ['have to talk', 'have to share', 'do i talk', 'speak at', 'say something'],
    text: 'No. You can say "I’ll just listen today" or "pass." Lots of people listen for weeks before they share.',
    related: ['meeting-what'],
  },
  {
    id: 'meeting-open',
    topic: 'Meetings and sponsors',
    q: "What's the difference between open and closed meetings?",
    keys: ['open meeting', 'closed meeting', 'open and closed', 'open vs closed', 'bring a friend'],
    text: 'Open meetings are for anyone, including friends and family. Closed meetings are only for people who want help with their own drinking or drug use. The listing usually says which one it is.',
    actions: () => [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }],
    related: ['meeting-types'],
  },
  {
    id: 'meeting-types',
    topic: 'Meetings and sponsors',
    q: "What's the difference between AA, NA and SMART?",
    keys: ['aa', 'na', 'smart', 'difference between', 'which meeting', 'celebrate recovery', 'dharma', 'alcoholics anonymous', 'narcotics anonymous', '12 step', 'twelve step'],
    text: 'AA focuses on alcohol and NA on drugs. Both use the 12 steps and sponsors. SMART Recovery uses practical tools and doesn’t use steps. Celebrate Recovery is faith-based, and Recovery Dharma uses meditation. Many people try a few and keep going to the ones that feel right.',
    actions: () => [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }],
    related: ['meeting-what'],
  },
  {
    id: 'meeting-online',
    topic: 'Meetings and sponsors',
    q: 'Can I go to a meeting online?',
    keys: ['online meeting', 'zoom', 'virtual', 'from home', 'online'],
    text: 'Yes. Many groups meet online every day, so you can join from your phone. In Find a meeting, tap "Online" to see them.',
    actions: () => [{ kind: 'route', label: 'Online meetings', route: { name: 'calendar', tab: 'meetings' } }],
  },
  {
    id: 'sponsor-find',
    topic: 'Meetings and sponsors',
    q: 'How do I find a sponsor?',
    keys: ['find a sponsor', 'get a sponsor', 'need a sponsor', 'ask someone to sponsor', 'new sponsor'],
    text: 'Go to the same meetings for a while and listen for someone whose recovery you respect, who has been sober a good while. Then ask, "Would you be my sponsor?" It’s normal to ask, and it’s okay if the first person says no. You can add them in LifeCircle.',
    actions: () => [{ kind: 'route', label: 'Open LifeCircle', route: { name: 'lifecircle' } }],
    related: ['sponsor-what'],
  },
  {
    id: 'sponsor-what',
    topic: 'Meetings and sponsors',
    q: 'What does a sponsor do?',
    keys: ['sponsor do', 'what is a sponsor', 'sponsor for', 'sponsor', 'sponsors'],
    text: (c) =>
      `A sponsor is someone further along in recovery who helps you work the steps and is there when things get hard. ${c.sponsorName ? `Yours is ${c.sponsorName}.` : 'You can add yours in LifeCircle.'}`,
    actions: (c) =>
      c.sponsorName
        ? [{ kind: 'call', label: `Call ${c.sponsorName}`, who: 'sponsor' }]
        : [{ kind: 'route', label: 'Open LifeCircle', route: { name: 'lifecircle' } }],
    related: ['sponsor-find'],
  },

  // Feelings and sleep
  {
    id: 'sleep',
    topic: 'Feelings and sleep',
    q: "Why can't I sleep?",
    keys: ['sleep', 'cant sleep', 'insomnia', 'awake', 'tired', 'nightmares', 'up all night'],
    text: 'A lot of people have trouble sleeping in early recovery, and it often gets better with time. Things some people find helpful: getting up at the same time each day, putting the phone away before bed, and less caffeine after lunch. If it keeps happening, tell your counselor or prescriber. They can help.',
    actions: () => [{ kind: 'route', label: 'Log it on LifePath', route: { name: 'lifepath' } }],
    related: ['feelings-normal'],
  },
  {
    id: 'feelings-normal',
    topic: 'Feelings and sleep',
    q: 'Is it normal to feel this way?',
    keys: ['normal to feel', 'feel this way', 'mood swings', 'anxious', 'anxiety', 'depressed', 'sad', 'angry', 'numb', 'stressed', 'overwhelmed', 'bored'],
    text: (c) =>
      `Big ups and downs are common in recovery, and you're not the only one. Talking about it helps. ${c.sponsorName ?? c.coordinatorName} and your counselor are good people to tell. Logging your mood on LifePath can show you and your team how your weeks are going.`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'route', label: 'Open LifePath', route: { name: 'lifepath' } }],
    related: ['lonely'],
  },
  {
    id: 'lonely',
    topic: 'Feelings and sleep',
    q: 'I feel alone. What can I do?',
    keys: ['alone', 'lonely', 'no friends', 'no one', 'nobody', 'isolated'],
    text: 'Feeling alone is really hard, and a lot of people in recovery feel it, especially early on. Reaching out to one person today can help, even with a short text. Meetings are also a good place to meet people who get it.',
    actions: (c) => [
      { kind: 'route', label: 'Open LifeCircle', route: { name: 'lifecircle' } },
      { kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } },
      ...callSponsorOrMaya(c).slice(0, 1),
    ],
    related: ['feelings-normal'],
  },

  // Housing, food and money
  {
    id: 'housing-tonight',
    topic: 'Housing, food and money',
    q: 'I need a place to stay tonight.',
    keys: ['place to stay', 'stay tonight', 'kicked out', 'evicted', 'homeless', 'shelter', 'nowhere to go', 'out tonight', 'no place', 'lost my housing'],
    text: (c) =>
      `I'm sorry, that's a lot to deal with. ${c.coordinatorName} can help with housing, so the best first step is to call now. You can also call 211 any time for local shelter and housing help.`,
    actions: (c) => [
      { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' },
      call211,
      { kind: 'route', label: 'Local shelters', route: { name: 'resources', category: 'Shelter tonight' } },
      { kind: 'route', label: 'Eviction help', route: { name: 'resources', category: 'Eviction and legal help' } },
    ],
    related: ['food', 'bills'],
  },
  {
    id: 'local-help',
    topic: 'Housing, food and money',
    q: 'Where can I find local help?',
    keys: ['local help', 'local resources', 'resources', 'homeless coalition', 'legal aid', 'lawyer', 'legal help', 'housing authority', 'section 8', 'shelter list'],
    text: (c) =>
      `Local help has shelters, housing programs, free legal help with evictions, food and crisis lines, with phone numbers you can tap. ${c.coordinatorName} can help you pick the right one.`,
    actions: (c) => [
      { kind: 'route', label: 'Open Local help', route: { name: 'resources' } },
      { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' },
    ],
    related: ['housing-tonight', 'food'],
  },
  {
    id: 'food',
    topic: 'Housing, food and money',
    q: 'Where can I get food?',
    keys: ['food', 'hungry', 'food bank', 'groceries', 'snap', 'ebt', 'eat'],
    text: (c) => `Call 211 to find food banks and free meals near you. ${c.coordinatorName} can also help you apply for food benefits like SNAP.`,
    actions: (c) => [
      call211,
      { kind: 'route', label: 'Local food', route: { name: 'resources', category: 'Food' } },
      { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' },
    ],
  },
  {
    id: 'bills',
    topic: 'Housing, food and money',
    q: 'I need help paying bills.',
    keys: ['bills', 'rent', 'money', 'broke', 'pay', 'utilities', 'phone bill', 'debt'],
    text: (c) => `Money stress is really common. ${c.coordinatorName} can help you look at your options. 211 can also point you to local help with rent and utilities.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, call211],
  },

  // My program
  {
    id: 'clean-days',
    topic: 'My program',
    q: 'How many days do I have?',
    keys: ['how many days', 'my days', 'clean time', 'sober time', 'days clean', 'days sober', 'my date', 'milestone'],
    text: (c) =>
      c.cleanDays == null
        ? "You haven't set a clean date yet. You can set one in Clean time."
        : `You have ${c.cleanDays} ${c.cleanDays === 1 ? 'day' : 'days'}.${c.nextMilestone ? ` ${c.daysToNext} more to ${c.nextMilestone}.` : ''} Every one of them counts.`,
    actions: () => [{ kind: 'route', label: 'Open Clean time', route: { name: 'milestones' } }],
  },
  {
    id: 'next-appointment',
    topic: 'My program',
    q: "What's next on my calendar?",
    keys: ['next appointment', 'appointment', 'calendar', 'schedule', 'what do i have', 'when is', 'therapy', 'next on'],
    text: (c) => (c.nextEvent ? `Next up: ${c.nextEvent.title}, ${c.nextEvent.when}.` : 'Nothing else is on your calendar this week.'),
    actions: () => [{ kind: 'route', label: 'Open Calendar', route: { name: 'calendar' } }],
  },
  {
    id: 'coordinator',
    topic: 'My program',
    q: 'Who is my care coordinator?',
    keys: ['coordinator', 'case manager', 'who is maya', 'caseworker', 'who do i call'],
    text: (c) => `${c.coordinatorName} is your care coordinator and can help with your plan, housing, and anything you're stuck on. The red LifeTouch button reaches her any time.`,
    actions: (c) => [
      { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' },
      { kind: 'text', label: `Text ${c.coordinatorName}`, who: 'coordinator' },
    ],
  },
  {
    id: 'who-sees',
    topic: 'My program',
    q: 'Who can see my check-ins?',
    keys: ['who can see', 'private', 'privacy', 'who sees', 'share my', 'shared', 'see my check'],
    text: (c) =>
      `Your check-ins, moods and questions are encrypted and stay on this phone. They aren't in your cloud backups. The one exception is safety alerts: if you write something that sounds like you might be in danger, those words and the messages just before them are saved for ${c.coordinatorName} to review, if you said yes to that. You can turn it off in Settings.`,
    actions: () => [{ kind: 'route', label: 'Open Settings', route: { name: 'settings' } }],
  },
  {
    id: 'is-zoey-human',
    topic: 'My program',
    q: 'Is Zoey a real person?',
    keys: ['real person', 'are you real', 'are you human', 'are you a bot', 'who are you', 'zoey', 'therapist', 'counselor'],
    text: "No. I'm an automated assistant, not a person, counselor, or therapist. I can share general information and help you reach real people, like your coordinator and sponsor.",
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },

  // Using Life Works
  {
    id: 'app-reminder',
    topic: 'Using Life Works',
    q: 'How do I set a reminder?',
    keys: ['reminder', 'remind me', 'alarm', 'notification', 'notifications'],
    text: 'Open Reminders and tap "Add a reminder." Reminders only show the time on your lock screen, never what they’re for.',
    actions: () => [{ kind: 'route', label: 'Open Reminders', route: { name: 'reminders' } }],
  },
  {
    id: 'app-add-person',
    topic: 'Using Life Works',
    q: 'How do I add someone to my LifeCircle?',
    keys: ['add someone', 'add a person', 'add my', 'add contact', 'lifecircle', 'change sponsor'],
    text: 'Open LifeCircle and tap "Add a person." Put in their name and number, and pick who they are to you.',
    actions: () => [{ kind: 'route', label: 'Open LifeCircle', route: { name: 'lifecircle' } }],
  },
  {
    id: 'app-mood',
    topic: 'Using Life Works',
    q: 'How do I log my mood?',
    keys: ['log my mood', 'track mood', 'mood', 'lifepath', 'how am i doing'],
    text: 'Tap a face on LifePath any time, or do a check-in with me. Your mood shows up on the daily, monthly and yearly charts.',
    actions: () => [
      { kind: 'route', label: 'Open LifePath', route: { name: 'lifepath' } },
      { kind: 'route', label: 'Start a check-in', route: { name: 'askzoey' } },
    ],
  },
];

// Fixed replies used by the router (ask.ts), not matched by keywords.
export const FIXED = {
  medication: (c: AnswerContext) =>
    `That's a really good question for your prescriber or a pharmacist. I can't give advice about medications. Want to save it for your next appointment, or send it to ${c.coordinatorName}?`,
  // Never "wait for your appointment" on its own: anything unmatched could be
  // urgent in words the safety screen missed, so 988 / 911 always show.
  // Ed (2026-10-24): never "I don't have a good answer"; ask to hear more instead.
  fallback: (c: AnswerContext) =>
    `Thanks for telling me. Can you tell me a little more, so I understand? ${c.coordinatorName} is here to help too. If it's urgent or you don't feel safe, call or text 988, or call 911 in an emergency.`,
  // The second miss in a row: don't ask a third time, hand it to a person.
  fallbackAgain: (c: AnswerContext) =>
    `Thank you for explaining. ${c.coordinatorName} is the best person to help with this one. Want me to save it for your team, or send it to ${c.coordinatorName} now? If it's urgent or you don't feel safe, call or text 988, or call 911 in an emergency.`,
  withdrawal: (c: AnswerContext) =>
    `Withdrawal can be dangerous, especially from alcohol or benzos, so please don't do it alone. If there are seizures, confusion, seeing things, chest pain, or you can't keep fluids down, call 911 now. Otherwise, call ${c.coordinatorName} or your doctor today about a safe detox. The SAMHSA helpline can also find detox near you, free and 24/7.`,
  housing: (c: AnswerContext) =>
    `I'm sorry, that's a lot to carry, and you don't have to sort it out alone. ${c.coordinatorName} can help with housing, so call now if you can. 211 can find a shelter bed or emergency housing near you, day or night. If you're outside tonight and not safe, call 911.`,
  // Third person: help them get the friend to 988, not a crisis screen for the person asking.
  someone: () =>
    "It's good you're looking out for them. Ask them straight out if they're thinking about suicide; asking doesn't put the idea in their head. Stay with them if you can, and call or text 988 together. If they're in danger right now or have hurt themselves, call 911.",
  pregnant: (c: AnswerContext) =>
    `Thank you for telling me. You're not in trouble, and you deserve good care for you and the baby. Please talk to your doctor or ${c.coordinatorName} today. Stopping some drugs suddenly while pregnant can be risky, so don't try it alone; there is treatment that is safe during pregnancy. If you have bleeding, bad pain, or feel very sick, call 911.`,
  // Harm reduction, not a lecture: the goal is that they don't die tonight.
  using: (c: AnswerContext) =>
    `Thank you for being honest with me. ${c.sponsorName ?? c.coordinatorName} would want to hear from you right now, before you use. If you do use, please don't use alone: the Never Use Alone line will stay on the phone with you and send help if you stop responding. Keep naloxone (Narcan) close, and call 911 if someone is hard to wake or breathing slowly. Fentanyl is in a lot of the supply, so go slow.`,
  abuse: (c: AnswerContext) =>
    `I'm so sorry. What happened is not your fault. If you're in danger right now, call 911. The domestic violence hotline and RAINN answer 24/7, and calls are free and private. ${c.coordinatorName} can also help you find a safe place to stay.`,
  crisis: "I'm glad you told me. Please reach out to someone right now. You don't have to go through this alone.",
  safetyCheck: 'Thank you for telling me. First: are you safe right now?',
};
