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
// there are none, to the program director, then to on-call staff who weren't
// texted the first time.
export function rerouteTargets(alreadyTexted: string[], ...inOrder: string[][]) {
  for (const group of inOrder) {
    const fresh = group.filter((id) => !alreadyTexted.includes(id));
    if (fresh.length) return fresh;
  }
  return [];
}

// ---- Which Life Works staff hear about which report ----
// The tier rule above always applies (counselor, on-call). On top of it, each
// kind of report brings in the staff role best placed to help. The actual
// people are added later with the admin script; until a role has someone in
// it, the alert notes that nobody in that role was told.

export type StaffRole = 'counselor' | 'house_manager' | 'case_manager' | 'program_director' | 'supervisor';

export const ROLE_LABEL: Record<StaffRole, string> = {
  counselor: 'Counselor',
  house_manager: 'House manager',
  case_manager: 'Case manager',
  program_director: 'Program director',
  supervisor: 'Clinical supervisor',
};

type ExtraRole = 'house_manager' | 'case_manager' | 'program_director';

// 'always': texted with the counselor at any hour.
// 'business': texted in business hours; after hours it waits on their review
// list for the morning (the counselor and on-call are still texted right away).
// A house manager only hears about people living in their Life Works Home.
export type RouteRule = { role: ExtraRole; when: 'always' | 'business' };

export const REPORT_ROUTES: { report: string; label: string; also: RouteRule[] }[] = [
  { report: 'crisis:psychiatric', label: 'Suicide or self-harm', also: [{ role: 'house_manager', when: 'always' }] },
  { report: 'crisis:medical', label: 'Medical emergency or overdose', also: [{ role: 'house_manager', when: 'always' }] },
  { report: 'urgent:using', label: 'About to use or using alone', also: [{ role: 'house_manager', when: 'always' }] },
  { report: 'urgent:withdrawal', label: 'Withdrawal or detox', also: [{ role: 'house_manager', when: 'always' }] },
  {
    report: 'urgent:housing',
    label: 'Losing housing',
    also: [
      { role: 'house_manager', when: 'business' },
      { role: 'case_manager', when: 'business' },
    ],
  },
  // Not the house manager: the harm may have happened in the house.
  { report: 'urgent:abuse', label: 'Abuse or assault', also: [{ role: 'program_director', when: 'business' }] },
  { report: 'urgent:pregnant', label: 'Pregnant and using', also: [{ role: 'case_manager', when: 'business' }] },
  { report: 'urgent:someone', label: 'Worried about someone else', also: [] },
  { report: 'check', label: 'Asked "are you safe?"', also: [] },
];

export const reportKey = (kind: string, variant?: string | null) => (kind === 'check' ? 'check' : `${kind}:${variant ?? ''}`);

// The staff around one person. houseManager: undefined when they don't live in
// a Life Works Home, null when they do but the home has no manager set up yet.
export type Team = {
  counselor: string;
  houseManager: string | null | undefined;
  caseManagers: string[];
  programDirectors: string[];
  onCall: string[];
};

export type Plan = { text: string[]; share: string[]; missing: StaffRole[] };

// text: texted now. share: also on their review list, not texted now.
// missing: roles this report should reach that have nobody set up yet.
export function planFor(tier: SafetyTier, kind: string, variant: string | null | undefined, now: Date, team: Team, hours: Hours): Plan {
  const text = routeFor(tier, now, team.counselor, team.onCall, hours);
  const share: string[] = [];
  const missing: StaffRole[] = [];
  const open = inBusinessHours(now, hours);
  const rules = REPORT_ROUTES.find((r) => r.report === reportKey(kind, variant))?.also ?? [];
  for (const rule of rules) {
    let ids: string[];
    if (rule.role === 'house_manager') {
      if (team.houseManager === undefined) continue;
      ids = team.houseManager ? [team.houseManager] : [];
    } else ids = rule.role === 'case_manager' ? team.caseManagers : team.programDirectors;
    if (!ids.length) missing.push(rule.role);
    const textNow = tier >= 2 && (rule.when === 'always' || open);
    (textNow ? text : share).push(...ids);
  }
  const t = [...new Set(text)];
  return { text: t, share: [...new Set(share)].filter((id) => !t.includes(id)), missing };
}
