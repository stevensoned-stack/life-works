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
//   "what's on Monday?"       -> that day, for any day name, "tmrw", "next week" or a date
//   "what's on my calendar?"  -> "What day do you want to know about?" with day buttons
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
export type ScheduleReply = { text: string; actions: AnswerAction[]; item?: DayItem | null; pickDay?: boolean };

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
// "What's next on my calendar?", "what's next for me today?"
const ON_CAL = '(?: (?:on|in|for) (?:my |the )?(?:calendar|calender|schedule|agenda|day|plan|list))?(?: for me)?(?: today)?';
const NEXT = new RegExp(`${LEAD}(?:whats next|what is next|whats up next|what do i have next|what have i got next|whats my next thing|what now|whats coming up|whats after that|what is after that|what about after that|and after that|after that|then what|and then|what else|what else do i have|anything else|anything else today|what else is (?:on|there))(?: today| zoey)?${ON_CAL}$`);
const TODAY = new RegExp(`${LEAD}(?:what do i have today|whats on today|what is on today|whats on for today|what does my day look like|whats my day look like|how does my day look|whats today look like|what am i doing today|whats my schedule today|what is my schedule today|whats going on today|what do i have going on today|whats the plan today|what is the plan today|whats on my calendar today)$`);
const TOMORROW = new RegExp(`${LEAD}(?:(?:what about|how about|and|whats|what is|what do i have|what have i got|whats on|anything|do i have anything|whats the plan|what does|whats my schedule|what is my schedule)(?: on| for)? )?tomorrow(?: look like| zoey)?$`);
const WEEK = new RegExp(`${LEAD}(?:(?:what about|how about|whats|what is|what do i have|whats on|whats my|what does my|how does my)(?: for)? )?(?:this week|the rest of the week|rest of the week|my week|the week)(?: look like| zoey)?$`);
const WHEN = /^(?:(?:ok|so|and|um|hey|zoey|wait) )*(?:when is|when s|whens|what time is|what time s|what time do i have|when do i have|when do i go to|what time do i go to|what time do i need to be at|what time should i be at|what time do i have to be at|when do i need to be at|when am i supposed to be at|when does|what time does|what day is) (?:my |the |our )?(.+?)(?: today| tomorrow| start| starts| begin| begins| at)*$/;
const LATE = /\b(?:im|i am|ill be|i will be|i might be|gonna be|going to be|i think ill be|running|im running) (?:a (?:little|bit|few minutes) |kinda |so )?late\b/;
const CANT = /\b(?:i cant make it|i cant go|i wont make it|i wont be able to go|im not going to make it|im not gonna make it|i have to miss|im going to miss|im gonna miss|i need to miss|i need to cancel|i have to cancel|i cant come|i cant be there|i need to reschedule|can i reschedule|how do i reschedule|i cant do (?:work|school|therapy|my) ?\w*)\b/;
const DONT_WANT = /\b(?:i (?:really )?(?:dont|do not|dont really) (?:want|wanna|feel like) (?:to )?(?:go|going)(?: to (?:my |the )?(.+))?|do i (?:have|need) to go(?: to (?:my |the )?(.+))?|i (?:dont|do not) want to do (?:my |the )?(.+))$/;
const NERVOUS = /\b(?:im|i am|im so|im really|i feel|feeling) (?:so |really |kinda |a little |pretty )?(?:nervous|scared|anxious|worried|stressed|freaked out|freaking out|dreading it|dreading) (?:about|for|of) (?:my |the |going to )?(.+)$/;
const FREE = /\b(?:im|i am) (?:free|off|not doing anything|not busy)(?: (?:tonight|today|this evening|now|right now|after work|after school|later))?$|\b(?:nothing to do|got nothing going on|nothing going on)(?: (?:tonight|today|later))?$|^what should i do tonight$/;
const DONE = /^(?:(?:ok|okay|well|whew|phew|finally|yay|so) )*(?:(?:im|i am) (?:all )?(?:done|finished|home|back home|off work)(?: (?:for the day|for today|for tonight|with everything|with my day))?|done for the day|done for today|finished for the day|made it through (?:the|today|my|another) day|my day is (?:done|over)|the day is (?:done|over)|(?:just )?got home|finally home|just got back|i (?:just |finally )?got (?:home|back)|im (?:finally )?home(?: now)?)$/;

