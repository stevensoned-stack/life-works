// Where they live and what's near them (Ed, 2026-10-25: "teach zoey to know my time
// zone and what city I live in, and to figure out what I am near").
//
// - Time zone: the phone's own. Nothing here assumes Pacific time.
// - City: they tell Zoey or Settings once; it's saved in the encrypted store and used
//   for the weather and for "what city do I live in?". Looked up in uscities.json
//   (GeoNames US places, see THIRD_PARTY.md) on the phone, so the name isn't sent anywhere.
// - What's near: only with their OK, one location reading at the moment they ask,
//   compared on the phone with the local help list, the meetings and their saved
//   places. The reading is never saved, never sent to the Life Works service or
//   staff, and no history is kept. Without it, Zoey measures from their city's center.
import ROWS from './uscities.json';
import type { Meeting, Place } from '../data/types';
import type { Resource, ResourceCategory } from '../data/resources';

export type City = { name: string; state: string; lat: number; lon: number };
export type Point = { lat: number; lon: number };

const STATES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT',
  nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
  'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};
const ABBR = new Set(Object.values(STATES));
// "wash" and "wa" both mean Washington; "dc" alone is a place, not a state.
const SHORT: Record<string, string> = { wash: 'WA', calif: 'CA', cali: 'CA', ore: 'OR', penn: 'PA', mass: 'MA', mich: 'MI', minn: 'MN', tenn: 'TN', ariz: 'AZ', colo: 'CO', fla: 'FL', ill: 'IL', ind: 'IN' };

const norm = (s: string) =>
  ` ${s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `
    .replace(/ st /g, ' saint ')
    .replace(/ ste /g, ' sainte ')
    .replace(/ ft /g, ' fort ')
    .replace(/ mt /g, ' mount ')
    .trim();

// "Coeur d Alene" and "Coeur d'Alene" are the same place.
const key = (s: string) => norm(s).replace(/ /g, '');
const ALIAS: Record<string, string> = { nyc: 'new york city', 'new york': 'new york city', ny: 'new york city', la: 'los angeles', sf: 'san francisco', philly: 'philadelphia', vegas: 'las vegas', cda: 'coeur dalene', dc: 'washington dc' };

// Biggest places first, so a bare name means the best-known one.
type Row = City & { rank: number };
let index: Map<string, Row[]> | null = null;
const rows = () => {
  if (!index) {
    index = new Map();
    (ROWS as string[]).forEach((r, rank) => {
      const [name, state, lat, lon] = r.split('|');
      const k = key(name);
      const row = { name, state, lat: Number(lat), lon: Number(lon), rank };
      index!.set(k, [...(index!.get(k) ?? []), row]);
    });
  }
  return index;
};

export const cityLabel = (c: City) => `${c.name}, ${c.state}`;
const strip = ({ name, state, lat, lon }: City): City => ({ name, state, lat, lon });

// Miles as the crow flies.
export function milesBetween(a: Point, b: Point) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Words that are also town names ("I live in hope"): only with a state.
const NOT_ALONE = new Set(['hope', 'faith', 'liberty', 'joy', 'peace', 'grace', 'fear', 'paradise', 'eden', 'harmony', 'unity', 'friendship', 'love', 'home', 'house', 'school', 'church', 'mission', 'central', 'center', 'mansfield', 'denial', 'pain', 'recovery', 'sober', 'shelter', 'a', 'the', 'my', 'an', 'apartment', 'trailer', 'car', 'town', 'city', 'here', 'there', 'pleasant', 'fairview', 'ransom', 'lucky', 'success', 'plenty', 'welcome', 'triumph', 'truth', 'temple', 'zion', 'goodwill']);

// "Spokane", "spokane wa", "Cheney, Washington", "St. Maries ID". `near`: when the
// name alone fits several places, the closest one within 150 miles wins (Deer
// Park, WA for someone near Spokane), else the biggest.
export function findCity(text: string, near?: Point | null): City | null {
  const t = norm(text);
  if (!t) return null;
  const words = t.split(' ');
  let name = t;
  let state: string | null = null;
  for (const n of [2, 1]) {
    if (words.length <= n) continue;
    const tail = words.slice(-n).join(' ');
    const st = STATES[tail] ?? SHORT[tail] ?? (n === 1 && ABBR.has(tail.toUpperCase()) ? tail.toUpperCase() : null);
    if (st) {
      state = st;
      name = words.slice(0, -n).join(' ');
      break;
    }
  }
  // "Spokane, WA" with the comma, or "spokane, washington state".
  name = name.replace(/ (?:state|county)$/, '').trim();
  name = ALIAS[name] ?? name;
  if (state) {
    const hit = rows().get(key(name))?.find((c) => c.state === state);
    if (hit) return strip(hit);
    // "Washington" alone is a place too, and so is "Ohio City".
    state = null;
    name = ALIAS[t] ?? t;
  }
  const all = rows().get(key(name));
  if (!all) return null;
  if (NOT_ALONE.has(name)) return null;
  if (near) {
    const close = all.map((c) => ({ c, d: milesBetween(near, c) })).filter((x) => x.d <= 150).sort((a, b) => a.d - b.d)[0];
    if (close) return strip(close.c);
  }
  return strip(all[0]);
}

