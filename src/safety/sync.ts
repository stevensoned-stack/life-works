// Sends shared safety events to the Life Works server, which texts the
// counselor and keeps them for review. Off unless the app was built with a
// server address and this phone's device key; until then alerts stay on the
// phone as before.
import { SafetyEvent } from '../data/types';
import { outbox, syncVersion } from './events';

export type SyncConfig = { url: string; deviceKey: string };

// Expo inlines EXPO_PUBLIC_ variables at build time. A device key baked into
// the build is a pilot shortcut; enrollment with a one-time code replaces it.
export function syncConfig(): SyncConfig | null {
  const url = process.env.EXPO_PUBLIC_LIFEWORKS_API_URL;
  const deviceKey = process.env.EXPO_PUBLIC_LIFEWORKS_DEVICE_KEY;
  return url && deviceKey ? { url: url.replace(/\/+$/, ''), deviceKey } : null;
}

// Only what the server needs: the local delivery and review fields stay here.
export const payload = (e: SafetyEvent) => ({
  id: e.id,
  at: e.at,
  screen: e.screen,
  tier: e.tier,
  kind: e.kind,
  ...(e.variant ? { variant: e.variant } : {}),
  matched: e.matched,
  message: e.message,
  context: e.context,
  shown: e.shown,
  taken: e.taken,
});

export type Synced = { id: string; version: string };

// Sends each pending event, oldest first, and returns the ones the server took.
// Stops at the first network or server failure so the rest retry together later.
export async function pushAlerts(cfg: SyncConfig, events: SafetyEvent[], fetchImpl: typeof fetch = fetch): Promise<Synced[]> {
  const done: Synced[] = [];
  const pending = [...outbox(events)].sort((a, b) => a.at.localeCompare(b.at));
  for (const e of pending) {
    try {
      const res = await fetchImpl(`${cfg.url}/v1/alerts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.deviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(e)),
      });
      if (res.status === 400) continue; // this one was refused; don't let it hold up the rest
      if (!res.ok) break;
      done.push({ id: e.id, version: syncVersion(e) });
    } catch {
      break;
    }
  }
  return done;
}
