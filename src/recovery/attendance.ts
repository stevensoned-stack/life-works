// Check In / Out (build plan sec. 03, "Attendance"): the person checks in when
// they arrive at a place they're expected to be, such as work, school, group or
// home, and checks out when they leave. Pure functions only, so the rules can
// be tested and later moved to the server unchanged.
//
// Attendance is kept apart from clinical data on purpose (plan sec. 07): a
// record holds a place, times and whether the phone confirmed the place. It
// never holds a mood, a note, or the phone's coordinates.
import { Attendance, LocationCheck, Place, PlaceKind, PlanSlot } from '../data/types';
import { clock, fromYmd, ymd } from '../util';

export const PLACE_KINDS: Record<PlaceKind, { label: string }> = {
  work: { label: 'Work' },
  school: { label: 'School' },
  home: { label: 'Home' },
  treatment: { label: 'Treatment' },
  meeting: { label: 'Meeting' },
  other: { label: 'Other' },
};

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// How far from a saved spot still counts as "at" the place. Phones in a
// building are often 50-100 m off, so this is generous, and the reading's own
// accuracy is added on top (capped, so a 3 km guess can't confirm anything).
export const DEFAULT_RADIUS_M = 150;
const MAX_ACCURACY_SLACK_M = 250;
// A check-in this long before a slot starts still counts for it.
export const EARLY_MINS = 30;
// After this many minutes past the start, a check-in counts as late.
export const GRACE_MINS = 10;

type Point = { lat: number; lng: number };

export function distanceMeters(a: Point, b: Point) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Only the outcome is kept, with the distance rounded to 50 m: enough to say
// "about 2 km away" and nothing that places the person on a map.
export function checkLocation(place: Place, here: Point, accuracyM = 0): LocationCheck | null {
  if (!place.spot) return null;
  const d = distanceMeters(place.spot, here);
  const slack = Math.min(Math.max(accuracyM, 0), MAX_ACCURACY_SLACK_M);
  return { at: d <= (place.spot.radiusM ?? DEFAULT_RADIUS_M) + slack ? 'here' : 'away', meters: Math.round(d / 50) * 50 };
}

