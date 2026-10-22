export const isToday = (iso: string, now = new Date()) => new Date(iso).toDateString() === now.toDateString();

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const pad = (n: number) => String(n).padStart(2, '0');

// Local calendar date as YYYY-MM-DD (not UTC, so late-evening entries stay on the right day).
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromYmd = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const hhmm = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

export const clock = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};

export const daysBetween = (from: Date, to: Date) =>
  Math.round((new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime() -
    new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()) / 86400000);
