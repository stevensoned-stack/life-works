// "Do you want to reach out?" -> "Yes" -> who to call (Ed, 2026-11-15: "when Zoey says do
// you want to reach out and the response is yes, give them option of who to call").
//
// Zoey lists everyone in their LifeCircle by name (sponsor, counselor, mentor, family),
// plus roommates and the house manager from MyHome who have a number, then "Text
// someone instead" and "Someone else". 988 is on the list only after danger words in
// this chat (Ed, 2026-10-27), but asking for it by name always works.
//
// Typing works like tapping (Ed, 2026-10-27): "Marcus", "call my sponsor", "text
// Kayla", "my counselor", "someone else", "988", "never mind".
import type { MyHome, SupportPerson } from '../data/types';
import { clean } from './feelings';

export type Reacher = { id: string; name: string; short: string; role: string; phone: string };
export type ReachMode = 'call' | 'text';
export type ReachPick =
  | { kind: 'person'; who: Reacher; mode: ReachMode }
  | { kind: 'crisis'; mode: ReachMode }
  | { kind: 'other'; mode: ReachMode }
  | { kind: 'none' };

export const LIFELINE_LABEL = '988 Lifeline';
export const OTHER_LABEL = 'Someone else';
export const TEXT_LABEL = 'Text someone instead';
export const CALL_LABEL = 'Call someone instead';

const TITLES = new Set(['dr', 'ms', 'mr', 'mrs', 'miss', 'pastor', 'father', 'sister', 'brother', 'aunt', 'uncle', 'coach']);

// "Maya Torres" -> Maya, "Marcus R." -> Marcus, "Dr. Lee" and "Ms. Carol" stay whole,
// and so does "House staff on duty", which isn't a person's name.
export function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return name.trim();
  if (TITLES.has(words[0].toLowerCase().replace(/\./g, ''))) return words.slice(0, 2).join(' ');
  if (words.length > 2) return name.trim();
  return words[0];
}

const ROOMMATE_ROLE: Record<string, string> = {
  roommate: 'Roommate',
  partner: 'Partner',
  family: 'Family',
  child: 'Child',
  house_manager: 'House manager',
  landlord: 'Landlord',
  other: '',
};

const digits = (p: string) => p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

// Everyone they could call, in LifeCircle order. Their coordinator comes first when
// she isn't in LifeCircle already; the same number is never listed twice.
export function reachList(people: SupportPerson[], coordinator: { name: string; phone: string }, home?: MyHome | null): Reacher[] {
  const out: Reacher[] = [];
  const seen = new Set<string>();
  const push = (r: Reacher) => {
    const d = digits(r.phone);
    if (!d || seen.has(d)) return;
    seen.add(d);
    out.push(r);
  };
  if (!people.some((p) => digits(p.phone) === digits(coordinator.phone)))
    push({ id: 'coordinator', name: coordinator.name, short: shortName(coordinator.name), role: 'Care coordinator', phone: coordinator.phone });
  for (const p of people) push({ id: p.id, name: p.name, short: shortName(p.name), role: p.role, phone: p.phone });
  for (const r of home?.roommates ?? [])
    if (r.phone) push({ id: `home-${r.id}`, name: r.name, short: shortName(r.name), role: ROOMMATE_ROLE[r.role] ?? '', phone: r.phone });
  return out;
}

// "Marcus (sponsor)". The words people tap are words they could type.
export const personLabel = (r: Reacher) => (r.role ? `${r.short} (${r.role.toLowerCase()})` : r.short);

// Who to show, by name, after "yes". 988 only after danger words.
export function reachChoices(list: Reacher[], mode: ReachMode, worried: boolean): string[] {
  return [...list.map(personLabel), ...(worried ? [LIFELINE_LABEL] : []), OTHER_LABEL, mode === 'call' ? TEXT_LABEL : CALL_LABEL, 'Not now'];
}

const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