// --- Which day (Ed, 2026-10-25: "whats on monday" said "tell me more") ------

// Days as offsets from today: [0] today, [3] Sunday, [5..11] next week.
export type Days = { offsets: number[]; label: string };

const WEEKDAY_RE: [number, string][] = [
  [0, 'sun|sunday|sundays|sunday s'],
  [1, 'mon|monday|mondays|mondy'],
  [2, 'tue|tues|tuesday|tuesdays|tusday|teusday'],
  [3, 'wed|weds|wednesday|wednesdays|wensday|wendsday|wednsday'],
  [4, 'thu|thur|thurs|thursday|thursdays|thrusday|thurday'],
  [5, 'fri|friday|fridays|fryday'],
  [6, 'sat|saturday|saturdays|saterday|satur'],
];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const longDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });
const longDate = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const daysBetween = (now: Date, d: Date) => Math.round((fromYmd(ymd(d)).getTime() - fromYmd(ymd(now)).getTime()) / 864e5);
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const one = (now: Date, o: number): Days => ({
  offsets: [o],
  label: o === 0 ? 'today' : o === 1 ? 'tomorrow' : o === -1 ? 'yesterday' : o > 1 && o < 7 ? longDay(addDays(now, o)) : longDate(addDays(now, o)),
});

// The day they mean, from words ("monday", "tmrw", "next week") or a date ("10/28", "Oct 28th").
// Like clean(), but keeps numbers for dates.
const norm = (text: string) => text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
export function parseDay(text: string, now: Date = new Date()): Days | null {
  const t = ` ${norm(text)} `;
  if (/ (?:next|this coming) week /.test(t)) {
    const mon = (8 - now.getDay()) % 7 || 7;
    return { offsets: range(mon, mon + 6), label: 'next week' };
  }
  if (/ (?:this |the |rest of the |rest of this )?week(?: ahead)? /.test(t) && !/ (?:a|per|every|last) week /.test(t)) return { offsets: range(1, 6), label: 'this week' };
  if (/ (?:this |the |next )?weekend /.test(t)) {
    const sat = (6 - now.getDay() + 7) % 7;
    return { offsets: now.getDay() === 0 ? [0] : [sat, sat + 1], label: 'this weekend' };
  }
  if (/ day after (?:tomorrow|tmrw|tmr) /.test(t)) return one(now, 2);
  if (/ (?:tomorrow|tmrw|tmr|tmrrw|tomorow|tommorow|tommorrow|tomm|2morrow|2moro|tomoro) /.test(t)) return one(now, 1);
  if (/ yesterday /.test(t)) return one(now, -1);
  if (/ (?:today|tonight|tonite|this morning|this afternoon|this evening|right now|now) /.test(t)) return one(now, 0);
  for (const [wd, names] of WEEKDAY_RE) {
    const m = t.match(new RegExp(` (next |this |this coming |on |)(?:${names}) `));
    if (!m) continue;
    let o = (wd - now.getDay() + 7) % 7;
    if (m[1] === 'next ' && o === 0) o = 7;
    // Keep the name they used, even when it's today or tomorrow.
    return { offsets: [o], label: o < 7 ? longDay(addDays(now, o)) : longDate(addDays(now, o)) };
  }
  // "10/28", "Oct 28th", "the 28th"
  const md = t.match(/ (\d{1,2})\/(\d{1,2})(?:\/\d{2,4})? /);
  const named = t.match(new RegExp(` (${MONTHS.join('|')})[a-z]* (?:the )?(\\d{1,2})(?:st|nd|rd|th)? `));
  const nth = t.match(/ (?:the )?(\d{1,2})(?:st|nd|rd|th) /);
  const [month, day] = md ? [+md[1] - 1, +md[2]] : named ? [MONTHS.indexOf(named[1]), +named[2]] : nth ? [now.getMonth(), +nth[1]] : [-1, 0];
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  let d = new Date(now.getFullYear(), month, day);
  // "The 3rd" near the end of the month means next month; a date long gone means next year.
  if (!md && !named && daysBetween(now, d) < 0) d = new Date(now.getFullYear(), month + 1, day);
  if (daysBetween(now, d) < -60) d = new Date(now.getFullYear() + 1, month, day);
  return one(now, daysBetween(now, d));
}

