// The forecast Zoey sometimes mentions when she says hello (Ed, 2026-10-24).
// Uses the National Weather Service (free, no key) for the center of the city
// they told Zoey they live in (place.ts), or the pilot city's center: never
// GPS, and nothing else about the person is sent. Any failure just means no
// weather line.
import { CURRENT_REGION } from '../data/resources';

export type Forecast = { name: string; shortForecast: string; temperature: number; isDaytime: boolean };
// The days ahead, the next 48 hours, and any NWS alerts (Ed, 2026-10-25: "teach zoey to
// look at weather forecasts ... if they have an early appointment and it is cold, snowing
// or raining she should tell the user or warn them").
export type Period = Forecast & { start: string; end: string; wind: string; rain: number | null };
export type Hour = { start: string; temperature: number; shortForecast: string; wind: string; rain: number | null };
export type Alert = { event: string; headline: string; severity: string };
// `sample`: the preview's made-up forecast, which Zoey says out loud.
// `place`: where the forecast is for, as Zoey says it ("Cheney, WA", "the Spokane area").
export type Outlook = { periods: Period[]; hours: Hour[]; alerts: Alert[]; sample?: boolean; place?: string };
// The city center to look up. Without one, the pilot region's.
export type WeatherAt = { lat: number; lon: number; place: string };

const HOUR = 60 * 60 * 1000;

async function getJson(url: string, ms: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/geo+json' } });
    return r.ok ? await r.json() : null;
  } finally {
    clearTimeout(timer);
  }
}

const num = (x: unknown) => (typeof x === 'number' ? x : null);
const toPeriod = (p: any): Period | null =>
  p && typeof p.shortForecast === 'string' && typeof p.temperature === 'number'
    ? {
        name: String(p.name ?? ''),
        shortForecast: p.shortForecast,
        temperature: p.temperature,
        isDaytime: !!p.isDaytime,
        start: String(p.startTime ?? ''),
        end: String(p.endTime ?? ''),
        wind: String(p.windSpeed ?? ''),
        rain: num(p.probabilityOfPrecipitation?.value),
      }
    : null;

const regionAt = (): WeatherAt | null =>
  CURRENT_REGION.weatherAt ? { ...CURRENT_REGION.weatherAt, place: `the ${CURRENT_REGION.name}` } : null;

async function load(at: WeatherAt | null): Promise<Outlook | null> {
  if (process.env.EXPO_PUBLIC_LIFEWORKS_SAMPLE_WEATHER === '1') return { ...sampleOutlook(new Date()), place: at?.place };
  if (!at) return null;
  try {
    const point = await getJson(`https://api.weather.gov/points/${at.lat},${at.lon}`, 5000);
    const url = point?.properties?.forecast;
    const hourlyUrl = point?.properties?.forecastHourly;
    if (typeof url !== 'string') return null;
    const [days, hourly, alerts] = await Promise.all([
      getJson(url, 5000),
      typeof hourlyUrl === 'string' ? getJson(hourlyUrl, 5000).catch(() => null) : null,
      getJson(`https://api.weather.gov/alerts/active?point=${at.lat},${at.lon}`, 5000).catch(() => null),
    ]);
    const periods = ((days?.properties?.periods ?? []) as unknown[]).map(toPeriod).filter((p): p is Period => !!p);
    if (!periods.length) return null;
    const hours = ((hourly?.properties?.periods ?? []) as unknown[])
      .slice(0, 48)
      .map(toPeriod)
      .filter((p): p is Period => !!p)
      .map(({ start, temperature, shortForecast, wind, rain }) => ({ start, temperature, shortForecast, wind, rain }));
    const list = ((alerts?.features ?? []) as any[])
      .map((f) => f?.properties)
      .filter((a) => a && typeof a.event === 'string')
      .map((a) => ({ event: a.event, headline: String(a.headline ?? a.event), severity: String(a.severity ?? '') }));
    return { periods, hours, alerts: list, place: at.place };
  } catch {
    return null;
  }
}

