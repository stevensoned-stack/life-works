// Typos (Ed, 2026-10-25: "add spell check"). The phone's keyboard spell check is on in
// the message boxes; this catches what gets through, like "sponcer", "meating",
// "cravng". Each unknown word is matched against the words Zoey's answers use
// first, then against the dictionary (wordnet.json).
//
// - `sure` fixes (a known misspelling, or one letter off from one of Zoey's own
//   words) are used straight away. Other fixes are "unsure": Zoey only uses them
//   after asking "Did you mean ...?".
// - Safety reads what they typed first. The fixed text can only add a safety
//   reply, never take one away (AskScreen.submit).
// - Names, towns, their own learned words, numbers and words under 4 letters are
//   left alone.
import WORDNET from './wordnet.json';
import { ANSWERS } from './answers';
import { FEELING_WORDS } from './feelings';
import { TERMS } from './define';
import { SHORTHAND } from './learn';
import { isTownWord } from './place';

// Common misspellings, always fixed.
export const MISSPELLED: Record<string, string> = {
  sponcer: 'sponsor', sponsur: 'sponsor', sponser: 'sponsor', sposor: 'sponsor', spnsr: 'sponsor', sponsar: 'sponsor', spounser: 'sponsor',
  meating: 'meeting', meetting: 'meeting', meting: 'meeting', meetng: 'meeting', meetins: 'meetings',
  craving: 'craving', cravng: 'craving', craveing: 'craving', cravins: 'cravings', cravigns: 'cravings',
  relaps: 'relapse', relapes: 'relapse', relaspe: 'relapse', replase: 'relapse', relasped: 'relapsed', relapesed: 'relapsed',
  anxeity: 'anxiety', anxitey: 'anxiety', anxity: 'anxiety', anxios: 'anxious', anxous: 'anxious', axious: 'anxious',
  depresed: 'depressed', depressd: 'depressed', depresion: 'depression', depresssion: 'depression',
  lonley: 'lonely', lonly: 'lonely', loney: 'lonely', stresed: 'stressed', streesed: 'stressed', stessed: 'stressed',
  tommorrow: 'tomorrow', tommorow: 'tomorrow', tomorow: 'tomorrow', tomarrow: 'tomorrow', tomorroe: 'tomorrow', yesterday: 'yesterday', yesturday: 'yesterday', yestrday: 'yesterday',
  becuase: 'because', becasue: 'because', beacuse: 'because', becaus: 'because', becouse: 'because',
  teh: 'the', adn: 'and', taht: 'that', waht: 'what', hwo: 'how', nad: 'and',
  wierd: 'weird', freind: 'friend', freinds: 'friends', frend: 'friend', frends: 'friends', familey: 'family', famly: 'family',
  probaly: 'probably', prolly: 'probably', definately: 'definitely', definitly: 'definitely', defintely: 'definitely',
  appointmet: 'appointment', appoitment: 'appointment', apointment: 'appointment', appointmnet: 'appointment',
  therapest: 'therapist', therapis: 'therapist', theripist: 'therapist', counseler: 'counselor', councelor: 'counselor', counsler: 'counselor', councilor: 'counselor',
  medicaton: 'medication', medicine: 'medicine', medecine: 'medicine', medcine: 'medicine', perscription: 'prescription', prescripton: 'prescription',
  suboxen: 'suboxone', suboxon: 'suboxone', subutex: 'subutex', methadon: 'methadone', narcon: 'narcan',
  recovry: 'recovery', recoverey: 'recovery', recoery: 'recovery', sobriaty: 'sobriety', sobreity: 'sobriety', sobrity: 'sobriety',
  calender: 'calendar', calandar: 'calendar', calander: 'calendar', schedual: 'schedule', schedul: 'schedule', shedule: 'schedule',
  untill: 'until', thier: 'their', recieve: 'receive', beleive: 'believe', belive: 'believe', truely: 'truly',
  enviroment: 'environment', goverment: 'government', neccessary: 'necessary', occured: 'occurred', seperate: 'separate',
  alchohol: 'alcohol', alcohal: 'alcohol', alcahol: 'alcohol', achohol: 'alcohol', drinkin: 'drinking', drugz: 'drugs',
  hungrey: 'hungry', angery: 'angry', angy: 'angry', tird: 'tired', tierd: 'tired', exausted: 'exhausted', exhuasted: 'exhausted',
  scarred: 'scared', scaird: 'scared', nervus: 'nervous', nervouse: 'nervous', worryed: 'worried', woried: 'worried',
  sleap: 'sleep', slepe: 'sleep', cant_sleep: 'cant sleep', insomnai: 'insomnia', proabtion: 'probation', probaton: 'probation', parol: 'parole',
  evcited: 'evicted', evited: 'evicted', evected: 'evicted', evicshun: 'eviction', evition: 'eviction', shleter: 'shelter', sheltor: 'shelter',
  wether: 'weather', wheather: 'weather', whether: 'whether', favrite: 'favorite', favorit: 'favorite', favourite: 'favorite', faverite: 'favorite',
  definition: 'definition', meaninng: 'meaning', mening: 'meaning', mean: 'mean',
};

