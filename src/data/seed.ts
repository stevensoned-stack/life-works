import { emptyLearned } from '../zoey/learn';
import { seedHome } from '../recovery/home';
import { colors } from '../theme';
import { addDays, ymd } from '../util';
import { Attendance, CalendarItem, GoalArea, LifeEvent, MoodEntry, MoodValue, Place, PlanSlot, State, SupportPerson } from './types';

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

// Jordan's demo week (Ed, 2026-11-14: "populate Jordan's calendar so I can
// demo it"). Added on top of seedCalendar, which matches the demo video and is
// what the Zoey tests read. Built from today by weekday, so it always looks like
// a real week in a Spokane recovery house: noon meetings, group, sponsor,
// chores, a visit with Kayla, and a few one-offs that tie to Jordan's goals.
// Times stay clear of the Check In/Out plan (work 8-12, school 4-6, home by 7).
// Ids start with "seed-cal-" so the store can roll the week forward later.
export const SEED_CAL = 'seed-cal-';
export function seedDemoCalendar(now = new Date(), from = -7, to = 21): CalendarItem[] {
  const out: CalendarItem[] = [];
  const add = (day: Date, time: string, title: string, subtitle: string, kind: CalendarItem['kind'], remindMins: number | null = 30, meetingId?: string) => {
    const date = ymd(day);
    out.push({ id: `${SEED_CAL}${date}-${time}-${title}`, date, time, title, subtitle, kind, remindMins, ...(meetingId ? { meetingId } : {}) });
  };
  // Every week, by weekday (0 = Sunday).
  const WEEK: Record<number, [string, string, string, CalendarItem['kind'], number | null, string?][]> = {
    0: [
      ['13:00', 'Lunch with Kayla', 'My sister · Riverfront Park', 'other', 60],
      ['17:00', 'Weekly planning', 'Look over my calendar and goals', 'other', null],
    ],
    1: [
      ['12:00', 'Just for Today', 'NA · Online · Beginner friendly', 'meeting', 15, 'm2'],
      ['13:00', 'Drug test', 'UA at the outpatient clinic', 'appointment', 30],
    ],
    2: [
      ['13:00', 'Group counseling', 'Outpatient program · Room 4', 'appointment', 30],
      ['19:30', 'Kitchen chore', 'Dishes and wipe the counters', 'other', 15],
    ],
    3: [
      ['12:00', 'Just for Today', 'NA · Online · Beginner friendly', 'meeting', 15, 'm2'],
      ['13:30', 'Weekly call with Maya', 'Check-in with my coordinator', 'appointment', 15],
    ],
    4: [['19:30', 'Bathroom chore', 'Scrub the shared bathroom', 'other', 15]],
    5: [
      ['12:00', 'Just for Today', 'NA · Online · Beginner friendly', 'meeting', 15, 'm2'],
      ['13:00', 'Group counseling', 'Outpatient program · Room 4', 'appointment', 30],
      ['18:30', 'Room check', 'House staff', 'other', 15],
    ],
    6: [
      ['10:00', 'Coffee with Marcus', 'Sponsor · Step work', 'appointment', 60],
      ['14:00', 'Laundry day', 'Tidy my room before room check', 'other', null],
      ['19:30', 'Movie night at the house', 'Popcorn in the living room', 'other', null],
    ],
  };
  for (let i = from; i <= to; i++) {
    const day = addDays(now, i);
    for (const [time, title, subtitle, kind, remind, meetingId] of WEEK[day.getDay()]) add(day, time, title, subtitle, kind, remind, meetingId);
  }
  // One-offs, moved to the next weekday when they land on a weekend.
  const weekday = (n: number) => {
    let d = addDays(now, n);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    return d;
  };
  const once: [number, boolean, string, string, string, CalendarItem['kind'], number | null][] = [
    [-5, true, '14:00', 'Dentist', 'Community health clinic', 'appointment', 60],
    [2, true, '14:30', 'Probation check-in', 'Spokane County probation', 'appointment', 60],
    [5, true, '14:30', 'Med check with the doctor', 'Community health clinic', 'appointment', 60],
    [8, true, '13:30', 'Welding info session', 'Spokane Community College', 'appointment', 60],
    // 90 days in recovery: Jordan's recovery date is 78 days ago.
    [12, false, '18:00', 'Celebrate 90 days in recovery', 'Key tag at the house meeting', 'other', 60],
    [15, true, '13:30', 'GED math test', 'Testing center', 'appointment', 120],
    [19, true, '14:30', 'Driving permit test', 'Department of Licensing', 'appointment', 60],
  ];
  for (const [n, wk, time, title, subtitle, kind, remind] of once) if (n >= from && n <= to) add(wk ? weekday(n) : addDays(now, n), time, title, subtitle, kind, remind);
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

// The video's calendar and Jordan's demo week together. A demo item at the
// same day and time as a video one is left out.
export function seedFullCalendar(now = new Date()): CalendarItem[] {
  const core = seedCalendar(now);
  const taken = new Set(core.map((c) => `${c.date} ${c.time}`));
  return [...core, ...seedDemoCalendar(now).filter((c) => !taken.has(`${c.date} ${c.time}`))];
}

// Saved calendars roll forward: demo weeks past the last saved demo day are
// added, so the demo never runs out. Items they added, changed or deleted stay
// as they left them.
// Only the demo calendar rolls: a calendar with none of the demo's own items
// is someone's real one and is left alone.
export function rollDemoCalendar(saved: CalendarItem[], now = new Date()): CalendarItem[] {
  const demo = saved.some((c) => c.id.startsWith(SEED_CAL) || (c.title === 'Work crew' && c.subtitle === 'Paid · 4 hrs'));
  if (!demo) return saved;
  const last = saved.filter((c) => c.id.startsWith(SEED_CAL)).reduce((m, c) => (c.date > m ? c.date : m), '');
  const taken = new Set(saved.map((c) => `${c.date} ${c.time}`));
  const more = seedDemoCalendar(now, last ? 0 : -7).filter((c) => c.date > last && !taken.has(`${c.date} ${c.time}`));
  return more.length ? [...saved, ...more] : saved;
}

// The demo's Check In/Out places. No saved spots: the person adds those while
// standing at each place.
export const seedPlaces = (): Place[] => [
  { id: 'work', name: 'Work crew', kind: 'work', detail: 'Paid · 4 hrs' },
  { id: 'school', name: 'School', kind: 'school', detail: 'GED math class, community college' },
  { id: 'house', name: 'Youth house', kind: 'home', detail: 'Check in with staff' },
  { id: 'therapy', name: 'Therapy', kind: 'treatment', detail: 'Dr. Lee · DBT' },
];

export const seedPlan = (): PlanSlot[] => [
  { id: 'work', placeId: 'work', days: [1, 2, 3, 4, 5], start: '08:00', end: '12:00' },
  { id: 'therapy', placeId: 'therapy', days: [4], start: '15:00', end: '16:00' },
  { id: 'school', placeId: 'school', days: [1, 2, 3, 4], start: '16:00', end: '18:00' },
  { id: 'curfew', placeId: 'house', days: [0, 1, 2, 3, 4, 5, 6], start: '19:00' },
];

// A few past days so the history and report have something in them.
export function seedAttendance(now = new Date()): Attendance[] {
  const out: Attendance[] = [];
  const t = (daysAgo: number, hm: string) => {
    const x = addDays(now, -daysAgo);
    const [h, m] = hm.split(':').map(Number);
    x.setHours(h, m, 0, 0);
    return x;
  };
  const add = (id: string, placeId: string, placeName: string, inAt: Date, outAt?: Date) =>
    out.push({
      id,
      placeId,
      placeName,
      method: 'tap',
      inAt: inAt.toISOString(),
      // Leave the visit open if its check-out time hasn't come yet today.
      outAt: outAt && outAt.getTime() < now.getTime() ? outAt.toISOString() : undefined,
      share: 'not_shared',
    });
  for (let n = 3; n >= 1; n--) {
    const wd = addDays(now, -n).getDay();
    if (wd >= 1 && wd <= 5) add(`seed-${n}-work`, 'work', 'Work crew', t(n, '07:56'), t(n, '12:03'));
    if (wd >= 1 && wd <= 4) add(`seed-${n}-school`, 'school', 'School', t(n, '16:04'), t(n, '17:58'));
    // Back at the house in the evening, out again the next morning.
    add(`seed-${n}-house`, 'house', 'Youth house', t(n, n === 2 ? '19:12' : '18:47'), t(n - 1, '07:35'));
  }
  return out;
}

// A few things that happened to Jordan, spread across the recovery window so
// every LifePath range has something on it, and a few goals.
export function seedLifeEvents(now = new Date()): LifeEvent[] {
  const ev = (ago: number, title: string, kind: LifeEvent['kind'], feel: LifeEvent['feel'], note?: string): LifeEvent => {
    const d = addDays(now, -ago);
    d.setHours(20, 0, 0, 0);
    return { id: `seed-event-${ago}`, status: 'done', date: ymd(d), title, kind, feel, note, createdAt: d.toISOString() };
  };
  const goal = (id: string, inDays: number | null, title: string, kind: LifeEvent['kind'], area?: GoalArea): LifeEvent => ({
    id: `seed-goal-${id}`,
    area,
    status: 'planned',
    date: inDays === null ? null : ymd(addDays(now, inDays)),
    title,
    kind,
    feel: 'good',
    createdAt: addDays(now, -30).toISOString(),
  });
  const reached = (id: string, ago: number, title: string, kind: LifeEvent['kind'], area: GoalArea, note?: string): LifeEvent => {
    const d = addDays(now, -ago);
    d.setHours(19, 0, 0, 0);
    return { id: `seed-goal-${id}`, area, status: 'done', date: ymd(d), title, kind, feel: 'good', note, createdAt: addDays(now, -75).toISOString(), doneAt: d.toISOString() };
  };
  return [
    // Things that happened, oldest first.
    ev(80, 'Started the recovery program', 'recovery', 'mixed', 'Scared but ready.'),
    ev(70, 'Moved into the youth house', 'housing', 'good', 'My own room for the first time.'),
    ev(64, 'Got my state ID', 'legal', 'good'),
    ev(52, 'Started on the work crew', 'work_school', 'good'),
    ev(45, 'First paycheck', 'work_school', 'good', 'Put $50 in savings.'),
    ev(40, 'Probation review in court', 'legal', 'mixed', 'Judge said keep doing what I am doing.'),
    ev(33, 'Opened a bank account', 'other', 'good'),
    ev(25, "Grandma's funeral", 'family', 'hard', 'Went with Kayla. Called Marcus after.'),
    ev(19, 'Lunch with Kayla', 'family', 'good', 'First time in two years.'),
    ev(14, 'Hard week at the house', 'housing', 'hard', 'Roommate drama. Talked it out at the house meeting.'),
    ev(9, 'Passed the GED reading test', 'work_school', 'good'),
    ev(5, 'Dentist visit', 'health', 'mixed', 'Need one more filling.'),
    ev(2, 'Shift got cancelled', 'work_school', 'hard', 'Lost a day of pay.'),
    // Goals reached.
    reached('sponsor', 60, 'Get a sponsor', 'recovery', 'recovery', 'Marcus said yes.'),
    reached('cravings', 35, 'Learn ways to handle cravings', 'recovery', 'recovery', 'Urge surfing and calling Marcus.'),
    reached('fafsa', 20, 'Apply for financial aid (FAFSA)', 'work_school', 'education'),
    reached('job', 52, 'Get a job', 'work_school', 'career', 'Work crew, 4 hours a day.'),
    reached('kayla', 19, 'Have lunch with Kayla', 'family', 'family'),
    // Goals still to go.
    goal('network', null, 'Build a sober support network', 'recovery', 'recovery'),
    goal('meetings', null, 'Go to meetings every week', 'recovery', 'recovery'),
    goal('steps', 90, 'Work the 12 steps', 'recovery', 'recovery'),
    goal('ged', 120, 'Get my GED', 'work_school', 'education'),
    goal('cert', 200, 'Earn a certificate or license', 'work_school', 'education'),
    goal('welding', 240, 'Work toward a career in welding', 'work_school', 'career'),
    goal('fulltime', 150, 'Get a full-time job', 'work_school', 'career'),
    goal('sister', null, 'Rebuild my relationship with my brothers and sisters', 'family', 'family'),
    goal('carol', 30, 'Call Ms. Carol every week', 'family', 'family'),
    goal('license', 45, "Get my driver's license", 'legal'),
    goal('place', null, 'Get my own place', 'housing'),
    goal('save', 90, 'Save $500', 'other'),
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
    home: seedHome(),
    calendar: seedFullCalendar(),
    reminders: [
      { id: 'meds-am', title: 'Morning meds', hour: 8, minute: 0, on: true },
      { id: 'step', title: 'Call Marcus', hour: 18, minute: 30, on: false },
    ],
    visits: [],
    questions: [],
    lifeEvents: seedLifeEvents(),
    safetyEvents: [],
    learned: emptyLearned(),
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
      zoeyVoiceOn: true,
      zoeyLearns: true,
      city: null,
      nearbyLocation: false,
    },
  };
}