// The town they're in or nearest to.
export function nearestTown(p: Point): { city: City; miles: number } | null {
  let best: { city: City; miles: number } | null = null;
  for (const list of rows().values())
    for (const c of list) {
      const miles = milesBetween(p, c);
      if (!best || miles < best.miles) best = { city: strip(c), miles };
    }
  return best;
}

// --- What they ask --------------------------------------------------------------

export type NearWhat = 'any' | 'meeting' | 'shelter' | 'food' | 'housing' | 'legal' | 'crisis' | 'pharmacy' | 'hospital' | 'bus' | 'store' | 'gas' | 'laundry' | 'library';
export type PlaceAsk =
  | { kind: 'city' }
  | { kind: 'zone' }
  | { kind: 'setCity'; city: City }
  | { kind: 'near'; what: NearWhat };

const clean = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9, ]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/^(?:(?:hey|hi|ok|okay|so|um|zoey|and|but|well|wait),? )+/, '')
    .replace(/,? zoey$/, '');

const CITY_Q = /^(?:do you know |can you tell me |tell me )?(?:what|which|wat|wut) (?:city|town|state|place) (?:am i in|am i at|do i live in|i live in|i am in|im in|is this|do i stay in|am i living in)(?: right now| now)?$|^(?:where do i live|where am i|where am i right now|where do i stay|whats my city|what is my city|whats my town|do you know where i (?:live|am)|do you know what (?:city|town) i (?:live in|am in)|where am i at|where i at|what city is this|what town is this)$/;
const ZONE_Q = /\b(?:time ?zone|timezone)\b/;
const SET_CITY = /^(?:i live in|i live at|i stay in|im living in|i am living in|i now live in|i just moved to|i moved to|i live near|my city is|my town is|my home is in|my home town is|i live by|we live in|i got moved to|they moved me to|home is)(?: the city of| the town of)? (.+?)(?: now| these days| now actually)?$/;
// Some places Zoey can't see on her list; the phone's map app can.
const KINDS: [NearWhat, RegExp][] = [
  ['meeting', /\b(?:meeting|meetings|aa|na|12 step|twelve step|smart recovery|celebrate recovery)\b/],
  ['shelter', /\b(?:shelter|shelters|place to sleep|somewhere to sleep|bed for tonight|beds? tonight|place to stay tonight)\b/],
  ['food', /\b(?:food bank|food banks|food pantry|pantry|soup kitchen|free food|free meal|free meals|meal|meals|somewhere to eat|place to eat|eat|food)\b/],
  ['housing', /\b(?:housing help|housing office|housing)\b/],
  ['legal', /\b(?:legal aid|lawyer|eviction help|legal help)\b/],
  ['crisis', /\b(?:crisis line|crisis center|crisis)\b/],
  ['pharmacy', /\b(?:pharmacy|pharmacies|drug store|drugstore|walgreens|cvs|rite aid|bartell)\b/],
  ['hospital', /\b(?:hospital|er|emergency room|urgent care|clinic|doctor|doctors office)\b/],
  ['bus', /\b(?:bus stop|bus stops|bus station|bus|transit|light rail)\b/],
  ['gas', /\b(?:gas station|gas)\b/],
  ['laundry', /\b(?:laundromat|laundry)\b/],
  ['library', /\b(?:library|libraries)\b/],
  ['store', /\b(?:grocery store|grocery|store|supermarket|walmart|safeway|target|dollar store)\b/],
];
const NEAR_ANY = /^(?:whats|what is|what s|what are|anything|is there anything|what all is|what places are|tell me what is|tell me whats|show me what is|show me whats|what am i|where am i) ?(?:near|around|close to|close by|nearby|by|near by)(?: me| here| where i am| my location| this place)?(?: right now| now)?$|^(?:what can i (?:walk|get) to|whats close|what is close|whats around here|what is around here|whats nearby|what is nearby|whats near here|whats in my area|what is in my area|figure out what im near|what im near)$/;
const NEAR_X = /\b(?:closest|nearest|close by|nearby|near me|near here|near by|around me|around here|close to me|close to here|in my area|walking distance)\b/;

