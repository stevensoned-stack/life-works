// Real answers about their day, from the app's own Calendar and Check In/Out
// plan (Ed, 2026-10-25: "come up with calendar answers by looking at their
// calendar after you told them what's up, not just say tell me more").
//   "what's next?"            -> the next thing and how long until it
//   "when is therapy?"        -> looks it up, today or later this week
//   "what about tomorrow?"    -> tomorrow's list; "this week" -> the week
//   "I'm going to be late"    -> offer to text the coordinator
//   "I can't make it"         -> let them know early, help to reschedule
//   "I don't want to go"      -> name it, encourage, ask what's going on
//   "I'm nervous about court" -> name it, normalize, offer help
//   "I'm free tonight"        -> a meeting from the list tonight
//   "I'm done for the day"    -> praise what they showed up for
// The safety screen runs before any of this.
import { AnswerAction } from './answers';
import { clean } from './feelings';
import { CalendarItem, Place, PlanSlot } from '../data/types';
import { SAMPLE_MEETINGS, meetsOn } from '../recovery/meetings';
import { addDays, clock, fromYmd, ymd } from '../util';
import { DayItem, dayItems, minutes } from './today';

export type ScheduleState = { calendar: CalendarItem[]; plan: PlanSlot[]; places: Place[] };
export type ScheduleCtx = {
  state: ScheduleState;
  now: Date;
  name: string;
  coordinatorName: string;
  sponsorName: string | null;
  // Zoey just talked about their day, so "I don't want to go" means the next thing.
  recent: boolean;
  // The last thing she named, for "and after that?".
  last: DayItem | null;
};
export type ScheduleReply = { text: string; actions: AnswerAction[]; item?: DayItem | null };

const pickWith = (rand: () => number) => <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];

// "school", "therapy", "my meeting", "the call with Maya" -> the thing they mean.
const SYNONYMS: Record<string, string[]> = {
  work: ['work', 'job', 'shift', 'crew', 'work crew'],
  school: ['school', 'class', 'classes', 'ged', 'math'],
  meeting: ['meeting', 'meetings', 'aa', 'na', 'group'],
  appointment: ['appointment', 'appt', 'doctor', 'therapy', 'therapist', 'counselor', 'counseling', 'court', 'probation', 'call', 'session', 'dr'],
  home: ['curfew', 'home', 'house', 'back at the house', 'back home'],
};
const STOP = new Set(['my', 'the', 'a', 'an', 'is', 'do', 'i', 'have', 'to', 'go', 'at', 'for', 'with', 'today', 'tomorrow', 'next', 'this', 'week', 'about', 'what', 'time', 'when', 'it', 'start', 'starts', 'begin', 'begins', 'be', 'get', 'there', 'tonight']);

function matches(item: DayItem, target: string) {
  const words = target.split(' ').filter((w) => w && !STOP.has(w));
  if (!words.length) return false;
  const hay = `${item.title} ${item.label} ${item.detail ?? ''} ${item.kind}`.toLowerCase();
  if (words.every((w) => new RegExp(`\\b${w}`).test(hay))) return true;
  // "therapy" -> the appointment called "Weekly therapy"; "class" -> school.
  return words.some((w) => (SYNONYMS[item.kind] ?? []).includes(w) && (item.kind !== 'appointment' || hay.includes(w) || ['appointment', 'appt'].includes(w)));
}

