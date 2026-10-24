// What's on today, for Zoey to mention once in a chat (Ed, 2026-10-24):
// "Looks like you have work today and then school." Only the app's own
// schedule (Calendar and the Check In/Out plan), never the phone's calendar.
import { CalendarItem, Place, PlanSlot } from '../data/types';
import { clock, ymd } from '../util';

export type TodayItem = { time: string; label: string };

const minutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

// "Call with Maya" -> "call with Maya", but "Dr. Lee" stays.
const lower = (t: string) => (/^[A-Z][a-z]+(?=\s|$)/.test(t) && !/^(Dr|Mr|Mrs|Ms)\b/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

// "an NA meeting", "an AA meeting", "a CR meeting".
const article = (w: string) => (/^[AEIOU]/i.test(w) || /^[AEFHILMNORSX][A-Z]/.test(w) ? 'an' : 'a');

const KIND_WORD: Partial<Record<string, string>> = { work: 'work', school: 'school', meeting: 'a meeting' };

// The rest of today, in order. Curfews and "back at the house" are left out:
// this is meant to sound like a day to look forward to, not a list of rules.
export function todayItems(s: { calendar: CalendarItem[]; plan: PlanSlot[]; places: Place[] }, now = new Date()): TodayItem[] {
  const today = ymd(now);
  const nowM = now.getHours() * 60 + now.getMinutes();
  const home = new Set<string>();
  const out: (TodayItem & { kind: string; end: number })[] = [];
  for (const p of s.plan) {
    const place = s.places.find((x) => x.id === p.placeId);
    if (!place || !p.days.includes(now.getDay())) continue;
    if (place.kind === 'home') {
      home.add(p.start);
      continue;
    }
    const label = KIND_WORD[place.kind] ?? `your ${lower(place.name)}`;
    out.push({ time: p.start, label, kind: place.kind, end: p.end ? minutes(p.end) : minutes(p.start) + 60 });
  }
  for (const c of s.calendar) {
    if (c.date !== today || home.has(c.time)) continue;
    // The same thing on the plan and the calendar is said once.
    if (out.some((o) => o.time === c.time && (o.kind === c.kind || o.label === `your ${lower(c.title)}`))) continue;
    const label = c.kind === 'meeting' ? (c.title.toLowerCase().includes('meeting') ? lower(c.title) : `${article(c.title)} ${c.title} meeting`) : (KIND_WORD[c.kind] ?? `your ${lower(c.title)}`);
    out.push({ time: c.time, label, kind: c.kind, end: minutes(c.time) + 60 });
  }
  return out
    .filter((x) => x.end > nowM)
    .sort((a, b) => minutes(a.time) - minutes(b.time))
    .filter((x, i, xs) => xs.findIndex((y) => y.label === x.label && y.time === x.time) === i)
    .map(({ time, label }) => ({ time, label }));
}

const INTRO = ['Looks like you have', 'I see you have', 'On your plate today:'];
const CHEER_BUSY = [
  'You’ve got a full day. You’ve got this!',
  'Busy day! Remember to take a breath in between.',
  'One thing at a time. I believe in you.',
  'That’s a solid day. Proud of you for showing up.',
];
const CHEER_ONE = ['Nice!', 'You’ve got this!', 'Sounds like a good day.', 'Good stuff.'];

const list = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', then ')}, and then ${xs[xs.length - 1]}`);

export function todayLine(items: TodayItem[], rand: () => number = Math.random): string | null {
  if (!items.length) return null;
  const pick = (xs: string[]) => xs[Math.floor(rand() * xs.length)];
  const shown = items.slice(0, 4).map((x) => `${x.label} at ${clock(x.time)}`);
  const intro = pick(INTRO);
  const body = intro.endsWith(':') ? `${intro} ${list(shown)}.` : `${intro} ${list(shown)} today.`;
  return `${body} ${pick(items.length > 1 ? CHEER_BUSY : CHEER_ONE)}`;
}
