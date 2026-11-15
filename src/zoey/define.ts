// "What does weak mean?" (Ed, 2026-10-25: "I asked Zoey if she knew what the word
// weak means and she went off in a different direction saying tell me more").
// A short, plain definition from an on-device dictionary: recovery words written
// by hand, everyday words from WordNet. Words people often ask about when they
// feel that way (weak, alone, worthless) get a gentle "is that how you're
// feeling?". The safety screen runs before any of this.
//
// WordNet 3.0 Copyright 2006 by Princeton University. All rights reserved.
// THIS SOFTWARE AND DATABASE IS PROVIDED "AS IS" AND PRINCETON UNIVERSITY MAKES NO
// REPRESENTATIONS OR WARRANTIES, EXPRESS OR IMPLIED. BY WAY OF EXAMPLE, BUT NOT
// LIMITATION, PRINCETON UNIVERSITY MAKES NO REPRESENTATIONS OR WARRANTIES OF
// MERCHANTABILITY OR FITNESS FOR ANY PARTICULAR PURPOSE OR THAT THE USE OF THE
// LICENSED SOFTWARE, DATABASE OR DOCUMENTATION WILL NOT INFRINGE ANY THIRD PARTY
// PATENTS, COPYRIGHTS, TRADEMARKS OR OTHER RIGHTS. (Full license: THIRD_PARTY.md.)
import WORDNET from './wordnet.json';

// "a|wanting in physical strength": a = describing word, n = thing, v = action, r = adverb.
const WN = WORDNET as Record<string, string[]>;