// A question about their calendar: "on my calendar", "am I busy", "do I have anything".
const CAL_WORD = /\b(?:calendar|calender|calandar|calander|schedule|schedual|shedule|sched|agenda|plans|planned|booked)\b/;
const CAL_ASK = /\b(?:whats on|what is on|wats on|wat on|whats going on|what is going on|whats happening|what is happening|what do i have|what have i got|what ive got|what am i doing|what i have|what i got|what i am doing|whats up|what is up|am i (?:busy|free|working|doing anything|booked|off)|do i have (?:anything|something|stuff|plans|any plans|work|school|class|therapy|group|court|a meeting|meetings|an appointment|any appointments|appointments)|have i got anything|is there anything|anything (?:on|going on|planned|happening|scheduled)|what does (?:my|the) .*look like|how does (?:my|the) .*look|whats the plan|what is the plan|whats planned|where do i (?:need|have) to be|where am i supposed to be|what do i need to do)\b/;
const QUESTION = new RegExp(`${LEAD}(?:can you |could you |please |pls |plz )*(?:what|whats|wats|wat|do|does|am|is|are|any|anything|check|look|tell|show|read|pull|open|give|got|have|how|hows|my|calendar|schedule|plans|whens|when|where)\\b`);
// Statements that mention a day are not questions: "I have plans with my mom on Friday and I'm stressed".
const FEELING = /\b(?:feel|feeling|sad|stressed|worried|nervous|scared|anxious|hate|mad|angry|upset|lonely|cry|crying|want to|wanna|dont want|cant|scared|excited|happy)\b/;
// Just a day after a question: "what about Monday?", "and Friday", "Tuesday?"
const DAY_ONLY = new RegExp(`${LEAD}(?:what about|how about|and what about|what of|whats on|what is on|anything|any plans|am i busy|am i free|do i have anything|got anything|what do i have|whats|what is)? ?(?:on |for )?(.+?)(?: look like| looking like)?$`);

export type ScheduleAsk = 'next' | 'today' | 'tomorrow' | 'week' | 'when' | 'late' | 'cant' | 'dontWant' | 'nervous' | 'free' | 'done' | 'day' | 'askDay';
export type ScheduleQ = { ask: ScheduleAsk; target?: string; day?: number; tonight?: boolean; days?: Days };

// A short message that is only a day ("monday", "the 28th"), for her "What day?".
export function dayOnly(text: string, now: Date = new Date()): Days | null {
  const t = norm(text);
  const m = t.match(DAY_ONLY);
  if (!m || m[1].split(' ').length > 4) return null;
  const d = parseDay(text, now);
  if (!d) return null;
  // Every word is part of the day: "monday", "next week", "oct 28".
  const rest = m[1].replace(/\b(?:next|this|coming|the|rest|of|week|weekend|day|after|on|for|today|tonight|tonite|tomorrow|tmrw|tmr|tmrrw|tomorow|tommorow|tommorrow|tomm|yesterday|morning|afternoon|evening|\d+\/\d+(?:\/\d+)?|\d+(?:st|nd|rd|th)?)\b/g, '').replace(new RegExp(`\\b(?:${WEEKDAY_RE.map((x) => x[1]).join('|')}|(?:${MONTHS.join('|')})[a-z]*)\\b`, 'g'), '').trim();
  return rest ? null : d;
}

