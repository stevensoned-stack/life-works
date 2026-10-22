import { Linking, Platform } from 'react-native';

// tel: and sms: links hand off to the phone's own dialer and messages app, so
// nothing is sent from Life Works itself and the person always presses send.
export const call = (phone: string) => Linking.openURL(`tel:${phone}`).catch(() => {});

export const text = (phone: string, body?: string) => {
  const sep = Platform.OS === 'ios' ? '&' : '?';
  const url = body ? `sms:${phone}${sep}body=${encodeURIComponent(body)}` : `sms:${phone}`;
  return Linking.openURL(url).catch(() => {});
};

export const QUICK_MESSAGES = [
  'Can you talk?',
  "I'm having a hard day. Can you call me?",
  "I'm at a meeting. I'll call you after.",
  "Just checking in. I'm doing okay.",
];

export const initials = (name: string) =>
  name
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const formatPhone = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};
