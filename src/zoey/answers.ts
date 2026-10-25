// Zoey's answer library (step 3). Every answer is authored text, written to be
// signed off by a clinician before real use, the same as the check-in flow.
// Zoey gives general information and routes to people. She does not diagnose,
// interpret, or give medication or treatment advice (build plan, section 02).
//
// `keys` are words and phrases that point to an answer. A longer phrase match
// counts for more than a single word (see ask.ts).

import { moduleRoute, Route } from '../modules';

export const LIBRARY_VERSION = 'answers@0.1-draft';

export type AnswerContext = {
  name: string;
  coordinatorName: string;
  sponsorName: string | null;
  cleanDays: number | null;
  // "August 7, 2026", from the date they set in Clean time.
  cleanDate?: string | null;
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
  | 'Work, school and court'
  | 'Family and friends'
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
  'Work, school and court',
  'Family and friends',
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
    keys: ['craving', 'cravings', 'crave', 'urge', 'want to use', 'wanna use', 'want to drink', 'tempted', 'trigger', 'triggered', 'thinking about using', 'thinking about drinking', 'want to get high', 'wanna get high', 'want a drink', 'miss using', 'miss drinking', 'miss getting high', 'miss my old life', 'miss the old days', 'want a beer'],
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
    keys: ['slipped', 'slip', 'relapsed', 'used again', 'drank again', 'i used', 'got high', 'fell off', 'i drank', 'drank last night', 'used last night', 'i got drunk', 'got loaded', 'smoked weed', 'i smoked', 'took a hit', 'got stoned', 'i got high', 'drank a', 'had a drink', 'had a beer', 'took a pill', 'popped a'],
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

  {
    id: 'what-988',
    topic: 'Feelings and sleep',
    q: 'What is 988?',
    keys: ['988', 'what is 988', 'nine eight eight', 'crisis line', 'lifeline', 'crisis hotline'],
    text: '988 is the free Suicide and Crisis Lifeline. You can call or text 988 any time, day or night, and talk with a trained crisis counselor. It is for anyone who is struggling, thinking about suicide, in a mental health or substance use crisis, or worried about someone else. You don’t have to be in danger to call. If someone is hurt or in danger right now, call 911.',
    actions: () => [
      { kind: 'phone', label: 'Call 988', number: '988' },
      { kind: 'url', label: 'Text 988', url: 'sms:988' },
    ],
  },

  // Meetings and sponsors
  {
    id: 'meeting-what',
    topic: 'Meetings and sponsors',
    q: 'What happens at a meeting?',
    keys: ['what happens at a meeting', 'what happens at', 'first meeting', 'meeting like', 'nervous meeting', 'what is a meeting', 'at meetings', 'meetings like'],
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
    keys: ['aa', 'na', 'smart recovery', 'smart meeting', 'smart meetings', 'difference between', 'which meeting', 'celebrate recovery', 'dharma', 'alcoholics anonymous', 'narcotics anonymous', '12 step', 'twelve step'],
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
    keys: ['find a sponsor', 'get a sponsor', 'need a sponsor', 'ask someone to sponsor', 'new sponsor', 'dont have a sponsor', 'no sponsor', 'different sponsor', 'another sponsor'],
    text: 'Go to the same meetings for a while and listen for someone whose recovery you respect, who has been sober a good while. Then ask, "Would you be my sponsor?" It’s normal to ask, and it’s okay if the first person says no. You can add them in LifeCircle.',
    actions: () => [{ kind: 'route', label: 'Open LifeCircle', route: { name: 'lifecircle' } }],
    related: ['sponsor-what'],
  },
  {
    id: 'sponsor-what',
    topic: 'Meetings and sponsors',
    q: 'What does a sponsor do?',
    keys: ['sponsor do', 'what is a sponsor', 'sponsor for', 'whats a sponsor', 'what are sponsors', 'who is my sponsor', 'need a sponsor for'],
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
    keys: ['sleep', 'cant sleep', 'insomnia', 'up all night', 'trouble sleeping', 'stay asleep', 'fall asleep', 'waking up', 'wake up at night', 'keep waking', 'wake up in the night', 'sleeping'],
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
    keys: ['food', 'hungry', 'food bank', 'groceries', 'snap', 'ebt', 'eat', 'havent eaten', 'food stamps', 'free meal', 'free meals', 'starving', 'nothing to eat', 'no food', 'out of food'],
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
    keys: ['bills', 'money', 'broke', 'utilities', 'phone bill', 'debt', 'pay my bills', 'need money', 'no money', 'pay rent', 'help with rent', 'dollars to my name', 'out of money', 'cant afford', 'no cash', 'owe money'],
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
    id: 'clean-date',
    topic: 'My program',
    q: "What's my clean date?",
    keys: ['clean date', 'my clean date', 'sobriety date', 'sober date', 'my sobriety', 'sobriety', 'been sober', 'been clean', 'how long have i been', 'get clean', 'got clean', 'get sober', 'got sober', 'sober since', 'clean since'],
    text: (c) =>
      c.cleanDays == null || !c.cleanDate
        ? "You haven't set a clean date yet. You can add it in Clean time, and I'll keep count for you."
        : `Your clean date is ${c.cleanDate}. That's ${c.cleanDays} ${c.cleanDays === 1 ? 'day' : 'days'}, and every one of them counts.${c.nextMilestone ? ` ${c.daysToNext} more to ${c.nextMilestone}!` : ''}`,
    actions: () => [{ kind: 'route', label: 'Open Clean time', route: { name: 'milestones' } }],
  },
  {
    id: 'next-appointment',
    topic: 'My program',
    q: "What's next on my calendar?",
    keys: ['next appointment', 'appointment', 'calendar', 'schedule', 'what do i have', 'next on', 'whats next', 'do i have anything', 'am i busy', 'appt', 'next appt', 'my appt', 'appointments'],
    text: (c) => (c.nextEvent ? `Next up: ${c.nextEvent.title}, ${c.nextEvent.when}.` : 'Nothing else is on your calendar this week.'),
    actions: () => [{ kind: 'route', label: 'Open Calendar', route: { name: 'calendar' } }],
  },
  {
    id: 'coordinator',
    topic: 'My program',
    q: 'Who is my care coordinator?',
    keys: ['coordinator', 'case manager', 'who is maya', 'caseworker', 'who do i call', 'call maya', 'text maya', 'talk to maya', 'call my coordinator', 'call my case manager'],
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
    keys: ['who can see', 'private', 'privacy', 'who sees', 'share my', 'see my check', 'see what i write', 'read my messages'],
    text: (c) =>
      `Your check-ins, moods, questions and what I've learned about how you talk are encrypted and stay on this phone. They aren't in your cloud backups. The one exception is safety alerts: if you write something that sounds like you might be in danger, those words and the messages just before them are saved for ${c.coordinatorName} to review, if you said yes to that. You can turn it off in Settings.`,
    actions: () => [{ kind: 'route', label: 'Open Settings', route: { name: 'settings' } }],
  },
  {
    id: 'what-zoey-learned',
    topic: 'Using Life Works',
    q: 'What does Zoey know about me?',
    keys: ['what do you know about me', 'what have you learned', 'what did you learn', 'what do you remember', 'do you remember me', 'do you learn', 'are you learning', 'what zoey learned', 'what zoey has learned', 'forget what i said', 'forget everything', 'clear what you learned', 'stop learning', 'do you remember what i said'],
    text: "I learn a little about how you talk so I understand you better, like words you use, the way you ask things, what to call you, your favorite things, and if you like short answers. It stays on this phone and isn't sent to staff. You can see all of it, remove any of it, or turn it off in Settings.",
    actions: () => [{ kind: 'route', label: 'What Zoey has learned', route: { name: 'learned' } }],
  },
  {
    id: 'is-zoey-human',
    topic: 'My program',
    q: 'Is Zoey a real person?',
    keys: ['are you a real person', 'is zoey a real person', 'are you real', 'are you human', 'are you a bot', 'are you a robot', 'are you ai', 'are you a computer', 'who are you', 'is this a real person', 'am i talking to a person', 'real human', 'a real human', 'r u a bot', 'u a bot', 'are u a bot', 'are u real', 'are you a person', 'are u human', 'r u real', 'are you alive'],
    text: "I'm not a real person. I'm Zoey, an automated helper, not a counselor or therapist. I can share general information and help you reach real people, like your coordinator and sponsor.",
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },

  // Using Life Works
  {
    id: 'app-reminder',
    topic: 'Using Life Works',
    q: 'How do I set a reminder?',
    keys: ['reminder', 'reminders', 'remind me', 'alarm', 'notification', 'notifications'],
    text: 'Open Reminders to add one with "Add a reminder," or to switch one off. Reminders only show the time on your lock screen, never what they’re for.',
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
    keys: ['log my mood', 'track mood', 'mood', 'lifepath', 'how am i doing', 'my moods', 'see my mood', 'see my moods', 'mood chart', 'mood history', 'my mood'],
    text: 'Tap a face on LifePath any time, or do a check-in with me. Your mood shows up on the daily, monthly and yearly charts.',
    actions: () => [
      { kind: 'route', label: 'Open LifePath', route: { name: 'lifepath' } },
      { kind: 'route', label: 'Start a check-in', route: { name: 'askzoey' } },
    ],
  },
  // Everyday questions and statements from a review of what residents type
  // (Ed, 2026-10-25: "come up with better answers to the statements or questions").
  {
    id: 'meeting-find',
    topic: 'Meetings and sponsors',
    q: 'Where and when is a meeting?',
    keys: ['find a meeting', 'meeting tonight', 'meeting today', 'meetings tonight', 'meetings today', 'meeting near', 'meetings near', 'closest meeting', 'nearest meeting', 'where is the meeting', 'where is a meeting', 'where are meetings', 'what time is the meeting', 'when is the meeting', 'when is my meeting', 'meeting time', 'meeting times', 'time is the meeting', 'meeting tomorrow', 'any meetings', 'a meeting near me', 'wheres a meeting', 'where a meeting', 'meeting at', 'meetings close', 'meeting close', 'close by', 'meetings around', 'meeting around', 'meetings in my area'],
    text: (c) =>
      `The meeting finder has AA, NA, SMART and other meetings, with times and places. You can save one to your calendar so I can remind you.${c.meetingsThisWeek ? ` You have ${c.meetingsThisWeek} on your calendar this week.` : ''}`,
    actions: () => [
      { kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } },
      { kind: 'route', label: 'Open Calendar', route: { name: 'calendar' } },
    ],
    related: ['meeting-online', 'meeting-what'],
  },
  {
    id: 'meeting-dont-want',
    topic: 'Meetings and sponsors',
    q: "I don't want to go to my meeting.",
    keys: ['dont want to go to my meeting', 'dont want to go to a meeting', 'dont feel like going', 'have to go to meetings', 'skip my meeting', 'skip the meeting', 'meetings are boring', 'meetings suck', 'hate meetings', 'meetings are pointless', 'dont like meetings'],
    text: (c) =>
      `That’s a really common feeling, and it’s okay to say it. A lot of people find the days they don’t want to go are the days it helps most. You don’t have to talk, you can just sit in the back and listen. If meetings aren’t clicking, try a different one, or talk with ${c.sponsorName ?? c.coordinatorName} about what would fit you better.`,
    actions: (c) => [{ kind: 'route', label: 'Find a different meeting', route: { name: 'calendar', tab: 'meetings' } }, ...callSponsorOrMaya(c).slice(0, 1)],
    related: ['meeting-types', 'meeting-online'],
  },
  {
    id: 'sponsor-reach',
    topic: 'Meetings and sponsors',
    q: 'How do I reach my sponsor?',
    keys: ['call my sponsor', 'text my sponsor', 'talk to my sponsor', 'chat with my sponsor', 'message my sponsor', 'sponsor wont answer', 'sponsor isnt answering', 'sponsor didnt answer', 'cant reach my sponsor', 'sponsor wont call', 'sponsor didnt call', 'sponsor never answers', 'sponsor is busy', 'sponsor is ignoring', 'sponsor ignoring', 'sponsor ignores', 'sponsor wont text', 'sponsor doesnt answer', 'sponsor wont call me back', 'sponsor never calls', 'sponsor didnt text'],
    text: (c) =>
      c.sponsorName
        ? `Here’s ${c.sponsorName}. If ${c.sponsorName} doesn’t pick up, leave a short message and try someone else in your LifeCircle. Sponsors miss calls too, so it’s not about you.`
        : 'You haven’t added a sponsor yet. You can add one in LifeCircle, and until then anyone in your LifeCircle is a good call.',
    actions: (c) =>
      c.sponsorName
        ? [
            { kind: 'call', label: `Call ${c.sponsorName}`, who: 'sponsor' },
            { kind: 'text', label: `Text ${c.sponsorName}`, who: 'sponsor' },
            { kind: 'route', label: 'Open my LifeCircle', route: { name: 'lifecircle' } },
          ]
        : [{ kind: 'route', label: 'Open LifeCircle', route: { name: 'lifecircle' } }],
  },
  {
    id: 'twelve-steps',
    topic: 'Meetings and sponsors',
    q: 'What are the 12 steps?',
    keys: ['12 steps', 'twelve steps', 'the steps', 'work the steps', 'working the steps', 'step 1', 'step one', 'first step', 'step work', 'what step', 'step 4', 'step four', 'step 2', 'step 3', 'step 5', 'step 6', 'step 7', 'step 8', 'step 9', 'step 10', 'step 11', 'step 12', 'step two', 'step three', 'step five', 'step six', 'step seven', 'step eight', 'step nine', 'step ten', 'step eleven', 'step twelve'],
    text: (c) =>
      `The 12 steps are a path many people use in AA and NA. Step 1 is admitting you’re powerless over your addiction and that life had become unmanageable. The steps after that are about hope, honesty, making amends and helping others. You work them with a sponsor, one at a time, at your own pace${c.sponsorName ? `, so ${c.sponsorName} is the best person to ask about where you are` : ''}.`,
    actions: (c) => callSponsorOrMaya(c).slice(0, 1),
    related: ['sponsor-what', 'meeting-types'],
  },
  {
    id: 'relapse-what',
    topic: 'Cravings and slips',
    q: 'What happens if I relapse?',
    keys: ['what happens if i relapse', 'if i relapse', 'what if i relapse', 'what if i use', 'what if i drink', 'what if i slip', 'scared to relapse', 'afraid to relapse', 'scared of relapsing', 'afraid i will relapse'],
    text: (c) =>
      `A relapse doesn’t erase your recovery, and it doesn’t mean you failed. If it happens, the most important thing is to tell someone right away, like ${c.sponsorName ?? c.coordinatorName}, so you get support fast. Every house has its own rules about use, so ${c.coordinatorName} can tell you what it would mean for your housing.`,
    actions: (c) => callSponsorOrMaya(c),
    related: ['craving-now', 'slip'],
  },
  {
    id: 'dreams',
    topic: 'Feelings and sleep',
    q: 'I had a dream about using.',
    keys: ['nightmare', 'nightmares', 'bad dream', 'bad dreams', 'using dream', 'using dreams', 'drinking dream', 'dream about using', 'dreamed about using', 'dreamt about using', 'dream about drinking', 'dreamed i used', 'dreaming about using', 'dreaming about drinking', 'dreams about using', 'dreams about drinking', 'dreaming about'],
    text: 'Using dreams and nightmares are really common in recovery, especially in the first year. They don’t mean you want to use or that something is wrong with you. It can help to tell someone about it, and to get some water and a few slow breaths when you wake up.',
    actions: (c) => callSponsorOrMaya(c).slice(0, 1),
    related: ['sleep'],
  },
  {
    id: 'calm',
    topic: 'Feelings and sleep',
    q: 'How do I calm down?',
    keys: ['calm down', 'relax', 'breathing', 'breathe', 'breathing exercise', 'panic attack', 'panic attacks', 'anxiety attack', 'racing thoughts', 'stop thinking', 'cant stop thinking', 'bad thoughts', 'cant calm down', 'freaking out', 'grounding'],
    text: 'Try this with me: breathe in slowly for 4, hold for 4, and breathe out for 6. Do it five times. If your mind is racing, name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell and 1 you can taste. If the thoughts are about hurting yourself, please call or text 988, the free Suicide and Crisis Lifeline.',
    actions: (c) => [...callSponsorOrMaya(c).slice(0, 1), { kind: 'crisis', label: 'Call or text 988' }],
    related: ['feelings-normal'],
  },
  {
    id: 'self-worth',
    topic: 'Feelings and sleep',
    q: 'I feel like a failure.',
    keys: ['failure', 'hate myself', 'im ugly', 'i am ugly', 'worthless', 'not good enough', 'im a loser', 'im a mess', 'disappointment', 'never get better', 'i ruin everything', 'im stupid', 'im so stupid', 'im dumb', 'im so dumb', 'i suck', 'feel stupid', 'feel dumb', 'feel like an idiot', 'feel worthless', 'feel like a loser', 'feel like garbage', 'feel like trash'],
    text: (c) =>
      `I’m sorry you’re feeling that way about yourself, ${c.name}. That voice is loud in recovery, but it isn’t the truth. You’re here, you’re trying, and that counts. Who in your LifeCircle could you talk to today? If you start having thoughts of hurting yourself, please call or text 988, the free Suicide and Crisis Lifeline.`,
    actions: (c) => [...callSponsorOrMaya(c).slice(0, 1), { kind: 'crisis', label: 'Call or text 988' }],
  },
  {
    id: 'counseling',
    topic: 'Feelings and sleep',
    q: 'I want to talk to a counselor.',
    keys: ['therapist', 'counselor', 'counseling', 'therapy', 'mental health', 'talk to someone', 'talk to a real person', 'talk to a person', 'need someone to talk to', 'psychiatrist', 'someone to talk to'],
    text: (c) =>
      `Talking to a real person can really help. ${c.coordinatorName} can set you up with counseling or mental health care, and ${c.sponsorName ?? 'anyone in your LifeCircle'} is a call away right now. If it’s urgent, call or text 988, the free Suicide and Crisis Lifeline.`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'crisis', label: 'Call or text 988' }],
  },
  {
    id: 'win',
    topic: 'My program',
    q: 'Something good happened!',
    keys: ['went to a meeting', 'made it to a meeting', 'made it to my meeting', 'called my sponsor', 'got a job', 'got hired', 'got the job', 'passed my ua', 'passed my drug test', 'clean ua', 'got my chip', 'got a chip', 'got my coin', 'hit 30 days', 'hit 60 days', 'hit 90 days', 'had a good day', 'good day today', 'today was good', 'today was great', 'great day', 'got my license', 'got my id', 'got my kids back', 'got an apartment', 'passed my test', 'finished my', 'graduated', 'new job', 'made it to', 'went to my first meeting', 'went to my meeting', 'first meeting today', 'days today', 'did my first', 'got a raise', 'got promoted', 'celebrated', 'months clean', 'months sober', 'year clean', 'year sober', '6 months', 'six months', '1 year', 'one year', '30 days', '60 days', '90 days'],
    text: (c) =>
      `That’s awesome, ${c.name}! 🎉 Moments like this are worth celebrating, and you earned it. Want to save it in LifeEvent so you can look back on it on harder days?`,
    actions: (c) => [
      { kind: 'route', label: 'Save it in LifeEvent', route: moduleRoute('lifeevent') },
      ...(c.sponsorName ? [{ kind: 'text' as const, label: `Tell ${c.sponsorName}`, who: 'sponsor' as const }] : []),
    ],
  },
  {
    id: 'kids-family',
    topic: 'Family and friends',
    q: 'I miss my kids.',
    keys: ['miss my kids', 'see my kids', 'my kids', 'my children', 'my son', 'my daughter', 'my baby', 'custody', 'visitation', 'cps', 'my mom', 'my dad', 'my parents', 'my family', 'my brother', 'my sister', 'my grandma'],
    text: (c) =>
      `Family can be one of the hardest and most important parts of recovery. Do you want to tell me more about what’s going on? ${c.coordinatorName} can help with things like visits and custody steps, and ${c.sponsorName ?? 'your LifeCircle'} has probably been through something like it.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, ...(c.sponsorName ? [{ kind: 'call' as const, label: `Call ${c.sponsorName}`, who: 'sponsor' as const }] : [])],
  },
  {
    id: 'breakup',
    topic: 'Family and friends',
    q: 'My partner left me.',
    keys: ['broke up', 'break up', 'breakup', 'broken up', 'left me', 'dumped me', 'my girlfriend', 'my boyfriend', 'my wife', 'my husband', 'my partner', 'my ex', 'divorce', 'cheated on me', 'heartbroken'],
    text: (c) =>
      `I’m so sorry. A breakup hurts, and in early recovery it can hit even harder. Please don’t go through tonight alone. Could you call ${c.sponsorName ?? 'someone in your LifeCircle'}? It’s okay to feel this. Want to tell me what happened?`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'route', label: 'Open my LifeCircle', route: { name: 'lifecircle' } }],
  },
  {
    id: 'friend-using',
    topic: 'Family and friends',
    q: 'My friend is using again.',
    keys: ['my friend relapsed', 'friend relapsed', 'friend is using', 'friend started using', 'friend using', 'friend is drinking', 'friend drinking', 'roommate is using', 'roommate relapsed', 'someone in my house is using', 'someone is using', 'homie relapsed', 'buddy relapsed', 'cousin relapsed', 'brother relapsed', 'sister relapsed', 'he relapsed', 'she relapsed', 'they relapsed', 'hes using', 'shes using', 'he is using', 'she is using', 'theyre using', 'he started using', 'she started using', 'boyfriend is using', 'boyfriend is drinking', 'girlfriend is using', 'girlfriend is drinking', 'husband is using', 'husband is drinking', 'wife is using', 'wife is drinking', 'partner is using', 'partner is drinking', 'mom is using', 'mom is drinking', 'dad is using', 'dad is drinking', 'brother is using', 'brother is drinking', 'sister is using', 'sister is drinking', 'son is using', 'son is drinking', 'daughter is using', 'daughter is drinking'],
    text: (c) =>
      `That’s really hard to see. You can care about them without putting your own recovery at risk. Tell ${c.sponsorName ?? c.coordinatorName} how you’re feeling about it. If they’re hard to wake or breathing slowly, call 911 and use naloxone (Narcan) if you have it.`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'phone', label: 'Call 911', number: '911' }],
  },
  {
    id: 'job-find',
    topic: 'Work, school and court',
    q: 'How do I find a job?',
    keys: ['need a job', 'find a job', 'find work', 'get a job', 'looking for work', 'looking for a job', 'job search', 'resume', 'job application', 'job interview', 'apply for jobs', 'who is hiring', 'hiring', 'interview', 'application', 'fill out an application', 'job fair'],
    text: (c) =>
      `Looking for work is a big step, and a good one. ${c.coordinatorName} can help you put together a resume, practice for interviews and find employers who hire people in recovery. Add it to LifeGoals under Career so you can track it.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, { kind: 'route', label: 'Open LifeGoals', route: moduleRoute('lifegoals') }],
    related: ['job-hard'],
  },
  {
    id: 'job-hard',
    topic: 'Work, school and court',
    q: 'Work is hard right now.',
    keys: ['hate my job', 'work was hard', 'work is hard', 'bad day at work', 'my boss', 'got fired', 'lost my job', 'laid off', 'let go from', 'work sucks', 'stressful at work', 'quit my job'],
    text: (c) =>
      `I’m sorry, work stress is real, and it can be a trigger. What happened? If you lost your job, it doesn’t define you, and ${c.coordinatorName} can help with next steps. Today is a good day to lean on ${c.sponsorName ?? 'your LifeCircle'}.`,
    actions: (c) => callSponsorOrMaya(c),
    related: ['job-find'],
  },
  {
    id: 'court',
    topic: 'Work, school and court',
    q: 'I have court coming up.',
    keys: ['court', 'court date', 'probation', 'probation officer', 'parole', 'parole officer', 'my po', 'judge', 'warrant', 'drug court', 'public defender'],
    text: (c) =>
      `Court and probation can feel like a lot. Put every date in your Calendar so I can remind you, and let ${c.coordinatorName} know. She can often help with letters or proof of treatment, and Check In/Out keeps a record of the meetings and groups you went to.`,
    actions: (c) => [{ kind: 'route', label: 'Open Calendar', route: { name: 'calendar' } }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
    related: ['local-help'],
  },
  {
    id: 'ua',
    topic: 'Work, school and court',
    q: "I'm worried about my drug test.",
    keys: ['ua', 'drug test', 'drug screen', 'pee test', 'urine test', 'uas', 'dirty ua', 'hot ua', 'fail my ua', 'fail my test', 'failed my ua', 'test dirty', 'test positive'],
    text: (c) =>
      `If you’re worried about a test, the best thing is to be honest with ${c.coordinatorName} before the result comes back. It’s much easier to make a plan together. If you used, that’s a slip, not the end of your recovery.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, ...(c.sponsorName ? [{ kind: 'call' as const, label: `Call ${c.sponsorName}`, who: 'sponsor' as const }] : [])],
    related: ['slip'],
  },
  {
    id: 'school',
    topic: 'Work, school and court',
    q: 'How do I go back to school?',
    keys: ['ged', 'go back to school', 'back to school', 'college', 'classes', 'fafsa', 'degree', 'community college', 'get my diploma', 'finish school'],
    text: (c) =>
      `That’s a great goal! Add it to LifeGoals under Education, and ${c.coordinatorName} can help you find GED classes or a school program, and help with paperwork like financial aid.`,
    actions: (c) => [{ kind: 'route', label: 'Open LifeGoals', route: moduleRoute('lifegoals') }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'ride',
    topic: 'Work, school and court',
    q: 'I need a ride.',
    keys: ['need a ride', 'ride to', 'get a ride', 'bus pass', 'bus', 'transportation', 'no car', 'my car', 'how do i get to', 'get to my', 'uber', 'lyft'],
    text: (c) =>
      `${c.coordinatorName} can help with rides and bus passes. For medical appointments, Medicaid often covers a free ride if you book ahead, so ask ${c.coordinatorName} to set it up. Someone in your LifeCircle might be able to help too.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, { kind: 'route', label: 'Open my LifeCircle', route: { name: 'lifecircle' } }],
  },
  {
    id: 'doctor',
    topic: 'Housing, food and money',
    q: 'I need a doctor.',
    keys: ['need a doctor', 'see a doctor', 'find a doctor', 'doctor appointment', 'dentist', 'clinic', 'urgent care', 'insurance', 'medicaid', 'apple health', 'health care', 'healthcare', 'eye doctor', 'glasses', 'teeth', 'toothache', 'tooth'],
    text: (c) =>
      `${c.coordinatorName} can help you find a doctor or dentist, and sign up for Medicaid (Apple Health in Washington) if you don’t have insurance. If it’s serious or can’t wait, go to urgent care, or call 911 in an emergency.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, call211],
  },
  {
    id: 'id-docs',
    topic: 'Housing, food and money',
    q: 'How do I get my ID back?',
    keys: ['my id', 'lost my id', 'get my id', 'state id', 'id card', 'birth certificate', 'social security card', 'drivers license', 'license', 'documents', 'paperwork', 'wallet', 'lost my wallet', 'my wallet'],
    text: (c) =>
      `Getting your ID back is a common first step, and you don’t have to figure it out alone. ${c.coordinatorName} can help you get your birth certificate, social security card and state ID. Bring anything you have with your name on it.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'clothes',
    topic: 'Housing, food and money',
    q: 'Where can I get clothes?',
    keys: ['clothes', 'clothing', 'shoes', 'coat', 'jacket', 'winter coat', 'toiletries', 'hygiene', 'work clothes', 'boots'],
    text: (c) => `Many places give out free clothes, coats and hygiene items. Call 211 to find one near you, or ask ${c.coordinatorName}, who may know a clothing closet close by.`,
    actions: (c) => [call211, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'house-rules',
    topic: 'Housing, food and money',
    q: 'What are the house rules?',
    keys: ['curfew', 'house rules', 'rules', 'visitor', 'visitors', 'visit', 'can my kids visit', 'pet', 'pets', 'smoke', 'smoking', 'vape', 'chores', 'overnight', 'sign out', 'have a phone', 'guest', 'guests', 'have my girlfriend over', 'have my boyfriend over', 'have someone over', 'have people over', 'have friends over', 'girlfriend over', 'boyfriend over', 'be home by', 'have to be home', 'home by', 'weekend pass', 'overnight pass', 'pass for the weekend', 'get a pass'],
    text: (c) =>
      `Rules like curfew, visitors, pets and smoking are set by your house. MyHome has your house details, and your house manager or ${c.coordinatorName} can tell you exactly what’s allowed.`,
    actions: (c) => [{ kind: 'route', label: 'Open MyHome', route: { name: 'myhome' } }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'roommates',
    topic: 'Housing, food and money',
    q: 'My roommate is driving me crazy.',
    keys: ['roommate', 'roommates', 'housemate', 'housemates', 'move out', 'moving out', 'fit in here', 'dont fit in', 'dont belong', 'everyone here', 'people here', 'people in my house', 'roomate', 'roomates', 'leave this house', 'leave the house', 'leave this place', 'hate this house', 'hate this place', 'stole my'],
    text: (c) =>
      `Living with other people in recovery can be hard sometimes. Want to tell me what’s going on? Your house manager can help sort out problems in the house, and ${c.coordinatorName} can talk with you about your housing.`,
    actions: (c) => [{ kind: 'route', label: 'Open MyHome', route: { name: 'myhome' } }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'rent-due',
    topic: 'Housing, food and money',
    q: 'When is my rent due?',
    keys: ['rent due', 'when is rent', 'rent is due', 'my rent', 'my lease', 'lease', 'how much is rent', 'how much is my rent', 'rent', 'owe for rent', 'owe rent', 'how much do i owe', 'rent payment'],
    text: (c) => `Your rent and lease details are in MyHome. If you’re worried about paying, ${c.coordinatorName} can help you look at options.`,
    actions: (c) => [{ kind: 'route', label: 'Open MyHome', route: { name: 'myhome' } }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
    related: ['bills'],
  },
  {
    id: 'fentanyl',
    topic: 'Cravings and slips',
    q: 'What is fentanyl?',
    keys: ['fentanyl', 'fent', 'test strips', 'test my drugs', 'fentanyl test', 'xylazine', 'tranq', 'never use alone', 'pressed pills'],
    text: (c) =>
      `Fentanyl is a very strong opioid that’s in a lot of street drugs, even pills that look real. A tiny amount can cause an overdose. I hope you’ll call ${c.sponsorName ?? c.coordinatorName} before using. If you do use, never use alone: the Never Use Alone line stays on the phone and sends help if you stop responding. Keep naloxone (Narcan) close.`,
    actions: (c) => [...callSponsorOrMaya(c).slice(0, 1), { kind: 'phone', label: 'Never Use Alone', number: '18004843731' }],
    related: ['overdose'],
  },
  {
    id: 'shaky',
    topic: 'Cravings and slips',
    q: "I can't stop shaking.",
    keys: ['shaking', 'shaky', 'cant stop shaking', 'the shakes', 'tremors', 'trembling', 'hands are shaking', 'sweating', 'sweats'],
    text: (c) =>
      `Shaking can come from withdrawal, anxiety, or not eating, and withdrawal can be dangerous. If you also have confusion, seeing things, a seizure, or chest pain, call 911 now. Otherwise, please call ${c.coordinatorName} or your doctor today, and try to eat something and drink water.`,
    actions: (c) => [{ kind: 'phone', label: 'Call 911', number: '911' }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'party',
    topic: 'Cravings and slips',
    q: 'Can I go to a party?',
    keys: ['party', 'parties', 'go to a party', 'go out drinking', 'go to a bar', 'bar', 'club', 'concert', 'wedding', 'cookout', 'bbq', 'go out tonight'],
    text: (c) =>
      `Parties can be tough in recovery, especially if there’s drinking or using. If you go, bring a sober friend, keep your own drink in your hand, plan how you’ll leave, and keep your phone ready to call ${c.sponsorName ?? 'someone in your LifeCircle'}. Check your house rules too. It’s also okay to skip it.`,
    actions: (c) => callSponsorOrMaya(c).slice(0, 1),
    related: ['craving-now'],
  },
  {
    id: 'grief',
    topic: 'Family and friends',
    q: 'Someone I love died.',
    keys: ['passed away', 'he died', 'she died', 'mom died', 'dad died', 'mother died', 'father died', 'friend died', 'brother died', 'sister died', 'grandma died', 'grandpa died', 'son died', 'daughter died', 'cousin died', 'uncle died', 'aunt died', 'wife died', 'husband died', 'boyfriend died', 'girlfriend died', 'best friend died', 'someone died', 'funeral', 'grief', 'grieving', 'rip', 'lost my mom', 'lost my dad', 'lost my brother', 'lost my sister', 'lost my friend', 'lost my son', 'lost my daughter', 'lost my grandma', 'lost my grandpa', 'lost my best friend', 'mom passed', 'dad passed', 'mother passed', 'father passed', 'friend passed', 'brother passed', 'sister passed', 'grandma passed', 'grandpa passed', 'son passed', 'daughter passed', 'cousin passed', 'uncle passed', 'aunt passed', 'wife passed', 'husband passed', 'boyfriend passed', 'girlfriend passed'],
    text: (c) =>
      `I’m so sorry for your loss, ${c.name}. Grief is really heavy, and it can stir up cravings, so please don’t carry it alone. Let ${c.sponsorName ?? c.coordinatorName} know what happened, and lean on your LifeCircle. Do you want to tell me about them?`,
    actions: (c) => [...callSponsorOrMaya(c), { kind: 'route', label: 'Open my LifeCircle', route: { name: 'lifecircle' } }],
  },
  {
    id: 'job-disclose',
    topic: 'Work, school and court',
    q: 'Do I have to tell my job I’m in recovery?',
    keys: ['tell my job', 'tell my boss', 'tell my employer', 'tell work', 'tell my work', 'employer know', 'boss know', 'background check'],
    text: (c) => `In most cases, whether you share that you’re in recovery at work is your choice. ${c.coordinatorName} can help you think it through, and help with questions about background checks.`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'house-help',
    topic: 'Housing, food and money',
    q: 'Who do I ask about things in the house?',
    keys: ['house manager', 'wifi', 'wi fi', 'password', 'bed is broken', 'toilet is broken', 'washer', 'dryer', 'fridge', 'broken window', 'broken door', 'repair', 'fix my', 'laundry', 'detergent', 'took my stuff', 'my stuff', 'toilet', 'no hot water', 'heat', 'lock', 'key', 'keys', 'my bed', 'bedroom'],
    text: (c) => `Your house manager handles things like wifi, repairs, supplies and problems in the house. MyHome has your house details, and ${c.coordinatorName} can help if it isn’t getting sorted out.`,
    actions: (c) => [{ kind: 'route', label: 'Open MyHome', route: { name: 'myhome' } }, { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }],
  },
  {
    id: 'program-terms',
    topic: 'Meetings and sponsors',
    q: 'What is a chip or a home group?',
    keys: ['home group', 'chip', 'chips', 'coin', 'keytag', 'key tag', 'sober mean', 'what does sober', 'what is sober', 'sobriety mean', 'clean mean', 'what does clean', 'recovery birthday', 'service work', 'big book'],
    text: 'A few recovery words: your home group is the meeting you go to regularly and call your own. Chips, coins or key tags mark clean time, like 24 hours, 30, 60 and 90 days, and you usually pick them up at a meeting. Sober or clean means not using alcohol or drugs. The Big Book is AA’s main book.',
    actions: () => [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }],
    related: ['meeting-types', 'twelve-steps'],
  },
  {
    id: 'sponsor-trouble',
    topic: 'Meetings and sponsors',
    q: "My sponsor and I aren't getting along.",
    keys: ['sponsor yelled', 'sponsor is mean', 'sponsor is mad', 'sponsor mad at me', 'dont like my sponsor', 'fight with my sponsor', 'sponsor and i', 'sponsor is rude', 'sponsor judged me'],
    text: 'Sponsors are people too, and things can get tense. It’s okay to talk it through with them when you’re both calm. If it doesn’t feel right, it’s also okay to find a new sponsor. That’s common, and it doesn’t mean you did anything wrong.',
    actions: (c) => callSponsorOrMaya(c).slice(0, 1),
    related: ['sponsor-find'],
  },
  {
    id: 'app-calendar',
    topic: 'Using Life Works',
    q: 'How do I add an appointment?',
    keys: ['add an appointment', 'add appointment', 'add to my calendar', 'put it on my calendar', 'add a meeting', 'add an event', 'add something to my calendar', 'new appointment'],
    text: 'Open Calendar and tap "Add." Put in what it is and when, and I’ll remind you before it starts.',
    actions: () => [{ kind: 'route', label: 'Open Calendar', route: { name: 'calendar' } }],
  },
  {
    id: 'zoey-chat',
    topic: 'Using Life Works',
    q: 'Do you like me?',
    keys: ['are you smart', 'do you like me', 'do you love me', 'favorite color', 'favorite food', 'your favorite', 'are you happy', 'do you sleep', 'are you my friend', 'be my friend', 'whats your favorite'],
    text: 'Ha, I try! 😄 I’m just an app, so no favorite color or snacks for me, but I really like talking with you. What’s on your mind?',
  },
  {
    id: 'zoey-sick',
    topic: 'Using Life Works',
    q: 'What illness do you have?',
    keys: ['illness do you have', 'sickness do you have', 'disease do you have', 'are you sick', 'do you get sick', 'do you ever get sick', 'do you have a disease', 'do you have an illness', 'are you ill', 'do you have covid', 'whats wrong with you', 'are you ok zoey', 'are you okay zoey', 'are you feeling ok', 'are you feeling okay', 'can you get sick'],
    // Ed (2026-10-25): "what illness do you have" is about Zoey: honest, light, then back to them.
    text: () =>
      [
        'Me? I’m an app, so I don’t get sick, not even a sniffle! 😄 But I care about how you’re feeling. Are you feeling okay today?',
        'Nope, no illness here. I’m just an app, so no colds and no flu for me. 😄 How about you? How are you feeling?',
        'I don’t have any illness. I’m not a person, so I can’t get sick, but I sure want you to feel good. How are you doing?',
      ][Math.floor(Math.random() * 3)],
  },
  {
    id: 'health-question',
    topic: 'Feelings and sleep',
    q: 'What illness do I have?',
    keys: ['illness do i have', 'disease do i have', 'sickness do i have', 'do i have a disease', 'do i have an illness', 'whats wrong with me', 'what is wrong with me', 'am i sick', 'what do i have', 'do i have depression', 'do i have anxiety', 'do i have adhd', 'do i have bipolar', 'do i have ptsd', 'do i have an addiction', 'am i an addict', 'am i an alcoholic', 'am i crazy', 'is something wrong with me'],
    // Never a label or a guess about their health (build plan section 02).
    text: (c) =>
      `I can’t tell what’s going on with your health. Only a doctor or counselor can do that, after really talking with you. If something doesn’t feel right, ${c.coordinatorName} can help you get an appointment. Want to tell me what’s been going on?`,
    actions: (c) => [{ kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' }, { kind: 'save', label: 'Save for my doctor' }],
    related: ['counseling', 'doctor'],
  },
  {
    id: 'motivation',
    topic: 'My program',
    q: 'I need some motivation.',
    keys: ['motivation', 'motivate me', 'inspiration', 'inspire me', 'encouragement', 'encourage me', 'quote', 'pep talk', 'need a boost', 'say something nice', 'cheer me up', 'make me feel better'],
    text: (c) =>
      c.cleanDays
        ? `Here’s something true: ${c.cleanDays} days ago, today was just a hope. You made it real, one day at a time. You don’t have to do the whole thing today, just today. I’m proud of you, ${c.name}.`
        : `Here’s something true: you reached out today, and that matters. You don’t have to do the whole thing at once, just today. I’m proud of you, ${c.name}.`,
    actions: () => [{ kind: 'route', label: 'See my clean time', route: { name: 'milestones' } }],
  },
  {
    id: 'what-to-do',
    topic: 'Feelings and sleep',
    q: 'What should I do today?',
    keys: ['what should i do', 'nothing to do', 'something to do', 'what can i do today', 'bored', 'kill time', 'any ideas', 'ideas for today'],
    text: 'A few ideas: go to a meeting, take a walk, call someone in your LifeCircle, cook something, work on a goal in LifeGoals, or write in LifeEvent. Boredom can be a trigger, so a little plan for the day helps.',
    actions: () => [
      { kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } },
      { kind: 'route', label: 'Open LifeGoals', route: moduleRoute('lifegoals') },
    ],
  },
  {
    id: 'joke',
    topic: 'Using Life Works',
    q: 'Tell me a joke.',
    keys: ['joke', 'tell me a joke', 'make me laugh', 'something funny', 'say something funny'],
    text: 'Why did the scarecrow win an award? Because he was outstanding in his field. 😄 Okay, I’ll keep my day job. How are you doing?',
  },
  {
    id: 'zoey-can-do',
    topic: 'Using Life Works',
    q: 'What can you do?',
    keys: ['what can you do', 'what can i ask', 'what do you do', 'how can you help', 'what are you for', 'what should i ask', 'what do you know', 'how does this work'],
    text: 'I can answer questions about cravings, meetings, sponsors, sleep, housing, food, work, court and using Life Works. I can do a daily check-in with you, tell you what’s on your calendar and your clean time, and help you reach your LifeCircle. I’m not a counselor, but I’m always here.',
    actions: () => [{ kind: 'route', label: 'Start a check-in', route: { name: 'askzoey' } }],
  },
  {
    id: 'zoey-name',
    topic: 'Using Life Works',
    q: "What's your name?",
    keys: ['your name', 'how old are you', 'who made you', 'where are you from', 'are you a girl', 'do you have feelings', 'ur name', 'whats ur name', 'name is'],
    text: 'I’m Zoey! I’m the helper inside Life Works. I’m not a real person, so no birthday cake for me, but I’m here any time, day or night.',
  },
  {
    id: 'app-checkinout',
    topic: 'Using Life Works',
    q: 'How do I check in?',
    keys: ['check in', 'check out', 'checkin', 'checkout', 'check in out', 'attendance', 'sign in'],
    text: 'To check in at a place like work, group or a meeting, open Check In/Out and tap Check in when you arrive and Check out when you leave. For your daily check-in with me, tap Start at the top of AskZoey.',
    actions: () => [
      { kind: 'route', label: 'Open Check In/Out', route: { name: 'checkinout' } },
      { kind: 'route', label: 'Daily check-in', route: { name: 'askzoey' } },
    ],
  },
  {
    id: 'app-goals',
    topic: 'Using Life Works',
    q: 'How do I add a goal?',
    keys: ['add a goal', 'set a goal', 'my goals', 'goals', 'goal', 'lifegoals'],
    text: 'Open LifeGoals and tap "Add a goal." You can add goals for recovery, education, career and family, and check off steps as you go.',
    actions: () => [{ kind: 'route', label: 'Open LifeGoals', route: moduleRoute('lifegoals') }],
  },
  {
    id: 'app-journal',
    topic: 'Using Life Works',
    q: 'How do I write in my journal?',
    keys: ['journal', 'write in my journal', 'lifeevent', 'diary', 'write it down', 'write down', 'what happened today'],
    text: 'Open LifeEvent and tap "Add." Write what happened and how you felt. It stays private on your phone unless you choose to share it.',
    actions: () => [{ kind: 'route', label: 'Open LifeEvent', route: moduleRoute('lifeevent') }],
  },
  {
    id: 'app-chat',
    topic: 'Using Life Works',
    q: 'How do I message someone?',
    keys: ['chat with', 'open chat', 'send a message', 'message someone', 'text someone', 'message my'],
    text: 'Open Chat and pick someone from your LifeCircle. Every message is checked for crisis words first, so help comes up right away if you need it.',
    actions: () => [{ kind: 'route', label: 'Open Chat', route: moduleRoute('chat') }],
  },
  {
    id: 'app-clean-date',
    topic: 'Using Life Works',
    q: 'How do I change my clean date?',
    keys: ['change my clean date', 'set my clean date', 'fix my clean date', 'edit my clean date', 'change my date', 'wrong clean date', 'reset my clean date', 'reset my days'],
    text: 'Open Clean time and tap your clean date to change it. Your days and milestones update right away.',
    actions: () => [{ kind: 'route', label: 'Open Clean time', route: { name: 'milestones' } }],
  },
];

// Ed (2026-10-24): whenever Zoey mentions 988, say what it is.
export const LIFELINE = '988, the free Suicide and Crisis Lifeline';

// The last line of every fallback, so the variants all say it the same way.
const URGENT_LINE = `If it's urgent or you don't feel safe, call or text ${LIFELINE}, any time. In an emergency, call 911.`;

// Fixed replies used by the router (ask.ts), not matched by keywords.
export const FIXED = {
  medication: (c: AnswerContext) =>
    `That's a really good question for your prescriber or a pharmacist. I can't give advice about medications. Want to save it for your next appointment, or send it to ${c.coordinatorName}?`,
  // Never "wait for your appointment" on its own: anything unmatched could be
  // urgent in words the safety screen missed, so 988 / 911 always show.
  // Ed (2026-10-24): never "I don't have a good answer"; ask to hear more instead.
  // ask() picks one of FALLBACKS at random; this first one is the default.
  fallback: (c: AnswerContext) =>
    `I want to understand. Can you tell me a little more? ${c.coordinatorName} is here to help too. ${URGENT_LINE}`,
  // The second miss in a row: don't ask a third time, hand it to a person.
  fallbackAgain: (c: AnswerContext) =>
    `I’m sorry, I don’t think I’m getting this one right. ${c.coordinatorName} is the best person to help with it. Want me to save it for your team, or send it to ${c.coordinatorName} now? ${URGENT_LINE}`,
  withdrawal: (c: AnswerContext) =>
    `Withdrawal can be dangerous, especially from alcohol or benzos, so please don't do it alone. If there are seizures, confusion, seeing things, chest pain, or you can't keep fluids down, call 911 now. Otherwise, call ${c.coordinatorName} or your doctor today about a safe detox. The SAMHSA helpline can also find detox near you, free and 24/7.`,
  housing: (c: AnswerContext) =>
    `I'm sorry, that's a lot to carry, and you don't have to sort it out alone. ${c.coordinatorName} can help with housing, so call now if you can. 211 can find a shelter bed or emergency housing near you, day or night. If you're outside tonight and not safe, call 911.`,
  // Third person: help them get the friend to 988, not a crisis screen for the person asking.
  someone: () =>
    `It's good you're looking out for them. Ask them straight out if they're thinking about suicide; asking doesn't put the idea in their head. Stay with them if you can, and call or text ${LIFELINE}, together. If they're in danger right now or have hurt themselves, call 911.`,
  pregnant: (c: AnswerContext) =>
    `I'm concerned about you and the baby, and you're not in trouble. You deserve good care for you and the baby. Please talk to your doctor or ${c.coordinatorName} today. Stopping some drugs suddenly while pregnant can be risky, so don't try it alone; there is treatment that is safe during pregnancy. If you have bleeding, bad pain, or feel very sick, call 911.`,
  // Harm reduction, not a lecture: the goal is that they don't die tonight.
  using: (c: AnswerContext) =>
    `I'm worried about you, and I'm glad you're being honest with me. ${c.sponsorName ?? c.coordinatorName} would want to hear from you right now, before you use. If you do use, please don't use alone: the Never Use Alone line will stay on the phone with you and send help if you stop responding. Keep naloxone (Narcan) close, and call 911 if someone is hard to wake or breathing slowly. Fentanyl is in a lot of the supply, so go slow.`,
  abuse: (c: AnswerContext) =>
    `I'm so sorry. What happened is not your fault. If you're in danger right now, call 911. The domestic violence hotline and RAINN answer 24/7, and calls are free and private. ${c.coordinatorName} can also help you find a safe place to stay.`,
  // Concern, never "thanks for telling me" (Ed, 2026-10-24).
  crisis: "I'm really worried about you. Please reach out to someone right now. You don't have to go through this alone.",
  safetyCheck: "I'm really worried about you. Are you safe right now?",
};

// Other ways to say the fallbacks, so Zoey doesn't sound like a script (Ed,
// 2026-10-24). Every one keeps the person and 988 / 911.
export const FALLBACKS: ((c: AnswerContext) => string)[] = [
  FIXED.fallback,
  (c) =>
    `I want to make sure I get this right. Could you tell me a bit more about what's going on? ${c.coordinatorName} can help too. ${URGENT_LINE}`,
  (c) =>
    `I'm listening. Can you say a little more, so I can help? You can always reach ${c.coordinatorName} too. ${URGENT_LINE}`,
];
export const FALLBACKS_AGAIN: ((c: AnswerContext) => string)[] = [
  FIXED.fallbackAgain,
  (c) =>
    `I’m not sure I understand this one, and I don’t want to guess. ${c.coordinatorName} can help with it better than I can. Want me to save it for your team, or send it to ${c.coordinatorName}? ${URGENT_LINE}`,
];
