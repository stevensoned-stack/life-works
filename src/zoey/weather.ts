// The forecast Zoey sometimes mentions when she says hello (Ed, 2026-10-24).
// Uses the National Weather Service (free, no key) for the pilot city's
// center only: no GPS and nothing about the person is sent. Any failure
// just means no weather line.
import { CURRENT_REGION } from '../data/resources';

export type Forecast = { name: string; shortForecast: string; temperature: number; isDaytime: boolean };

const HOUR = 60 * 60 * 1000;
let cached: { at: number; f: Promise<Forecast | null> } | null = null;

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

async function load(): Promise<Forecast | null> {
  const at = CURRENT_REGION.weatherAt;
  if (!at) return null;
  try {
    const point = await getJson(`https://api.weather.gov/points/${at.lat},${at.lon}`, 5000);
    const url = point?.properties?.forecast;
    if (typeof url !== 'string') return null;
    const p = (await getJson(url, 5000))?.properties?.periods?.[0];
    if (!p || typeof p.shortForecast !== 'string' || typeof p.temperature !== 'number') return null;
    return { name: String(p.name ?? ''), shortForecast: p.shortForecast, temperature: p.temperature, isDaytime: !!p.isDaytime };
  } catch {
    return null;
  }
}

// At most one lookup an hour.
export function forecast(now = Date.now()): Promise<Forecast | null> {
  if (!cached || now - cached.at > HOUR) cached = { at: now, f: load() };
  return cached.f;
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