// Recovery words, and the everyday meaning of words WordNet gets odd ("anxious"
// is "eagerly desirous" there). Plain language; clinician review in TODO.md.
export const TERMS: Record<string, string> = {
  sponsor: 'In 12-step groups like AA and NA, a sponsor is someone further along in recovery who helps you work the steps and is there to call when things get hard.',
  sponsee: 'A sponsee is the person a sponsor helps through the 12 steps.',
  relapse: 'A relapse is going back to using drugs or alcohol after a time of not using. It can happen, and it doesn’t erase your progress.',
  slip: 'A slip is a short use of drugs or alcohol after a time in recovery, often caught quickly. Telling someone soon really helps.',
  lapse: 'A lapse is a one-time use after a time in recovery, like a slip. Getting support right away can keep it from becoming a relapse.',
  sober: 'Sober means not under the influence of alcohol or drugs. In recovery it usually means not using at all.',
  sobriety: 'Sobriety means living without alcohol or drugs.',
  clean: 'Clean means not using drugs or alcohol. Life Works calls it being in recovery, and counts your days in recovery for you.',
  'clean time': 'Clean time is how long you’ve gone without using drugs or alcohol. Life Works calls it your days in recovery, counted from your recovery date.',
  'clean date': 'Your clean date is the first day you stopped using. Life Works calls it your recovery date, and counts your days in recovery from it.',
  recovery: 'Recovery is the ongoing work of living without drugs or alcohol and building a healthier life, one day at a time.',
  amends: 'Making amends means owning the harm you caused someone and doing what you can to make it right. It’s part of steps 8 and 9.',
  'higher power': 'A higher power is whatever bigger-than-yourself source of strength you choose: God, nature, your group, or something else. It’s your own idea.',
  'twelve steps': 'The 12 steps are the program AA and NA follow: admitting the problem, looking honestly at yourself, making amends, and helping others.',
  '12 steps': 'The 12 steps are the program AA and NA follow: admitting the problem, looking honestly at yourself, making amends, and helping others.',
  'step work': 'Step work is working through the 12 steps, usually with your sponsor.',
  'home group': 'A home group is the meeting you go to regularly and call your own.',
  chip: 'A chip (or coin) is a small token meetings give to mark time in recovery, like 30 days or 1 year.',
  trigger: 'A trigger is a person, place, feeling or thing that makes you want to use. Knowing your triggers helps you plan around them.',
  triggers: 'Triggers are people, places, feelings or things that make you want to use. Knowing them helps you plan around them.',
  triggered: 'Being triggered means something brought up a strong urge or feeling, like wanting to use. It’s a good moment to reach out to someone.',
  craving: 'A craving is a strong urge to use. Cravings rise and pass, usually within 15 to 30 minutes.',
  cravings: 'Cravings are strong urges to use. They rise and pass, usually within 15 to 30 minutes.',
  urge: 'An urge is a strong want to do something, like use. Urges pass if you ride them out.',
  detox: 'Detox is the first stage of stopping drugs or alcohol, when your body clears them out. It’s safest with medical help.',
  withdrawal: 'Withdrawal is how your body reacts when you stop a drug it’s used to. It can feel awful and sometimes be dangerous, so medical help matters.',
  rehab: 'Rehab is a treatment program for addiction, where you live there (inpatient) or visit during the day (outpatient).',
  inpatient: 'Inpatient treatment means you live at the treatment center for a while.',
  outpatient: 'Outpatient treatment means you go to sessions but live at home or in sober living.',
  iop: 'IOP means Intensive Outpatient Program: treatment several days a week for a few hours, while you live at home or in sober living.',
  php: 'PHP means Partial Hospitalization Program: full-day treatment on most weekdays, while you sleep at home.',
  mat: 'MAT means Medication for Addiction Treatment: medicines like buprenorphine (Suboxone), methadone or naltrexone (Vivitrol), used with counseling.',
  moud: 'MOUD means medications for opioid addiction, like buprenorphine, methadone or naltrexone.',
  suboxone: 'Suboxone is a medicine (buprenorphine and naloxone) that eases opioid cravings and withdrawal. It’s part of MAT.',
  buprenorphine: 'Buprenorphine is a medicine that eases opioid cravings and withdrawal. Suboxone is one brand.',
  methadone: 'Methadone is a medicine for opioid addiction, given daily at a clinic. It eases cravings and withdrawal.',
  vivitrol: 'Vivitrol is a monthly shot of naltrexone that blocks the effects of opioids and can cut alcohol cravings.',
  naltrexone: 'Naltrexone is a medicine that blocks the effects of opioids and can reduce alcohol cravings.',
  narcan: 'Narcan is naloxone, a nasal spray that can reverse an opioid overdose. Call 911 too.',
  naloxone: 'Naloxone (Narcan) is a medicine that can reverse an opioid overdose. Call 911 too.',
  fentanyl: 'Fentanyl is a very strong opioid. Tiny amounts can cause an overdose, and it’s often mixed into other drugs.',
  overdose: 'An overdose is taking more of a drug than your body can handle. It can stop breathing. Call 911 right away.',
  opioid: 'Opioids are drugs like heroin, fentanyl, oxycodone and morphine. They ease pain but are very addictive.',
  opioids: 'Opioids are drugs like heroin, fentanyl, oxycodone and morphine. They ease pain but are very addictive.',
  'harm reduction': 'Harm reduction means steps that make drug use less dangerous, like carrying Narcan or never using alone.',
  'sober living': 'Sober living is a shared home where everyone is in recovery and follows house rules, with support.',
  'halfway house': 'A halfway house is shared housing with rules and support, between treatment or jail and living on your own.',
  'recovery residence': 'A recovery residence is a sober living home: shared housing where everyone is in recovery and supports each other.',
  curfew: 'Curfew is the time you need to be home by.',
  ua: 'A UA is a urine analysis: a urine test for drugs or alcohol.',
  uas: 'UAs are urine tests for drugs or alcohol.',
  po: 'A PO is a probation or parole officer, the person who checks that you’re following the court’s conditions.',
  probation: 'Probation is court supervision instead of (or after) jail, with rules you must follow and check-ins with a PO.',
  parole: 'Parole is supervised release from prison before the full sentence ends, with rules and a parole officer.',
  'case manager': 'A case manager helps you connect to services like housing, benefits, health care and jobs.',
  'house manager': 'A house manager runs a sober living home day to day and makes sure house rules are followed.',
  'peer support': 'Peer support is help from someone who has been through recovery themselves.',
  'part 2': 'Part 2 is a federal privacy rule (42 CFR Part 2) that gives extra protection to addiction treatment records.',
  hipaa: 'HIPAA is a federal law that protects the privacy of your health information.',
  aa: 'AA is Alcoholics Anonymous, free meetings for people who want to stop drinking, using the 12 steps.',
  na: 'NA is Narcotics Anonymous, free meetings for people recovering from drug addiction, using the 12 steps.',
  'smart recovery': 'SMART Recovery is a free support group that uses practical tools, not the 12 steps.',
  'al anon': 'Al-Anon is a support group for family and friends of people who drink.',
  halt: 'HALT stands for Hungry, Angry, Lonely, Tired: four states that make cravings stronger. Checking them helps.',
  paws: 'PAWS is post-acute withdrawal syndrome: mood swings, poor sleep and cravings that can last months after stopping.',
  codependency: 'Codependency is putting someone else’s needs and problems ahead of your own so much that it hurts you.',
  codependent: 'Codependent means putting someone else’s needs ahead of your own so much that it hurts you.',
  enabling: 'Enabling means protecting someone from the results of their using, which can make it easier to keep using.',
  boundary: 'A boundary is a limit you set to protect yourself, like what you will and won’t accept from others.',
  boundaries: 'Boundaries are limits you set to protect yourself, like what you will and won’t accept from others.',
  'dual diagnosis': 'It means having both a mental health condition and an addiction at the same time.',
  serenity: 'Serenity means calm and peace of mind.',
  'serenity prayer': '“God, grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to know the difference.”',
  surrender: 'In recovery, surrender means admitting you can’t beat addiction alone and accepting help.',
  acceptance: 'Acceptance means seeing things as they really are, without fighting what you can’t change.',
  resentment: 'A resentment is anger you keep holding onto about something someone did. Letting go of it is a big part of recovery.',
  gratitude: 'Gratitude means being thankful for what you have.',
  humility: 'Humility means seeing yourself honestly, without thinking you’re better or worse than anyone.',
  integrity: 'Integrity means being honest and doing what’s right, even when no one is watching.',
  humble: 'Humble means not thinking you’re better than others, and being open to help and learning.',
  honest: 'Honest means telling the truth and not hiding things.',
  honesty: 'Honesty means telling the truth, to others and to yourself.',
  willingness: 'Willingness means being open to trying something new, like taking suggestions in recovery.',
  'open minded': 'Open-minded means willing to hear new ideas.',
  denial: 'Denial means not admitting a problem is real, like telling yourself your using isn’t a big deal.',
  addiction: 'Addiction is a health condition where you keep using a substance or doing something even though it’s hurting you.',
  addict: 'An addict is a person with an addiction. Many people prefer “a person in recovery.”',
  alcoholic: 'An alcoholic is a person with an addiction to alcohol.',
  accountable: 'Being accountable means owning what you do and following through.',
  resilient: 'Resilient means able to bounce back after hard times.',
  // Everyday meaning of feeling words.
  anxious: 'Anxious means feeling worried, nervous or uneasy, often about something that might happen.',
  anxiety: 'Anxiety is a feeling of worry, nervousness or unease, sometimes with a racing heart or tight chest.',
  depressed: 'Depressed means feeling very sad, empty or hopeless for a long time, often without energy.',
  depression: 'Depression is a health condition with sadness, emptiness or loss of interest that lasts weeks or more. It’s treatable.',
  overwhelmed: 'Overwhelmed means feeling like there’s too much to handle at once.',
  weak: 'Weak means not strong: lacking physical strength or energy, or feeling like you can’t handle something.',
  alone: 'Alone means without anyone else around you.',
  lonely: 'Lonely means feeling sad because you’re alone or don’t feel close to anyone.',
  worthless: 'Worthless means having no value or use.',
  hopeless: 'Hopeless means feeling like things can’t get better.',
  useless: 'Useless means not able to help or do any good.',
  ashamed: 'Ashamed means feeling bad about yourself because of something you did or something about you.',
  shame: 'Shame is the painful feeling that something is wrong with you as a person.',
  guilt: 'Guilt is the bad feeling you get when you think you did something wrong.',
  guilty: 'Guilty means feeling bad because you think you did something wrong.',
  numb: 'Numb means not able to feel anything, in your body or in your feelings.',
  empty: 'Empty means having nothing inside. As a feeling, it means feeling hollow or like nothing matters.',
  stuck: 'Stuck means not able to move or change things.',
  trapped: 'Trapped means feeling caught with no way out.',
  burden: 'A burden is something heavy or hard to carry. It can also mean a person feeling they cause trouble for others.',
  failure: 'A failure is something that didn’t work out. It doesn’t make a person a failure.',
  broken: 'Broken means damaged or not working right.',
  lazy: 'Lazy means not wanting to work or make an effort.',
  stupid: 'Stupid means not smart or not thinking clearly.',
  ugly: 'Ugly means not pleasant to look at.',
  unloved: 'Unloved means not feeling loved by anyone.',
  unwanted: 'Unwanted means not wanted or welcome.',
  lost: 'Lost means not knowing where you are or which way to go.',
  scared: 'Scared means afraid.',
  angry: 'Angry means feeling strong upset toward someone or something.',
  sad: 'Sad means feeling unhappy.',
  tired: 'Tired means needing rest or sleep, or being worn out from something.',
  exhausted: 'Exhausted means extremely tired.',
};

