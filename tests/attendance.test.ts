// Run with: npm test
// Check In/Out rules: which plan slot a visit counts for, late and missed,
// the "checked out of the house and never came back" prompt, location checks
// and the shareable report.
import assert from 'node:assert/strict';
import {
  attendanceReport,
  checkLocation,
  dayPlan,
  distanceMeters,
  openVisit,
  overdueReturn,
  slotLabel,
  suggestedPlace,
} from '../src/recovery/attendance';
import { seedAttendance, seedPlaces, seedPlan, seedState } from '../src/data/seed';
import { Attendance, Place, PlanSlot } from '../src/data/types';

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

// Wednesday 2026-10-21, the demo's day.
const DAY = '2026-10-21';
const at = (hm: string, date = DAY) => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, m] = hm.split(':').map(Number);
  return new Date(y, mo - 1, d, h, m);
};
const iso = (hm: string, date = DAY) => at(hm, date).toISOString();

const places: Place[] = [
  { id: 'work', name: 'Work crew', kind: 'work', spot: { lat: 47.6588, lng: -117.426 } },
  { id: 'school', name: 'School', kind: 'school' },
  { id: 'house', name: 'Youth house', kind: 'home' },
];
const plan: PlanSlot[] = [
  { id: 'w', placeId: 'work', days: [1, 2, 3, 4, 5], start: '08:00', end: '12:00' },
  { id: 's', placeId: 'school', days: [1, 2, 3, 4], start: '16:00', end: '18:00' },
  { id: 'c', placeId: 'house', days: [0, 1, 2, 3, 4, 5, 6], start: '19:00' },
];
const visit = (placeId: string, inHm: string, outHm?: string, date = DAY): Attendance => ({
  id: `${placeId}-${inHm}-${date}`,
  placeId,
  placeName: places.find((p) => p.id === placeId)!.name,
  method: 'tap',
  inAt: iso(inHm, date),
  outAt: outHm ? iso(outHm, date) : undefined,
  share: 'not_shared',
});
const kinds = (records: Attendance[], now: Date) => dayPlan(plan, places, records, DAY, now).map((i) => i.status.kind);

// 1. The day's plan.
test('only slots for that weekday show', () => {
  assert.equal(dayPlan(plan, places, [], DAY, at('07:00')).length, 3);
  assert.equal(dayPlan(plan, places, [], '2026-10-25', at('07:00', '2026-10-25')).length, 1); // Sunday: curfew only
});
test('before anything starts, all upcoming', () => assert.deepEqual(kinds([], at('06:00')), ['upcoming', 'upcoming', 'upcoming']));
test('30 minutes before a slot it is due', () => assert.deepEqual(kinds([], at('07:35')), ['due', 'upcoming', 'upcoming']));
test('a slot with no check-in by its end is missed', () => assert.deepEqual(kinds([], at('12:30')), ['missed', 'upcoming', 'upcoming']));
test('a curfew stays due until midnight, never missed the same day', () =>
  assert.deepEqual(kinds([], at('23:50')).at(-1), 'due'));
test('checked in on time, then out', () => {
  const items = dayPlan(plan, places, [visit('work', '07:58', '12:04')], DAY, at('13:00'));
  assert.deepEqual(items[0].status, { kind: 'done', inAt: iso('07:58'), outAt: iso('12:04'), late: false });
});
test('more than 10 minutes after the start is late', () => {
  const s = dayPlan(plan, places, [visit('work', '08:25')], DAY, at('09:00'))[0].status;
  assert.equal(s.kind, 'here');
  assert.ok(s.kind === 'here' && s.late);
});
test('a check-in at the wrong place does not count', () =>
  assert.deepEqual(kinds([visit('school', '08:00', '12:00')], at('13:00')).slice(0, 2), ['missed', 'upcoming']));
test('a check-in too early does not count', () => assert.equal(kinds([visit('work', '06:00', '06:30')], at('09:00'))[0], 'due'));
test('one visit fills one slot only', () => {
  const twice: PlanSlot[] = [
    { id: 'a', placeId: 'work', days: [3], start: '08:00', end: '10:00' },
    { id: 'b', placeId: 'work', days: [3], start: '09:00', end: '12:00' },
  ];
  const items = dayPlan(twice, places, [visit('work', '08:00', '11:00')], DAY, at('13:00'));
  assert.deepEqual(items.map((i) => i.status.kind), ['done', 'missed']);
});
test('a slot for a removed place is skipped', () =>
  assert.equal(dayPlan([{ id: 'x', placeId: 'gone', days: [3], start: '09:00' }], places, [], DAY, at('09:00')).length, 0));

