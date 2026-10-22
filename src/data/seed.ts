import { colors } from '../theme';
import { addDays, ymd } from '../util';
import { CalendarItem, LifeEvent, MoodEntry, MoodValue, State, SupportPerson } from './types';

// Small deterministic PRNG so the demo history looks the same on every device.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const TAGS = ['Money', 'Housing', 'Work or school', 'People', 'Cravings', 'Sleep', 'Feeling alone'];

// The last six days match the demo video's LifePath chart (Thu..Tue).
const RECENT: { value: MoodValue; tags: string[] }[] = [
  { value: 1, tags: [] },
  { value: 0, tags: ['Sleep'] },
  { value: 2, tags: [] },
  { value: 1, tags: ['People'] },
  { value: -1, tags: ['Sleep', 'Work or school'] },
  { value: 0, tags: ['Sleep'] },
];

export function seedMoods(now = new Date(), days = 400): MoodEntry[] {
  const rand = rng(42);
  const out: MoodEntry[] = [];
  for (let d = days; d >= 1; d--) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const recent = d <= RECENT.length ? RECENT[RECENT.length - d] : null;
    // A slow upward drift across the year, like someone settling into a program.
    const drift = -0.8 + (1 - d / days) * 1.3;
    const value = recent
      ? recent.value
      : (Math.max(-2, Math.min(2, Math.round(drift + (rand() - 0.5) * 2.6))) as MoodValue);
    const tags = recent
      ? recent.tags
      : value < 0
        ? [TAGS[Math.floor(rand() * TAGS.length)]]
        : [];
    // Skip some older days: real check-in history has gaps.
    if (!recent && rand() < 0.18) continue;
    day.setHours(8, Math.floor(rand() * 50), 0, 0);
    out.push({
      id: `seed-${d}`,
      value,
      source: 'self_report',
      recordedAt: day.toISOString(),
      tags,
    });
  }
  return out;
}

// Demo placeholder numbers use the 555-01xx range, which is reserved for fiction.
export const seedPeople = (): SupportPerson[] => [
  { id: 'maya', name: 'Maya Torres', role: 'Care coordinator', detail: 'Answers 24/7', group: 'coordinator', phone: '+15095550142', color: colors.red },
  { id: 'marcus', name: 'Marcus R.', role: 'Sponsor', detail: 'Call any time', group: 'team', phone: '+15095550118', color: colors.module.lifepath },
  { id: 'lee', name: 'Dr. Lee', role: 'Therapist', detail: 'Thursdays', group: 'team', phone: '+15095550127', color: colors.greenDark },
  { id: 'dre', name: 'Dre W.', role: 'Peer mentor', detail: 'Care alumni', group: 'team', phone: '+15095550131', color: colors.blue },
  { id: 'house', name: 'House staff on duty', role: 'Youth house', detail: '24 hours', group: 'team', phone: '+15095550150', color: colors.module.myhome },
  { id: 'carol', name: 'Ms. Carol', role: 'Mentor', detail: 'Weekends', group: 'family', phone: '+15095550163', color: colors.module.chat },
  { id: 'kayla', name: 'Kayla', role: 'Sister', detail: '', group: 'family', phone: '+15095550174', color: colors.module.lifeevent },
];

export function seedCalendar(now = new Date()): CalendarItem[] {
  const d = (n: number) => ymd(addDays(now, n));
  const item = (date: string, time: string, title: string, subtitle: string, kind: CalendarItem['kind'], remindMins: number | null = 30): CalendarItem => ({
    id: `${date}-${time}-${title}`,
    date,
    time,
    title,
    subtitle,
    kind,
    remindMins,
  });
  // Today matches the demo's Check In/Out schedule.
  return [
    item(d(0), '08:00', 'Work crew', 'Paid · 4 hrs', 'work'),
    item(d(0), '13:30', 'Call with Maya', 'Housing plan', 'appointment', 15),
    item(d(0), '16:00', 'GED math class', 'Community college', 'school'),
    item(d(0), '19:00', 'Back at the house', 'Check in with staff', 'other', null),
    item(d(1), '15:00', 'Weekly therapy', 'Dr. Lee · DBT', 'appointment', 60),
    item(d(2), '08:00', 'Work crew', 'Paid · 4 hrs', 'work'),
    item(d(3), '18:00', 'House meeting', 'Youth house', 'other'),
    item(d(4), '08:00', 'Work crew', 'Paid · 4 hrs', 'work'),
  ];
}

// A few things that happened to Jordan, spread across the clean-time window so
// every LifePath range has something on it, and a few goals.
export function seedLifeEvents(now = new Date()): LifeEvent[] {
  const ev = (ago: number, title: string, kind: LifeEvent['kind'], feel: LifeEvent['feel'], note?: string): LifeEvent => {
    const d = addDays(now, -ago);
    d.setHours(20, 0, 0, 0);
    return { id: `seed-event-${ago}`, status: 'done', date: ymd(d), title, kind, feel, note, createdAt: d.toISOString() };
  };
  const goal = (id: string, inDays: number | null, title: string, kind: LifeEvent['kind']): LifeEvent => ({
    id: `seed-goal-${id}`,
    status: 'planned',
    date: inDays === null ? null : ymd(addDays(now, inDays)),
    title,
    kind,
    feel: 'good',
    createdAt: addDays(now, -30).toISOString(),
  });
  return [
    ev(80, 'Started the recovery program', 'recovery', 'mixed'),
    ev(70, 'Moved into the youth house', 'housing', 'good', 'My own room for the first time.'),
    ev(52, 'Started on the work crew', 'work_school', 'good'),
    ev(40, 'Probation review in court', 'legal', 'mixed', 'Judge said keep doing what I am doing.'),
    ev(25, "Grandma's funeral", 'family', 'hard'),
    ev(9, 'Passed the GED reading test', 'work_school', 'good'),
    ev(2, 'Shift got cancelled', 'work_school', 'hard', 'Lost a day of pay.'),
    goal('license', 45, "Get my driver's license", 'legal'),
    goal('ged', 120, 'Finish my GED', 'work_school'),
    goal('place', null, 'Get my own place', 'housing'),
  ];
}

export function seedState(): State {
  return {
    profile: {
      name: 'Jordan',
      phase: 'Phase 1, Week 6',
      coordinator: { name: 'Maya', phone: '+15095550142' },
    },
    // 78 days, so the demo shows 90 days coming up in 12.
    sobrietyDate: ymd(addDays(new Date(), -78)),
    moods: seedMoods(),
    checkins: [],
    people: seedPeople(),
    calendar: seedCalendar(),
    reminders: [
      { id: 'meds-am', title: 'Morning meds', hour: 8, minute: 0, on: true },
      { id: 'step', title: 'Call Marcus', hour: 18, minute: 30, on: false },
    ],
    visits: [],
    questions: [],
    lifeEvents: seedLifeEvents(),
    safetyEvents: [],
    places: seedPlaces(),
    plan: seedPlan(),
    attendance: seedAttendance(),
    settings: {
      onboarded: false,
      wakeHour: 7,
      sleepHour: 22,
      checkInReminders: true,
      shareSafetyAlerts: true,
      checkInLocation: false,
      shareAttendance: false,
      attendanceReminders: true,
    },
  };
}