export function findScheduleAsk(text: string, now: Date = new Date()): ScheduleQ | null {
  const t = clean(text);
  if (!t) return null;
  const calendarQ = (): ScheduleQ | null => {
    const words = t.split(' ').length;
    const only = dayOnly(text, now);
    if (only) return { ask: 'day', days: only };
    if (words > 14 || FEELING.test(t)) return null;
    if (!CAL_WORD.test(t) && !CAL_ASK.test(t)) return null;
    if (!QUESTION.test(t) && !/\?\s*$/.test(text) && !CAL_WORD.test(t)) return null;
    const days = parseDay(text, now);
    // "Whats up" and "what am I doing" with no day are not about the calendar.
    if (!days && !CAL_WORD.test(t) && /\b(?:whats up|what is up|what am i doing|what i am doing|what do i need to do|is there anything|whats going on|what is going on|whats happening|what is happening)\b/.test(t)) return null;
    if (/\bnext\b/.test(t) && !(days && /\bnext (?:week|weekend|\w+day)\b/.test(t))) return { ask: 'next' };
    if (days) return { ask: 'day', days };
    return { ask: 'askDay' };
  };
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
  return calendarQ();
}

// Buttons for "What day do you want to know about?"
export function dayChoices(now: Date = new Date()): { label: string; q: ScheduleQ }[] {
  const day = (o: number, label: string) => ({ label, q: { ask: 'day' as const, days: one(now, o) } });
  return [
    day(0, 'Today'),
    day(1, 'Tomorrow'),
    ...[2, 3, 4].map((o) => day(o, longDay(addDays(now, o)))),
    { label: 'This week', q: { ask: 'week' } },
    { label: 'Next week', q: { ask: 'day', days: parseDay('next week', now)! } },
  ];
}
export const WHAT_DAY = 'Sure, I can check your calendar. What day do you want to know about?';

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

export function scheduleReply(ask: ScheduleQ, c: ScheduleCtx, rand: () => number = Math.random): ScheduleReply | null {
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
    case 'askDay':
      return { text: WHAT_DAY, actions: [], pickDay: true };
    case 'day': {
      const { offsets, label } = ask.days!;
      // "What's on Monday?" when Monday is tomorrow: "Monday is tomorrow. Tomorrow you have…"
      const named = (r: ScheduleReply | null, when: string) => (r && !/^(?:today|tomorrow)$/.test(label) ? { ...r, text: `${label} is ${when}. ${r.text}` } : r);
      if (offsets.length === 1 && offsets[0] === 0) return named(scheduleReply({ ask: 'today' }, c, rand), 'today');
      if (offsets.length === 1 && offsets[0] === 1) return named(scheduleReply({ ask: 'tomorrow' }, c, rand), 'tomorrow');
      if (label === 'this week') return scheduleReply({ ask: 'week' }, c, rand);
      const findMeeting: AnswerAction = { kind: 'route', label: 'Find a meeting', route: { name: 'calendar', tab: 'meetings' } };
      if (offsets.length === 1) {
        const o = offsets[0];
        const xs = dayItems(s, addDays(now, o)).filter((x) => !x.home);
        const on = o < 0 ? label : `on ${label}`;
        if (!xs.length)
          return o < 0
            ? { text: `I don’t see anything on your calendar ${on}.`, actions: [calendar], item: null }
            : { text: `Nothing on your calendar ${on} yet. It could be a good day to plan a meeting or something you enjoy.`, actions: [findMeeting, calendar], item: null };
        return { text: `${cap(on)} you ${o < 0 ? 'had' : 'have'} ${list(xs.map(short))}.`, actions: [calendar], item: o < 0 ? null : xs[0] };
      }
      // A weekend or next week: day by day.
      const days: string[] = [];
      for (const o of offsets) {
        const xs = dayItems(s, addDays(now, o)).filter((x) => !x.home);
        if (xs.length) days.push(`${o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : longDay(addDays(now, o))}: ${list(xs.map(short))}.`);
      }
      if (!days.length) return { text: `Your calendar is clear for ${label}. Want to plan something?`, actions: [findMeeting, calendar], item: null };
      return { text: `Here’s ${label === 'next week' ? 'next week' : 'your weekend'}. ${days.join(' ')}`, actions: [calendar], item: null };
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
