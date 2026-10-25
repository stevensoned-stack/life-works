// "My favorite color is mint green", "I love pizza" (Ed, 2026-10-25: "what does it
// mean when I say my favorite is mint green"). Zoey answers warmly and asks what
// they like about it. With learning on she remembers it (learn.ts favorites) and
// can say it back: "What's my favorite color?" -> "Mint green!". Never for
// drugs, alcohol or people: "I love getting high" is not a favorite.
import { clean } from './feelings';

// `keep`: a real favorite to remember ("my favorite X is"), not just "I love pizza".
export type Favorite = { what: string; value: string; asked: boolean; keep: boolean };

const COLORS = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'violet', 'pink', 'black', 'white', 'gray', 'grey', 'brown', 'gold', 'silver',
  'teal', 'turquoise', 'navy', 'maroon', 'lavender', 'lilac', 'mint', 'mint green', 'sky blue', 'baby blue', 'royal blue', 'lime',
  'lime green', 'forest green', 'olive', 'coral', 'peach', 'beige', 'tan', 'magenta', 'burgundy', 'cyan', 'aqua', 'indigo', 'rose',
  'hot pink', 'neon green', 'dark blue', 'light blue', 'dark green', 'light green', 'emerald', 'sage', 'sage green', 'rainbow',
];
const COLOR_RE = new RegExp(`^(?:(?:light|dark|bright|pale|deep|neon|pastel|baby|sky|royal|hot|forest|lime|mint|sea|ocean) )?(?:${COLORS.join('|')})$`);
// How each color feels, for "That's such a calm, fresh color".
const COLOR_FEEL: [RegExp, string][] = [
  [/mint|sage|seafoam/, 'calm, fresh'],
  [/green|emerald|olive/, 'peaceful, natural'],
  [/blue|navy|teal|turquoise|aqua|cyan|indigo/, 'calm, cool'],
  [/red|maroon|burgundy|crimson/, 'bold, strong'],
  [/pink|rose|coral|peach|magenta/, 'warm, happy'],
  [/purple|violet|lavender|lilac/, 'creative, calm'],
  [/yellow|gold|orange/, 'bright, sunny'],
  [/black/, 'classic, cool'],
  [/white|silver|gray|grey|beige|tan/, 'clean, simple'],
  [/rainbow/, 'fun, bright'],
];
// Not something to cheer for, or not a "favorite": substances, people, Zoey, danger.
const NOT_A_FAVORITE = /\b(?:high|drunk|buzzed|wasted|stoned|faded|using|drinking|beer|beers|wine|vodka|whiskey|tequila|liquor|alcohol|booze|weed|blunt|blunts|joints|dabs|pills|percs|percocet|oxy|xanax|xans|meth|heroin|dope|fent|fentanyl|coke|cocaine|crack|ecstasy|shrooms|smoking|vape|vaping|partying|getting|you|u|zoey|him|her|them|my (?:mom|dad|kids|son|daughter|wife|husband|girlfriend|boyfriend|sister|brother|family|baby)|myself|life|dying|death|pain|cutting|hurting)\b/;
// Words that are a drug only on their own: "lean" yes, "Lean on Me" no.
const ALONE_NOT = /^(?:drink|drinks|pot|joint|dab|bars|crystal|ice|molly|acid|lean|sipping lean|party|parties|getting lit|lit)$/;
// "my favorite color", "my fave food", "my favorite thing to do"
const KIND = '(color|colour|food|meal|snack|dessert|drink|song|band|singer|artist|rapper|music|movie|film|show|tv show|book|game|video game|team|sport|animal|pet|place|season|holiday|flower|fruit|candy|ice cream|ice cream flavor|flavor|number|day|thing to do|thing|hobby|subject|class|car|food to eat|restaurant|meeting|quote|verse|prayer|saying)';
const FAV = '(?:favorite|favourite|fav|fave|favorit|favrite|favorate)';
const LEAD = '^(?:(?:hey|zoey|so|ok|okay|well|um|guess what|fun fact|btw|by the way|just so you know|you know what|and|also) )*';
// "What does it mean when I say ...": they want her to hear the statement.
const ABOUT = /^(?:what does it mean when i say|what does it mean if i say|what if i (?:say|said)|what do you think when i say|what do you think if i say|what would you say if i (?:say|said)|if i (?:say|said)|when i say|what does it mean that) (?:that )?/;