let cachedOutlook: { at: number; key: string; o: Promise<Outlook | null> } | null = null;
// At most one lookup an hour, unless they move to another city.
export function outlook(now = Date.now(), where: WeatherAt | null = null): Promise<Outlook | null> {
  const at = where ?? regionAt();
  const key = at ? `${at.lat.toFixed(3)},${at.lon.toFixed(3)}` : '';
  if (!cachedOutlook || cachedOutlook.key !== key || now - cachedOutlook.at > HOUR) cachedOutlook = { at: now, key, o: load(at) };
  return cachedOutlook.o;
}

// The greeting's line: the period they're in now.
export function forecast(now = Date.now()): Promise<Forecast | null> {
  return outlook(now).then((o) => o?.periods[0] ?? null);
}

// "Mostly sunny today, with a high near 58." Tips only for rain, snow and heat.
export function weatherLine(f: Forecast): string {
  const sky = f.shortForecast.toLowerCase();
  const when = f.isDaytime ? 'today' : 'tonight';
  const temp = f.isDaytime ? `a high near ${f.temperature}` : `a low around ${f.temperature}`;
  const tip = /thunder/.test(sky)
    ? ' Stay safe out there.'
    : /snow|sleet|ice|freezing/.test(sky)
      ? ' Bundle up and be careful out there.'
      : /rain|shower|drizzle/.test(sky)
        ? ' Might be a good day for a jacket.'
        : f.isDaytime && f.temperature >= 90
          ? ' Drink plenty of water.'
          : f.temperature <= 25
            ? ' Bundle up if you go out.'
            : '';
  return `The forecast says ${sky} ${when}, with ${temp}.${tip}`;
}

// --- Asking about the weather, and warnings before early plans ---------------

