// Demo issue log (Ed, 2026-11-15: "track issues such as user comments and there
// is no response programmed - log any other issues during the demos").
//
// Every message Zoey has no answer for, every "you didn't answer my question" and
// every "you just said that" is noted here, with what she said back. Ed can add his
// own notes too (a button that did nothing, a voice problem). It lives only in this
// phone's or browser's encrypted store, like the rest of their data: nothing is ever
// sent to a server. Settings > Demo issue log copies it as CSV for the issue sheet
// (feedback/Life Works Demo Issue Log.xlsx), whose columns match CSV_HEADERS.
//
// Danger words never reach this log: the safety checks answer them first.

export type DemoIssueType = 'No response' | 'Wrong answer' | 'Repeat' | 'Bug' | 'Button' | 'Voice' | 'Note';

export type DemoIssue = {
  id: string;
  at: string; // ISO time
  where: string; // "AskZoey", "Check-in", "Settings note"
  typed: string; // what they typed ("" for a note)
  zoey: string; // what Zoey said back
  type: DemoIssueType;
  note?: string;
};

// The most kept; the oldest go first.
export const DEMO_LOG_MAX = 300;

export const CSV_HEADERS = ['ID', 'Date', 'Time', 'Where in app', 'What user typed', 'What Zoey said', 'Issue type', 'Severity', 'Status', 'Fix / PR', 'Notes'];

// No answer at all is the most important to fix; a note is Ed's to rate.
const SEVERITY: Record<DemoIssueType, string> = {
  'No response': 'Medium',
  'Wrong answer': 'Medium',
  Repeat: 'Low',
  Bug: 'High',
  Button: 'High',
  Voice: 'Medium',
  Note: '',
};

const clip = (s: string, n = 400) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// Adds one, unless it's the same words and type as the last one within a minute
// (a double tap or a resend). Newest last.
export function addDemoIssue(log: DemoIssue[], x: DemoIssue): DemoIssue[] {
  const e = { ...x, typed: clip(x.typed.trim()), zoey: clip(x.zoey.trim()), note: x.note ? clip(x.note.trim(), 1000) : undefined };
  const last = log[log.length - 1];
  if (last && last.type === e.type && last.typed === e.typed && last.note === e.note && Date.parse(e.at) - Date.parse(last.at) < 60_000) return log;
  const next = [...log, e];
  return next.length > DEMO_LOG_MAX ? next.slice(next.length - DEMO_LOG_MAX) : next;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (d: Date) => `${((d.getHours() + 11) % 12) + 1}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;

// A spreadsheet cell: quoted when it has a comma, quote or line break. A leading
// = + - @ is prefixed so a spreadsheet never runs it as a formula.
export function csvCell(v: string): string {
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function demoLogRows(log: DemoIssue[]): string[][] {
  return log.map((x) => {
    const d = new Date(x.at);
    return [`D-${x.id.slice(-6)}`, dateOf(d), timeOf(d), x.where, x.typed, x.zoey, x.type, SEVERITY[x.type], 'New', '', x.note ?? ''];
  });
}

// `header` false: just the rows, to paste under the sheet's existing headings.
export function demoLogCsv(log: DemoIssue[], header = true): string {
  const rows = demoLogRows(log);
  return [...(header ? [CSV_HEADERS] : []), ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function demoLogSummary(log: DemoIssue[]): string {
  if (!log.length) return 'Nothing logged yet.';
  const n = log.filter((x) => x.type === 'No response').length;
  return `${log.length} logged${n ? ` · ${n} with no answer` : ''}`;
}
