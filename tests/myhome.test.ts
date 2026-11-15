// Run with: npm test
// MyHome: lease end dates, rent due dates, calendar items and the text that
// goes through the safety screen.
import assert from 'node:assert/strict';
import { seedState } from '../src/data/seed';
import { MyHome } from '../src/data/types';
import { emptyHome, providerLabel, withProvider, homeCalendarItems, leaseEndFor, livedFor, nextRentDates, rentLabel, seedHome, typedText } from '../src/recovery/home';
import { screen } from '../src/zoey/safety';

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

const home = (lease: Partial<MyHome['lease']>, extra: Partial<MyHome> = {}): MyHome => ({
  ...emptyHome(),
  ...extra,
  lease: { ...emptyHome().lease, ...lease },
});
// Wednesday 2026-10-21.
const now = new Date(2026, 9, 21, 10, 0);

test('a 12-month lease ends the day before the anniversary', () => {
  assert.equal(leaseEndFor('2026-03-01', '12_months'), '2027-02-28');
  assert.equal(leaseEndFor('2026-10-15', '6_months'), '2027-04-14');
});

test('a lease starting on the 31st ends at the end of the short month', () => {
  assert.equal(leaseEndFor('2026-08-31', '6_months'), '2027-02-28');
});

test('month to month, program and no lease have no end date', () => {
  for (const t of ['month_to_month', 'program', 'none', 'other'] as const) assert.equal(leaseEndFor('2026-01-01', t), null);
});

test('monthly rent: the next due dates start today or later', () => {
  assert.deepEqual(nextRentDates(home({ due: 1 }), now), ['2026-11-01', '2026-12-01', '2027-01-01']);
  assert.deepEqual(nextRentDates(home({ due: 21 }), now, 2), ['2026-10-21', '2026-11-21']);
});

test('"last day" rent lands on the last day of each month', () => {
  assert.deepEqual(nextRentDates(home({ due: 31 }), new Date(2027, 0, 5)), ['2027-01-31', '2027-02-28', '2027-03-31']);
});

test('weekly rent falls on the chosen weekday', () => {
  assert.deepEqual(nextRentDates(home({ every: 'week', due: 5 }), now), ['2026-10-23', '2026-10-30', '2026-11-06']);
  assert.deepEqual(nextRentDates(home({ every: 'week', due: 3 }), now, 1), ['2026-10-21']);
});

test('no due day means no dates', () => {
  assert.deepEqual(nextRentDates(home({ due: null }), now), []);
});

test('rent labels read naturally', () => {
  assert.equal(rentLabel(home({ rent: 650, due: 1 })), '$650 a month, due the 1st');
  assert.equal(rentLabel(home({ rent: 1200, due: 31 })), '$1,200 a month, due the last day of the month');
  assert.equal(rentLabel(home({ rent: 125, every: 'week', due: 5 })), '$125 a week, due Fridays');
  assert.equal(rentLabel(home({ due: 22 })), 'Rent due the 22nd');
  assert.equal(rentLabel(home({})), null);
});

test('calendar items: rent dates and the lease end, with fixed ids and no detail in reminders', () => {
  const items = homeCalendarItems(home({ rent: 650, due: 1, end: '2027-02-28' }), now);
  assert.deepEqual(items.map((i) => i.id), ['myhome-rent-2026-11-01', 'myhome-rent-2026-12-01', 'myhome-rent-2027-01-01', 'myhome-lease-end']);
  assert.ok(items.every((i) => i.remindMins != null && i.kind === 'other'));
  assert.deepEqual(homeCalendarItems(home({ rent: 650, due: 1, end: '2027-02-28' }), now), items, 'adding again gives the same ids');
});

test('a lease that already ended is not put on the calendar', () => {
  assert.deepEqual(homeCalendarItems(home({ end: '2026-01-31' }), now), []);
});

test('time lived there', () => {
  assert.equal(livedFor('2026-10-11', now), '10 days');
  assert.equal(livedFor('2026-08-12', now), '2 months');
  assert.equal(livedFor('2025-07-01', now), '1 year, 3 months');
});

test('everything typed goes to the safety screen, phone numbers left out', () => {
  const h = home({}, { name: 'Maple house', address: '12 Elm', notes: 'getting evicted friday', roommates: [{ id: 'a', name: 'Sam', role: 'roommate', phone: '5095550100' }] });
  const t = typedText(h);
  assert.ok(t.includes('Maple house') && t.includes('Sam') && t.includes('evicted'));
  assert.ok(!t.includes('5095550100'));
  const s = screen(t);
  assert.equal(s.kind === 'urgent' && s.variant, 'housing');
});

test('a crisis typed into house notes is caught', () => {
  assert.equal(screen(typedText(home({}, { notes: 'i want to kill myself' }))).kind, 'crisis');
});

test('the demo home is in the seed and passes the screen quietly', () => {
  const s = seedState();
  assert.ok(s.home);
  assert.equal(s.home!.type, 'transitional');
  assert.equal(screen(typedText(seedHome())).kind, 'none');
});

test('a Life Works Home switches an open-ended lease to a program agreement, and back', () => {
  const lw = withProvider(home({ term: 'month_to_month' }), 'life_works');
  assert.equal(lw.provider, 'life_works');
  assert.equal(lw.lease.term, 'program');
  assert.equal(withProvider(lw, 'own').lease.term, 'month_to_month');
  assert.equal(withProvider(home({ term: '12_months' }), 'life_works').lease.term, '12_months', 'a real lease is kept');
  assert.equal(providerLabel('life_works'), 'A Life Works Home');
  assert.equal(providerLabel('own'), 'My own leased home');
});

test('new homes start as their own; the demo home is a Life Works Home', () => {
  assert.equal(emptyHome().provider, 'own');
  assert.equal(seedHome().provider, 'life_works');
});

console.log(`myhome: ${passed} passed`);