export function findPlaceAsk(text: string, near?: Point | null): PlaceAsk | null {
  const t = clean(text).replace(/,/g, '');
  if (!t) return null;
  if (CITY_Q.test(t)) return { kind: 'city' };
  if (ZONE_Q.test(t) && /\b(?:what|which|whats|my|am i|tell me|do you know)\b/.test(t)) return { kind: 'zone' };
  if (NEAR_ANY.test(t)) return { kind: 'near', what: 'any' };
  if (NEAR_X.test(t) && !/\b(?:feel|felt|feeling|people|person|someone|friend|family|mom|dad|sponsor|god|close to (?:my|him|her|them|god|using|relapse|giving up|quitting))\b/.test(t)) {
    const what = KINDS.find(([, re]) => re.test(t))?.[0];
    if (what) return { kind: 'near', what };
    if (/^(?:wheres|where is|where s|wheres the|find|find me|is there|any|whats the|what is the|show me|closest|nearest)\b/.test(t)) return { kind: 'near', what: 'any' };
  }
  const m = SET_CITY.exec(clean(text));
  if (m) {
    const c = findCity(m[1], near);
    if (c) return { kind: 'setCity', city: c };
  }
  return null;
}

// "What time zone am I in?"
export function zoneAnswer(now: Date, tz = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const long = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value;
  const time = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  return `Your phone is set to ${long ?? tz}, so it’s ${time} for you. I use your phone’s time for your plans, reminders and the weather.`;
}

export const ASK_CITY = 'I don’t know yet. What city do you live in? I’ll use it for your weather.';
export const CITY_NOT_FOUND = 'I couldn’t find that town. Can you tell me the city and state, like “Cheney, WA”?';
export const cityOrNot = (x: string) => /^(?:no|nope|not now|nah|never mind|nevermind|i dont want to|id rather not|rather not|skip)\b/i.test(x.trim());

// "What city do I live in?" / "Where am I?"
export function cityAnswer(o: { city: City | null; here: Point | null }) {
  const home = o.city ? cityLabel(o.city) : null;
  if (o.here) {
    const n = nearestTown(o.here);
    if (n) {
      const at = n.miles < 3 ? `Right now you’re in ${cityLabel(n.city)}.` : `Right now you’re about ${miles(n.miles)} from ${cityLabel(n.city)}.`;
      return home && home !== cityLabel(n.city) ? `${at} Your home city is ${home}.` : at;
    }
  }
  if (home) return `You told me you live in ${home}. I use it for your weather. If that changes, just tell me, like “I live in Cheney, WA.”`;
  return ASK_CITY;
}
export const cityHeard = (c: City) => `Got it, ${cityLabel(c)}. I’ll use it for your weather and to find help near you. You can change it any time in Settings.`;

// --- What's near ----------------------------------------------------------------

export const miles = (m: number) => (m < 0.1 ? 'right around the corner' : m < 10 ? `${m.toFixed(1)} miles` : `${Math.round(m)} miles`);

export const NEAR_PERMISSION =
  'I can find what’s closest if I check your location. I only look once, right now, on your phone. It isn’t saved, and it isn’t sent to anyone, including staff. Is that okay?';
export const NEAR_DENIED = 'I couldn’t get your location, so I measured from the middle of your city.';

const CATEGORY: Partial<Record<NearWhat, ResourceCategory>> = {
  shelter: 'Shelter tonight',
  food: 'Food',
  housing: 'Housing help',
  legal: 'Eviction and legal help',
};
const MAPS: Partial<Record<NearWhat, string>> = {
  pharmacy: 'pharmacy',
  hospital: 'urgent care',
  bus: 'bus stop',
  store: 'grocery store',
  gas: 'gas station',
  laundry: 'laundromat',
  library: 'library',
};
const NOUN: Partial<Record<NearWhat, string>> = {
  pharmacy: 'pharmacies',
  hospital: 'hospitals or clinics',
  bus: 'bus stops',
  store: 'stores',
  gas: 'gas stations',
  laundry: 'laundromats',
  library: 'libraries',
};

export type Located<T> = T & { at?: Point | null };
export type NearInput = {
  what: NearWhat;
  // Where to measure from, and how Zoey says it.
  from: Point | null;
  fromCity: boolean; // measured from the city center, not a reading
  regionName: string;
  regionAt: Point | null;
  resources: Located<Resource>[];
  meetings: Located<Meeting>[];
  places: Place[];
};
export type NearReply = { text: string; maps?: string; call211?: boolean; resources?: ResourceCategory | true; meetings?: boolean };

