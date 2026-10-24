// Run with: npm test
// Checks the LifeEvent timeline, where events land on the LifePath chart, and
// that free text in an event goes through the safety screen.
import assert from 'node:assert/strict';
import { seedLifeEvents } from '../src/data/seed';
import { LifeEvent } from '../src/data/types';
import { chartIndex, chartMarks, eventStatus, inRange, markDone, milestoneEvents, screenEntry, SUGGESTIONS, timeline, upcoming } from '../src/recovery/lifeEvents';
import { addDays, ymd } from '../src/util';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const now = new Date(2026, 9, 22, 12, 0, 0); // Thu 22 Oct 2026, local
const ago = (n: number) => ymd(addDays(now, -n));
const ev = (n: number, title: string, extra: Partial<LifeEvent> = {}): LifeEvent => ({
  id: `e${n}-${title}`,
  status: 'done',
  date: ago(n),
  title,
  kind: 'other',
  feel: 'mixed',
  createdAt: addDays(now, -n).toISOString(),
  ...extra,
});

// --- chart placement --------------------------------------------------------

test('daily: today is the last point, 6 days ago the first, 7 days ago is off', () => {
  assert.equal(chartIndex(ago(0), 'daily', now), 6);
  assert.equal(chartIndex(ago(6), 'daily', now), 0);
  assert.equal(chartIndex(ago(7), 'daily', now), -1);
});

test('monthly: four 7-day buckets ending today', () => {
  assert.equal(chartIndex(ago(0), 'monthly', now), 3);
  assert.equal(chartIndex(ago(6), 'monthly', now), 3);
  assert.equal(chartIndex(ago(7), 'monthly', now), 2);
  assert.equal(chartIndex(ago(27), 'monthly', now), 0);
  assert.equal(chartIndex(ago(28), 'monthly', now), -1);
});

test('yearly: calendar months, this month last', () => {
  assert.equal(chartIndex('2026-10-01', 'yearly', now), 11);
  assert.equal(chartIndex('2026-09-30', 'yearly', now), 10);
  assert.equal(chartIndex('2025-11-01', 'yearly', now), 0);
  assert.equal(chartIndex('2025-10-31', 'yearly', now), -1);
});

test('future dates are never placed on the chart', () => {
  assert.equal(chartIndex(ymd(addDays(now, 1)), 'daily', now), -1);
  assert.equal(chartIndex(ymd(addDays(now, 1)), 'monthly', now), -1);
});

test('marks group events on the same point and count them', () => {
  const marks = chartMarks([ev(1, 'a'), ev(1, 'b'), ev(3, 'c'), ev(30, 'old')], 'daily', now);
  assert.deepEqual(
    marks.map((m) => [m.index, m.count]),
    [
      [3, 1],
      [5, 2],
    ],
  );
});

// --- timeline ---------------------------------------------------------------

test('milestones come from the clean date, earned ones only', () => {
  const ms = milestoneEvents(ago(78), now);
  assert.deepEqual(
    ms.map((m) => m.title),
    ['24 hours clean', '1 week clean', '2 weeks clean', '30 days clean', '60 days clean'],
  );
  assert.equal(ms.find((m) => m.title === '30 days clean')?.date, ago(48));
  assert.ok(ms.every((m) => m.auto && m.kind === 'recovery'));
  assert.deepEqual(milestoneEvents(null, now), []);
});

test('timeline is newest first, mixes in milestones, and drops future dates', () => {
  const t = timeline([ev(5, 'five'), ev(50, 'fifty'), { ...ev(0, 'later'), date: ymd(addDays(now, 3)) }], ago(10), now);
  assert.deepEqual(
    t.map((e) => e.title),
    ['1 week clean', 'five', '24 hours clean', 'fifty'],
  );
});

test('inRange keeps what the chart shows', () => {
  const t = timeline([ev(2, 'recent'), ev(20, 'weeks'), ev(200, 'months')], null, now);
  assert.deepEqual(inRange(t, 'daily', now).map((e) => e.title), ['recent']);
  assert.deepEqual(inRange(t, 'monthly', now).map((e) => e.title), ['recent', 'weeks']);
  assert.equal(inRange(t, 'yearly', now).length, 3);
});

