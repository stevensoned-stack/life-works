// Turns a safety-screen result into the record a counselor reviews. Pure, so
// it can be tested and later moved to the server unchanged.
import { CheckInTurn, SafetyEvent, SafetyTier } from '../data/types';
import { SafetyResult } from '../zoey/safety';

type Flagged = Exclude<SafetyResult, { kind: 'none' }>;

// Tiers from build plan sec. 06. "Are you safe?" is tier 2 until the answer
// is No or Not sure, which raises it to 3.
export function tierFor(r: Flagged): SafetyTier {
  if (r.kind === 'crisis') return 3;
  return 2;
}

export const TIER_LABEL: Record<SafetyTier, string> = { 1: 'Elevated', 2: 'Urgent', 3: 'Crisis' };

export function describe(r: Flagged): string {
  if (r.kind === 'crisis') return r.variant === 'medical' ? 'Medical emergency' : 'Suicide or self-harm';
  if (r.kind === 'check') return 'Asked "are you safe?"';
  return { withdrawal: 'Withdrawal or detox', abuse: 'Abuse or assault', housing: 'Losing housing' }[r.variant];
}

export function shownFor(r: Flagged): string {
  if (r.kind === 'crisis')
    return r.variant === 'medical' ? 'Full-screen crisis help, 911 first' : 'Full-screen crisis help, 988 first';
  if (r.kind === 'check') return 'Zoey asked "Are you safe right now?"';
  return `Zoey's ${r.variant} reply with call buttons`;
}

const CONTEXT_TURNS = 6;

export function makeEvent(args: {
  result: Flagged;
  message: string;
  history: CheckInTurn[]; // the conversation before this message
  screen: SafetyEvent['screen'];
  coordinatorName: string;
  share: boolean;
  id: string;
  now?: Date;
}): SafetyEvent {
  const at = (args.now ?? new Date()).toISOString();
  const r = args.result;
  return {
    id: args.id,
    at,
    screen: args.screen,
    tier: tierFor(r),
    kind: r.kind,
    variant: 'variant' in r ? r.variant : undefined,
    matched: r.matched,
    message: args.message,
    context: args.history.slice(-CONTEXT_TURNS),
    shown: shownFor(r),
    taken: [],
    alert: { to: args.coordinatorName, status: args.share ? 'queued' : 'not_shared', queuedAt: at },
  };
}

// The text alert the person can send the coordinator from their own phone.
// Kept short and private on purpose: it lands on two lock screens and in the
// person's own message history, so it never quotes what they wrote or names
// the topic. The details wait in the review list.
// timeZone matters on the server, whose clock is UTC; the phone uses its own.
export function alertText(personName: string, tier: SafetyTier, at: Date = new Date(), timeZone?: string) {
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
  return `Life Works alert: ${personName} would like a check-in (${TIER_LABEL[tier].toLowerCase()}, ${time}). Please reach out soon.`;
}

// What has changed since the server last saw this event. A record only grows
// (tier can rise, taps are added), so tier plus tap count identifies a version.
export const syncVersion = (e: SafetyEvent) => `${e.tier}:${e.taken.length}`;

// Shared events the server hasn't seen in their current form (alert table,
// build plan sec. 07). Events the person chose not to share never leave the phone.
export const outbox = (events: SafetyEvent[]) =>
  events.filter((e) => e.alert.status !== 'not_shared' && e.alert.syncedVersion !== syncVersion(e));