const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`);

// Closest first. Places without a location keep their list order, after the rest.
function byDistance<T>(xs: Located<T>[], from: Point | null) {
  return xs
    .map((x, i) => ({ x, i, d: from && x.at ? milesBetween(from, x.at) : null }))
    .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity) || a.i - b.i);
}

export function nearAnswer(o: NearInput): NearReply {
  const from = o.from;
  const how = o.fromCity ? ' from the middle of your city' : '';
  // Their own saved places from Check In/Out.
  const savedPlaces = o.places
    .filter((p) => p.spot)
    .map((p) => ({ p, d: from ? milesBetween(from, { lat: p.spot!.lat, lon: p.spot!.lng }) : null }))
    .filter((x) => x.d !== null)
    .sort((a, b) => a.d! - b.d!);
  // The local help list is for one area. Far from it, 211 knows what's near them.
  const away = from && o.regionAt ? milesBetween(from, o.regionAt) : 0;
  const outside = away > 60;
  const far = `My local help list only covers the ${o.regionName} so far, and that’s about ${miles(away)} away. 211 can tell you about shelters, food and housing help near you.`;

  if (MAPS[o.what]) {
    return {
      text: `I don’t have ${NOUN[o.what]} on my list yet. Your phone’s map app can show you the closest ones.`,
      maps: MAPS[o.what],
    };
  }
  if (o.what === 'crisis') {
    return { text: 'You don’t have to go anywhere for crisis help. You can call or text 988 any time, day or night, wherever you are.', resources: 'Crisis lines' };
  }
  if (o.what === 'meeting') {
    const live = o.meetings.filter((m) => m.format === 'in_person');
    const near = byDistance(live, from);
    const known = near.filter((x) => x.d !== null);
    const online = o.meetings.some((m) => m.format === 'online');
    if (known.length) {
      const top = known.slice(0, 2).map(({ x, d }) => `${x.name} at ${x.place} (${miles(d!)}${how})`);
      return { text: `The closest meeting${top.length > 1 ? 's are' : ' is'} ${list(top)}.${online ? ' There are online meetings too, if getting there is hard.' : ''}`, meetings: true };
    }
    const names = live.slice(0, 3).map((m) => `${m.name} at ${m.place}`);
    return {
      text: names.length
        ? `The in-person meetings on my list are ${list(names)}. I can’t tell how far they are, because the list doesn’t have their addresses yet.${online ? ' There are online meetings too, if getting there is hard.' : ''}`
        : 'I don’t have in-person meetings on my list yet. The meeting finder has online ones you can join from anywhere.',
      meetings: true,
    };
  }
  const cat = CATEGORY[o.what];
  if (cat) {
    if (outside) return { text: far, call211: true };
    const near = byDistance(o.resources.filter((r) => r.category === cat), from);
    const known = near.filter((x) => x.d !== null);
    const label = o.what === 'shelter' ? 'shelter' : o.what === 'food' ? 'place for food' : o.what === 'housing' ? 'housing help' : 'legal help';
    if (known.length) {
      const top = known.slice(0, 2).map(({ x, d }) => `${x.name}, ${x.address} (${miles(d!)}${how})`);
      const call = o.what === 'shelter' ? ' Beds change often, so call before you go.' : ' Call ahead to check their hours.';
      return { text: `The closest ${label} on my list is ${top[0]}.${top[1] ? ` Next is ${top[1]}.` : ''}${call}`, resources: cat };
    }
    const names = near.slice(0, 3).map(({ x }) => (x.address ? `${x.name}, ${x.address}` : x.name));
    return {
      text: `Here’s what I have for the ${o.regionName}: ${list(names)}. I can’t measure how far they are on this device, so tap below for phone numbers and call ahead.`,
      resources: cat,
    };
  }
  // "What's near me?"
  const parts: string[] = [];
  if (from && !o.fromCity) {
    const n = nearestTown(from);
    if (n) parts.push(n.miles < 3 ? `You’re in ${cityLabel(n.city)}.` : `You’re about ${miles(n.miles)} from ${cityLabel(n.city)}.`);
  }
  if (savedPlaces.length) {
    const s = savedPlaces[0];
    parts.push(s.d! < 0.1 ? `You’re at ${s.p.name}.` : `${s.p.name} is ${miles(s.d!)} away${how}.`);
  }
  if (outside) parts.push(far);
  else {
    for (const what of ['shelter', 'food'] as const) {
      const hit = byDistance(o.resources.filter((r) => r.category === CATEGORY[what]), from).find((x) => x.d !== null);
      if (hit) parts.push(`The closest ${what === 'shelter' ? 'shelter' : 'place for food'} on my list is ${hit.x.name} (${miles(hit.d!)}${how}).`);
    }
    if (parts.length < 2) parts.push(`I have shelters, food, housing and legal help for the ${o.regionName} in Local help.`);
  }
  parts.push('Ask me about something specific, like “closest meeting” or “closest pharmacy.”');
  return { text: parts.join(' '), resources: outside ? undefined : true, call211: outside };
}