export const distanceLabel = (m: number) => (m < 1000 ? `${Math.max(m, 50)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const at = (date: string, time: string) => {
  const d = fromYmd(date);
  d.setMinutes(minutesOf(time));
  return d;
};

export const openVisit = (records: Attendance[]) => [...records].reverse().find((r) => !r.outAt) ?? null;

export type SlotStatus =
  | { kind: 'upcoming' } // not started yet
  | { kind: 'due' } // started (or about to), not checked in
  | { kind: 'here'; inAt: string; late: boolean }
  | { kind: 'done'; inAt: string; outAt: string; late: boolean }
  | { kind: 'missed' }; // ended with no check-in

export type DayItem = { slot: PlanSlot; place: Place; start: Date; end: Date | null; status: SlotStatus; visit: Attendance | null };

// The plan for one day: each slot, its place and whether the person showed up.
// A visit counts for a slot when it's at the same place and starts between
// EARLY_MINS before the slot and the slot's end (or, for open-ended slots like
// a curfew, any time later that day).
export function dayPlan(slots: PlanSlot[], places: Place[], records: Attendance[], date: string, now = new Date()): DayItem[] {
  const weekday = fromYmd(date).getDay();
  const used = new Set<string>();
  return slots
    .filter((s) => s.days.includes(weekday))
    .sort((a, b) => a.start.localeCompare(b.start))
    .flatMap((slot) => {
      const place = places.find((p) => p.id === slot.placeId);
      if (!place) return [];
      const start = at(date, slot.start);
      const end = slot.end ? at(date, slot.end) : null;
      const from = start.getTime() - EARLY_MINS * 60000;
      const until = end ? end.getTime() : at(date, '23:59').getTime() + 60000;
      const visit =
        records.find((r) => {
          const t = new Date(r.inAt).getTime();
          return !used.has(r.id) && r.placeId === place.id && t >= from && t < until;
        }) ?? null;
      if (visit) used.add(visit.id);
      let status: SlotStatus;
      if (visit) {
        const late = new Date(visit.inAt).getTime() > start.getTime() + GRACE_MINS * 60000;
        status = visit.outAt ? { kind: 'done', inAt: visit.inAt, outAt: visit.outAt, late } : { kind: 'here', inAt: visit.inAt, late };
      } else if (now.getTime() < from) status = { kind: 'upcoming' };
      else if (now.getTime() < until) status = { kind: 'due' };
      else status = { kind: 'missed' };
      return [{ slot, place, start, end, status, visit }];
    });
}

// Which place to offer first: wherever the plan says the person should be
// right now, else the next thing today, else the last place they used.
export function suggestedPlace(items: DayItem[], records: Attendance[], places: Place[]): Place | null {
  const due = items.find((i) => i.status.kind === 'due');
  if (due) return due.place;
  const next = items.find((i) => i.status.kind === 'upcoming');
  if (next) return next.place;
  const last = [...records].reverse().find((r) => places.some((p) => p.id === r.placeId));
  return places.find((p) => p.id === last?.placeId) ?? places[0] ?? null;
}

// The context rule from plan sec. 04: "a check-out from sober housing that
// never checks back in". After leaving home, once the time the plan says to be
// back has passed with no check-in there, the app asks if they're on their way.
export function overdueReturn(slots: PlanSlot[], places: Place[], records: Attendance[], now = new Date()) {
  const homes = places.filter((p) => p.kind === 'home');
  if (!homes.length) return null;
  const lastHome = [...records].reverse().find((r) => homes.some((h) => h.id === r.placeId));
  if (!lastHome?.outAt) return null;
  const left = new Date(lastHome.outAt);
  const today = ymd(now);
  const item = dayPlan(slots, places, records, today, now).find(
    (i) => i.place.id === lastHome.placeId && i.status.kind === 'due' && i.start.getTime() <= now.getTime() && i.start > left,
  );
  if (!item) return null;
  return { place: item.place, leftAt: lastHome.outAt, dueAt: item.start };
}

export const duration = (fromIso: string, toIso: string) => {
  const mins = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h ? `${h} h ${mins % 60} min` : `${mins} min`;
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const checkLabel = (c?: LocationCheck) => (!c ? '' : c.at === 'here' ? 'location confirmed' : `phone was about ${distanceLabel(c.meters)} away`);

// The attendance summary the person can send to their coordinator, court or
// program from their own phone. Places and times only: what the plan calls
// "did she attend group Tuesday", never what she told Zoey.
export function attendanceReport(name: string, records: Attendance[], places: Place[], days = 14, now = new Date()) {
  const since = fromYmd(ymd(now));
  since.setDate(since.getDate() - (days - 1));
  const rows = records
    .filter((r) => new Date(r.inAt) >= since)
    .sort((a, b) => a.inAt.localeCompare(b.inAt))
    .map((r) => {
      const place = places.find((p) => p.id === r.placeId)?.name ?? r.placeName;
      const day = new Date(r.inAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const span = r.outAt ? `${time(r.inAt)} to ${time(r.outAt)} (${duration(r.inAt, r.outAt)})` : `in at ${time(r.inAt)}, not checked out`;
      const loc = checkLabel(r.inCheck);
      return `${day} · ${place} · ${span}${loc ? ` · ${loc}` : ''}`;
    });
  const head = `${name}'s check-ins, last ${days} days (from the Life Works app)`;
  return rows.length ? `${head}\n${rows.join('\n')}` : `${head}\nNo check-ins.`;
}

export const slotLabel = (s: PlanSlot) => {
  const days =
    s.days.length === 7
      ? 'Every day'
      : [1, 2, 3, 4, 5].every((d) => s.days.includes(d)) && s.days.length === 5
        ? 'Weekdays'
        : [...s.days].sort().map((d) => WEEKDAYS[d]).join(', ');
  return `${days} · ${s.end ? `${clock(s.start)} to ${clock(s.end)}` : `by ${clock(s.start)}`}`;
};
