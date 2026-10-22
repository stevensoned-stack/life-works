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

// One row on the timeline. Milestones come from the clean date, so they can't
// be edited or deleted here; changing the clean date changes them.
export type TimelineItem = LifeEvent & { auto?: boolean };

export function milestoneEvents(sobrietyDate: string | null, now = new Date()): TimelineItem[] {
  if (!sobrietyDate) return [];
  const start = fromYmd(sobrietyDate);
  return cleanTime(sobrietyDate, now).earned.map((m) => {
    const d = new Date(start);
    d.setDate(d.getDate() + m.days);
    return {
      id: `milestone-${m.days}`,
      date: ymd(d),
      title: `${m.label} clean`,
      kind: 'recovery' as const,
      feel: 'good' as const,
      createdAt: d.toISOString(),
      auto: true,
    };
  });
}

// Newest first. Anything dated after today is left off (it belongs in Calendar).
export function timeline(events: LifeEvent[], sobrietyDate: string | null, now = new Date()): TimelineItem[] {
  const today = ymd(now);
  return [...events, ...milestoneEvents(sobrietyDate, now)]
    .filter((e) => e.date <= today)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

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
    const i = chartIndex(e.date, range, now);
    if (i < 0) continue;
    const m = marks.get(i);
    if (m) m.count++;
    else marks.set(i, { index: i, color: KINDS[e.kind].color, count: 1 });
  }
  return [...marks.values()].sort((a, b) => a.index - b.index);
}

export const inRange = (items: TimelineItem[], range: Range, now = new Date()) =>
  items.filter((e) => chartIndex(e.date, range, now) >= 0);

// Title and note are free text, so the safety screen runs on them before the
// event is saved, as it does on every check-in and question.
export const screenEntry = (title: string, note = ''): SafetyResult => screen(`${title}\n${note}`);

export const dateLabel = (date: string, now = new Date()) => {
  const ago = daysBetween(fromYmd(date), now);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return fromYmd(date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(fromYmd(date).getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

export const monthLabel = (date: string) => fromYmd(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
