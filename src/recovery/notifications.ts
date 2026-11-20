import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { State } from '../data/types';
import { clock, fromYmd } from '../util';

// Notification copy never says what a reminder or appointment is about: lock
// screens are seen by roommates, caseworkers and strangers (build plan, section 05).

export const notificationsSupported = Platform.OS !== 'web';

// Check-in windows from build plan section 05, clamped to the person's waking hours.
export function checkInWindows(wakeHour: number, sleepHour: number) {
  const clamp = (h: number) => Math.max(wakeHour, Math.min(sleepHour - 1, h));
  return [
    { id: 'morning', label: 'Morning', from: clamp(7), to: clamp(10), body: 'Good morning! How are you feeling today?' },
    { id: 'midday', label: 'Midday', from: clamp(11), to: clamp(14), body: "Hi, how's your day going?" },
    { id: 'evening', label: 'Evening', from: clamp(19), to: clamp(21), body: 'How are you feeling this evening?' },
  ].filter((w) => w.to > w.from);
}

// iOS keeps at most 64 scheduled notifications per app.
const MAX_ATTENDANCE_ALERTS = 14;
const MAX_EVENT_ALERTS = 40;

let configured = false;

// The cold or rain/snow notice from the forecast (weather.ts), set from Home. Weather
// isn't private, so unlike the rest it says what it's about. It has its own id so a
// newer forecast replaces it, and it's put back each time everything is rebuilt.
type WeatherNotice = { at: Date; title: string; body: string };
let weatherNotice: WeatherNotice | null = null;
const WEATHER_ID = 'weather-alert';

async function scheduleWeather(state: State) {
  if (!weatherNotice || !state.settings.weatherAlerts || weatherNotice.at.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: WEATHER_ID,
    content: { title: weatherNotice.title, body: weatherNotice.body, data: { route: 'home' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: weatherNotice.at, channelId: 'reminders' },
  });
}

export async function setWeatherNotice(n: WeatherNotice | null, state: State) {
  const same = n && weatherNotice && n.at.getTime() === weatherNotice.at.getTime() && n.body === weatherNotice.body;
  if (same || (!n && !weatherNotice)) return;
  weatherNotice = n;
  if (!notificationsSupported) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(WEATHER_ID).catch(() => {});
    if (!n || !state.settings.weatherAlerts || !(await ensurePermission())) return;
    await scheduleWeather(state);
  } catch {
    // Best effort, like the rest.
  }
}

async function ensurePermission() {
  if (!configured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    configured = true;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Rebuilds every scheduled notification from the current state. Called when
// reminders, the calendar or check-in settings change.
export async function syncNotifications(state: State) {
  if (!notificationsSupported) return;
  try {
    const wanted =
      state.settings.checkInReminders ||
      state.reminders.some((r) => r.on) ||
      state.calendar.some((e) => e.remindMins != null) ||
      (state.settings.attendanceReminders && state.plan.length > 0) ||
      (state.settings.weatherAlerts && !!weatherNotice);
    if (!wanted) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }
    if (!(await ensurePermission())) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const channelId = 'reminders';

    if (state.settings.checkInReminders) {
      for (const w of checkInWindows(state.settings.wakeHour, state.settings.sleepHour)) {
        // A random minute inside the window, so check-ins are dependable in kind
        // but not predictable in moment. Re-rolled each time this runs.
        const minutes = Math.floor(Math.random() * (w.to - w.from) * 60);
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Life Works', body: w.body, data: { route: 'askzoey' } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: w.from + Math.floor(minutes / 60),
            minute: minutes % 60,
            channelId,
          },
        });
      }
    }

    for (const r of state.reminders.filter((x) => x.on)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Life Works', body: `It's time for your ${clock(`${r.hour}:${r.minute}`)} reminder.` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId },
      });
    }

    // Check In/Out: a weekly nudge at the start of each plan slot. Never says
    // where, since the place is often a treatment program or a sober house.
    let weekly = 0;
    if (state.settings.attendanceReminders) {
      for (const slot of state.plan.filter((x) => state.places.some((p) => p.id === x.placeId))) {
        const [hour, minute] = slot.start.split(':').map(Number);
        for (const d of slot.days) {
          if (weekly >= MAX_ATTENDANCE_ALERTS) break;
          weekly++;
          await Notifications.scheduleNotificationAsync({
            content: { title: 'Life Works', body: "It's time to check in.", data: { route: 'checkinout' } },
            // weekday here is 1 = Sunday.
            trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: d + 1, hour, minute, channelId },
          });
        }
      }
    }

    const now = Date.now();
    const upcoming = state.calendar
      .filter((e) => e.remindMins != null)
      .map((e) => {
        const [h, m] = e.time.split(':').map(Number);
        const at = fromYmd(e.date);
        at.setHours(h, m, 0, 0);
        return { e, fireAt: at.getTime() - e.remindMins! * 60000 };
      })
      .filter((x) => x.fireAt > now)
      .sort((a, b) => a.fireAt - b.fireAt)
      .slice(0, MAX_EVENT_ALERTS);
    for (const { e, fireAt } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Life Works', body: `You have something on your calendar at ${clock(e.time)}.`, data: { route: 'calendar' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt), channelId },
      });
    }

    await scheduleWeather(state);
  } catch {
    // Scheduling is best effort; the app works without it.
  }
}