const PATTERNS: RegExp[] = [
  new RegExp(`${LEAD}my ${FAV}(?: ${KIND})?(?: of all time| ever| right now)? (?:is|are|would be|has to be|has always been|was always|is probably|is definitely) (.+)$`),
  new RegExp(`${LEAD}(.+?) (?:is|are) my (?:all time |absolute |very )?${FAV}(?: ${KIND})?(?: ever| of all time| right now)?$`),
  new RegExp(`${LEAD}i (?:really |just |absolutely |totally )?(?:love|adore|like|am obsessed with|m obsessed with|cant get enough of|really like) (?:the color |eating |listening to |watching |playing )?(.+)$`),
];

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

export function findFavorite(text: string): Favorite | null {
  let t = clean(text);
  const asked = ABOUT.test(t);
  t = t.replace(ABOUT, '');
  for (const [i, re] of PATTERNS.entries()) {
    const m = t.match(re);
    if (!m) continue;
    // Pattern 0: kind, value; 1: value, kind; 2: value only.
    let kind = i === 0 ? m[1] : i === 1 ? m[2] : undefined;
    let value = (i === 0 ? m[2] : m[1]).replace(/^(?:the|a|an) /, '').replace(/ (?:a lot|so much|too|zoey|lol|haha)$/g, '').trim();
    if (!value || value.split(' ').length > 6 || NOT_A_FAVORITE.test(value) || ALONE_NOT.test(value)) return null;
    // "I love it", "I like that", "I like to ..." are not things.
    if (i === 2 && (/^(?:it|that|this|to|when|how|being|going|doing|my|our|their|your|feeling|having|the way)\b/.test(value) || value.split(' ').length > 4)) return null;
    if (kind === 'colour') kind = 'color';
    if (!kind && COLOR_RE.test(value)) kind = 'color';
    return { what: kind ?? 'thing', value, asked, keep: i < 2 };
  }
  return null;
}

// "What's my favorite color?", "do you remember my favorite food?", "guess my favorite season".
// Any kind of thing works; "what's my favorite?" alone is "thing".
export function findFavoriteQuestion(text: string): string | null {
  const m = clean(text).match(
    new RegExp(`^(?:(?:hey|zoey|so|ok|okay|um) )*(?:whats|what is|what s|wats|wat is|do you (?:remember|know)(?: what)?|can you guess|guess|tell me|you know|bet you dont know|i bet you dont know) my ${FAV}(?: ([a-z]+(?: [a-z]+){0,2}?))?(?: is| is zoey| zoey)?$`),
  );
  if (!m) return null;
  const k = m[1] ?? 'thing';
  return k === 'colour' ? 'color' : k;
}

// Their answer to "what is it?": checked like any favorite.
export function makeFavorite(what: string, value: string): Favorite | null {
  const v = clean(value).replace(/^(?:its|it is|it s|my favorite is|my favorite (?:\w+ )?is|i (?:think|guess) its|probably) /, '').replace(/^(?:the|a|an) /, '').trim();
  if (!v || v.split(' ').length > 6 || NOT_A_FAVORITE.test(v) || ALONE_NOT.test(v)) return null;
  return { what: what === 'thing' && COLOR_RE.test(v) ? 'color' : what, value: v, asked: false, keep: true };
}

// --- Not saved yet: "I don't know, can you tell me, or at least give me a hint?" (Ed, 2026-10-25)

export const DONT_KNOW = [
  'I don’t know, can you tell me, or at least give me a hint? I’m smart, but I can’t read minds. 😄',
  'Hmm, you haven’t told me your favorite {what} yet! Can you tell me, or give me a hint? I’m smart, but I can’t read minds. 😄',
  'I wish I knew! Tell me, or give me a little hint. I’m pretty smart, but reading minds isn’t one of my skills. 😄',
];