// 2. What to offer.
test('suggests where the plan says to be now', () => {
  assert.equal(suggestedPlace(dayPlan(plan, places, [], DAY, at('07:45')), [], places)?.id, 'work');
  assert.equal(suggestedPlace(dayPlan(plan, places, [visit('work', '07:58', '12:00')], DAY, at('13:00')), [], places)?.id, 'school');
});
test('open visit is the last one without a check-out', () => {
  assert.equal(openVisit([visit('house', '19:00', '23:00'), visit('work', '08:00')])?.placeId, 'work');
  assert.equal(openVisit([visit('work', '08:00', '12:00')]), null);
});

// 3. Checked out of the house and not back by curfew (build plan sec. 04).
test('not back by curfew after leaving home: asks', () => {
  const left = [visit('house', '00:00', '15:00')];
  const o = overdueReturn(plan, places, left, at('19:20'));
  assert.equal(o?.place.id, 'house');
  assert.equal(o?.dueAt.getTime(), at('19:00').getTime());
});
test('before curfew: no prompt', () => assert.equal(overdueReturn(plan, places, [visit('house', '00:00', '15:00')], at('18:50')), null));
test('back in time: no prompt', () =>
  assert.equal(overdueReturn(plan, places, [visit('house', '00:00', '15:00'), visit('house', '18:45')], at('20:00')), null));
test('still checked in at home: no prompt', () => assert.equal(overdueReturn(plan, places, [visit('house', '10:00')], at('20:00')), null));
test('left after curfew started (going out late): no prompt for that night', () =>
  assert.equal(overdueReturn(plan, places, [visit('house', '18:00', '19:30')], at('21:00')), null));

// 4. Location: only here/away and a rounded distance are kept.
test('distance is right to within a few metres', () => {
  // About 1.11 km per 0.01 degree of latitude.
  const d = distanceMeters({ lat: 47.65, lng: -117.42 }, { lat: 47.66, lng: -117.42 });
  assert.ok(Math.abs(d - 1112) < 5, String(d));
});
test('at the place: here', () => assert.equal(checkLocation(places[0], { lat: 47.6589, lng: -117.4262 }, 20)?.at, 'here'));
test('2 km away: away, distance rounded to 50 m', () => {
  const c = checkLocation(places[0], { lat: 47.6768, lng: -117.426 }, 20)!;
  assert.equal(c.at, 'away');
  assert.equal(c.meters % 50, 0);
  assert.deepEqual(Object.keys(c).sort(), ['at', 'meters']); // no coordinates
});
test('a vague reading cannot stretch the radius past 400 m', () =>
  assert.equal(checkLocation(places[0], { lat: 47.6638, lng: -117.426 }, 3000)?.at, 'away'));
test('no saved spot: nothing to check', () => assert.equal(checkLocation(places[1], { lat: 0, lng: 0 }), null));

// 5. The report: places and times only.
test('report lists visits, newest last, with times and location result', () => {
  const r = attendanceReport(
    'Jordan',
    [{ ...visit('work', '07:58', '12:04'), inCheck: { at: 'here', meters: 0 } }, visit('school', '16:02')],
    places,
    14,
    at('17:00'),
  );
  const lines = r.split('\n');
  assert.match(lines[0], /^Jordan's check-ins, last 14 days/);
  assert.match(lines[1], /Work crew · 7:58 AM to 12:04 PM \(4 h 6 min\) · location confirmed/);
  assert.match(lines[2], /School · in at 4:02 PM, not checked out/);
});
test('report leaves out old visits', () =>
  assert.match(attendanceReport('Jordan', [visit('work', '08:00', '12:00', '2026-09-01')], places, 14, at('17:00')), /No check-ins\./));
test('slot labels read plainly', () => {
  assert.equal(slotLabel(plan[0]), 'Weekdays · 8:00 AM to 12:00 PM');
  assert.equal(slotLabel(plan[2]), 'Every day · by 7:00 PM');
  assert.equal(slotLabel({ id: 'x', placeId: 'x', days: [4, 2], start: '15:00', end: '16:00' }), 'Tue, Thu · 3:00 PM to 4:00 PM');
});

// 6. Demo data.
test('seed plan points at seeded places', () => {
  const ids = new Set(seedPlaces().map((p) => p.id));
  for (const s of seedPlan()) assert.ok(ids.has(s.placeId), s.id);
});
test('seed history: at most one open visit, none in the future', () => {
  const now = new Date();
  const recs = seedAttendance(now);
  assert.ok(recs.filter((r) => !r.outAt).length <= 1);
  for (const r of recs) assert.ok(new Date(r.outAt ?? r.inAt) <= now, r.id);
});
test('nothing is shared by default', () => {
  const s = seedState().settings;
  assert.equal(s.shareAttendance, false);
  assert.equal(s.checkInLocation, false);
});

console.log(`${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
