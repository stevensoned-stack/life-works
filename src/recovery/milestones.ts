import { addDays, daysBetween, fromYmd } from '../util';

export type Milestone = { days: number; label: string };

// Common recovery-chip milestones. Day counts use 30-day months and 365-day
// years, matching how most groups hand out chips.
export const MILESTONES: Milestone[] = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '30 days' },
  { days: 60, label: '60 days' },
  { days: 90, label: '90 days' },
  { days: 180, label: '6 months' },
  { days: 270, label: '9 months' },
  { days: 365, label: '1 year' },
  { days: 545, label: '18 months' },
  { days: 730, label: '2 years' },
  { days: 1095, label: '3 years' },
  { days: 1825, label: '5 years' },
];

export function cleanTime(sobrietyDate: string, now = new Date()) {
  const start = fromYmd(sobrietyDate);
  const days = Math.max(0, daysBetween(start, now));
  const earned = MILESTONES.filter((m) => days >= m.days);
  const next = MILESTONES.find((m) => days < m.days) ?? null;
  const prevDays = earned.length ? earned[earned.length - 1].days : 0;
  return {
    days,
    earned,
    next,
    daysToNext: next ? next.days - days : 0,
    // Progress from the last milestone toward the next one, 0..1.
    progress: next ? (days - prevDays) / (next.days - prevDays) : 1,
    nextDate: next ? addDays(start, next.days) : null,
    hitToday: earned.find((m) => m.days === days) ?? null,
  };
}

export const daysLabel = (n: number) => (n === 1 ? '1 day' : `${n.toLocaleString()} days`);