export const WHO_CALL = [
  'Who would you like to call?',
  'Okay! Who would you like to call?',
  'I’m really glad. Who would you like to call?',
  'Good. Who do you want to call?',
];
export const WHO_TEXT = ['Who would you like to text?', 'Sure. Who do you want to text?'];
export const whoLine = (mode: ReachMode) => pick(mode === 'call' ? WHO_CALL : WHO_TEXT);

export function reachingLine(who: string, mode: ReachMode): string {
  return mode === 'call'
    ? pick([
        `Calling ${who} now. I’m really glad you’re reaching out.`,
        `Okay, calling ${who}. Reaching out is a strong step.`,
        `Calling ${who}. I hope it helps to talk.`,
      ])
    : pick([
        `Opening a text to ${who}. Reaching out is a strong step.`,
        `Okay, here’s a text to ${who}. I’m glad you’re reaching out.`,
      ]);
}

export const crisisLine = (mode: ReachMode) =>
  mode === 'call'
    ? 'Calling 988 now. You don’t have to go through this alone.'
    : 'Opening a text to 988. Someone there will text you back. You don’t have to go through this alone.';

export const otherAsk = (mode: ReachMode) =>
  mode === 'call' ? pick(['Sure. Who would you like to call?', 'Okay. Who are you thinking of calling?']) : 'Sure. Who would you like to text?';

export const unknownLine = (said: string) => {
  const who = said.trim().replace(/[.!?]+$/, '');
  const name = who.length && who.length <= 30 ? who : 'them';
  return `I don’t have a number for ${name} in your LifeCircle yet. You can reach them from your phone’s contacts, and if you add them to your LifeCircle, they’ll be one tap away next time.`;
};

export const NOT_NOW = ['Okay. They’re a tap away whenever you’re ready.', 'That’s okay. Your LifeCircle is here whenever you want to reach out.'];

// --- Typed answers -----------------------------------------------------------

const NONE = /^(?:(?:um|well|actually|zoey) )*(?:no|nope|nah|no one|nobody|noone|none|not now|not right now|never mind|nevermind|nvm|forget it|no thanks|maybe later|later|not yet|i changed my mind|i dont want to|i dont wanna|neither|none of them|no body)(?: thanks| zoey| right now)*$/;
const OTHER = /\b(?:someone else|somebody else|some one else|anyone else|someone different|somebody different|other person|another person|someone not (?:on )?(?:the |my )?(?:list|here)|not on the list|other)\b/;
const CRISIS = /\b(?:988|nine eight eight|crisis line|crisis lifeline|lifeline|hotline|suicide line|crisis)\b/;
const TEXT = /^(?:i (?:want|wanna|would like|d like) to |id like to |can i |let me |lets |please |just )?(?:text|txt|message|msg|send a text to|send a message to|send)\b/;
const FILLER = /\b(?:i want to|i wanna|i would like to|id like to|i will|ill|can i|could i|let me|lets|please|just|call|phone|ring|text|txt|message|msg|send a text to|send a message to|send|talk to|reach|reach out to|with|try|maybe|probably|i think|i guess|the|my|zoey|now|right now|today|ok|okay|yes|yeah|yep|sure)\b/g;

// Words that name a role, mapped to what to look for in LifeCircle.
const ROLE_WORDS: [RegExp, RegExp][] = [
  [/\b(?:counselor|counsellor|therapist|counseling|therapy)\b/, /counsel|therap/i],
  [/\b(?:coordinator|case manager|caseworker|case worker|care manager|care coordinator)\b/, /coordinat|case/i],
  [/\b(?:house manager|house staff|staff|house|manager)\b/, /house|staff|manager/i],
  [/\b(?:sponsor)\b/, /sponsor/i],
  [/\b(?:mentor|peer)\b/, /mentor|peer/i],
  [/\b(?:roommate|room mate|roomie)\b/, /roommate/i],
  [/\b(?:doctor|dr)\b/, /doctor|dr|therap/i],
];

