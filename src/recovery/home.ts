// MyHome: where the person lives, who they live with, and the lease. Pure, so
// it can be tested without the app. Everything here is self-reported and
// stays on the phone like the rest of the person's data.

import { CalendarItem, HousingType, LeaseTerm, MyHome, Roommate, RoommateRole } from '../data/types';
import { addDays, fromYmd, ymd } from '../util';

export const HOUSING_TYPES: { value: HousingType; label: string }[] = [
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'room', label: 'Room for rent' },
  { value: 'sober_living', label: 'Sober living / recovery house' },
  { value: 'transitional', label: 'Transitional or youth housing' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'family', label: 'With family or friends' },
  { value: 'other', label: 'Other' },
];

export const LEASE_TERMS: { value: LeaseTerm; label: string; months?: number }[] = [
  { value: 'month_to_month', label: 'Month to month' },
  { value: '6_months', label: '6-month lease', months: 6 },
  { value: '12_months', label: '12-month lease', months: 12 },
  { value: 'program', label: 'Program agreement' },
  { value: 'none', label: 'No lease' },
  { value: 'other', label: 'Other' },
];

export const ROOMMATE_ROLES: { value: RoommateRole; label: string }[] = [
  { value: 'roommate', label: 'Roommate' },
  { value: 'partner', label: 'Partner' },
  { value: 'family', label: 'Family' },
  { value: 'child', label: 'My child' },
  { value: 'house_manager', label: 'House manager or staff' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'other', label: 'Other' },
];

// 0 is a studio. Bedrooms and beds are separate because a sober house can have
// three bedrooms and six beds.
export const BEDROOM_OPTIONS = [
  { value: 0, label: 'Studio' },
  ...Array.from({ length: 6 }, (_, i) => ({ value: i + 1, label: i === 5 ? '6 or more' : String(i + 1) })),
];
export const BED_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: i === 11 ? '12 or more' : String(i + 1) }));

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};
// Days 29-31 don't exist every month, so those collapse to "last day" (31).
export const DUE_DAY_OPTIONS = [
  ...Array.from({ length: 28 }, (_, i) => ({ value: i + 1, label: `The ${ordinal(i + 1)}` })),
  { value: 31, label: 'Last day of the month' },
];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const typeLabel = (t: HousingType) => HOUSING_TYPES.find((x) => x.value === t)?.label ?? 'Other';
export const termLabel = (t: LeaseTerm) => LEASE_TERMS.find((x) => x.value === t)?.label ?? 'Other';
export const roleLabel = (r: RoommateRole) => ROOMMATE_ROLES.find((x) => x.value === r)?.label ?? 'Other';

export function emptyHome(): MyHome {
  return {
    type: 'apartment',
    address: '',
    city: '',
    moveIn: null,
    bedrooms: null,
    beds: null,
    lease: { term: 'month_to_month', end: null, rent: null, every: 'month', due: null },
    roommates: [],
    updatedAt: new Date().toISOString(),
  };
}

// A fixed-length lease ends that many months after move-in, the day before.
export function leaseEndFor(moveIn: string, term: LeaseTerm): string | null {
  const months = LEASE_TERMS.find((x) => x.value === term)?.months;
  if (!months) return null;
  const d = fromYmd(moveIn);
  const end = new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
  // Aug 31 + 6 months rolls into March; such a lease runs to the end of February.
  if (end.getDate() !== d.getDate()) {
    end.setDate(0);
    return ymd(end);
  }
  return ymd(addDays(end, -1));
}

// The next `count` rent due dates on or after `from`.
export function nextRentDates(h: MyHome, from = new Date(), count = 3): string[] {
  const { due, every } = h.lease;
  if (due == null) return [];
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const out: string[] = [];
  if (every === 'week') {
    let d = addDays(start, (due - start.getDay() + 7) % 7);
    while (out.length < count) {
      out.push(ymd(d));
      d = addDays(d, 7);
    }
    return out;
  }
  for (let m = 0; out.length < count; m++) {
    const last = new Date(start.getFullYear(), start.getMonth() + m + 1, 0).getDate();
    const d = new Date(start.getFullYear(), start.getMonth() + m, Math.min(due, last));
    if (d >= start) out.push(ymd(d));
  }
  return out;
}

