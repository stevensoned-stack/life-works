// Sends chat messages to the Life Works server and picks up replies. Off
// unless the app was built with a server address and device key (see
// safety/sync.ts); without one, Chat hands each message to the phone's own
// texting app instead. Pure apart from fetch, so it can be tested.
import { ChatMessage, SupportPerson } from '../data/types';
import { SyncConfig } from '../safety/sync';

// The server knows the coordinator as the person's assigned counselor, whose
// conversation is always called 'coordinator'. Everyone else is reached by
// text at the number saved in LifeCircle.
export const conversationKey = (p: SupportPerson) => (p.group === 'coordinator' ? 'coordinator' : p.id);

export const personForKey = (people: SupportPerson[], key: string) =>
  key === 'coordinator' ? people.find((p) => p.group === 'coordinator') : people.find((p) => p.id === key);

// What the server sends back (server/src/messages.ts MessageView).
export type ServerMessage = {
  id: string;
  clientId: string | null;
  conversation: string;
  direction: 'out' | 'in';
  author: string;
  body: string;
  at: string;
};

export type Sent = { id: string; status: 'sent' | 'failed'; serverId?: string };

export const pending = (messages: ChatMessage[]) =>
  messages.filter((m) => m.from === 'me' && m.status === 'sending').sort((a, b) => a.at.localeCompare(b.at));

// Sends waiting messages oldest first. A refused message (bad number, person
// removed) is marked failed so it doesn't hold up the rest; a network or server
// failure stops the run so everything retries together later.
export async function pushMessages(
  cfg: SyncConfig,
  messages: ChatMessage[],
  people: SupportPerson[],
  fetchImpl: typeof fetch = fetch,
): Promise<Sent[]> {
  const done: Sent[] = [];
  for (const m of pending(messages)) {
    const p = people.find((x) => x.id === m.with);
    if (!p) {
      done.push({ id: m.id, status: 'failed' });
      continue;
    }
    try {
      const res = await fetchImpl(`${cfg.url}/v1/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.deviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, at: m.at, body: m.text, to: { id: conversationKey(p), name: p.name, phone: p.phone } }),
      });
      if (res.status === 400) {
        done.push({ id: m.id, status: 'failed' });
        continue;
      }
      if (!res.ok) break;
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      done.push({ id: m.id, status: 'sent', serverId: json.id });
    } catch {
      break;
    }
  }
  return done;
}

export async function pullMessages(cfg: SyncConfig, after: string, fetchImpl: typeof fetch = fetch): Promise<ServerMessage[] | null> {
  try {
    const res = await fetchImpl(`${cfg.url}/v1/messages?after=${encodeURIComponent(after)}`, {
      headers: { Authorization: `Bearer ${cfg.deviceKey}` },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { messages: ServerMessage[] }).messages;
  } catch {
    return null;
  }
}

// Turns what the server sent into new local messages. Skips anything already
// on the phone and conversations with people no longer in LifeCircle. Returns
// the cursor to ask from next time.
export function mergeIncoming(local: ChatMessage[], people: SupportPerson[], incoming: ServerMessage[], cursor: string) {
  const known = new Set(local.flatMap((m) => [m.id, m.serverId].filter(Boolean) as string[]));
  const added: ChatMessage[] = [];
  let next = cursor;
  for (const s of incoming) {
    if (Number(s.id) > Number(next)) next = s.id;
    if (known.has(s.id) || (s.clientId && known.has(s.clientId))) continue;
    const p = personForKey(people, s.conversation);
    if (!p) continue;
    const mine = s.direction === 'out';
    added.push({
      id: mine && s.clientId ? s.clientId : `srv-${s.id}`,
      serverId: s.id,
      with: p.id,
      from: mine ? 'me' : 'them',
      // A reply from someone covering (another counselor) says who wrote it.
      ...(!mine && s.author !== 'sms' && s.author !== p.name ? { author: s.author } : {}),
      text: s.body,
      at: s.at,
      status: mine ? 'sent' : 'received',
      ...(mine ? {} : { read: false }),
    });
  }
  return { added, cursor: next };
}

export const unreadFrom = (messages: ChatMessage[], withId?: string) =>
  messages.filter((m) => m.from === 'them' && !m.read && (!withId || m.with === withId)).length;
