// Run with: npm test
// Jordan's demo data (Ed, 2026-11-14: "populate Jordan's calendar so I can demo
// it, populate lifegoals, populate lifeevents").
import assert from 'node:assert/strict';
import { rollDemoCalendar, seedDemoCalendar, seedFullCalendar, seedLifeEvents, seedPlaces, seedPlan } from '../src/data/seed';
import { screenEntry, timeline, upcoming } from '../src/recovery/lifeEvents';
import { calendarList, dayChoices, findScheduleAsk, scheduleReply, ScheduleCtx } from '../src/zoey/schedule';
import { dayItems } from '../src/zoey/today';
import { validateReply } from '../src/zoey/validate';
import { addDays, ymd } from '../src/util';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
};

// A Saturday morning and a Wednesday morning, so both kinds of day are covered.
const days = [new Date(2026, 10, 14, 9, 0), new Date(2026, 10, 18, 9, 0), new Date(2026, 10, 16, 6, 30)];

for (const now of days) {
  const cal = seedFullCalendar(now);
  const st = { calendar: cal, plan: seedPlan(), places: seedPlaces() };
  const label = now.toDateString();

  test(`${label}: every day of the next week has something on it`, () => {
    for (let i = 0; i < 7; i++) {
      const d = ymd(addDays(now, i));
      assert.ok(cal.filter((c) => c.date === d).length >= 1, d);
    }
  });

  test(`${label}: no two calendar items at the same day and time, ids unique`, () => {
    const keys = cal.map((c) => `${c.date} ${c.time}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(new Set(cal.map((c) => c.id)).size, cal.length);
  });

  test(`${label}: never says "clean"`, () => {
    for (const c of cal) assert.doesNotMatch(`${c.title} ${c.subtitle}`, /\bclean\b(?! (my|the))/i, c.title);
    for (const e of seedLifeEvents(now)) assert.doesNotMatch(`${e.title} ${e.note ?? ''}`, /\bclean (time|date)|\bbeing clean|\bstay clean/i, e.title);
  });

  test(`${label}: demo items do not trip the safety screen`, () => {
    for (const c of cal) assert.equal(screenEntry(c.title, c.subtitle).kind, 'none', c.title);
    for (const e of seedLifeEvents(now)) assert.equal(screenEntry(e.title, e.note).kind, 'none', e.title);
  });

  test(`${label}: Zoey answers calendar questions from it`, () => {
    const sc: ScheduleCtx = { state: st, now, name: 'Jordan', coordinatorName: 'Maya', sponsorName: 'Marcus', recent: true, last: null };
    for (const q of ["what's next", 'what do i have today', 'what about tomorrow', 'this week', 'whats on monday', 'when is group', 'when is my meeting', 'when is coffee with marcus', 'when is my ged test', 'when is counseling', 'when is the welding info session']) {
      const a = findScheduleAsk(q, now);
      assert.ok(a, q);
      const r = scheduleReply(a!, sc, () => 0);
      assert.ok(r, q);
      assert.ok(validateReply(r!.text).ok, r!.text);
      assert.doesNotMatch(r!.text, /I don’t see|nothing on your calendar|Nothing else/i, `${q}: ${r!.text}`);
    }
  });

  test(`${label}: "show my calendar" lists the week day by day, then later one-offs`, () => {
    const sc: ScheduleCtx = { state: st, now, name: 'Jordan', coordinatorName: 'Maya', sponsorName: 'Marcus', recent: false, last: null };
    for (const q of ['show my calendar', 'Show me my calendar', 'my calendar', 'list my events', 'can you list my upcoming events?', 'show me a list of my events', 'my schedule', 'upcoming events', 'whats coming up this month', 'what are my upcoming appointments', 'Zoey, show my calendar please', 'pull up my schedule']) {
      const a = findScheduleAsk(q, now);
      assert.equal(a?.ask, 'list', q);
      const r = scheduleReply(a!, sc, () => 0)!;
      assert.ok(validateReply(r.text).ok, r.text);
      assert.doesNotMatch(r.text, /\bclean\b/i);
      assert.ok(r.list && r.list.days.length >= 6, q);
      assert.equal(r.list!.days[0].label, 'Today');
      assert.equal(r.list!.days[1].label, 'Tomorrow');
      // Curfews are left out, nothing already over today is shown.
      for (const d of r.list!.days) for (const x of d.items) assert.ok(!x.home, x.label);
      for (const x of r.list!.days[0].items) assert.ok(x.end > now.getHours() * 60 + now.getMinutes(), x.label);
    }
    const l = calendarList(st, now);
    // Later one-offs come only from the Calendar, in date order, after the week.
    for (const x of l.later) assert.ok(x.date >= ymd(addDays(now, 7)), x.date);
    assert.deepEqual(l.later.map((x) => x.date), [...l.later.map((x) => x.date)].sort());
  });

  test(`${label}: day questions still get their own answers`, () => {
    for (const [q, ask] of [['whats on my calendar', 'askDay'], ['this week', 'week'], ['what do i have today', 'today'], ["what's next", 'next'], ['whats on monday', 'day']] as const)
      assert.equal(findScheduleAsk(q, now)?.ask, ask, q);
    assert.equal(dayChoices(now).at(-1)!.q.ask, 'list');
  });

  test(`${label}: each day is said once per item`, () => {
    for (let i = 0; i < 7; i++) {
      const items = dayItems(st, addDays(now, i));
      const keys = items.map((x) => `${x.time} ${x.label}`);
      assert.equal(new Set(keys).size, keys.length);
    }
  });
}

test('one-offs tie to Jordan’s goals and the 90-day milestone', () => {
  const now = days[0];
  const cal = seedDemoCalendar(now);
  for (const t of ['Probation check-in', 'Welding info session', 'GED math test', 'Driving permit test', 'Celebrate 90 days in recovery'])
    assert.ok(cal.some((c) => c.title === t), t);
  assert.equal(cal.find((c) => c.title === 'Celebrate 90 days in recovery')!.date, ymd(addDays(now, 12)));
  for (const c of cal.filter((x) => ['Probation check-in', 'GED math test'].includes(x.title))) {
    const wd = new Date(c.date + 'T12:00').getDay();
    assert.ok(wd >= 1 && wd <= 5, c.title);
  }
});

test('no work or class on the weekend', () => {
  for (const now of days)
    for (const c of seedFullCalendar(now)) if (['work', 'school'].includes(c.kind)) assert.ok(![0, 6].includes(new Date(`${c.date}T12:00`).getDay()), `${c.title} ${c.date}`);
});

test('meetings link to the meeting list', () => {
  for (const c of seedDemoCalendar(days[0]).filter((x) => x.kind === 'meeting')) assert.equal(c.meetingId, 'm2');
});

test('a saved demo calendar rolls forward and keeps their changes', () => {
  const then = days[0];
  const saved = seedFullCalendar(then).filter((c) => c.title !== 'Lunch with Kayla');
  saved.push({ id: 'mine', date: ymd(addDays(then, 3)), time: '11:00', title: 'Haircut', subtitle: '', kind: 'other', remindMins: null });
  const later = addDays(then, 30);
  const rolled = rollDemoCalendar(saved, later);
  assert.ok(rolled.some((c) => c.id === 'mine'));
  assert.ok(rolled.some((c) => c.date === ymd(addDays(later, 6))), 'next week is filled in');
  // Deleted demo items in the saved window stay deleted.
  const lastSaved = saved.filter((c) => c.id.startsWith('seed-cal-')).reduce((m, c) => (c.date > m ? c.date : m), '');
  assert.ok(!rolled.some((c) => c.title === 'Lunch with Kayla' && c.date <= lastSaved));
  assert.equal(rollDemoCalendar(rolled, later).length, rolled.length, 'rolling twice adds nothing');
});

test('a real calendar is never filled with demo items', () => {
  const mine = [{ id: 'a', date: '2026-11-20', time: '10:00', title: 'Job interview', subtitle: '', kind: 'appointment' as const, remindMins: 60 }];
  assert.equal(rollDemoCalendar(mine, days[0]), mine);
  assert.deepEqual(rollDemoCalendar([], days[0]), []);
});

test('LifeEvents: a full timeline and goals to go', () => {
  const now = days[0];
  const ev = seedLifeEvents(now);
  assert.ok(timeline(ev, ymd(addDays(now, -78)), now).length >= 15);
  const up = upcoming(ev, ymd(addDays(now, -78)), now);
  assert.ok(up.length >= 10);
  // The 90-day milestone comes from the recovery date, not a duplicate goal.
  assert.equal(up.filter((e) => /90 days/.test(e.title)).length, 1);
  assert.equal(new Set(ev.map((e) => e.id)).size, ev.length);
});

test('an empty calendar gets a kind answer, no list', () => {
  const now = days[0];
  const r = scheduleReply({ ask: 'list' }, { state: { calendar: [], plan: [], places: [] }, now, name: 'Jordan', coordinatorName: 'Maya', sponsorName: null, recent: false, last: null })!;
  assert.equal(r.list, undefined);
  assert.match(r.text, /clear/);
});

console.log(`${passed} passed`);
