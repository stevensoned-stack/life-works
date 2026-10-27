// LifeEvent: the timeline of things that happened, and where each one sits on
// the LifePath mood chart. Pure, so it can be tested and later shared with the
// provider console's mood-plus-events view (build plan sec. 08).
import { LifeEvent, LifeEventFeel, LifeEventKind } from '../data/types';
import { colors } from '../theme';
import { daysBetween, fromYmd, ymd } from '../util';
import { screen, SafetyResult } from '../zoey/safety';
import { cleanTime } from './milestones';

export type Range = 'daily' | 'monthly' | 'yearly';

export const KINDS: Record<LifeEventKind, { label: string; color: string; examples: string }> = {
  housing: { label: 'Housing', color: colors.module.myhome, examples: 'Moved, new lease, lost a place' },
  legal: { label: 'Legal', color: colors.blue, examples: 'Court date, probation, paperwork' },
  health: { label: 'Health', color: colors.red, examples: 'Doctor, new medication, injury' },
  work_school: { label: 'Work or school', color: colors.module.lifeevent, examples: 'New job, class, test' },
  family: { label: 'Family and loss', color: colors.module.chat, examples: 'Birth, visit, funeral' },
  recovery: { label: 'Recovery', color: colors.module.lifepath, examples: 'Started a program, got a sponsor' },
  other: { label: 'Other', color: colors.inkSoft, examples: '' },
};

export const FEELS: Record<LifeEventFeel, string> = { good: 'Good', hard: 'Hard', mixed: 'Mixed' };

// Common milestones and goals to pick from instead of typing. Picking one
// fills the title and type; the person can still change both.
export const SUGGESTIONS: { title: string; kind: LifeEventKind }[] = [
  { title: "Get my driver's license", kind: 'legal' },
  { title: 'Get a state ID', kind: 'legal' },
  { title: 'Finish probation', kind: 'legal' },
  { title: 'Pay off fines', kind: 'legal' },
  { title: 'Finish my GED', kind: 'work_school' },
  { title: 'Get a job', kind: 'work_school' },
  { title: 'Start classes', kind: 'work_school' },
  { title: 'Get my own place', kind: 'housing' },
  { title: 'Sign a lease', kind: 'housing' },
  { title: 'Open a bank account', kind: 'other' },
  { title: 'Save my first $500', kind: 'other' },
  { title: 'Get a sponsor', kind: 'recovery' },
  { title: 'Go to my first meeting', kind: 'recovery' },
  { title: 'Finish my treatment program', kind: 'recovery' },
  { title: 'See a doctor or dentist', kind: 'health' },
  { title: 'Reconnect with family', kind: 'family' },
];

// One row on the list. Milestones come from the recovery date, so they can't be
// edited or deleted here; changing the recovery date changes them.
export type TimelineItem = LifeEvent & { auto?: boolean };

const milestoneItem = (start: Date, m: { days: number; label: string }, status: LifeEvent['status']): TimelineItem => {
  const d = new Date(start);
  d.setDate(d.getDate() + m.days);
  return {
    id: `milestone-${m.days}`,
    status,
    date: ymd(d),
    title: `${m.label} in recovery`,
    kind: 'recovery',
    feel: 'good',
    createdAt: d.toISOString(),
    auto: true,
  };
};

export function milestoneEvents(sobrietyDate: string | null, now = new Date()): TimelineItem[] {
  if (!sobrietyDate) return [];
  const start = fromYmd(sobrietyDate);
  return cleanTime(sobrietyDate, now).earned.map((m) => milestoneItem(start, m, 'done'));
}

// Done items, newest first. Anything dated after today is left off.
export function timeline(events: LifeEvent[], sobrietyDate: string | null, now = new Date()): TimelineItem[] {
  const today = ymd(now);
  return [...events.filter((e) => e.status === 'done'), ...milestoneEvents(sobrietyDate, now)]
    .filter((e): e is TimelineItem & { date: string } => e.date !== null && e.date <= today)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date!.localeCompare(a.date!)));
}

