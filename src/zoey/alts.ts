// Other ways to say the library answers (answers.ts), so Zoey doesn't repeat
// herself word for word (Ed, 2026-10-27: "get creative, use words that mean the
// same thing"). Same facts, numbers and people as the main text; different
// words. Safety answers (overdose, 988, withdrawal and the like) have none.
import type { AnswerContext } from './answers';

type Alt = string | ((c: AnswerContext) => string);

const helper = (c: AnswerContext) => c.sponsorName ?? c.coordinatorName;

export const ANSWER_ALTS: Record<string, Alt[]> = {
  'craving-now': [
    (c) =>
      `Okay, I’m right here. Cravings feel huge, but they don’t last. Try stepping away from where you are, grabbing some water, or riding it out with me for 20 minutes. ${c.sponsorName ? `${c.sponsorName} said you can call any time, too.` : 'Your coordinator can help too.'} What’s happening right now?`,
    (c) =>
      `Thank you for telling me. That urge is real, and it will pass. Moving to a different spot, sipping some water, or waiting it out for 20 minutes can all help. ${c.sponsorName ? `And ${c.sponsorName} said to call any time.` : 'Your coordinator can help too.'} What’s going on?`,
  ],
  'craving-length': [
    'Think of a craving like a wave. It rises, it crests, and then it rolls back out. Most people find one fades in about 20 to 30 minutes if they hang on. And the longer you’re in recovery, the less often they tend to show up.',
  ],
  'meeting-what': [
    'A meeting usually runs about an hour. Someone opens with a short reading, then people take turns talking about their own recovery. You’re welcome to just listen. No one has to speak, and it doesn’t cost anything. Showing up a few minutes early is an easy way to get to know people.',
  ],
  'meeting-talk': ['Nope, not at all. You can just say "I’ll listen today" or "pass." Plenty of people listen for weeks before they share.'],
  'meeting-types': [
    'AA is mainly about alcohol, and NA is about drugs. They both use the 12 steps and sponsors. SMART Recovery skips the steps and uses practical tools. Celebrate Recovery is built on faith, and Recovery Dharma uses meditation. Feel free to try a few and stick with the ones that fit.',
  ],
  'sponsor-find': [
    'Keep going to the same meetings for a bit, and notice someone whose recovery you look up to. Then you can simply ask, "Would you be my sponsor?" People ask all the time, and it’s fine if the first person says no. Once you find someone, you can add them in LifeCircle.',
  ],
  sleep: [
    'Oh, sleepless nights are rough. Lots of people struggle with sleep early in recovery, and it usually eases up over time. Waking at the same time each day can help, so can setting the phone aside before bed and cutting back on caffeine after lunch. If it keeps going, your counselor or prescriber can help too.',
    'Not sleeping wears you down, I know. It’s really common early in recovery, and it tends to get better. A steady wake-up time, no phone right before bed, and less caffeine after lunch can all make a difference. If it doesn’t let up, your counselor or prescriber can help too.',
  ],
  'feelings-normal': [
    (c) =>
      `It’s completely normal. Recovery comes with big highs and lows, and you’re far from the only one riding them. Sharing it really helps, and ${helper(c)} and your counselor are great people to talk to. How have things been feeling for you lately?`,
  ],
  lonely: [
    'I’m sorry. Loneliness is so heavy, and lots of people in recovery feel it, especially at the start. Reaching out to just one person today can help, even with a quick text. Meetings are a good spot to find people who understand, too. And I’m here with you now.',
    'That’s such a hard feeling, and you’re not the only one who has it. So many people feel it early in recovery. Even one short message to someone today can help. Meetings are full of people who get it, too. I’m right here with you.',
  ],
  'housing-tonight': [
    (c) =>
      `Oh, I’m sorry, that’s a lot. ${c.coordinatorName} can help with housing, so calling her now is a great first step. You can also call 211 any time for local shelter and housing help.`,
  ],
  food: [
    (c) => `Let’s find you something to eat. 211 can point you to food banks and free meals nearby, and ${c.coordinatorName} can help you sign up for food benefits like SNAP.`,
  ],
  bills: [
    (c) => `Money worries weigh a lot, and you don’t have to carry them alone. ${c.coordinatorName} can go over your options with you, and 211 can connect you with local help for rent and bills.`,
  ],
  'meeting-dont-want': [
    (c) =>
      `That makes sense, and it’s okay to feel that way. Lots of people find the days they least want to go are the days it helps the most. You don’t have to say a word. You can sit in the back and just listen. If meetings aren’t working for you, try a new one, or talk with ${helper(c)} about what might suit you better.`,
  ],
  'relapse-what': [
    (c) =>
      `A relapse doesn’t wipe out your recovery, and it doesn’t make you a failure. If it ever happens, the most important thing is to reach out right away, like to ${helper(c)}, so you get support quickly. Every house has its own rules about use, so ${c.coordinatorName} can tell you what it would mean for your housing.`,
  ],
  dreams: [
    'Oh, those dreams can really shake you. Using dreams are super common in recovery, especially that first year. They don’t mean you want to use, and they don’t mean anything’s wrong with you. When you wake up, some water and a few slow breaths can help, and so can talking about it with someone.',
  ],
  'self-worth': [
    (c) =>
      `Oh, ${c.name}, I’m sorry you feel that way about yourself. That voice gets loud in recovery, but it’s not telling the truth. You’re here, you’re trying, and that matters. Who in your LifeCircle could you talk to today?`,
  ],
  counseling: [
    (c) =>
      `I’m so glad you want that. Talking with a real person can help a lot. ${c.coordinatorName} can get you set up with counseling, and ${c.sponsorName ?? 'anyone in your LifeCircle'} is only a call away right now.`,
  ],
  win: [
    (c) => `Yay, ${c.name}! 🎉 That’s a big deal, and you worked for it. Want to save it in LifeEvent so you can look back on it on the hard days?`,
    (c) => `Way to go, ${c.name}! 🎉 Moments like this deserve to be celebrated. Want to save it in LifeEvent so you can come back to it on tougher days?`,
  ],
  'kids-family': [
    (c) =>
      `Family can be one of the toughest parts of recovery, and one of the things that matters most. Do you want to tell me what’s happening? ${c.coordinatorName} can help with things like visits and custody, and ${c.sponsorName ?? 'your LifeCircle'} has probably been through something like it.`,
  ],
  breakup: [
    (c) =>
      `Oh, I’m so sorry. Breakups really hurt, and early in recovery they can hit even harder. Please don’t spend tonight alone with it. Could you call ${c.sponsorName ?? 'someone in your LifeCircle'}? It’s okay to feel this. Do you want to tell me what happened?`,
  ],
  'job-find': [
    (c) =>
      `That’s a great step to take! ${c.coordinatorName} can help you build a resume, practice interviewing, and find employers who hire people in recovery. You can also add it to LifeGoals under Career to keep track of how it’s going.`,
  ],
  'job-hard': [
    (c) =>
      `Oh no, I’m sorry. Stress at work is real, and it can be a trigger. What’s going on? If you lost your job, that doesn’t define you, and ${c.coordinatorName} can help figure out what’s next. Today’s a good day to lean on ${c.sponsorName ?? 'your LifeCircle'}.`,
  ],
  court: [
    (c) =>
      `Court and probation can be a lot to keep up with. You don’t have to hold it all in your head. Add each date to your Calendar and I’ll remind you, and let ${c.coordinatorName} know. She can often help with letters or proof of treatment, and Check In/Out keeps a record of the meetings and groups you went to.`,
  ],
  ua: [
    (c) =>
      `I can tell that’s on your mind. If you’re nervous about a test, being honest with ${c.coordinatorName} before the result comes back really helps. Making a plan together is so much easier. And if you used, that’s a slip, not the end of your recovery.`,
  ],
  school: [
    (c) => `What a great goal! You can add it to LifeGoals under Education. ${c.coordinatorName} can help you find GED classes or a school program, and help with things like financial aid.`,
  ],
  ride: [
    (c) =>
      `Let’s get you there. ${c.coordinatorName} can help with rides and bus passes. For medical appointments, Medicaid often covers a free ride if you book ahead, so ask ${c.coordinatorName} to set it up. Someone in your LifeCircle might be able to drive you, too.`,
  ],
  'id-docs': [
    (c) =>
      `Ugh, that’s a hassle, but you can get it sorted, and you don’t have to do it alone. ${c.coordinatorName} can help you get your birth certificate, social security card, and state ID. Bring anything you have with your name on it.`,
  ],
  roommates: [
    (c) =>
      `Sharing a house can be tough sometimes, especially in recovery. Do you want to tell me what’s happening? Your house manager can help work things out in the house, and ${c.coordinatorName} is there to talk about your housing.`,
  ],
  party: [
    (c) =>
      `Parties can be hard in recovery, especially with drinking or using around. If you go, it helps to bring a sober friend, hold your own drink, and have a way to leave. Keep your phone handy to call ${c.sponsorName ?? 'someone in your LifeCircle'}, and check your house rules too. And it’s completely fine to sit this one out.`,
  ],
  grief: [
    (c) =>
      `Oh, ${c.name}, I’m so sorry. Losing someone is so heavy, and grief can stir up cravings, so please don’t carry it by yourself. Let ${helper(c)} know what happened, and lean on your LifeCircle. Would you like to tell me about them?`,
  ],
  'sponsor-trouble': [
    'Oh, that’s rough. Sponsors are human too, and things can get tense. Talking it out when you’re both calm can help. And if it really doesn’t feel right, it’s okay to find a new sponsor. Lots of people do, and it doesn’t mean you did anything wrong.',
  ],
  'health-question': [
    (c) =>
      `I can’t tell what’s going on with your health. Only a doctor or counselor can, after really talking with you. If something feels off, ${c.coordinatorName} can help you get an appointment. Do you want to tell me what’s been happening?`,
  ],
  motivation: [
    (c) =>
      `${c.cleanDays ? `${c.cleanDays} days ago, today was just a hope. You made it happen, one day at a time.` : 'Every day you show up is a day you made happen.'} You don’t have to do all of it today. Just today. I’m really proud of you, ${c.name}.`,
  ],
  'what-to-do': [
    'Ooh, let’s see. You could go for a walk, catch a meeting, call someone in your LifeCircle, or make something you like to eat. Working on a goal or writing in LifeEvent is nice too. Boredom can be a trigger, so even a small plan helps. What sounds fun to you?',
  ],
  'zoey-chat': ['Aw, thanks for asking! 😄 I’m just an app, so no favorite color or snacks for me, but I really enjoy talking with you. What’s on your mind?'],
  'zoey-sick': ['Nope, no illness here. I’m not a person, so I can’t catch anything, but I really want you to feel good. How are you doing?'],
  'zoey-name': ['I’m Zoey! I’m the helper in Life Works. I’m not a real person, so no birthday cake for me, but I’m here any time, day or night.'],
  'zoey-can-do': [
    'I can help with questions about cravings, meetings, sponsors, sleep, housing, food, work, court, and Life Works. We can do check-ins together, I can tell you what’s on your calendar, and I can help you reach your LifeCircle. I’m not a counselor, but I’m always happy to talk.',
  ],
};