const pad = (n: number) => String(n).padStart(2, '0');
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`;
const dateOf = (iso: string) => iso.slice(0, 10);
const hourOf = (iso: string) => Number(iso.slice(11, 13));
const ymdOf = (d: Date) => localIso(d).slice(0, 10);
const plusDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
const windMph = (w: string) => Math.max(0, ...(w.match(/\d+/g) ?? ['0']).map(Number));

type Wx = { snow: boolean; ice: boolean; rain: boolean; storm: boolean; freezing: boolean; windy: boolean; hot: boolean };
function wx(sky: string, temp: number, wind: string, rain: number | null): Wx {
  const s = sky.toLowerCase();
  return {
    snow: /snow|flurr|blizzard/.test(s),
    ice: /ice|icy|sleet|freezing (?:rain|drizzle|fog)/.test(s),
    rain: /rain|shower|drizzle/.test(s) || (rain ?? 0) >= 50,
    storm: /thunder|storm/.test(s),
    freezing: temp <= 32,
    windy: /wind|breezy|gust/.test(s) || windMph(wind) >= 25,
    hot: temp >= 90,
  };
}

// A made-up forecast for the preview, which can't reach the weather service.
// Tomorrow morning is snowy and 27°, so the early-plan warning shows.
export function sampleOutlook(now: Date): Outlook {
  const days: [string, number, number, string, number][] = [
    ['Partly Cloudy', 41, 30, 'Mostly Cloudy', 10],
    ['Snow Likely', 31, 22, 'Light Snow', 70],
    ['Chance Rain And Snow', 36, 27, 'Mostly Cloudy', 40],
    ['Sunny', 44, 29, 'Clear', 0],
    ['Rain Showers Likely', 48, 37, 'Rain Showers', 60],
    ['Mostly Sunny', 50, 34, 'Partly Cloudy', 10],
    ['Partly Sunny', 46, 31, 'Mostly Cloudy', 20],
  ];
  const periods: Period[] = [];
  days.forEach(([sky, hi, lo, nightSky, rain], i) => {
    const d = plusDays(now, i);
    const day = ymdOf(d);
    const name = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'long' });
    if (!(i === 0 && now.getHours() >= 18))
      periods.push({ name, shortForecast: sky, temperature: hi, isDaytime: true, start: `${day}T06:00:00`, end: `${day}T18:00:00`, wind: '5 to 10 mph', rain });
    periods.push({ name: i === 0 ? 'Tonight' : `${name} Night`, shortForecast: nightSky, temperature: lo, isDaytime: false, start: `${day}T18:00:00`, end: `${ymdOf(plusDays(now, i + 1))}T06:00:00`, wind: '5 mph', rain });
  });
  const hours: Hour[] = [];
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
  for (let h = 0; h < 48; h++) {
    const t = new Date(start.getTime() + h * HOUR);
    const tomorrow = ymdOf(t) === ymdOf(plusDays(now, 1));
    const morning = t.getHours() >= 5 && t.getHours() <= 11;
    hours.push(
      tomorrow && morning
        ? { start: localIso(t), temperature: 27 + Math.max(0, t.getHours() - 7), shortForecast: 'Light Snow', wind: '10 mph', rain: 70 }
        : { start: localIso(t), temperature: t.getHours() >= 10 && t.getHours() <= 17 ? 39 : 31, shortForecast: 'Mostly Cloudy', wind: '5 mph', rain: 10 },
    );
  }
  return { periods, hours, alerts: [], sample: true };
}

// "What's the weather tomorrow?", "will it rain Monday?", "do I need a jacket?"
export type WeatherKind = 'general' | 'rain' | 'snow' | 'cold' | 'hot' | 'jacket' | 'wind';
export type WeatherAsk = { kind: WeatherKind; offsets: number[]; label: string; tonight: boolean };

const WEATHER_WORD = /\b(?:weather|forecast|rain|raining|rainy|snow|snowing|snowy|cold|colder|freezing|hot|warm|chilly|jacket|coat|umbrella|windy|wind|icy|ice|storm|storming|temperature|temp|degrees|sunny|sun)\b/;
const WEATHER_Q = /^(?:(?:hey|zoey|so|ok|okay|um) )*(?:what|whats|wats|how|hows|is|isnt|will|wont|does|do|should|gonna|going|any|anything|weather|forecast|tell me|check)\b/;
// Not about the sky: "cold turkey", "I feel cold inside", "this weather makes me sad".
const NOT_WEATHER = /\b(?:feel|feeling|makes me|sad|mood|depress|cold turkey|cold feet|cold sweat|hot mess|hot flash|cold shoulder|the chills|chills|ice cream|ice skating|sun tan|a cold|have a cold|got a cold|catch a cold)\b/;

export function findWeatherAsk(text: string, now: Date, parse: (t: string, now: Date) => { offsets: number[]; label: string } | null): WeatherAsk | null {
  const t = text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!WEATHER_WORD.test(t) || NOT_WEATHER.test(t)) return null;
  if (!WEATHER_Q.test(t) && !/\?\s*$/.test(text)) return null;
  // "What's the forecast for my meeting?" is fine; "what time is it" never gets here.
  const kind: WeatherKind = /\b(?:jacket|coat|umbrella|dress|wear)\b/.test(t)
    ? 'jacket'
    : /\bsnow/.test(t)
      ? 'snow'
      : /\brain/.test(t)
        ? 'rain'
        : /\b(?:cold|colder|freezing|chilly|icy|ice)\b/.test(t)
          ? 'cold'
          : /\b(?:hot|warm)\b/.test(t)
            ? 'hot'
            : /\bwind/.test(t)
              ? 'wind'
              : 'general';
  const tonight = /\b(?:tonight|tonite|this evening)\b/.test(t);
  const d = parse(text, now) ?? { offsets: [0], label: 'today' };
  return { kind, offsets: d.offsets, label: tonight ? 'tonight' : d.label, tonight };
}

const SAMPLE_NOTE = ' (This preview uses a sample forecast.)';
export const NO_FORECAST = [
  'I couldn’t get the forecast right now, so I don’t want to guess. A weather app will have it.',
  'Hmm, the weather service isn’t answering right now. I’d rather not guess, so check a weather app before you head out.',
];

function tipFor(w: Wx, temp: number): string {
  if (w.storm) return 'Stay safe out there, and stay inside if there’s lightning.';
  if (w.ice) return 'It could be icy, so leave a few minutes early and watch your step.';
  if (w.snow) return 'Bundle up and give yourself extra time.';
  if (w.rain) return 'Bring a jacket or umbrella.';
  if (w.freezing || temp <= 32) return 'Bundle up: warm coat, hat and gloves.';
  if (w.windy) return 'It’ll be windy, so hold on to your hat!';
  if (w.hot) return 'Drink plenty of water and find some shade.';
  return '';
}

const dayName = (o: number, now: Date) => (o === 0 ? 'Today' : o === 1 ? 'Tomorrow' : plusDays(now, o).toLocaleDateString('en-US', { weekday: 'long' }));

export function weatherAnswer(q: WeatherAsk, o: Outlook | null, now: Date, rand: () => number = Math.random): string {
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  if (!o || !o.periods.length) return pick(NO_FORECAST);
  const note = o.sample ? SAMPLE_NOTE : '';
  const alert = alertLine(o);
  const extra = `${alert ? ` ${alert}` : ''}${note}`;
  const forDay = (off: number) => {
    const date = ymdOf(plusDays(now, off));
    const ps = o.periods.filter((p) => dateOf(p.start) === date);
    return { day: ps.find((p) => p.isDaytime) ?? null, night: ps.find((p) => !p.isDaytime) ?? null };
  };
  // A weekend or week: a short line a day.
  if (q.offsets.length > 1) {
    const lines = q.offsets
      .map((off) => ({ off, ...forDay(off) }))
      .filter((d) => d.day || d.night)
      .slice(0, 4)
      .map((d) => `${dayName(d.off, now)}: ${(d.day ?? d.night)!.shortForecast.toLowerCase()}, ${d.day ? `high ${d.day.temperature}°` : `low ${d.night!.temperature}°`}.`);
    return lines.length ? `${lines.join(' ')}${extra}` : `I can only see about a week ahead.${note}`;
  }
  const off = q.offsets[0];
  const { day, night } = forDay(off);
  const late = off === 0 && (q.tonight || now.getHours() >= 18 || !day);
  const main = late ? night ?? day : day ?? night;
  if (!main) return off < 0 ? 'I can only see the forecast ahead, not past days.' : `I can only see about a week ahead.${note}`;
  const when = late && off === 0 ? 'tonight' : off === 0 ? 'today' : off === 1 ? 'tomorrow' : `on ${dayName(off, now)}`;
  const w = wx(main.shortForecast, main.temperature, main.wind, main.rain);
  const temps = main.isDaytime
    ? `a high near ${main.temperature}°${night && !late ? ` and a low around ${night.temperature}°` : ''}`
    : `a low around ${main.temperature}°`;
  const chance = main.rain && main.rain >= 20 ? ` ${main.rain}% chance of ${w.snow ? 'snow' : 'rain'}.` : '';
  const sky = main.shortForecast.toLowerCase();
  const tip = tipFor(w, main.temperature);
  let text: string;
  switch (q.kind) {
    case 'rain':
      text = w.snow && !/rain|shower|drizzle/.test(sky)
        ? `Not rain, but snow ${when}: ${sky}.${chance} ${tip}`
        : w.rain || (main.rain ?? 0) >= 40
          ? `Looks like it, ${when}: ${sky}.${chance} ${tip}`
          : `No rain in the forecast ${when}. It should be ${sky}, with ${temps}.`;
      break;
    case 'snow':
      text = w.snow
        ? `Yes, snow is in the forecast ${when}: ${sky}.${chance} ${tip}`
        : `No snow in the forecast ${when}. It should be ${sky}, with ${temps}.`;
      break;
    case 'cold':
      text = main.temperature <= 32
        ? `Yes, it’s cold ${when}: ${sky}, with ${temps}. ${tip}`
        : main.temperature < 50
          ? `It’s chilly ${when}: ${sky}, with ${temps}. ${tip || 'A warm layer is a good idea.'}`
          : `Not really. ${cap(when)} looks ${sky}, with ${temps}.${tip ? ` ${tip}` : ''}`;
      break;
    case 'hot':
      text = main.temperature >= 85
        ? `Yes, it’s hot ${when}: ${sky}, with ${temps}. ${tipFor({ ...w, hot: true }, main.temperature)}`
        : `Not really. ${cap(when)} looks ${sky}, with ${temps}.${tip ? ` ${tip}` : ''}`;
      break;
    case 'wind':
      text = w.windy
        ? `Yes, it’ll be windy ${when}: ${sky}, wind ${main.wind}. ${tip}`
        : `Not very. ${cap(when)} looks ${sky}, with ${temps}.`;
      break;
    case 'jacket':
      text = main.temperature < 60 || w.rain || w.snow
        ? `Yes, I’d bring one. ${cap(when)} looks ${sky}, with ${temps}. ${tip}`
        : `You probably won’t need one. ${cap(when)} looks ${sky}, with ${temps}.`;
      break;
    default:
      text = `${cap(when)}: ${sky}, with ${temps}.${chance}${tip ? ` ${tip}` : ''}`;
  }
  return `${text.replace(/\s+/g, ' ').trim()}${extra}`;
}
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

// Severe NWS alerts, for the greeting and weather answers.
export function alertLine(o: Outlook | null): string | null {
  const a = o?.alerts.find((x) => /severe|extreme/i.test(x.severity) || /warning/i.test(x.event));
  return a ? `The National Weather Service has a ${a.event} out for ${o?.place ?? `the ${CURRENT_REGION.name}`}. Please be careful, and check before you head out.` : null;
}

// "Heads up: it's going to be 28° and snowy when you leave for work at 8:00 AM tomorrow."
// Only for plans they travel to, early ones first, today or tomorrow.
export type Plan = { label: string; time: string; date: string; kind: string; home?: boolean };
const LEAD = ['Heads up:', 'Quick weather check:', 'Just so you know:'];

export function weatherWarning(o: Outlook | null, plans: Plan[], now: Date, rand: () => number = Math.random): string | null {
  if (!o) return null;
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];
  const today = ymdOf(now);
  const tomorrow = ymdOf(plusDays(now, 1));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const ahead = plans
    .filter((p) => !p.home && (p.date === today ? mins(p.time) > nowMin : p.date === tomorrow))
    .filter((p) => mins(p.time) < 10 * 60 || ['work', 'school', 'appointment', 'meeting'].includes(p.kind))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  for (const p of ahead) {
    // They leave about half an hour before.
    const leave = Math.max(0, mins(p.time) - 30);
    const h = Math.floor(leave / 60);
    const hour = o.hours.find((x) => dateOf(x.start) === p.date && hourOf(x.start) === h);
    const per = o.periods.find((x) => dateOf(x.start) === p.date && x.isDaytime === (h >= 6 && h < 18)) ?? o.periods.find((x) => dateOf(x.start) === p.date);
    const f = hour ?? per;
    if (!f) continue;
    const w = wx(f.shortForecast, f.temperature, f.wind, f.rain);
    if (!(w.snow || w.ice || w.rain || w.storm || w.freezing || w.windy)) continue;
    const desc = w.ice ? 'icy' : w.snow ? 'snowy' : w.storm ? 'stormy' : w.rain ? 'rainy' : w.windy ? 'windy' : 'freezing';
    const at = `${((mins(p.time) / 60) | 0) % 12 || 12}:${p.time.slice(3, 5)} ${mins(p.time) >= 720 ? 'PM' : 'AM'}`;
    const day = p.date === tomorrow ? ' tomorrow' : '';
    const tip = w.ice || w.snow ? 'Bundle up and leave a few minutes early.' : w.rain || w.storm ? 'Grab a jacket or umbrella on your way out.' : w.windy ? 'Hold on to your hat out there!' : 'Bundle up: warm coat, hat and gloves.';
    const temp = desc === 'freezing' ? `${f.temperature}° and freezing` : `${f.temperature}° and ${desc}`;
    const line = pick([
      `${pick(LEAD)} it’s going to be ${temp} when you leave for ${p.label} at ${at}${day}. ${tip}`,
      `${pick(LEAD)} the forecast says ${temp} around the time you head to ${p.label}${day} (${at}). ${tip}`,
    ]);
    return `${line}${o.sample ? SAMPLE_NOTE : ''}`;
  }
  return null;
}
