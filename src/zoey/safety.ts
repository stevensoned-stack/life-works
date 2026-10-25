// Layer 1 (Safety) from the build plan, section 04: a deterministic screen that
// runs before anything else on every free-text turn. It does not assess or
// score the person; it only decides whether to interrupt with crisis resources.
// Tuned toward false positives on purpose. These patterns are a starting point
// and must be reviewed by a crisis-response clinician before any real use. A
// pattern list will always miss phrasings; the plan's server-side classifier is
// the real answer, this is the floor that works offline.
//
// Tiers, checked in this order:
//   crisis/medical      overdose, ingestion, not breathing: full-screen, 911 first
//   crisis/psychiatric  suicide, self-harm, methods, harm to others: full-screen, 988 first
//   urgent/abuse        violence or assault disclosed: 911, hotlines, coordinator
//   urgent/withdrawal   withdrawal or detox: 911 if severe, coordinator, helpline
//   check               ambiguous ("i'm done"): Zoey asks "are you safe right now?"
//   urgent/housing      homeless, evicted, nowhere to sleep: coordinator and 211
//   urgent/someone      worried about someone else's safety: 988 together, 911
//   urgent/pregnant     pregnant and using: doctor today, 911 if severe
//   urgent/using        about to use, using alone, just bought drugs: don't use alone

export type SafetyResult =
  | { kind: 'crisis'; variant: 'psychiatric' | 'medical'; matched: string }
  | { kind: 'urgent'; variant: 'withdrawal' | 'abuse' | 'housing' | 'someone' | 'pregnant' | 'using'; matched: string }
  | { kind: 'check'; matched: string }
  | { kind: 'none' };

// ---------------------------------------------------------------------------
// Normalising: lowercase, fold accents (so Spanish works), expand "OD'd",
// drop apostrophes ("can't" -> "cant"), squash stretched letters ("dieee"),
// then correct near-miss spellings of the words the patterns depend on.

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n', à: 'a', è: 'e', ì: 'i', ò: 'o', ù: 'u' };

// Words the patterns lean on. A typed word one letter off from one of these
// (missing, extra, wrong or swapped) is read as that word.
const VOCAB = [
  'myself', 'suicide', 'suicidal', 'overdose', 'overdosed', 'overdosing', 'breathe', 'breathing',
  'unalive', 'unalived', 'withdrawal', 'withdrawals', 'withdrawing', 'detoxing', 'seizure',
  'seizures', 'hopeless', 'homeless', 'swallowed', 'tylenol', 'anymore', 'without', 'responding', 'suboxone',
  'methadone', 'molested', 'assaulted', 'quiero', 'matarme', 'morir',
];
// Real words that sit one letter from a VOCAB word and must stay as they are.
const KEEP = new Set(['overdone', 'breath', 'breathy', 'breather', 'mores', 'moris', 'quieto']);

function nearMiss(a: string, b: string) {
  // Optimal string alignment distance <= 1, without building the full table.
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // one substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // one swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // one insert/delete
}

function correct(word: string) {
  if (word.length < 5 || KEEP.has(word) || VOCAB.includes(word)) return word;
  return VOCAB.find((v) => nearMiss(word, v)) ?? word;
}