// Asking about these can mean feeling them.
export const HEAVY = new Set([
  'weak', 'alone', 'lonely', 'worthless', 'hopeless', 'useless', 'ashamed', 'shame', 'guilt', 'guilty', 'numb', 'empty', 'stuck',
  'trapped', 'burden', 'failure', 'broken', 'lazy', 'stupid', 'ugly', 'unloved', 'unwanted', 'lost', 'depressed', 'depression',
  'overwhelmed', 'anxious', 'anxiety', 'scared', 'sad', 'exhausted', 'helpless', 'pathetic', 'loser', 'unlovable', 'invisible',
]);

const POS: Record<string, (g: string) => string> = {
  v: (g) => (/^(?:to|be) /.test(g) ? g : `to ${g}`),
  n: (g) => g,
  a: (g) => g,
  r: (g) => g,
};

// --- What they asked ---------------------------------------------------------

const Q = '(?:the )?(?:word |term |phrase )?["“”‘’\']?([a-z0-9][a-z0-9 \'’-]{0,24}?)["“”‘’\']?';
const ASKS = [
  new RegExp(`^(?:what|wat|wht) (?:does|do|dose|is|s) ${Q} (?:mean|means|stand for|meaning)$`),
  new RegExp(`^whats ${Q} (?:mean|means|stand for)$`),
  new RegExp(`^(?:do|did) (?:you|u|ya) (?:know|kno) what ${Q} (?:means|mean|is)$`),
  new RegExp(`^(?:can you |could you |please )?(?:tell me |explain )(?:what )?${Q} (?:means|mean)$`),
  new RegExp(`^(?:can you |could you |please )?(?:define|definition of|define the word|explain the word|meaning of|the meaning of) ${Q}$`),
  new RegExp(`^(?:what is|whats) (?:the )?(?:meaning|definition) of ${Q}$`),
  new RegExp(`^${Q} (?:meaning|definition|means what|mean what)$`),
  new RegExp(`^what (?:does it|do it) mean (?:to be|if (?:im|i am|you are|youre)|when (?:im|i am|you are|youre)) ${Q}$`),
  new RegExp(`^i dont know what ${Q} means$`),
];
const LEAD = /^(?:(?:hey|hi|ok|okay|so|um|zoey|well|and|but|also|quick question) )+/;
// "What do you mean?" and "what does that mean?" are about what Zoey said.
const NOT_A_WORD = /^(?:you|u|ya|that|this|it|thats|those|these|they|he|she|we|i|me|my|your|ur|her|his|a|an|the)$/;

