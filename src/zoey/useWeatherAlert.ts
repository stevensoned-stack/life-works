// The cold and rain/snow alert for Home (weather.ts), and the phone notification
// that goes with it. Looks up their city's forecast (at most once an hour), or the
// pilot city's.
import { useEffect, useState } from 'react';
import { CURRENT_REGION } from '../data/resources';
import { State } from '../data/types';
import { setWeatherNotice } from '../recovery/notifications';
import { cityLabel, findCity } from './place';
import { ColdWet, coldWetAlert, coldWetNotice, outlook, WeatherAt } from './weather';

// Weather alerts they tapped "Got it" or "No, I'm okay" on, until the app closes. A new
// alert (another day, or snow where it was only cold) shows again. Shared by Home,
// the check-in, AskZoey and Check In/Out.
export const seenAlerts = new Set<string>();

export function weatherAtFor(state: State): WeatherAt | null {
  const c = state.settings.city ?? (state.home?.city ? findCity(state.home.city, CURRENT_REGION.weatherAt) : null);
  return c ? { lat: c.lat, lon: c.lon, place: cityLabel(c) } : null;
}

export function useWeatherAlert(state: State): ColdWet | null {
  const [alert, setAlert] = useState<ColdWet | null>(null);
  const on = state.settings.weatherAlerts;
  const at = weatherAtFor(state);
  const key = at ? `${at.lat},${at.lon}` : '';
  useEffect(() => {
    if (!on) {
      setAlert(null);
      setWeatherNotice(null, state);
      return;
    }
    let live = true;
    outlook(Date.now(), at).then(
      (o) => {
        if (!live) return;
        const now = new Date();
        const a = coldWetAlert(o, now);
        setAlert(a);
        setWeatherNotice(coldWetNotice(a, now, state.settings.wakeHour, state.settings.sleepHour), state);
      },
      () => {},
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, key]);
  return alert;
}