const nameWords = (r: Reacher) =>
  clean(r.name)
    .split(' ')
    .filter((w) => w.length > 1 && !TITLES.has(w) && !['on', 'duty', 'the', 'of'].includes(w));

// What their typed words pick, or null if it isn't about who to reach.
export function findReach(text: string, list: Reacher[], mode: ReachMode = 'call'): ReachPick | null {
  const t = clean(text.replace(/988/g, ' nine eight eight '));
  if (!t) return null;
  if (NONE.test(t)) return { kind: 'none' };
  const m: ReachMode = TEXT.test(t) ? 'text' : /^(?:i (?:want|wanna|would like) to |id like to |lets |please |just )?(?:call|phone|ring)\b/.test(t) ? 'call' : mode;
  if (CRISIS.test(t)) return { kind: 'crisis', mode: m };
  const rest = t.replace(FILLER, ' ').replace(/\s+/g, ' ').trim();
  // Their label, as tapped or typed: "Marcus (sponsor)".
  const byLabel = list.find((r) => clean(personLabel(r)) === t || clean(r.name) === rest || clean(r.short) === rest);
  if (byLabel) return { kind: 'person', who: byLabel, mode: m };
  if (OTHER.test(t)) return { kind: 'other', mode: m };
  if (!rest) return null;
  const words = rest.split(' ');
  // A name: "Marcus", "call Kayla", "text dre".
  const byName = list.find((r) => nameWords(r).some((w) => words.includes(w)));
  if (byName) return { kind: 'person', who: byName, mode: m };
  // A role: "my sponsor", "my sister", "my counselor", "the house manager".
  const byRole = list.find((r) => r.role && words.join(' ').includes(clean(r.role)));
  if (byRole) return { kind: 'person', who: byRole, mode: m };
  for (const [said, role] of ROLE_WORDS) {
    if (!said.test(rest)) continue;
    const r = list.find((x) => role.test(x.role) || role.test(x.name));
    if (r) return { kind: 'person', who: r, mode: m };
  }
  const roleWord = list.find((r) => r.role && clean(r.role).split(' ').some((w) => w.length > 3 && words.includes(w)));
  if (roleWord) return { kind: 'person', who: roleWord, mode: m };
  return null;
}

// A node that asks "Want to reach out?" with call buttons (trees.ts `offer: reachOut`).
// Yes / Not now buttons, and "yes" goes on to who to call.
export const REACH_ACTIONS = ['callSponsor', 'callCoordinator', 'callCounselor', 'textSponsor', 'openLifeCircle'] as const;
export const isReachAction = (a: string) => (REACH_ACTIONS as readonly string[]).includes(a);

// --- The flow, shared by AskZoey chat and the check-in ---------------------------

export type ReachEnv = {
  list: Reacher[];
  worried: () => boolean; // danger words came up in this chat
  say: (t: string) => void;
  me: (t: string) => void; // shows their tapped words
  choices: (cs: { label: string; onPick: () => void }[]) => void;
  listen: (hear: ((t: string) => boolean) | null) => void; // typed answers
  call: (phone: string) => void;
  text: (phone: string) => void;
};

// "Who would you like to call?" with everyone by name. `quiet`: the node already asked.
export function askWho(env: ReachEnv, then: () => void, mode: ReachMode = 'call', quiet = false): void {
  if (!quiet) env.say(whoLine(mode));
  const go = (p: ReachPick) => reachTo(env, p, then);
  const tap = (label: string, run: () => void) => ({ label, onPick: () => (env.me(label), run()) });
  env.choices([
    ...env.list.map((r) => tap(personLabel(r), () => go({ kind: 'person', who: r, mode }))),
    ...(env.worried() ? [tap(LIFELINE_LABEL, () => go({ kind: 'crisis', mode }))] : []),
    tap(OTHER_LABEL, () => go({ kind: 'other', mode })),
    mode === 'call' ? tap(TEXT_LABEL, () => askWho(env, then, 'text')) : tap(CALL_LABEL, () => askWho(env, then, 'call')),
    tap('Not now', () => go({ kind: 'none' })),
  ]);
  env.listen((t) => {
    const p = findReach(t, env.list, mode);
    if (!p) return false;
    go(p);
    return true;
  });
}

