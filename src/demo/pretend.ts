// Pretend calls and texts for the web demo.
//
// In the browser preview, tel: and sms: links go nowhere, so every Call and
// Text button looked broken. On the web build, Linking.openURL hands those
// links to a pretend phone screen instead (PretendPhone.tsx). The real phone
// app never comes through here: it keeps real calls and real texts, and
// crisis lines (988, 911, Crisis Text Line, Never Use Alone) are always real
// on a phone. In the demo those lines get a pretend screen with a clear
// "demo only" label.
//
// No react-native imports here, so the tests can load it. The Linking patch
// lives in PretendPhone.tsx.
import { CURRENT_REGION } from '../data/resources';
import type { State } from '../data/types';

export type PretendKind = 'call' | 'text';
export type PretendRequest = { kind: PretendKind; number: string; body?: string };
export type PretendContact = { name: string; detail?: string; crisis: boolean };

// On only in the browser. EXPO_PUBLIC_LIFEWORKS_PRETEND_PHONE=0 turns it off
// there too (a real web app later should not fake calls).
export const pretendPhoneOn = (os: string, flag = process.env.EXPO_PUBLIC_LIFEWORKS_PRETEND_PHONE) => os === 'web' && flag !== '0';

const digits = (s: string) => s.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

// Same as formatPhone in contact.ts: (509) 555-1234.
export const showNumber = (p: string) => {
  const d = digits(p);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

// tel:5095551234, sms:988, sms:741741?body=HOME, sms:741741&body=HOME
export function parseContactUrl(url: string): PretendRequest | null {
  const m = /^(tel|sms):([^?&]*)(?:[?&](.*))?$/i.exec(url.trim());
  if (!m) return null;
  const number = decodeURIComponent(m[2]).trim();
  if (!digits(number)) return null;
  let body: string | undefined;
  if (m[3]) {
    for (const part of m[3].split('&')) {
      const [k, v = ''] = part.split('=');
      if (k.toLowerCase() === 'body') body = decodeURIComponent(v.replace(/\+/g, ' '));
    }
  }
  return { kind: m[1].toLowerCase() === 'tel' ? 'call' : 'text', number, body };
}

const CRISIS: Record<string, string> = {
  '988': '988 Suicide & Crisis Lifeline',
  '911': '911 Emergency',
  '741741': 'Crisis Text Line',
  '8004843731': 'Never Use Alone',
};

const KNOWN: Record<string, string> = {
  '211': '211 (local help)',
  '8006624357': 'SAMHSA Helpline',
  '8007997233': 'Domestic Violence Hotline',
  '8006564673': 'RAINN',
};

export const isCrisisNumber = (number: string) => digits(number) in CRISIS;

// Who is this number? Looks through the people they already have in the app.
export function contactFor(number: string, state?: Pick<State, 'profile' | 'people' | 'home'>): PretendContact {
  const d = digits(number);
  if (CRISIS[d]) return { name: CRISIS[d], crisis: true };
  const same = (p?: string) => !!p && digits(p) === d;
  if (state) {
    const person = state.people.find((p) => same(p.phone));
    if (person) return { name: person.name, detail: person.role, crisis: false };
    if (same(state.profile.coordinator.phone)) return { name: state.profile.coordinator.name, detail: 'Coordinator', crisis: false };
    const mate = state.home?.roommates?.find((r) => same(r.phone));
    if (mate) return { name: mate.name, detail: 'MyHome', crisis: false };
  }
  const place = CURRENT_REGION.resources.find((r) => same(r.phone) || same(r.textNumber));
  if (place) return { name: place.name, detail: 'Local help', crisis: place.category === 'Crisis lines' };
  if (KNOWN[d]) return { name: KNOWN[d], crisis: false };
  return { name: showNumber(number), crisis: false };
}

// "1:05", "12:30"
export const callClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// A tiny bus between the patched Linking.openURL and the screen in App.tsx.
type Listener = (r: PretendRequest) => void;
const listeners = new Set<Listener>();
export const onPretend = (fn: Listener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const showPretend = (r: PretendRequest) => {
  if (!listeners.size) return false;
  listeners.forEach((fn) => fn(r));
  return true;
};