// Planned items and the next recovery milestone: soonest target first, then
// the ones with no date yet in the order they were added.
export function upcoming(events: LifeEvent[], sobrietyDate: string | null, now = new Date()): TimelineItem[] {
  const next = sobrietyDate ? cleanTime(sobrietyDate, now).next : null;
  const items: TimelineItem[] = events.filter((e) => e.status === 'planned');
  if (sobrietyDate && next) items.push(milestoneItem(fromYmd(sobrietyDate), next, 'planned'));
  return items.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date || b.date) return a.date ? -1 : 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// What a planned item becomes when the person marks it done: dated today
// unless they change it, keeping when it was first added.
export const markDone = (e: LifeEvent, now = new Date()): LifeEvent => ({
  ...e,
  status: 'done',
  date: ymd(now),
  feel: 'good',
  doneAt: now.toISOString(),
});

// Which point on the LifePath chart a date falls on, using the same buckets as
// buildSeries: 7 days, 4 weeks of 7 days, or 12 calendar months, oldest first.
// -1 when the date is outside the range shown.
export function chartIndex(date: string, range: Range, now = new Date()): number {
  const d = fromYmd(date);
  if (range === 'yearly') {
    const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
    return monthsAgo >= 0 && monthsAgo < 12 ? 11 - monthsAgo : -1;
  }
  const ago = daysBetween(d, now);
  if (ago < 0) return -1;
  if (range === 'daily') return ago < 7 ? 6 - ago : -1;
  return ago < 28 ? 3 - Math.floor(ago / 7) : -1;
}

export type ChartMark = { index: number; color: string; count: number };

// One mark per chart point that has events, colored by the most recent one.
export function chartMarks(items: TimelineItem[], range: Range, now = new Date()): ChartMark[] {
  const marks = new Map<number, ChartMark>();
  for (const e of items) {
    const i = e.date ? chartIndex(e.date, range, now) : -1;
    if (i < 0) continue;
    const m = marks.get(i);
    if (m) m.count++;
    else marks.set(i, { index: i, color: KINDS[e.kind].color, count: 1 });
  }
  return [...marks.values()].sort((a, b) => a.index - b.index);
}

export const inRange = (items: TimelineItem[], range: Range, now = new Date()) =>
  items.filter((e) => e.date !== null && chartIndex(e.date, range, now) >= 0);

// Title and note are free text, so the safety screen runs on them before the
// event is saved, as it does on every check-in and question.
export const screenEntry = (title: string, note = ''): SafetyResult => screen(`${title}\n${note}`);

export const dateLabel = (date: string | null, now = new Date()) => {
  if (!date) return 'No date yet';
  const ago = daysBetween(fromYmd(date), now);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  if (ago === -1) return 'Tomorrow';
  return fromYmd(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(fromYmd(date).getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

export const monthLabel = (date: string) => fromYmd(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Counts for the status card at the top of LifeEvent. Milestones are counted
// on their own; the feel counts cover only what the person logged.
export function eventStatus(events: LifeEvent[], sobrietyDate: string | null, now = new Date()) {
  const done = events.filter((e) => e.status === 'done');
  const feel = { good: 0, mixed: 0, hard: 0 } as Record<LifeEventFeel, number>;
  for (const e of done) feel[e.feel]++;
  const monthAgo = ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30));
  const clean = sobrietyDate ? cleanTime(sobrietyDate, now) : null;
  const next = upcoming([], sobrietyDate, now)[0] ?? null;
  return {
    done: done.length,
    lastMonth: done.filter((e) => e.date && e.date >= monthAgo && e.date <= ymd(now)).length,
    feel,
    goalsOpen: events.filter((e) => e.status === 'planned').length,
    goalsDone: done.filter((e) => e.doneAt).length,
    milestones: clean ? clean.earned.length : 0,
    nextMilestone: next ? { title: next.title, date: next.date!, days: clean!.daysToNext } : null,
  };
}