// The person with this number in their list ("Want to call Maya now?" -> Maya).
export const findReacher = (list: Reacher[], phone: string | undefined) => (phone ? list.find((r) => digits(r.phone) === digits(phone)) : undefined);

// A Yes / Not now question ("Want to reach out?"). Typing a name skips straight to them.
// `one`: the question names one person ("Want to call Maya now?"), so "yes" calls
// them right away, with no list (Ed, 2026-11-15).
export function askReach(env: ReachEnv, then: () => void, one?: { who: Reacher; mode: ReachMode }): void {
  const yes = () => (one ? reachTo(env, { kind: 'person', ...one }, then) : askWho(env, then));
  const no = () => (env.say('Okay, maybe later.'), then());
  const yesLabel = one ? `Yes, ${one.mode} ${one.who.short}` : 'Yes';
  env.choices([
    { label: yesLabel, onPick: () => (env.me(yesLabel), yes()) },
    { label: 'Not now', onPick: () => (env.me('Not now'), no()) },
  ]);
  env.listen((t) => {
    const p = findReach(t, env.list);
    if (p && p.kind !== 'none' && p.kind !== 'other') return reachTo(env, p, then), true;
    const yn = yesOrNo(t);
    if (yn === 'yes') return yes(), true;
    if (yn === 'no' || p?.kind === 'none') return no(), true;
    if (p?.kind === 'other') return reachTo(env, p, then), true;
    return false;
  });
}

const YES_RE = /^(?:(?:um|well|ok|okay|zoey) )*(?:yes|yeah|yea|yep|yup|ya|sure|ok|okay|please|i guess|i think so|probably|definitely|absolutely|of course|alright|all right|lets do it|i will|i would|i could|maybe|that would help|it would help|good idea|y)(?: please| zoey| i guess| i would| i will| that would help| thanks)*$/;
const NO_RE = /^(?:(?:um|well|honestly) )*(?:no|nope|nah|not now|not really|no thanks|maybe later|later|not today|i dont think so|i dont want to|i dont wanna|n)(?: thanks| zoey| right now)*$/;
const yesOrNo = (t: string): 'yes' | 'no' | null => {
  const c = clean(t);
  return NO_RE.test(c) ? 'no' : YES_RE.test(c) ? 'yes' : null;
};

export function reachTo(env: ReachEnv, p: ReachPick, then: () => void): void {
  env.choices([]);
  env.listen(null);
  switch (p.kind) {
    case 'person':
      env.say(reachingLine(p.who.short, p.mode));
      (p.mode === 'call' ? env.call : env.text)(p.who.phone);
      return then();
    case 'crisis':
      env.say(crisisLine(p.mode));
      (p.mode === 'call' ? env.call : env.text)('988');
      return then();
    case 'none':
      env.say(pick(NOT_NOW));
      return then();
    case 'other': {
      env.say(otherAsk(p.mode));
      env.choices([{ label: 'Never mind', onPick: () => (env.me('Never mind'), reachTo(env, { kind: 'none' }, then)) }]);
      env.listen((t) => {
        const q = findReach(t, env.list, p.mode);
        if (q && q.kind !== 'other') return reachTo(env, q, then), true;
        env.choices([]);
        env.say(unknownLine(t.replace(/^(?:(?:i want to|id like to|lets|please|just|maybe) )*(?:call|text|phone|message) /i, '').replace(/^my /i, 'your ')));
        then();
        return true;
      });
      return;
    }
  }
}