export function normalize(text: string) {
  const s = text
    .toLowerCase()
    .replace(/[áéíóúüñàèìòù]/g, (c) => ACCENTS[c] ?? c)
    .replace(/\bo\.?d\.?(?:['’`]d|ed)\b/g, ' overdosed ')
    .replace(/\bo\.?d\.?(?:['’`]?ing|['’`]in)\b/g, ' overdosing ')
    .replace(/\bo\.d\.?(?=\s|$)/g, ' overdose ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])\1{2,}/g, '$1')
    .trim()
    .split(' ')
    .map(correct)
    .join(' ')
    .replace(/\bmy self\b/g, 'myself')
    .replace(/\bover (dos(e|ed|es|ing))\b/g, 'over$1')
    .replace(/\bi m\b/g, 'im')
    // Misspelled "die" and "dying" (Ed, 2026-10-24: "dyeing" got "thanks for
    // telling me"). Hair and clothes dye stays dye.
    .replace(/\b(dyeing|dieing|dyin|dyng|diyng|dyign|dyinng)\b(?! (my|your|her|his|their|our|the|it|this|that|them|hair|beard|some|a|clothes|shirts?|eggs|fabric|jeans|stuff)\b)/g, 'dying')
    .replace(/(\b\w+ )?\b(dye|diee|dei)\b(?! (my|your|her|his|their|our|the|it|this|that|them|hair|beard|some|a|clothes|shirts?|eggs|fabric|jeans|stuff)\b)/g, (m, prev?: string) => (prev && /^(hair|box|food|fabric|tie|clothes|clothing|easter|egg|eggs|natural|black|blue|red) $/.test(prev) ? m : `${prev ?? ''}die`));
  return ` ${s} `;
}

// ---------------------------------------------------------------------------
// Patterns. Each runs against the normalised text, so only [a-z0-9 ] appear.

// A function rule returns the words it matched, or null.
type Rule = RegExp | ((norm: string) => string | null);

const DRUG = '(pills?|meds|medications?|medicine|tablets?|capsules?|tylenol|advil|aleve|ibuprofen|acetaminophen|aspirin|sleeping pills|benzos?|xanax|klonopin|ativan|valium|percocets?|oxys?|oxycodone|oxycontin|vicodin|fent|fentanyl|heroin|dope|ambien|seroquel|trazodone|gabapentin|insulin|prescriptions?|suboxone|methadone|antidepressants?|lithium)';
const USE = '(relapsed|relapse|used|using|high|drank|drinking|drunk|withdrawal|detoxing|detox|dope|fent|fentanyl|heroin|pills|overdosed|overdose)';
const PERSON =
  '(he|she|they|hes|shes|theyre|him|her|them|friend|someone|somebody|boyfriend|girlfriend|roommate|brother|sister|mom|dad|son|daughter|baby|husband|wife|partner|guy|man|person|cousin|bf|gf)';

const EDUCATIONAL =
  /^ (what|how|where|when|is|are|can|does|do) .*\b(signs|symptoms|look like|prevent|avoid|recognize|spot|tell if|know if|narcan|naloxone|test strips?)\b/;

const MEDICAL: Rule[] = [
  // The word itself, unless it is plainly a question about the topic ("what are
  // the signs of an overdose"), which gets the library answer with a 911 button.
  (n) => (EDUCATIONAL.test(n) ? null : (n.match(/\b(overdos(e|ed|es|ing)|od)\b/)?.[0] ?? null)),
  /\bsobredosis\b/,
  // ingestion: a dangerous amount of something, taken or swallowed
  (n) => {
    if (!/\b(took|take|taken|taking|swallowed|swallow|ate|downed|popped|shot|snorted|did|used)\b/.test(n)) return null;
    const strong =
      n.match(/\b(swallowed|downed|popped|took|taken) (a |the |an )?(whole |entire |full )?(bottle|handful|pack|packet|box|sheet|strip|bag)\b/) ??
      n.match(/\b(took|taken|taking|swallowed|popped|ate|did|used) (way )?too (many|much)\b/);
    if (strong) return strong[0];
    // "took all my meds this morning" is ordinary adherence, not ingestion
    if (/\btook (all )?(of )?my (meds|medications?|pills|medicine) (today|this morning|tonight|this evening|on time|already|for the day|like)\b/.test(n)) return null;
    return n.match(new RegExp(`\\b(all|the rest|a whole|the whole|whole|entire|everything|a bunch|a lot|lots|a handful)\\b(?: of)?(?: my| the| his| her| those| these| a)? (?:\\w+ )?${DRUG}\\b`))?.[0] ?? null;
  },
  /\b(cant|can not|cannot|couldnt|could not|unable to|hard to|trouble|struggling to|no puedo) (breathe|breath|breathing|respirar)\b/,
  new RegExp(
    `\\b${PERSON}( \\w+){0,2} (is |s |was |has )?(not|isnt|wasnt|wont|will not|stopped|cant|can not|cannot|hasnt) (breathing|breathe|wake|waking|respond|responding)\\b(?! to (my |our |your )?(texts?|calls?|messages?|emails?))`,
  ),
  new RegExp(`\\b(cant|can not|cannot|couldnt) wake ${PERSON}\\b`),
  /\b(not|no longer|stopped) breathing\b/,
  /\bno respira\b/,
  /\bunresponsive\b/,
  /\b(seizure|seizures|seizing|convulsing|convulsions)\b/,
  /\bchest (pain|hurts|is tight|tightness)\b/,
  /\b(passing|passed|pass) out\b/,
  /\bfainted\b/,
  /\b(turning|turned|going|lips are|lips) (blue|gray|grey)\b/,
  /\bblue lips\b/,
  /\b(throwing up|vomiting|puking|coughing up) blood\b/,
  // fear of dying around use: "i relapsed and im scared ill die"
  (n) =>
    new RegExp(`\\b${USE}\\b`).test(n)
      ? (n.match(/\b(ill|i will|im going to|im gonna|i might|i could|gonna|going to|might|could|will) die\b/)?.[0] ?? null)
      : null,
];

// Added to MEDICAL after the clinician review pack (G6, G8).
MEDICAL.push(
  // a large amount of alcohol at once
  /\b(drank|drunk|downed|chugged|finished|killed) (a |an |the )?(whole |entire |full )?(bottle|fifth|handle|pint|liter|litre|case|box of wine)\b(?! of (water|soda|pop|juice|milk|gatorade|tea|coffee|lemonade))/,
  // sick after using: could be an overdose
  /\b(used|relapsed|got high|was high|shot up|snorted|smoked|drank|been using|was using)( (last night|today|tonight|earlier|this morning|again|yesterday|an hour ago|a few hours ago))?( and| but| now)* (i )?(now )?(feel|feeling|felt|am|im|getting) (really |so |very |super )?(sick|ill|dizzy|faint|like im dying|like i might die|like i could die)\b/,
);

const PSYCH: Rule[] = [
  /\b(kill|killing|killed|kil) myself\b/,
  /\bkms\b/,
  // passive wish not to wake (review pack G1)
  /\b(wish|want|wanna|hope|hoping|pray|praying|rather|like to)\b.*\b(never|not|wouldnt|dont|didnt have to) wake up\b(?! (so |this |too )?(early|late|on time|in time|tired|sore|sick))/,
  /\bgo to sleep and (never|not) wake up\b/,
  // a plan (G3): on its own, or a plan to die
  /^ (i )?(have|got|made|ive got|ive made|i ve got) a plan( now| tonight| today| to do it| for tonight)? $/,
  /\b(have|got|made) a plan to (die|end it|end my life|kill myself|do it|hurt myself)\b/,
  // voices telling them to do something
  /\bvoices? (are |keep )?(telling|tell|told|telling) me to\b/,
  /\bsuicid\w*/,
  /\bunaliv\w*/,
  /\b(want|wanna|wanted|wish|ready|going|gonna|plan|planning|trying|try|tried|need|deserve) (to )?die\b/,
  /\b(want|wanna|going|gonna|ready|planning|plan|thinking about|think about|about|trying|try) (to )?end (it|it all|everything|myself|my life|me)\b(?! with)/,
  /\bend (it all|my life|myself|my own life)\b/,
  /\btake my own life\b/,
  /\b(want|wanna|going|gonna|thinking about|plan|planning|about|try|trying) to take my life\b(?! back)/,
  /\bwish i (was|were|wasnt|werent) (dead|alive|here|born|never born|gone)\b/,
  /\b(want|wanna|wanted|wish|ready|rather|prefer|deserve) (to )?(be|being) dead\b/,
  /\bmight as well (be dead|die)\b/,
  /\bwish i (was|were|had been) never born\b/,
  /\bbetter off (dead|without me|if i (was|were) (dead|gone))\b/,
  /\bbetter (off )?without me\b/,
  /\b(nobody|no one|noone) would (miss|care|notice) (me|if i)\b/,
  /\b(dont|do not|dont really|no longer|never) (want|wanna) (to )?(live|be alive|be here|exist|wake up|keep going|keep living|go on)\b/,
  /\bnot (want|wanna) (to )?(live|be alive|wake up)\b/,
  /\bno (reason|point) (to|in) (live|living|going on|being alive|be alive|keep going|stay alive|staying alive)\b/,
  /\b(tired|sick) of (living|being alive|life)\b/,
  /\bfeel(ing)? like (dying|i want to die|ending it|killing myself)\b/,
  /\b(hang|hanging|hung|shoot|shooting|shot|stab|stabbing|drown|drowning|burn|burning|poison|poisoning|starve|starving|suffocate|suffocating|strangle|electrocute|hurt|hurting|harm|harming|cut|cutting|kill|killing) myself\b/,
  /\bself ?harm\w*/,
  /\bcut(ting)? (my )?(wrists?|arms?|legs?|thighs?)\b/,
  /\bslit (my )?(wrists?|throat)\b/,
  /\bnoose\b/,
  /\bjump(ing)? (off|from|in front of) (a |the |my |this |that )?(bridge|building|roof|cliff|train|car|truck|bus|balcony|overpass|window|ledge|parking garage)\b/,
  /\b(gun|rope|razor|blade|pills) (to|so i can) (kill|end|shoot|hang|die)\b/,
  // explicit danger
  /\b(im|i am|i feel|feeling) (not|really not|so not) safe\b/,
  /\bi (dont|do not) feel safe\b/,
  /\bnot safe (right now|tonight|anymore|with myself|alone)\b/,
  /\bi need help (now|right now|asap|immediately|please)\b/,
  // harm to others
  /\b(want|wanna|going|gonna|about|ready|could|will|ill|might|thinking about|plan|planning) (to )?(kill|murder|stab|shoot|strangle) (him|her|them|someone|somebody|people|everyone|everybody|my \w+)\b/,
  /\b(want|wanna|going|gonna|about|ready|will|ill|thinking about|plan|planning) (to )?hurt (him|her|them|someone|somebody|people|everyone|everybody)\b(?! feelings)/,
  /\b(kill|murder|stab) (him|her|them|someone|somebody|everyone|everybody)\b/,
  // Spanish
  /\b(quiero|quisiera|voy a|me voy a) (morir|morirme|matarme|suicidarme)\b/,
  /\bme (quiero|voy a) (matar|morir|suicidar)\b/,
  /\bno quiero (vivir|seguir viviendo|estar aqui)\b/,
  /\bquitarme la vida\b/,
  /\bhacerme dano\b/,
];

const ABUSE: Rule[] = [
  new RegExp(`\\b${PERSON}( \\w+){0,2} (hits|hit|beats|beat|punched|punches|punch|chokes|choked|strangled|strangles|kicked|kicks|slapped|slaps|hurts|raped|rapes|abuses|abused|molested|touched|threatens|threatened|pushed|shoved) (me|on me)\\b(?! (up|to|into|at|in|back|around|out|off))`),
  /\b(raped|rape|sexually assaulted|sexual assault|molested|assaulted|trafficked|trafficking)\b/,
  /\b(being|was|been|getting|got) (abused|beaten|beat up)\b/,
  /\bdomestic (violence|abuse)\b/,
  new RegExp(`\\b(afraid|scared|terrified) (of|to go home|to go back)( to)? (my )?${PERSON}\\b`),
  /\b(going to|gonna|threatened to|threatens to|says hell|said hed|says shell|said shed) (kill|hurt|beat) me\b/,
  /\b(said|says|told me|keeps saying) (he|she|they)( would| will| wants to| was going to| is going to| is gonna| was gonna| wanted to)? (kill|hurt|beat|shoot|stab) me\b/,
  /\b(he|she|they) (wants|want|wanted) to (kill|hurt|beat|shoot|stab) me\b/,
  /\bme (pega|golpea|violo|violaron)\b/,
];

const WITHDRAWAL: Rule[] = [
  /\bwithdraw(al|als|ing)\b/,
  /\bdetox\w*/,
  /\bdope ?sick\b/,
  /\b(the shakes|im shaking|i am shaking|hands are shaking|shaking so bad|tremors?|trembling)\b/,
  /\b(dts|delirium)\b/,
  /\bhallucinat\w*/,
  /\bseeing things\b/,
  /\bcold turkey\b/,
  /\b(sweating|sweats) and (shaking|vomiting|throwing up)\b/,
  /\b(quit|quitting|stop|stopping|stopped|come off|coming off|came off|get off|getting off|got off|taper|tapering|ran out of|run out of|out of) (\w+ ){0,2}(benzos?|xanax|klonopin|ativan|valium|suboxone|subs|subutex|methadone|bupe|buprenorphine|sublocade|gabapentin|librium)\b/,
];

// Losing housing is a relapse risk and often a same-day emergency, so it goes
// ahead of library answers. Typos are spelled out here because the words are
// short or common enough that one-letter correction would misfire.
const HOUSING: Rule[] = [
  /\b(home?le?s+(ness)?|unhoused|houseless)\b/,
  /\bev\w{0,2}ct(ed|ion|ions|ing|s)?\b/,
  /\bnotice to (vacate|quit)\b/,
  /\b(3|5|7|10|14|30|three|five|seven|ten|thirty) day notice\b/,
  /\b(kicked|kick|kicking|thrown|threw|throw|throwing|put|putting) (me |us )?out\b(?! of (class|school|the game|the meeting|the group|the chat|work|practice|the store|the bar))/,
  /\bno ?(where|place|home) to (stay|go|sleep|live|crash)\b/,
  /\b(dont|do not|dont even) have (a place|anywhere|a home|a bed|a roof|somewhere|any place)( over my head)?( to (stay|go|sleep|live|crash))?\b/,
  /\b(lost|losing|lose|gonna lose|going to lose) (my|our) (housing|apartment|place|home|room|house|lease|bed)\b(?! (in|keys|key))/,
  /\b(have|got|need) to (be out|move out|get out of (my|the|this|our) (apartment|place|house|room|home))\b/,
  /\b(on the street|on the streets|outside) (tonight|right now|now)\b/,
  /\b(living|live|sleeping|sleep|slept|staying|stay) (on|in) the streets?\b/,
  /\b(sleeping|sleep|slept|staying|living|live) (outside|outdoors|in (my|a|the|our) (car|truck|van|tent|park|station|bus station|train station|laundromat))\b/,
  /\b(sleeping|sleep|slept|crashing|crash) on (a|the|someones|my friends|friends|peoples|my cousins|a friends) (couch|couches|floor|bench)\b/,
  /\bcouch ?surf\w*/,
  /\b(cant|cannot|can not|couldnt|unable to) (pay|make|afford) (my |the |our )?rent\b/,
  /\bbehind on (my |the |our )?rent\b/,
  /\b(landlord|lease)\b.*\b(notice|out|kick|kicking|lock|locked|evict\w*)\b/,
  /\b(nearest|homeless|emergency|a|the|any|youth|womens|family) shelter\b(?! (dog|cat|pet|animal)s?)/,
  /\bshelter (tonight|bed|beds|near)\b/,
  /\b(aging|aged|age) out\b/,
  // Spanish
  /\b(desaloj\w*|sin hogar|sin casa|indigente)\b/,
  /\bme (echaron|corrieron|van a echar|quieren echar)\b/,
  /\bno tengo (donde|a donde|adonde) (dormir|vivir|ir|quedarme)\b/,
  /\b(vivo|duermo|dormi|estoy viviendo|estoy durmiendo) en (la calle|mi carro|el carro|mi coche|el coche|un carro)\b/,
];

// Worried about someone else (review pack G12): help them reach 988 together.
const SOMEONE: Rule[] = [
  new RegExp(
    `\\b(${PERSON}|my \\w+)( \\w+){0,3} (is |keeps |has been |was |s |been )?(talking about|talks about|talked about|saying|says|said|thinking about|thinks about|wants to|threatening to|threatened to|posted about|texted me about|texting about|tried to|trying to|going to|gonna) (suicide|suicidal|killing (himself|herself|themselves|themself)|kill (himself|herself|themselves|themself)|hurting (himself|herself|themselves)|hurt (himself|herself|themselves)|dying|die|end (it|his life|her life|their life)|ending (it|his life|her life|their life))\\b`,
  ),
  /\b(worried|scared|afraid) (about|for) (my \w+|him|her|them|someone|a friend)\b.*\b(suicid\w*|kill (himself|herself|themselves)|hurt (himself|herself|themselves)|end (his|her|their) life)\b/,
  /\b(he|she|they|my \w+) (is|s|seems|might be|may be) suicidal\b/,
];

const USE_WORDS = '(using|used|use|drinking|drank|high|relapsed|relapsing|drugs|fent|fentanyl|heroin|dope|meth|pills|smoking|shooting up)';

// Pregnant and using (G10): don't stop some drugs suddenly without a doctor.
// Only the person themselves ("im pregnant"), not "my sister is pregnant".
const SELF_PREGNANT = /(^ |\b(im|i am|i might be|i could be|i think im|found out im|found out i am|i was|i just)\b( \w+){0,3} )(pregnant|expecting|having a baby)\b/;
const PREGNANT: Rule[] = [
  (n) => {
    const m = n.match(SELF_PREGNANT);
    return m && new RegExp(`\\b${USE_WORDS}\\b`).test(n) ? m[0] : null;
  },
];

// "i dont want to use tonight" is a good sign, not an overdose risk.
const NEGATED = /\b(not|dont|do not|never|wont|will not|didnt|did not|no longer|refuse to|trying not to)( (?!sure\b|but\b|im\b|i\b|know\b|care\b|lie\b)\w+){0,3} $/;
const unlessNegated = (re: RegExp): Rule => (n) => {
  const m = n.match(re);
  return m && !NEGATED.test(n.slice(0, m.index!)) ? m[0] : null;
};

// About to use, using alone, or just got drugs (G4, G5, G7). Overdose risk.
// "I want to use" is a craving and gets the craving answer; these are plans.
const USING: Rule[] = [
  unlessNegated(/\b(using|use|get high|getting high|shoot up|shooting up|drinking) (alone|by myself|on my own)\b/),
  unlessNegated(/\b(im|i am|im gonna|im going to|going to|gonna|about to|plan to|planning to|i will|ill|need to|have to|i might|might|probably gonna|probably going to) (use|get high|shoot up|relapse|go use|go get high|go score|score|cop)\b( (tonight|today|again|now|right now|so bad|after work|this weekend))*(?= $| and| but| because| cause| i)/),
  unlessNegated(/\b(im gonna|im going to|going to|gonna|about to) (drink|get drunk|go drinking)( (tonight|today|again|now|right now|so bad))+\b/),
  unlessNegated(/\b(im|im gonna|im going to|going to|gonna|about to) get drunk\b/),
  unlessNegated(/\b(using|drinking) (again )?(tonight|today|right now)\b/),
  unlessNegated(/\b(bought|buy|buying|got|scored|score|copped|cop|picked up|pick up|grabbed|have|got some) (some |a |a bag of |a gram of |a point of |a few )?(fent|fentanyl|heroin|dope|meth|crack|cocaine|blues|percs|bars|xans|pressies|pressed pills)\b(?= $| (and|from|off|tonight|today|again|earlier|just|but|so|to)\b)/),
];

const CHECK: Rule[] = [
  // "I'm dying" may be pain, panic or a wish: ask (and the "No" answer opens 988 and 911).
  /\b(im|i am|i feel like im|feel like im|i think im|i feel like i am|i think i am)( literally| actually| really| slowly| just)? dying\b(?! (laughing|of laughter|lol|lmao|haha|to|for|over|of embarrassment|of boredom|of cuteness)\b)/,
  /^ dying $/,
  // "die" or "dye" anywhere ("dye", "i will dye", "im about to die") is a
  // danger word (Ed, 2026-10-24): ask, with concern. Only plain idioms and hair
  // or clothes dye (left as "dye" by normalize) are let through.
  /\bdie\b(?! (of|from) (laughter|laughing|embarrassment|boredom|cuteness|shame)\b| laughing\b| hard\b| is cast\b| for (a|some|that|this|it)\b)/,
  // review pack G2, G9, G11
  /\b(im|i am|i feel like|feel like|i feel|i'm just) (a |such a |just a |nothing but a )?burden\b/,
  /\bburden (to|on) (everyone|everybody|my family|them|you|people)\b/,
  /\bcant stop crying\b/,
  // "I'm so tired of everything" (2026-10-25 review): hopelessness, not sleep. Clinician review.
  /\btired of (everything|it all|all of it|life|trying|fighting)\b(?! (at|about) (work|school|the house)\b)/,
  /\bcrying (all day|all night|nonstop|non stop)\b/,
  /\b(hear|hearing|heard) voices\b/,
  // "I'm done for the day" / "done with work" is the end of a day, not giving up (2026-10-25).
  /\b(im|i am) (so )?done\b(?! (for (the day|today|tonight|the night|the week)|with (work|school|class|my shift|my day|the day|today|chores|my homework|homework)|eating)\b)/,
  /\bcant do this( anymore)?\b/,
  /\bcant (go on|keep going|take (it|this|much more))\b/,
  /\bno point\b/,
  /\bwhats the point( anymore| of (living|anything|trying|it all|life|going on))? $/,
  /\bgiv(e|ing) up\b/,
  /\bhopeless\b/,
  // Zoey asks "what gives you hope?" (faith follow-up), so a no-hope answer must be caught.
  /\b(i have|ive got|i got|theres|there is|i see|ive lost all|lost all|i dont have any|i dont have) no hope\b/,
  /\b(ive lost|i lost|lost) (all )?(my )?hope\b/,
  /\bnothing (gives me|brings me) hope\b/,
  /\bno hope (left|for me|anymore)\b/,
  /\bnothing matters\b/,
  /\bno way out\b/,
  /\bhate my life\b/,
  /\b(want|wanna) to disappear\b/,
  /\bworthless\b/,
  // "Am I a burden?", "am I too far gone?" (Oct 2026, self-worth questions; clinician review in TODO.md).
  /\bam i (?:just )?(?:a |such a )?burden\b/,
  /\b(?:am i|im|i am) (?:too far gone|a lost cause|beyond (?:help|saving)|unlovable)\b/,
  /\bme quiero rendir\b/,
];

function first(rules: Rule[], norm: string) {
  for (const r of rules) {
    if (typeof r === 'function') {
      const hit = r(norm);
      if (hit) return hit.trim();
    } else {
      const m = norm.match(r);
      if (m) return m[0].trim();
    }
  }
  return null;
}

export function screen(text: string): SafetyResult {
  const norm = normalize(text);
  let m: string | null;
  if ((m = first(MEDICAL, norm))) return { kind: 'crisis', variant: 'medical', matched: m };
  // Someone else at risk, unless the person is also talking about themselves.
  if ((m = first(SOMEONE, norm))) {
    const rest = ` ${norm.replace(m, ' ').replace(/\s+/g, ' ').trim()} `;
    const self = first(PSYCH, rest);
    if (self) return { kind: 'crisis', variant: 'psychiatric', matched: self };
    return { kind: 'urgent', variant: 'someone', matched: m };
  }
  if ((m = first(PSYCH, norm))) return { kind: 'crisis', variant: 'psychiatric', matched: m };
  if ((m = first(ABUSE, norm))) return { kind: 'urgent', variant: 'abuse', matched: m };
  if ((m = first(PREGNANT, norm))) return { kind: 'urgent', variant: 'pregnant', matched: m };
  if ((m = first(WITHDRAWAL, norm))) return { kind: 'urgent', variant: 'withdrawal', matched: m };
  if ((m = first(USING, norm))) return { kind: 'urgent', variant: 'using', matched: m };
  if ((m = first(CHECK, norm))) return { kind: 'check', matched: m };
  if ((m = first(HOUSING, norm))) return { kind: 'urgent', variant: 'housing', matched: m };
  return { kind: 'none' };
}