// "It's a kind of green" -> "Is it mint green?"
const SHADE: Record<string, string> = {
  green: 'mint green', blue: 'sky blue', red: 'cherry red', pink: 'hot pink', purple: 'lavender', yellow: 'sunshine yellow',
  orange: 'bright orange', black: 'jet black', white: 'snow white', brown: 'chocolate brown', gray: 'silver', grey: 'silver',
};
const BASE_COLOR = new RegExp(`\\b(${Object.keys(SHADE).join('|')})\\b`);
const HINTS: [RegExp, RegExp, string][] = [
  [/color|thing/, /\b(?:sky|ocean|sea|water)\b/, 'sky blue'],
  [/color|thing/, /\b(?:grass|leaf|trees|money|mint)\b/, 'green'],
  [/color|thing/, /\b(?:sun|banana|lemon)\b/, 'yellow'],
  [/color|thing/, /\b(?:blood|fire|apple|roses)\b/, 'red'],
  [/season/, /\b(?:cold|snow|snowy|christmas|freezing|ice|skiing)\b/, 'winter'],
  [/season/, /\b(?:hot|sun|sunny|beach|swimming|pool|vacation|warm)\b/, 'summer'],
  [/season/, /\b(?:leaves|pumpkin|pumpkins|halloween|football|cool|crisp|orange)\b/, 'fall'],
  [/season/, /\b(?:flowers|bloom|blooming|rain|easter|birds|fresh)\b/, 'spring'],
  [/food|meal|snack|thing/, /\b(?:italian|cheese|slice|slices)\b/, 'pizza'],
  [/food|meal|snack|thing/, /\b(?:mexican|spicy|tortilla|salsa)\b/, 'tacos'],
  [/food|meal|snack|thing/, /\b(?:bun|grill|grilled|patty|beef|fast food)\b/, 'burgers'],
  [/food|meal|snack|thing|dessert/, /\b(?:sweet|cold|frozen|cone|scoop)\b/, 'ice cream'],
  [/food|meal|snack|dessert|thing/, /\b(?:chocolate|baked|bake|cookie)\b/, 'chocolate chip cookies'],
  [/food|meal|thing/, /\b(?:chinese|rice|noodles)\b/, 'orange chicken'],
  [/animal|pet/, /\b(?:bark|barks|loyal|fetch|puppy)\b/, 'dogs'],
  [/animal|pet/, /\b(?:meow|purr|purrs|kitten|whiskers)\b/, 'cats'],
  [/holiday/, /\b(?:presents|gifts|santa|tree|december)\b/, 'Christmas'],
  [/holiday/, /\b(?:turkey|thankful|november)\b/, 'Thanksgiving'],
  [/holiday/, /\b(?:costumes|candy|spooky|october)\b/, 'Halloween'],
  [/holiday/, /\b(?:fireworks|july)\b/, 'the Fourth of July'],
];
const HINT_WORDS = /\b(?:hint|clue|kind of|kinda|sort of|type of|a shade of|shade of|starts with|begins with|rhymes with|its like|it s like|similar to|you can eat|guess|its a color|it s a color|has to do with|think)\b/;

export type FavoriteReply = { value: string } | { hint: true; guess: string | null; base: string | null } | null;

// What they said after "can you tell me, or give me a hint?"
export function readFavoriteReply(what: string, text: string): FavoriteReply {
  const t = clean(text);
  if (!t || /\?\s*$/.test(text) || t.split(' ').length > 12 || /^(?:what|whats|who|where|when|why|how|do|does|can|could|will|would|are|is)\b/.test(t)) return null;
  if (/^(?:i dont know|idk|never mind|nevermind|nvm|forget it|no|nope|not telling|you tell me)$/.test(t)) return null;
  const base = what === 'color' || what === 'thing' ? t.match(BASE_COLOR)?.[1] ?? null : null;
  // "It's green" for a color is a hint; "mint green" is the answer.
  const colorHint = !!base && new RegExp(`^(?:its|it is|it s)(?: a)?(?: kind of| sort of| shade of| type of)? ${base}(?: color| ish)?$`).test(t);
  const known = HINTS.find(([w, re]) => w.test(what) && re.test(t));
  // "It's cold and snowy" for a season is a hint; "winter" is the answer.
  if (HINT_WORDS.test(t) || colorHint || (known && /^(?:its|it is|it s) /.test(t) && !COLOR_RE.test(t.replace(/^(?:its|it is|it s) /, '')) && t.replace(/^(?:its|it is|it s) /, '') !== known[2].toLowerCase())) {
    if (base) return { hint: true, guess: SHADE[base], base };
    return { hint: true, guess: known ? known[2] : null, base: null };
  }
  const f = makeFavorite(what, text);
  return f ? { value: f.value } : null;
}

