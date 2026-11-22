// Run with: npm test
// Cold (below 35°) and rain/snow alerts from the forecast (Ed, 2026-11-20).
import assert from 'node:assert/strict';
import { coldWetAlert, coldWetLine, coldWetNotice, Hour, Outlook, sampleOutlook, whenLabel } from '../src/zoey/weather';

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

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`;
// Friday 2026-11-20, noon.
const now = new Date(2026, 10, 20, 12, 0);
// 24 hours from noon; `f(h)` gives the temperature, sky and chance for hours-from-now h.
function outlookOf(f: (h: number, at: Date) => [number, string, number | null]): Outlook {
  const hours: Hour[] = [];
  for (let h = 0; h < 48; h++) {
    const at = new Date(now.getTime() + h * 3600_000);
    const [temperature, shortForecast, rain] = f(h, at);
    hours.push({ start: iso(at), temperature, shortForecast, wind: '5 mph', rain });
  }
  return { periods: [{ name: 'Today', shortForecast: 'Cloudy', temperature: 40, isDaytime: true, start: iso(now), end: iso(now), wind: '5 mph', rain: 10 }], hours, alerts: [], place: 'the Spokane area' };
}

test('no alert on a mild, dry day', () => {
  assert.equal(coldWetAlert(outlookOf(() => [45, 'Partly Cloudy', 5]), now), null);
});

test('35° is not cold enough; 34° is', () => {
  assert.equal(coldWetAlert(outlookOf(() => [35, 'Clear', 0]), now), null);
  const a = coldWetAlert(outlookOf((h) => [h === 10 ? 34 : 40, 'Clear', 0]), now)!;
  assert.ok(a.cold);
  assert.equal(a.wet, null);
  assert.match(a.text, /drops to 34° tonight around 10 PM/);
  assert.equal(a.title, 'Cold weather ahead');
});

test('cold: when it drops below 35 and the low', () => {
  const a = coldWetAlert(outlookOf((h) => [h < 8 ? 40 : 40 - (h - 7) * 1.5 >= 33 ? Math.round(40 - (h - 7) * 1.5) : 33, 'Clear', 0]), now)!;
  assert.match(a.text, /drops below 35° tonight around \d+ PM, down to 33°/);
  assert.match(a.tip, /coat, hat and gloves/);
  assert.equal(a.ask, null);
  assert.match(coldWetLine(a)!, /warm place/);
});

test('below freezing: seek a warm shelter, and ask if they need help finding one', () => {
  const a = coldWetAlert(outlookOf((h) => [h < 8 ? 40 : 40 - (h - 7) * 1.5 >= 26 ? Math.round(40 - (h - 7) * 1.5) : 26, 'Clear', 0]), now)!;
  assert.equal(a.title, 'Temps dropping below freezing');
  assert.match(a.text, /down to 26°/);
  assert.match(a.tip, /^Seek a warm shelter/);
  assert.equal(a.ask, 'Do you need help finding one near you?');
  assert.match(coldWetLine(a)!, /help finding a shelter near you/);
  // 32° counts as freezing; 33° doesn't.
  assert.ok(coldWetAlert(outlookOf((h) => [h === 9 ? 32 : 40, 'Clear', 0]), now)!.ask);
  assert.equal(coldWetAlert(outlookOf((h) => [h === 9 ? 33 : 40, 'Clear', 0]), now)!.ask, null);
});

test('cold right now', () => {
  const a = coldWetAlert(outlookOf(() => [30, 'Clear', 0]), now)!;
  assert.match(a.text, /^It’s 30° right now\./);
  assert.equal(a.title, 'Temps below freezing');
  const c = coldWetAlert(outlookOf((h) => [h < 3 ? 31 : 25, 'Clear', 0]), now)!;
  assert.equal(c.title, 'Temps dropping below freezing');
  const b = coldWetAlert(outlookOf(() => [34, 'Clear', 0]), now)!;
  assert.equal(b.title, 'Cold weather');
});

test('snow tomorrow morning with cold', () => {
  const a = coldWetAlert(
    outlookOf((h, at) => (at.getDate() === 21 && at.getHours() >= 6 && at.getHours() <= 10 ? [28, 'Snow Likely', 70] : [33, 'Mostly Cloudy', 10])),
    now,
  )!;
  assert.equal(a.wet?.kind, 'snow');
  assert.match(a.text, /down to 28° tomorrow morning around 6 AM, with snow likely then \(70% chance\)\./);
  assert.equal(a.title, 'Temps dropping below freezing');
  assert.match(a.tip, /Seek a warm shelter\. Roads and sidewalks could be icy/);
});

test('the same time is not said twice', () => {
  const a = coldWetAlert(
    outlookOf((h, at) => (at.getDate() === 21 && at.getHours() >= 5 && at.getHours() <= 9 ? [27, 'Snow Likely', 70] : [31, 'Mostly Cloudy', 10])),
    now,
  )!;
  assert.equal(a.text, 'It’s 31° right now, and it gets down to 27° tomorrow morning around 5 AM, with snow likely then (70% chance).');
});

test('rain only, not cold', () => {
  const a = coldWetAlert(outlookOf((h) => [48, h >= 3 ? 'Rain Showers Likely' : 'Cloudy', h >= 3 ? 60 : 20]), now)!;
  assert.equal(a.cold, null);
  assert.equal(a.wet?.kind, 'rain');
  assert.equal(a.title, 'Rain on the way');
  assert.match(a.text, /Rain is likely starting this afternoon around 3 PM/);
  assert.equal(a.tip, 'Bring a jacket or umbrella.');
  assert.doesNotMatch(coldWetLine(a)!, /warm place/);
});

test('rain and snow, freezing rain', () => {
  const both = coldWetAlert(outlookOf((h) => [36, h === 2 ? 'Chance Rain And Snow' : 'Cloudy', h === 2 ? 40 : 10]), now)!;
  assert.equal(both.wet?.kind, 'rain and snow');
  assert.match(both.text, /possible/);
  const ice = coldWetAlert(outlookOf((h) => [31, h === 5 ? 'Freezing Rain' : 'Cloudy', h === 5 ? 60 : 10]), now)!;
  assert.equal(ice.wet?.kind, 'freezing rain');
  assert.equal(ice.title, 'Temps below freezing');
  assert.match(ice.text, /Freezing rain/);
});

test('a slight chance is not an alert', () => {
  assert.equal(coldWetAlert(outlookOf(() => [45, 'Slight Chance Rain', 20]), now), null);
});

test('only the next 24 hours count', () => {
  assert.equal(coldWetAlert(outlookOf((h) => [h >= 26 ? 20 : 45, h >= 26 ? 'Snow' : 'Cloudy', h >= 26 ? 90 : 0]), now), null);
});

test('uses day/night periods when the hourly forecast is missing', () => {
  const o: Outlook = {
    hours: [],
    alerts: [],
    periods: [
      { name: 'This Afternoon', shortForecast: 'Cloudy', temperature: 41, isDaytime: true, start: '2026-11-20T12:00:00', end: '2026-11-20T18:00:00', wind: '', rain: 10 },
      { name: 'Tonight', shortForecast: 'Snow Likely', temperature: 27, isDaytime: false, start: '2026-11-20T18:00:00', end: '2026-11-21T06:00:00', wind: '', rain: 70 },
    ],
  };
  const a = coldWetAlert(o, now)!;
  assert.equal(a.wet?.kind, 'snow');
  assert.equal(a.cold?.low, 27);
  assert.match(a.place, /Spokane/);
});

test('the preview forecast shows an alert', () => {
  const a = coldWetAlert(sampleOutlook(now), now);
  assert.ok(a && a.cold && a.wet);
});

test('when labels', () => {
  assert.equal(whenLabel('2026-11-20T12:00:00', now), 'right now');
  assert.equal(whenLabel('2026-11-20T15:00:00', now), 'this afternoon around 3 PM');
  assert.equal(whenLabel('2026-11-20T21:00:00', now), 'tonight around 9 PM');
  assert.equal(whenLabel('2026-11-21T02:00:00', now), 'late tonight around 2 AM');
  assert.equal(whenLabel('2026-11-21T07:00:00', now), 'tomorrow morning around 7 AM');
});

test('notification: two hours before, never in sleeping hours, never for right now', () => {
  const snowAt = (hr: number) => coldWetAlert(outlookOf((h, at) => (at.getDate() === 21 && at.getHours() >= hr ? [28, 'Snow', 80] : [40, 'Cloudy', 0])), now);
  // Snow at 6 AM tomorrow: 4 AM is in sleeping hours, so 9 PM tonight.
  const n = coldWetNotice(snowAt(6), now, 7, 22)!;
  assert.equal(n.at.getDate(), 20);
  assert.equal(n.at.getHours(), 21);
  assert.match(n.title, /Temps dropping below freezing in the Spokane area/);
  assert.match(n.body, /Do you need help finding one near you\?$/);
  assert.match(n.body, /tomorrow morning around 6 AM/);
  // Snow at 10 AM tomorrow: 8 AM tomorrow.
  const m = coldWetNotice(snowAt(10), now, 7, 22)!;
  assert.equal(m.at.getDate(), 21);
  assert.equal(m.at.getHours(), 8);
  // Already cold now: the card covers it, no notification.
  assert.equal(coldWetNotice(coldWetAlert(outlookOf(() => [30, 'Clear', 0]), now), now), null);
});

test('alert wording follows the rules', () => {
  const a = coldWetAlert(sampleOutlook(now), now)!;
  const all = `${a.title} ${a.text} ${a.tip} ${coldWetLine(a)}`;
  assert.doesNotMatch(all, /\bclean\b|not using|sample/i);
});

test('the demo forecast always shows the below-freezing shelter alert', () => {
  for (const hr of [0, 6, 9, 12, 15, 18, 21, 23]) {
    const at = new Date(2026, 10, 20, hr, 30);
    const a = coldWetAlert(sampleOutlook(at), at)!;
    assert.ok(a?.ask, `no ask at ${hr}:30`);
    assert.match(a.title, /below freezing/);
  }
});

console.log(`${passed} weather alert tests passed`);
