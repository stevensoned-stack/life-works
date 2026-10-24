// LifeGoals: goals grouped into life areas, each with options to tap instead of
// typing. A goal is a planned LifeEvent tagged with its area, so it also shows
// under "Goals and coming up" in LifeEvent, and marking it done puts it on the
// timeline and the LifePath chart. Pure, so it can be tested.
import { GoalArea, LifeEvent, LifeEventKind } from '../data/types';
import { colors } from '../theme';

export type AreaInfo = {
  title: string;
  question: string;
  color: string;
  kind: LifeEventKind; // the LifeEvent type a goal in this area gets
  options: { label: string; title: string }[]; // label on the chip, title saved
};

const same = (titles: string[]) => titles.map((t) => ({ label: t, title: t }));

export const AREAS: Record<GoalArea, AreaInfo> = {
  recovery: {
    title: 'Recovery',
    question: 'What are your goals for your recovery?',
    color: colors.module.lifepath,
    kind: 'recovery',
    options: same([
      'Stay sober one day at a time',
      'Reach 90 days clean',
      'Reach 1 year clean',
      'Get a sponsor',
      'Go to meetings every week',
      'Finish my treatment program',
      'Work the 12 steps',
      'Learn ways to handle cravings',
      'Build a sober support network',
      'Take my medication as prescribed',
    ]),
  },
  education: {
    title: 'Education',
    question: 'What do you want to finish or start?',
    color: colors.blue,
    kind: 'work_school',
    options: [
      { label: 'GED', title: 'Get my GED' },
      { label: 'High school diploma', title: 'Finish my high school diploma' },
      { label: 'Associate degree (AA, 2 years)', title: 'Earn an associate degree (AA)' },
      { label: "Bachelor's degree (BA or BS, 4 years)", title: "Earn a bachelor's degree (BA or BS)" },
      { label: 'Trade school or apprenticeship', title: 'Go to trade school or an apprenticeship' },
      { label: 'Certificate or license (CNA, CDL, forklift)', title: 'Earn a certificate or license' },
      { label: 'Apply for financial aid (FAFSA)', title: 'Apply for financial aid (FAFSA)' },
      { label: 'English classes (ESL)', title: 'Take English classes (ESL)' },
    ],
  },
  career: {
    title: 'Career',
    question: 'What kind of work interests you?',
    color: colors.module.lifeevent,
    kind: 'work_school',
    options: [
      ['Welding', 'welding'],
      ['Construction', 'construction'],
      ['Electrician or plumber', 'the electrical or plumbing trades'],
      ['Computers and IT', 'computers and IT'],
      ['Medical and healthcare', 'medical and healthcare'],
      ['Truck driving (CDL)', 'truck driving'],
      ['Auto mechanic', 'auto repair'],
      ['Cooking and food service', 'cooking and food service'],
      ['Warehouse and forklift', 'warehouse work'],
      ['Customer service and retail', 'customer service'],
      ['Peer recovery coach', 'peer recovery coaching'],
    ]
      .map(([label, field]) => ({ label, title: `Work toward a career in ${field}` }))
      .concat({ label: 'Start my own business', title: 'Start my own business' }),
  },
  family: {
    title: 'Family',
    question: 'Who do you want to rebuild relationships with?',
    color: colors.module.chat,
    kind: 'family',
    options: [
      ['Parents', 'my parents'],
      ['Brothers and sisters', 'my brothers and sisters'],
      ['Spouse or partner', 'my spouse or partner'],
      ['My children', 'my children'],
      ['Grandparents', 'my grandparents'],
      ['Aunts, uncles and cousins', 'my extended family'],
      ['Old friends', 'old friends'],
    ].map(([label, who]) => ({ label, title: `Rebuild my relationship with ${who}` })),
  },
};

export const AREA_ORDER: GoalArea[] = ['recovery', 'education', 'career', 'family'];

// The goal saved for an option in an area, planned or done, if there is one.
export const goalFor = (events: LifeEvent[], area: GoalArea, title: string) =>
  events.find((e) => e.area === area && e.title === title);

export const newGoal = (area: GoalArea, title: string, id: string, now = new Date()): LifeEvent => ({
  id,
  status: 'planned',
  date: null,
  title,
  kind: AREAS[area].kind,
  feel: 'good',
  area,
  createdAt: now.toISOString(),
});

// Goals in an area, open ones first (soonest target, then oldest), then done.
export function areaGoals(events: LifeEvent[], area: GoalArea): LifeEvent[] {
  const mine = events.filter((e) => e.area === area);
  const open = mine
    .filter((e) => e.status === 'planned')
    .sort((a, b) => (a.date && b.date ? a.date.localeCompare(b.date) : a.date ? -1 : b.date ? 1 : a.createdAt.localeCompare(b.createdAt)));
  const done = mine.filter((e) => e.status === 'done').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return [...open, ...done];
}

export const progress = (events: LifeEvent[], area: GoalArea) => {
  const mine = events.filter((e) => e.area === area);
  return { total: mine.length, done: mine.filter((e) => e.status === 'done').length };
};

export type GoalState = 'done' | 'late' | 'dated' | 'open';

export const STATE_LABEL: Record<GoalState, string> = {
  done: 'Done',
  late: 'Past target date',
  dated: 'Has a target date',
  open: 'No date yet',
};

export function goalState(e: LifeEvent, today: string): GoalState {
  if (e.status === 'done') return 'done';
  if (!e.date) return 'open';
  return e.date < today ? 'late' : 'dated';
}

// Counts for the status card at the bottom of LifeGoals: every area goal, and
// per area how many are in each state.
export function goalStatus(events: LifeEvent[], today: string) {
  const blank = (): Record<GoalState, number> => ({ done: 0, late: 0, dated: 0, open: 0 });
  const areas = Object.fromEntries(AREA_ORDER.map((a) => [a, { total: 0, ...blank() }])) as Record<GoalArea, { total: number } & Record<GoalState, number>>;
  const all = { total: 0, ...blank() };
  for (const e of events) {
    if (!e.area) continue;
    const s = goalState(e, today);
    areas[e.area].total++;
    areas[e.area][s]++;
    all.total++;
    all[s]++;
  }
  return { all, areas };
}