export const GUESS = (g: string) => `Ooh, a clue! 🤔 Is it ${g}?`;
export const STUMPED = 'Ooh, a clue! 🤔 Hmm, you got me. I’m stumped. What is it?';
export const GUESS_WRONG = (base: string | null) => (base ? `Darn! Just plain ${base}, then? Or tell me the shade.` : 'Darn! Okay, what is it?');
export const GOT_IT = ['I knew it! 😄', 'Yes! I got it! 😄', 'Ha, nailed it! 😄'];

const pickWith = (rand: () => number) => <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length) % xs.length];

const ABOUT_IT = ['What do you like about it?', 'What do you love most about it?', 'What makes it your favorite?'];

export function favoriteLine(f: Favorite, o: { remembered: string | null; learning: boolean }, rand: () => number = Math.random): string {
  const pick = pickWith(rand);
  const v = f.value;
  const kind = f.what === 'thing' ? '' : ` ${f.what}`;
  // "What does it mean when I say ...?" gets what it tells her, first.
  const means = f.asked ? `It tells me ${v} is your favorite${kind}! ` : '';
  const same = o.remembered && o.remembered === v;
  const keep = o.learning && f.keep && !o.remembered ? pick([' I’ll remember that.', ' Noted. 😊', '']) : '';
  if (same) return `${means}I remember! ${cap(v)} is your favorite${kind}. 😊 What do you love most about it?`;
  let line: string;
  if (f.what === 'color') {
    const feel = COLOR_FEEL.find(([re]) => re.test(v))?.[1] ?? 'great';
    line = f.asked ? `That’s such a ${feel} color.` : pick([`${cap(v)}! That’s such a ${feel} color.`, `Ooh, ${v}! That’s a ${feel} color. Good pick.`, `${cap(v)}, nice! It’s such a ${feel} color.`]);
  } else if (/food|meal|snack|dessert|fruit|candy|ice cream|flavor|restaurant|drink/.test(f.what)) {
    line = pick([`Ooh, ${v}! Good choice.`, `${cap(v)}, yum! 😋`, `Mmm, ${v}! Now I’m hungry, and I don’t even eat.`]);
  } else if (/song|band|singer|artist|rapper|music/.test(f.what)) {
    line = pick([`${cap(v)}! Music can really lift your mood.`, `Ooh, ${v}! Good taste. 🎶`]);
  } else if (/movie|film|show|book|game/.test(f.what)) {
    line = pick([`${cap(v)}! Good pick.`, `Ooh, ${v}! I’ve heard good things.`]);
  } else if (/team|sport/.test(f.what)) {
    line = pick([`${cap(v)}! Go team! 🙌`, `Nice, ${v}! That’s a good one to cheer for.`]);
  } else if (f.asked) {
    line = 'Good to know!';
  } else {
    line = pick([`${cap(v)}! I love that.`, `Ooh, ${v}! That’s great.`, `${cap(v)}, nice!`]);
  }
  // A change: "Last time you said blue."
  const changed = o.remembered && !same ? ` Last time you told me ${o.remembered}, so I’ll update that.` : '';
  return `${means}${line}${changed}${keep} ${pick(f.keep ? ABOUT_IT : ABOUT_IT.slice(0, 2))}`;
}

// After "What do you like about it?"
export const FAVORITE_HEARD = [
  'I love that. It’s good to know what makes you happy. 😊',
  'That’s a great reason. Little things like that matter.',
  'Love it. Hold on to the things that bring you joy.',
];

export const favoriteAnswer = (what: string, value: string | null, rand: () => number = Math.random) =>
  value
    ? `Your favorite ${what === 'thing' ? 'thing' : what} is ${value}! 😊`
    : pickWith(rand)(DONT_KNOW).replace(' your favorite {what}', what === 'thing' ? ' your favorite' : ` your favorite ${what}`);
