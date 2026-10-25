// Zoey's optional live AI answers, from the phone's side. The phone never holds
// a model key: it asks the Life Works server, which calls the model under the
// organization's BAA. Off unless the server says it's on; any problem (no
// server, offline, slow, a reply that breaks the rules) returns null and the
// authored answer is shown instead. See liveRules.ts for what is sent.
import type { SyncConfig } from '../safety/sync';
import { checkLiveReply, cleanRequest, LiveRequest } from './liveRules';

export const LIVE_TIMEOUT_MS = 8000;

async function call(cfg: SyncConfig, path: string, init: RequestInit, fetchImpl: typeof fetch, ms: number) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetchImpl(`${cfg.url}${path}`, {
      ...init,
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${cfg.deviceKey}`, 'Content-Type': 'application/json' },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Asked once when AskZoey opens.
export async function liveStatus(cfg: SyncConfig | null, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!cfg) return false;
  const r = await call(cfg, '/v1/zoey/live', { method: 'GET' }, fetchImpl, 4000);
  return r?.live === true;
}

// `names`: full names in their LifeCircle, cut to first names before sending.
export async function liveReply(
  cfg: SyncConfig | null,
  req: LiveRequest,
  names: string[],
  fetchImpl: typeof fetch = fetch,
  ms = LIVE_TIMEOUT_MS,
): Promise<string | null> {
  if (!cfg) return null;
  const r = await call(cfg, '/v1/zoey/chat', { method: 'POST', body: JSON.stringify(cleanRequest(req, names)) }, fetchImpl, ms);
  const text = typeof r?.text === 'string' ? r.text.trim() : '';
  return text && checkLiveReply(text).ok ? text : null;
}