// Words people type that aren't in the dictionary but aren't typos.
const KNOWN = new Set(
  (
    'this that with from have what when where which there their they them then than your yours about would could should been were some into just only also very much many more most other because these those does doing done ' +
    'dont cant wont didnt doesnt isnt arent wasnt werent havent hasnt hadnt shouldnt wouldnt couldnt aint ive youre theyre thats whats wheres hows whos lets yall gonna wanna gotta kinda sorta ' +
    'lol lmao lmfao idk omg haha hahaha okay yeah yess nope yup yep thanks thank please hello hiya heyy thx tysm ikr smh tbh imo nvm brb ttyl ' +
    'myself yourself himself herself ourselves themselves anything everything nothing something anyone everyone someone nobody somebody anybody everybody ' +
    'though although while until since before after above below under over again here both each every either neither whether whose whom shall might must ours hers theirs mine onto upon within without through ' +
    'toward towards against among between beside besides around across along behind beyond during except inside outside near maybe really still even ever never always often sometimes already almost enough quite rather ' +
    'such same else instead like alot gotten zoey lifecircle lifepath lifeevent lifegoals lifetouch myhome askzoey checkin checkins ' +
    'suboxone subutex narcan naloxone methadone vivitrol sublocade fentanyl fent meth oxy oxys percs perc xanax xans bars benzos benzo molly kratom vape vaping weed edibles dabs ' +
    'sober sobriety relapse relapsed relapsing craving cravings trigger triggered triggers sponsor sponsors sponsee meeting meetings aa na smart dharma ' +
    'today tonight tomorrow yesterday monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december ' +
    'facebook instagram tiktok snapchat youtube netflix google iphone android texting texted ' +
    // Past tenses the dictionary lists only as their base word.
    'meant felt thought went said made told knew slept kept left gone drank drove bought brought caught taught fought sought found held heard lost paid sent spent stood understood took gave came began broke chose ' +
    'forgot forgave froze grew hurt rode rang rose sang sank shook shot slid spoke stole stuck stung swore swam threw tore woke wore wrote been done seen given taken written eaten driven forgotten broken chosen spoken stolen ' +
    'woken fallen beaten became fell dealt dreamt learnt burnt built lent bent fled flew flown hung knelt leapt meant overslept relapsed shrank spun spat split spread sprang strove swept swung wept withdrew withdrawn'
  ).split(' '),
);

const tokensOf = (s: string) => s.toLowerCase().replace(/[’']/g, '').split(/[^a-z]+/).filter(Boolean);

// Zoey's own words: what the answers, feelings and definitions are about.
let app: string[] | null = null;
let dict: Set<string> | null = null;
let all: string[] | null = null;
function vocab() {
  if (!app) {
    const mine = new Set<string>([...KNOWN]);
    for (const a of ANSWERS) for (const s of [a.q, ...a.keys]) tokensOf(s).forEach((w) => mine.add(w));
    for (const ws of Object.values(FEELING_WORDS)) for (const w of ws) tokensOf(w).forEach((x) => mine.add(x));
    for (const k of Object.keys(TERMS)) tokensOf(k).forEach((w) => mine.add(w));
    for (const v of Object.values(SHORTHAND)) tokensOf(v).forEach((w) => mine.add(w));
    for (const v of Object.values(MISSPELLED)) tokensOf(v).forEach((w) => mine.add(w));
    app = [...mine].filter((w) => w.length >= 3);
    dict = new Set(Object.keys(WORDNET as Record<string, unknown>).filter((w) => /^[a-z]+$/.test(w)));
    all = [...dict].filter((w) => w.length >= 4);
  }
  return { app: app!, dict: dict!, all: all!, appSet: new Set(app) };
}

// "cravings", "needed", "hoping", "happily", "bigger": a dictionary word with an ending.
function known(w: string) {
  const { dict, appSet } = vocab();
  if (appSet.has(w) || dict.has(w)) return true;
  const stems = [
    w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y'), w.replace(/ied$/, 'y'),
    w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/(.)\1ed$/, '$1'),
    w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/(.)\1ing$/, '$1'), w.replace(/in$/, ''), w.replace(/in$/, 'e'),
    w.replace(/ly$/, ''), w.replace(/ily$/, 'y'), w.replace(/er$/, ''), w.replace(/est$/, ''), w.replace(/ier$/, 'y'), w.replace(/iest$/, 'y'),
  ];
  // "hopless" isn't "hop" + less: these endings need a longer word in front.
  const long = [w.replace(/ness$/, ''), w.replace(/ful$/, ''), w.replace(/less$/, ''), w.replace(/ment$/, '')];
  return (
    stems.some((s) => s !== w && s.length >= 3 && (appSet.has(s) || dict.has(s))) ||
    long.some((s) => s !== w && s.length >= 5 && (appSet.has(s) || dict.has(s)))
  );
}

