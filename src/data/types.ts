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
  // Check In/Out. Location is asked for only at the moment of a tap, never in
  // the background. Sharing covers attendance only (places and times).
  checkInLocation: boolean;
  shareAttendance: boolean;
  attendanceReminders: boolean;
  // Zoey reads her replies aloud with an on-device voice. On by default (Ed,
  // 2026-10-25: "they can read it and hear it"); the speaker button mutes her.
  // Renamed from `zoeyVoice`, which was off by default, so old saved choices
  // don't keep her silent.
  zoeyVoiceOn: boolean;
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

// MyHome: where the person lives now. One record, replaced on each save.
export type HousingType = 'house' | 'apartment' | 'room' | 'sober_living' | 'transitional' | 'shelter' | 'family' | 'other';
export type LeaseTerm = 'month_to_month' | '6_months' | '12_months' | 'program' | 'none' | 'other';
export type RoommateRole = 'roommate' | 'partner' | 'family' | 'child' | 'house_manager' | 'landlord' | 'other';

export type Roommate = { id: string; name: string; role: RoommateRole; phone?: string };

export type MyHome = {
  type: HousingType;
  name?: string; // e.g. "Youth house", "Oxford House Maple"
  address: string;
  city: string;
  moveIn: string | null; // YYYY-MM-DD
  bedrooms: number | null; // 0 = studio
  beds: number | null;
  lease: {
    term: LeaseTerm;
    end: string | null; // YYYY-MM-DD
    rent: number | null; // whole dollars
    every: 'month' | 'week';
    // Monthly: day of the month, 31 = the last day. Weekly: 0 = Sunday.
    due: number | null;
  };
  roommates: Roommate[];
  notes?: string; // house rules, landlord details
  updatedAt: string; // ISO
};

// Check In/Out (build plan sec. 03 and the attendance table in sec. 07).
export type PlaceKind = 'work' | 'school' | 'home' | 'treatment' | 'meeting' | 'other';

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  detail?: string; // e.g. "Community college"
  // Where the place is, saved by the person while standing there, so a
  // check-in can confirm they arrived. The person's own position is never kept.
  spot?: { lat: number; lng: number; radiusM?: number };
};

// Where the person is expected to be and when. No end time means "be there by"
// (a curfew), which stays open for the rest of the day.
export type PlanSlot = {
  id: string;
  placeId: string;
  days: number[]; // 0 = Sunday
  start: string; // HH:MM
  end?: string; // HH:MM
};

export type LocationCheck = { at: 'here' | 'away'; meters: number };

export type Attendance = {
  id: string;
  placeId: string;
  placeName: string; // as it was named at check-in
  method: 'tap' | 'location';
  inAt: string; // ISO
  outAt?: string;
  inCheck?: LocationCheck;
  outCheck?: LocationCheck;
  // Queued to send to the coordinator once the Life Works service is connected.
  share: 'queued' | 'not_shared';
};

export type SavedQuestion = { id: string; text: string; savedAt: string };

// One record per time the safety screen fires (build plan sec. 06: "trigger
// evidence, tier, exact text shown, actions offered, actions taken,
// notifications sent and their delivery status"). Append-only: a review adds a
// note but never changes what was recorded.
export type SafetyTier = 1 | 2 | 3;

export type SafetyEvent = {
  id: string;
  at: string; // ISO
  screen: 'ask' | 'checkin' | 'checkinout' | 'myhome';
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

export type State = {
  profile: { name: string; phase: string; coordinator: { name: string; phone: string } };
  sobrietyDate: string | null; // YYYY-MM-DD
  moods: MoodEntry[];
  checkins: CheckIn[];
  people: SupportPerson[];
  home: MyHome | null;
  calendar: CalendarItem[];
  reminders: Reminder[];
  visits: MeetingVisit[];
  questions: SavedQuestion[];
  safetyEvents: SafetyEvent[];
  places: Place[];
  plan: PlanSlot[];
  attendance: Attendance[];
  settings: Settings;
};
