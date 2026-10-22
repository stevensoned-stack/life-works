// Who gets texted, and when (build plan sec. 06). Pure, so the rules are easy
// to read and test.
import { SafetyTier } from '../../src/data/types';

export type Hours = { timeZone: string; days: number[]; start: number; end: number }; // days: 0 = Sunday

export const DEFAULT_HOURS: Hours = { timeZone: 'America/Los_Angeles', days: [1, 2, 3, 4, 5], start: 8, end: 17 };

export function inBusinessHours(now: Date, h: Hours) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: h.timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(now);
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')!.value);
  const hour = Number(parts.find((p) => p.type === 'hour')!.value);
  return h.days.includes(day) && hour >= h.start && hour < h.end;
}

// Tier 1: no text; it waits on the review list.
// Tier 2: the person's counselor in business hours, the on-call staff outside them.
// Tier 3: the counselor always, plus on-call outside business hours.
// With nobody on call, the counselor is texted anyway rather than no one.
export function routeFor(tier: SafetyTier, now: Date, counselorId: string, onCall: string[], hours: Hours): string[] {
  if (tier < 2) return [];
  const open = inBusinessHours(now, hours);
  let to: string[];
  if (tier === 2) to = open || onCall.length === 0 ? [counselorId] : onCall;
  else to = open ? [counselorId] : [counselorId, ...onCall];
  return [...new Set(to)];
}

// An unacknowledged Tier 2+ alert goes to supervisors after this long; if
// there are none, to on-call staff who weren't texted the first time.
export function rerouteTargets(alreadyTexted: string[], supervisors: string[], onCall: string[]) {
  const fresh = (ids: string[]) => ids.filter((id) => !alreadyTexted.includes(id));
  const sup = fresh(supervisors);
  return sup.length ? sup : fresh(onCall);
}