// Letters added, dropped, changed or swapped (Damerau-Levenshtein), stopping past `max`.
export function distance(a: string, b: string, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}

const squeeze = (w: string) => w.replace(/([a-z])\1+/g, '$1');

// The closest word within `max`. A tie is settled only when one candidate is the
// same word with a letter doubled or not ("slep" -> sleep, not step; "jobb" -> job),
// or the rest are just it with an ending ("job", "jobs"). Otherwise: `tie`.
function closest(w: string, list: string[], max: number): { word: string; d: number } | 'tie' | null {
  let best: string[] = [];
  let bestD = max + 1;
  for (const x of list) {
    // Two letters off only counts when the first letter is right.
    if (Math.abs(x.length - w.length) > max || (x[0] !== w[0] && (max > 1 || x[1] !== w[1]))) continue;
    const d = distance(w, x, max);
    if (d < bestD) (best = [x]), (bestD = d);
    else if (d === bestD && d <= max) best.push(x);
  }
  if (!best.length) return null;
  if (best.length === 1) return { word: best[0], d: bestD };
  const doubled = best.filter((x) => squeeze(x) === squeeze(w));
  if (doubled.length === 1) return { word: doubled[0], d: bestD };
  const short = [...best].sort((a, b) => a.length - b.length)[0];
  if (best.every((x) => x === short || /^(?:s|es|d|ed|ing)$/.test(x.slice(short.length)) && x.startsWith(short))) return { word: short, d: bestD };
  return 'tie';
}

export type Fix = { from: string; to: string; sure: boolean };
export type Spelled = { sure: string; all: string; fixes: Fix[] };

// `skip`: names and their own words to leave alone.
export function spellFix(text: string, skip: string[] = []): Spelled {
  const leave = new Set(skip.flatMap((s) => tokensOf(s)));
  const fixes: Fix[] = [];
  const fixWord = (raw: string): { sure: string; all: string } => {
    const w = raw.toLowerCase().replace(/[’']/g, '');
    const same = { sure: raw, all: raw };
    if (!/^[a-z]+$/.test(w) || leave.has(w)) return same;
    const m = MISSPELLED[w];
    if (m) {
      if (m !== w) fixes.push({ from: raw, to: m, sure: true });
      return { sure: m, all: m };
    }
    if (w.length < 4) return same;
    if (known(w) || isTownWord(w)) return same;
    // Repeated letters for feeling ("sooo", "pleaseee") are fine once squeezed.
    const squeezed = w.replace(/([a-z])\1{2,}/g, '$1');
    if (squeezed !== w && known(squeezed)) return same;
    const { app, all } = vocab();
    const mine = closest(w, app, w.length >= 7 ? 2 : 1);
    // Two of her words fit equally ("evcited": evicted or excited?): leave it.
    if (mine === 'tie') return same;
    if (mine) {
      const sure = mine.d === 1;
      fixes.push({ from: raw, to: mine.word, sure });
      return { sure: sure ? mine.word : raw, all: mine.word };
    }
    if (w.length >= 5) {
      const any = closest(w, all, 1);
      if (any && any !== 'tie') {
        fixes.push({ from: raw, to: any.word, sure: false });
        return { sure: raw, all: any.word };
      }
    }
    return same;
  };
  let sure = '';
  let every = '';
  for (const part of text.split(/([A-Za-z’']+)/)) {
    if (/^[A-Za-z’']+$/.test(part)) {
      const f = fixWord(part);
      sure += f.sure;
      every += f.all;
    } else {
      sure += part;
      every += part;
    }
  }
  return { sure, all: every, fixes };
}

// "Did you mean “sponsor”?"
export const didYouMean = (fixes: Fix[]) => {
  const ws = fixes.filter((f) => !f.sure).map((f) => `“${f.to}”`);
  return `Did you mean ${ws.length > 2 ? `${ws.slice(0, -1).join(', ')} and ${ws[ws.length - 1]}` : ws.join(' and ')}?`;
};
