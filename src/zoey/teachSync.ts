// Sends missed sayings to the team's Teach Zoey list (only with "Help teach
// Zoey" on) and fetches what the team has taught. Uses the same server address
// and device key as safety alerts (safety/sync.ts). The server keeps the saying
// and what it was said to mean, never who sent it.
import { SyncConfig } from '../safety/sync';
import { Missed, Taught } from './teach';

// Returns the ids the server took. Stops at the first failure so the rest retry later.
export async function pushMissed(cfg: SyncConfig, items: Missed[], fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const done: string[] = [];
  for (const m of items) {
    try {
      const res = await fetchImpl(`${cfg.url}/v1/zoey/missed`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.deviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phrase: m.phrase, ...(m.picked ? { picked: m.picked } : {}) }),
      });
      // Refused (the server's own scrub said no): drop it rather than retry forever.
      if (res.ok || res.status === 400) done.push(m.id);
      else break;
    } catch {
      break;
    }
  }
  return done;
}

export async function fetchTaught(cfg: SyncConfig, fetchImpl: typeof fetch = fetch): Promise<Taught | null> {
  try {
    const res = await fetchImpl(`${cfg.url}/v1/zoey/taught`, { headers: { Authorization: `Bearer ${cfg.deviceKey}` } });
    if (!res.ok) return null;
    const t = (await res.json()) as Taught;
    return Array.isArray(t?.phrases) && Array.isArray(t?.answers) ? t : null;
  } catch {
    return null;
  }
}