// The next 7 days, today's leftovers first.
function upcoming(s: ScheduleState, now: Date, withHome = false): DayItem[] {
  const out: DayItem[] = [];
  for (let i = 0; i < 7; i++) out.push(...dayItems(s, addDays(now, i), i === 0 ? now : undefined));
  return withHome ? out : out.filter((x) => !x.home);
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const nowMin = (d: Date) => d.getHours() * 60 + d.getMinutes();

function when(item: DayItem, now: Date) {
  const days = Math.round((fromYmd(item.date).getTime() - fromYmd(ymd(now)).getTime()) / 864e5);
  const at = clock(item.time);
  if (days === 0) {
    const mins = minutes(item.time) - nowMin(now);
    if (mins <= 0) return `right now (it started at ${at})`;
    const inTime = mins < 60 ? `${mins} minutes` : mins < 90 ? 'about an hour' : `about ${Math.round(mins / 60)} hours`;
    return `today at ${at}, in ${inTime}`;
  }
  if (days === 1) return `tomorrow at ${at}`;
  const d = addDays(now, days);
  return `on ${d.toLocaleDateString('en-US', { weekday: 'long' })} at ${at}`;
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const name = (i: DayItem) => i.label;
const short = (i: DayItem) => `${name(i)} at ${clock(i.time)}`;

const calendar: AnswerAction = { kind: 'route', label: 'Open Calendar', route: { name: 'calendar' } };

// --- What they said ----------------------------------------------------------

const LEAD = '^(?:(?:ok|okay|so|and|um|well|zoey|hey|cool|alright|wait|oh) )*';
const NEXT = new RegExp(`${LEAD}(?:whats next|what is next|whats up next|what do i have next|what have i got next|whats my next thing|what now|whats coming up|whats after that|what is after that|what about after that|and after that|after that|then what|and then|what else|what else do i have|anything else|anything else today|what else is (?:on|there))(?: today| zoey)?$`);
const TODAY = new RegExp(`${LEAD}(?:what do i have today|whats on today|what is on today|whats on for today|what does my day look like|whats my day look like|how does my day look|whats today look like|what am i doing today|whats my schedule(?: today)?|what is my schedule(?: today)?|my schedule|whats going on today|what do i have going on(?: today)?|whats the plan(?: today)?|what is the plan(?: today)?|whats on my calendar(?: today)?)$`);
const TOMORROW = new RegExp(`${LEAD}(?:(?:what about|how about|and|whats|what is|what do i have|what have i got|whats on|anything|do i have anything|whats the plan|what does|whats my schedule|what is my schedule)(?: on| for)? )?tomorrow(?: look like| zoey)?$`);
const WEEK = new RegExp(`${LEAD}(?:(?:what about|how about|whats|what is|what do i have|whats on|whats my|what does my|how does my)(?: for)? )?(?:this week|the rest of the week|rest of the week|my week|the week)(?: look like| zoey)?$`);
const WHEN = /^(?:(?:ok|so|and|um|hey|zoey|wait) )*(?:when is|when s|whens|what time is|what time s|what time do i have|when do i have|when do i go to|what time do i go to|what time do i need to be at|what time should i be at|what time do i have to be at|when do i need to be at|when am i supposed to be at|when does|what time does|what day is) (?:my |the |our )?(.+?)(?: today| tomorrow| start| starts| begin| begins| at)*$/;
const LATE = /\b(?:im|i am|ill be|i will be|i might be|gonna be|going to be|i think ill be|running|im running) (?:a (?:little|bit|few minutes) |kinda |so )?late\b/;
const CANT = /\b(?:i cant make it|i cant go|i wont make it|i wont be able to go|im not going to make it|im not gonna make it|i have to miss|im going to miss|im gonna miss|i need to miss|i need to cancel|i have to cancel|i cant come|i cant be there|i need to reschedule|can i reschedule|how do i reschedule|i cant do (?:work|school|therapy|my) ?\w*)\b/;
const DONT_WANT = /\b(?:i (?:really )?(?:dont|do not|dont really) (?:want|wanna|feel like) (?:to )?(?:go|going)(?: to (?:my |the )?(.+))?|do i (?:have|need) to go(?: to (?:my |the )?(.+))?|i (?:dont|do not) want to do (?:my |the )?(.+))$/;
const NERVOUS = /\b(?:im|i am|im so|im really|i feel|feeling) (?:so |really |kinda |a little |pretty )?(?:nervous|scared|anxious|worried|stressed|freaked out|freaking out|dreading it|dreading) (?:about|for|of) (?:my |the |going to )?(.+)$/;
const FREE = /\b(?:im|i am) (?:free|off|not doing anything|not busy)(?: (?:tonight|today|this evening|now|right now|after work|after school|later))?$|\b(?:nothing to do|got nothing going on|nothing going on)(?: (?:tonight|today|later))?$|^what should i do tonight$/;
const DONE = /^(?:(?:ok|okay|well|whew|phew|finally|yay|so) )*(?:(?:im|i am) (?:all )?(?:done|finished|home|back home|off work)(?: (?:for the day|for today|for tonight|with everything|with my day))?|done for the day|done for today|finished for the day|made it through (?:the|today|my|another) day|my day is (?:done|over)|the day is (?:done|over)|(?:just )?got home|finally home|just got back|i (?:just |finally )?got (?:home|back)|im (?:finally )?home(?: now)?)$/;

export type ScheduleAsk = 'next' | 'today' | 'tomorrow' | 'week' | 'when' | 'late' | 'cant' | 'dontWant' | 'nervous' | 'free' | 'done';

export function findScheduleAsk(text: string): { ask: ScheduleAsk; target?: string; day?: number; tonight?: boolean } | null {
  const t = clean(text);
  if (!t) return null;
  if (NEXT.test(t)) return { ask: 'next' };
  if (TODAY.test(t)) return { ask: 'today' };
  if (TOMORROW.test(t)) return { ask: 'tomorrow' };
  if (WEEK.test(t)) return { ask: 'week' };
  if (DONE.test(t)) return { ask: 'done' };
  if (LATE.test(t)) return { ask: 'late', target: t.match(/\blate (?:to|for) (?:my |the )?(.+)$/)?.[1] };
  if (CANT.test(t)) return { ask: 'cant', target: t.match(/\b(?:make it|go|miss|cancel|reschedule|be there|come) (?:to )?(?:my |the )?(.+)$/)?.[1] };
  let m = t.match(DONT_WANT);
  if (m) return { ask: 'dontWant', target: m[1] ?? m[2] ?? m[3] };
  m = t.match(NERVOUS);
  if (m) return { ask: 'nervous', target: m[1] };
  if (FREE.test(t)) return { ask: 'free', tonight: /\b(?:tonight|this evening|later)\b/.test(t) };
  m = t.match(WHEN);
  if (m) {
    const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}\\b`).test(t));
    return { ask: 'when', target: m[1].replace(/ (?:on )?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/, ''), ...(/\btomorrow\b/.test(t) ? { day: -1 } : wd >= 0 ? { day: wd } : {}) };
  }
  return null;
}

// --- What Zoey says ------------------------------------------------------------

const NEXT_LINES = ['Next up is {x}.', 'Up next: {x}.', 'Next you have {x}.'];
const THEN_LINES = ['After that, {x}.', 'Then {x}.'];
const ALL_DONE = ['That’s everything for today! Nice work.', 'You’re all done for today. Time to rest!', 'Nothing else on your calendar today. You made it!'];
const LATE_LINES = [
  'No worries, it happens. The best thing is to let them know now, so nobody’s waiting on you.',
  'That’s okay. A quick heads-up goes a long way. Let them know you’re on your way.',
];
const CANT_LINES = [
  'Okay. The best thing is to let them know as early as you can.',
  'That happens. Letting them know ahead of time really helps.',
];
const DONT_WANT_LINES = [
  'That’s okay to feel. Showing up when you don’t feel like it is how it gets easier, and you’ve done it before.',
  'I hear you. Some days it’s hard to go. Going anyway is one of the strongest things you can do for your recovery.',
  'Totally normal to feel that way. Most days you end up glad you went.',
];
const NERVOUS_LINES = [
  'It’s normal to feel nervous about that.',
  'Feeling nervous makes sense. It means it matters to you.',
];
const DONE_LINES = ['Nice work today, {name}! 🎉', 'You did it, {name}! 🎉', 'Way to go, {name}! 🎉'];

export function scheduleReply(ask: { ask: ScheduleAsk; target?: string; day?: number; tonight?: boolean }, c: ScheduleCtx, rand: () => number = Math.random): ScheduleReply | null {
  const pick = pickWith(rand);
  const { state: s, now } = c;
  const today = dayItems(s, now, now).filter((x) => !x.home);
  const upcomingNow = today.filter((x) => minutes(x.time) > nowMin(now));
  const current = today.find((x) => minutes(x.time) <= nowMin(now) && x.end > nowMin(now)) ?? null;
  const coordCall: AnswerAction = { kind: 'call', label: `Call ${c.coordinatorName}`, who: 'coordinator' };
  // "work tomorrow" (day -1), "therapy on Thursday" (a weekday): only that day.
  const onDay = (x: DayItem) =>
    ask.day == null ? true : ask.day === -1 ? x.date === ymd(addDays(now, 1)) : fromYmd(x.date).getDay() === ask.day;
  const find = (target?: string) => (target ? upcoming(s, now, true).find((x) => onDay(x) && matches(x, target)) ?? null : null);
  // A named thing must be on the calendar; otherwise the next thing, if she just talked about their day.
  const named = (target?: string) => (target ? find(target) : c.recent ? upcomingNow[0] ?? current : null);

  switch (ask.ask) {
    case 'next': {
      // "And after that?" follows on from the last thing she named.
      const from = c.last ? today.filter((x) => minutes(x.time) > minutes(c.last!.time) && x.date === c.last!.date) : upcomingNow;
      const item = from[0];
      if (!item) return { text: pick(ALL_DONE), actions: [calendar], item: null };
      const line = (c.last ? pick(THEN_LINES) : pick(NEXT_LINES)).replace('{x}', `${name(item)} ${when(item, now)}`);
      return { text: line, actions: [calendar], item };
    }
    case 'today': {
      if (!today.length) return { text: 'Your calendar is clear for the rest of today. Want to find a meeting, or plan something good for yourself?', actions: [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }], item: null };
      return { text: `Today you have ${list(today.map(short))}.${current ? ` You’re at ${name(current)} now.` : ''}`, actions: [calendar], item: today[today.length - 1] };
    }
    case 'tomorrow': {
      const t = dayItems(s, addDays(now, 1)).filter((x) => !x.home);
      if (!t.length) return { text: 'Nothing on your calendar tomorrow yet. It could be a good day to plan a meeting or something fun.', actions: [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }, calendar], item: null };
      return { text: `Tomorrow you have ${list(t.map(short))}.`, actions: [calendar], item: t[0] };
    }
    case 'week': {
      const days: string[] = [];
      for (let i = 1; i < 7 && days.length < 5; i++) {
        const d = addDays(now, i);
        const xs = dayItems(s, d).filter((x) => !x.home);
        if (xs.length) days.push(`${i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' })}: ${list(xs.map(short))}.`);
      }
      if (!days.length) return { text: 'Your calendar is clear for the rest of the week.', actions: [calendar], item: null };
      return { text: `Here’s your week. ${days.join(' ')}`, actions: [calendar], item: null };
    }
    case 'when': {
      const item = find(ask.target);
      if (!item) {
        // Only answer "I don't see it" for things that live on a calendar.
        const word = (ask.target ?? '').split(' ').find((w) => Object.values(SYNONYMS).some((ws) => ws.includes(w)) && w !== 'call');
        // "What time is the meeting?" with none saved: the meeting finder answer is better.
        if (!word || /\b(rent|clean|sober|sobriety|due)\b/.test(ask.target ?? '') || SYNONYMS.meeting.includes(word)) return null;
        return { text: `I don’t see ${word} on your calendar this week. You can add it in Calendar so I can remind you.`, actions: [calendar], item: null };
      }
      if (item.home) return { text: `You need to be ${item.label} by ${clock(item.time)}${item.date === ymd(now) ? ' tonight' : ''}.`, actions: [{ kind: 'route', label: 'Open Check In/Out', route: { name: 'checkinout' } }], item };
      return { text: `${cap(name(item))} is ${when(item, now)}.${item.detail ? ` (${item.detail})` : ''}`, actions: [calendar], item };
    }
    case 'late': {
      const item = named(ask.target) ?? upcomingNow[0] ?? current;
      const what = item ? `${name(item)} at ${clock(item.time)}` : null;
      const who = item?.kind === 'work' ? 'your boss or crew lead' : item?.kind === 'school' ? 'your teacher' : 'them';
      const withCoord = !!item && item.title.includes(c.coordinatorName);
      const text = withCoord
        ? `${pick(LATE_LINES)} Want to text ${c.coordinatorName} that you’re running a little late for your call?`
        : `${pick(LATE_LINES)}${what ? ` For ${what}, a quick text or call to ${who} works.` : ''} Want me to give ${c.coordinatorName} a heads-up too?`;
      return {
        text,
        actions: [{ kind: 'text', label: `Text ${c.coordinatorName}`, who: 'coordinator', body: `Hi ${c.coordinatorName}, I'm running late${what ? ` to ${what}` : ''}. I'm on my way.` }, coordCall],
        item,
      };
    }
    case 'cant': {
      const item = named(ask.target);
      const what = item ? `${name(item)} ${when(item, now)}` : null;
      const text = `${pick(CANT_LINES)}${what ? ` For ${what}, call or text them now.` : ''} If it’s part of your program, ${c.coordinatorName} can help you reschedule. Is everything okay?`;
      return {
        text,
        actions: [{ kind: 'text', label: `Text ${c.coordinatorName}`, who: 'coordinator', body: `Hi ${c.coordinatorName}, I can't make it${what ? ` to ${what}` : ''}. Can you help me reschedule?` }, calendar],
        item,
      };
    }
    case 'dontWant': {
      const item = named(ask.target);
      if (!item) return null;
      const meeting = item.kind === 'meeting';
      const text = `${pick(DONT_WANT_LINES)} ${cap(name(item))} is ${when(item, now)}. What’s making you not want to go?${meeting ? ' You can just sit in the back and listen.' : ''}`;
      return { text, actions: c.sponsorName ? [{ kind: 'call', label: `Call ${c.sponsorName}`, who: 'sponsor' }, coordCall] : [coordCall], item };
    }
    case 'nervous': {
      const item = find(ask.target);
      if (!item) return null;
      const court = /court|judge|probation/i.test(`${item.title} ${ask.target}`);
      const text = `${pick(NERVOUS_LINES)} ${cap(name(item))} is ${when(item, now)}. ${
        court
          ? `Get there a little early, bring any papers you were given, and let ${c.coordinatorName} know. She may be able to help with a letter or a ride.`
          : `Try a few slow breaths before you go, and plan to get there a little early.`
      } Want to talk it through with ${c.sponsorName ?? c.coordinatorName}?`;
      return {
        text,
        actions: [...(c.sponsorName ? [{ kind: 'call' as const, label: `Call ${c.sponsorName}`, who: 'sponsor' as const }] : []), coordCall],
        item,
      };
    }
    case 'free': {
      const nowM = nowMin(now);
      const from = ask.tonight ? Math.max(nowM, 17 * 60) : nowM;
      const tonight = SAMPLE_MEETINGS.filter((m) => meetsOn(m, now.getDay()) && minutes(m.time) > from).sort((a, b) => a.time.localeCompare(b.time)).slice(0, 2);
      const curfew = dayItems(s, now, now).find((x) => x.home);
      const ok = tonight.filter((m) => !curfew || m.format === 'online' || minutes(m.time) + 60 <= minutes(curfew.time));
      const where = (m: (typeof ok)[number]) => `${m.name} (${m.fellowship}) at ${clock(m.time)}${m.format === 'online' ? ', online' : `, ${m.place}`}`;
      const text = ok.length
        ? `Free time is a good chance to do something for your recovery. ${list(ok.map(where))}${ok.length > 1 ? ' are both' : ' is'} on the meeting list for later today. Want to add one to your calendar?${curfew ? ` Remember to be ${curfew.label} by ${clock(curfew.time)}.` : ''}`
        : `Free time is a good chance to do something for your recovery: call someone in your LifeCircle, take a walk, or write in LifeEvent.${curfew ? ` Remember to be ${curfew.label} by ${clock(curfew.time)}.` : ''}`;
      return { text, actions: [{ kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } }, { kind: 'route', label: 'Open my LifeCircle', route: { name: 'lifecircle' } }], item: null };
    }
    case 'done': {
      const all = dayItems(s, now).filter((x) => !x.home && minutes(x.time) <= nowMin(now));
      const curfew = dayItems(s, now, now).find((x) => x.home);
      const wins = all.length ? ` You made it to ${list(all.map((x) => name(x)))} today. That’s showing up for yourself.` : ' You showed up for today, and that counts.';
      const left = upcomingNow.length ? ` You still have ${list(upcomingNow.map(short))} later, so take a breather before then.` : ' Time to rest.';
      const home = curfew && !upcomingNow.length ? ` Be ${curfew.label} by ${clock(curfew.time)}.` : '';
      return { text: `${pick(DONE_LINES).replace('{name}', c.name)}${wins}${left}${home}`, actions: [], item: null };
    }
  }
}
