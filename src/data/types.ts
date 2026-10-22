export type MoodValue = -2 | -1 | 0 | 1 | 2;

// Mood is only ever declared by the person (build plan, section 02). There is
// deliberately no other value for `source`.
export type MoodEntry = {
  id: string;
  value: MoodValue;
  source: 'self_report';
  recordedAt: string; // ISO timestamp
  tags: string[];
  note?: string;
};

export type CheckInKind = 'morning' | 'midday' | 'evening' | 'drop_in';

export type CheckInTurn = { from: 'zoey' | 'me'; text: string; at: string };

export type CheckIn = {
  id: string;
  kind: CheckInKind;
  flowVersion: string;
  startedAt: string;
  completedAt?: string;
  moodId?: string;
  tags: string[];
  meds?: 'yes' | 'not_yet' | 'none';
  turns: CheckInTurn[];
};

export type Settings = {
  onboarded: boolean;
  wakeHour: number;
  sleepHour: number;
  checkInReminders: boolean;
  // Explicit consent for safety alerts to the coordinator (Part 2 emergency
  // disclosure scope, build plan sec. 07). Asked at onboarding, changeable in Settings.
  shareSafetyAlerts: boolean;
};

export type SupportPerson = {
  id: string;
  name: string;
  role: string; // e.g. Sponsor, Therapist, Sister
  detail: string; // e.g. "Thursdays", "Answers 24/7"
  group: 'coordinator' | 'team' | 'family';
  phone: string;
  color: string;
};

export type EventKind = 'appointment' | 'meeting' | 'work' | 'school' | 'other';

export type CalendarItem = {
  id: string;
  date: string; // YYYY-MM-DD, local
  time: string; // HH:MM, 24h
  title: string;
  subtitle: string;
  kind: EventKind;
  remindMins: number | null; // minutes before; null = no reminder
  meetingId?: string;
};

export type Reminder = {
  id: string;
  title: string; // shown in the app only; notifications stay generic
  hour: number;
  minute: number;
  on: boolean;
};

export type MeetingFormat = 'in_person' | 'online';

export type Meeting = {
  id: string;
  name: string;
  fellowship: 'AA' | 'NA' | 'SMART' | 'Celebrate Recovery' | 'Recovery Dharma';
  weekday: number; // 0 = Sunday
  time: string; // HH:MM
  format: MeetingFormat;
  place: string;
  notes: string;
};

export type MeetingVisit = { id: string; meetingId: string; date: string };

export type SavedQuestion = { id: string; text: string; savedAt: string };

// One record per time the safety screen fires (build plan sec. 06: "trigger
// evidence, tier, exact text shown, actions offered, actions taken,
// notifications sent and their delivery status"). Append-only: a review adds a
// note but never changes what was recorded.
export type SafetyTier = 1 | 2 | 3;

export type SafetyEvent = {
  id: string;
  at: string; // ISO
  screen: 'ask' | 'checkin' | 'chat';
  tier: SafetyTier;
  kind: 'crisis' | 'urgent' | 'check';
  variant?: string;
  matched: string; // the words that triggered it
  message: string; // what the person typed
  context: CheckInTurn[]; // the messages just before it
  shown: string; // what the app showed in response
  taken: { label: string; at: string }[];
  // status: queued (shared, nothing sent yet), texted (the person opened a text
  // to the coordinator from their phone), not_shared. The server copy is tracked
  // separately: syncedVersion is the syncVersion() the server last accepted.
  alert: {
    to: string;
    status: 'queued' | 'texted' | 'sent' | 'not_shared';
    queuedAt: string;
    sentAt?: string;
    syncedVersion?: string;
    syncedAt?: string;
  };
  review?: { by: string; at: string; note: string };
};

// Chat with LifeCircle members (build plan sec. 03, Messaging). `with` is the
// SupportPerson id. status, for my messages: sending (waiting for the Life
// Works service), sent (the service has it), texted (handed to the phone's own
// texting app, used when no service is connected), failed (the service
// refused it). Their messages are 'received'.
export type ChatMessage = {
  id: string;
  with: string;
  from: 'me' | 'them';
  author?: string; // who replied, when it isn't the LifeCircle member themselves (e.g. a covering counselor)
  text: string;
  at: string; // ISO
  status: 'sending' | 'sent' | 'texted' | 'failed' | 'received';
  serverId?: string;
  read?: boolean;
};

export type State = {
  profile: { name: string; phase: string; coordinator: { name: string; phone: string } };
  sobrietyDate: string | null; // YYYY-MM-DD
  moods: MoodEntry[];
  checkins: CheckIn[];
  people: SupportPerson[];
  calendar: CalendarItem[];
  reminders: Reminder[];
  visits: MeetingVisit[];
  questions: SavedQuestion[];
  safetyEvents: SafetyEvent[];
  messages: ChatMessage[];
  chatCursor: string; // the last server message id this phone has picked up
  settings: Settings;
};