export function rentLabel(h: MyHome) {
  const { rent, every, due } = h.lease;
  const amount = rent != null ? `$${rent.toLocaleString('en-US')}` : null;
  const when =
    due == null ? null : every === 'week' ? `due ${WEEKDAYS[due]}s` : due === 31 ? 'due the last day of the month' : `due the ${ordinal(due)}`;
  if (!amount) return when ? `Rent ${when}` : null;
  return `${amount} a ${every}${when ? `, ${when}` : ''}`;
}

export const dateLabel = (s: string) => fromYmd(s).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// How long the person has lived there, in words.
export function livedFor(moveIn: string, now = new Date()) {
  const d = fromYmd(moveIn);
  let months = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
  if (now.getDate() < d.getDate()) months--;
  if (months < 1) {
    const days = Math.max(0, Math.round((now.getTime() - d.getTime()) / 86400000));
    return days === 1 ? '1 day' : `${days} days`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? '' : 's'}` : '');
  return [part(y, 'year'), part(m, 'month')].filter(Boolean).join(', ');
}

export function daysUntil(s: string, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((fromYmd(s).getTime() - a) / 86400000);
}

// Calendar items for rent due dates and the lease end, so the existing
// calendar reminders cover them. Ids are fixed per date so adding them again
// replaces rather than duplicates. Titles stay in the app; the notification
// itself never says what it's about.
export function homeCalendarItems(h: MyHome, now = new Date()): CalendarItem[] {
  const items: CalendarItem[] = nextRentDates(h, now).map((date) => ({
    id: `myhome-rent-${date}`,
    date,
    time: '09:00',
    title: 'Rent due',
    subtitle: h.lease.rent != null ? `$${h.lease.rent.toLocaleString('en-US')}` : 'MyHome',
    kind: 'other',
    remindMins: 24 * 60,
  }));
  if (h.lease.end && daysUntil(h.lease.end, now) >= 0) {
    // A week's notice the first time; the day itself is on the calendar too.
    items.push({ id: 'myhome-lease-end', date: h.lease.end, time: '09:00', title: 'Lease ends', subtitle: 'MyHome', kind: 'other', remindMins: 7 * 24 * 60 });
  }
  return items;
}

// Everything typed into MyHome, joined for the safety screen. Phone numbers
// are left out: they can't say anything the screen looks for.
export function typedText(h: MyHome) {
  return [h.name, h.address, h.city, h.notes, ...h.roommates.map((r) => r.name)].filter((x) => x && x.trim()).join('\n');
}

export const blankRoommate = (id: string): Roommate => ({ id, name: '', role: 'roommate' });

// The demo's home: the youth house Jordan moved into 70 days ago (it is on
// LifePath as a life event too).
export function seedHome(now = new Date()): MyHome {
  return {
    type: 'transitional',
    name: 'Youth house',
    address: '',
    city: 'Spokane, WA',
    moveIn: ymd(addDays(now, -70)),
    bedrooms: 4,
    beds: 6,
    lease: { term: 'program', end: null, rent: 150, every: 'month', due: 1 },
    roommates: [
      { id: 'seed-rm-devon', name: 'Devon', role: 'roommate' },
      { id: 'seed-rm-sam', name: 'Sam', role: 'roommate' },
      { id: 'seed-rm-staff', name: 'House staff on duty', role: 'house_manager', phone: '+15095550150' },
    ],
    notes: 'Curfew 7 PM. House meeting every week. Chores on Sunday.',
    updatedAt: addDays(now, -70).toISOString(),
  };
}