test('planned items stay off the timeline and the chart', () => {
  const plan = ev(0, 'Get my license', { status: 'planned', date: ymd(addDays(now, 10)) });
  const t = timeline([ev(1, 'done'), plan, { ...plan, id: 'p2', date: null }], null, now);
  assert.deepEqual(t.map((e) => e.title), ['done']);
});

test('upcoming: dated goals soonest first, next milestone included, undated last', () => {
  const g = (id: string, inDays: number | null, created: number) =>
    ev(0, id, { id, status: 'planned', date: inDays === null ? null : ymd(addDays(now, inDays)), createdAt: addDays(now, -created).toISOString() });
  const u = upcoming([g('later', 40, 1), g('undated-new', null, 1), g('soon', 5, 1), g('undated-old', null, 9), ev(3, 'done')], ago(78), now);
  assert.deepEqual(
    u.map((e) => e.title),
    ['soon', '90 days clean', 'later', 'undated-old', 'undated-new'],
  );
  assert.equal(u[1].date, ymd(addDays(now, 12)));
  assert.ok(u[1].auto);
});

test('upcoming has no milestone without a clean date', () => {
  assert.deepEqual(upcoming([], null, now), []);
});

test('marking a goal done dates it today and keeps it', () => {
  const plan = ev(0, 'Finish my GED', { id: 'ged', status: 'planned', date: null });
  const done = markDone(plan, now);
  assert.equal(done.status, 'done');
  assert.equal(done.date, ymd(now));
  assert.equal(done.id, 'ged');
  assert.equal(done.createdAt, plan.createdAt);
  assert.deepEqual(timeline([done], null, now).map((e) => e.id), ['ged']);
});

test('suggestions are unique and pass the safety screen', () => {
  assert.equal(new Set(SUGGESTIONS.map((x) => x.title)).size, SUGGESTIONS.length);
  for (const x of SUGGESTIONS) assert.equal(screenEntry(x.title).kind, 'none', x.title);
});

test('status counts done items, feelings, goals and milestones', () => {
  const goal = ev(0, 'Get my GED', { id: 'g', status: 'planned', date: null });
  const s = eventStatus([ev(3, 'a', { feel: 'good' }), ev(40, 'b', { feel: 'hard' }), markDone(ev(0, 'c', { id: 'c', status: 'planned' }), now), goal], ago(78), now);
  assert.equal(s.done, 3);
  assert.equal(s.lastMonth, 2);
  assert.deepEqual(s.feel, { good: 2, mixed: 0, hard: 1 });
  assert.equal(s.goalsOpen, 1);
  assert.equal(s.goalsDone, 1);
  assert.equal(s.milestones, 5);
  assert.deepEqual(s.nextMilestone, { title: '90 days clean', date: ymd(addDays(now, 12)), days: 12 });
  assert.equal(eventStatus([], null, now).nextMilestone, null);
});

// --- safety -----------------------------------------------------------------

test('crisis words in a title interrupt', () => {
  const r = screenEntry('i want to kill myself');
  assert.equal(r.kind, 'crisis');
});

test('crisis words in the note are screened too', () => {
  const r = screenEntry('Bad night', 'took a bunch of pills and cant wake him up');
  assert.equal(r.kind, 'crisis');
});

test('eviction is routed to housing help', () => {
  const r = screenEntry('Got evicted');
  assert.equal(r.kind, 'urgent');
  assert.equal(r.kind === 'urgent' && r.variant, 'housing');
});

test('ordinary events pass', () => {
  for (const t of ['New job at the warehouse', 'Court date', "Grandma's funeral", 'Thirty days clean', 'Moved into my own place']) {
    assert.equal(screenEntry(t).kind, 'none', t);
  }
});

test('demo events do not trip the safety screen', () => {
  for (const e of seedLifeEvents(now)) assert.equal(screenEntry(e.title, e.note).kind, 'none', e.title);
});

console.log(`${passed} passed`);