export function findDefine(text: string): string | null {
  const t = text
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEAD, '');
  for (const re of ASKS) {
    const m = t.match(re);
    if (!m) continue;
    const w = m[1].replace(/["“”‘’']/g, '').replace(/^(?:a|an|the|to) /, '').trim();
    if (!w || NOT_A_WORD.test(w) || w.split(' ').length > 3) return null;
    return w;
  }
  return null;
}

// --- Looking it up -------------------------------------------------------------

// "means" -> "mean", "cravings" -> "craving", "triggered" -> "trigger".
function stems(w: string): string[] {
  const out = [w];
  const add = (x: string) => x.length > 1 && !out.includes(x) && out.push(x);
  if (w.endsWith('ies')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('es')) add(w.slice(0, -2));
  if (w.endsWith('s') && !w.endsWith('ss')) add(w.slice(0, -1));
  if (w.endsWith('ied')) add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) (add(w.slice(0, -2)), add(w.slice(0, -1)));
  if (w.endsWith('ing')) (add(w.slice(0, -3)), add(`${w.slice(0, -3)}e`));
  if (/(.)\1(?:ed|ing)$/.test(w)) add(w.replace(/(.)\1(?:ed|ing)$/, '$1'));
  if (w.endsWith('ly')) add(w.slice(0, -2));
  return out;
}

export type Definition = { word: string; text: string; heavy: boolean } | { word: string; text: null; heavy: false };

const quoteWord = (w: string) => `“${w[0].toUpperCase()}${w.slice(1)}”`;

export function define(word: string): Definition {
  const w = word.toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  const heavy = HEAVY.has(w);
  for (const s of stems(w)) if (TERMS[s]) return { word: w, text: TERMS[s], heavy };
  for (const s of stems(w.replace(/ /g, ''))) {
    const senses = WN[s];
    if (!senses) continue;
    // "(American football) a play in which…": drop the field label.
    const [first, second] = senses.map((x) => POS[x[0]](x.slice(2).replace(/^\([^)]*\)\s*/, '')));
    const end = (g: string) => (/[.…]$/.test(g) ? g : `${g}.`);
    const text = `${quoteWord(w)} means ${end(first)}${second ? ` It can also mean ${end(second)}` : ''}`;
    return { word: w, text, heavy: heavy || HEAVY.has(s) };
  }
  return { word: w, text: null, heavy: false };
}

// --- What Zoey says --------------------------------------------------------------

export const HEAVY_ASK = (w: string) =>
  `Sometimes people ask about a word like that when they’re feeling it. Are you feeling ${w} right now?`;
export const UNKNOWN = (w: string, coord: string) =>
  `I don’t know the word “${w}” yet. I’m still learning. A dictionary app can help, or you can ask ${coord}.`;
export const HEAVY_NO = 'Okay, I’m glad. If that ever changes, I’m right here. What else is on your mind?';
