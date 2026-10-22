// Zoey's spoken voice: which system voice to use and what she may say aloud.
// Pure logic, no Expo imports, so it runs under `npm test`. The player is
// src/zoey/useVoice.ts.
//
// Speech is made on the phone (iOS AVSpeechSynthesizer, Android TextToSpeech).
// Voices that send the text to a cloud service (Android "-network" voices,
// browser "Online" voices) are never picked, because Zoey's words can carry
// health details.

export type VoiceInfo = {
  identifier: string;
  name: string;
  quality?: string; // 'Default' | 'Enhanced' on iOS
  language: string;
  localService?: boolean; // web only
};

// A calm, steady pace: a little slower than the system default.
export const SPEECH = { rate: 0.92, pitch: 1.0 };

// Female voices by name, best first. iOS ships Ava/Zoe/Allison/Susan/Samantha
// for en-US (premium and enhanced copies download in Settings > Accessibility >
// Spoken Content); Windows has Aria/Jenny/Zira; Chrome has "Google US English".
const FEMALE_NAMES = ['ava', 'zoe', 'allison', 'susan', 'samantha', 'nicky', 'joelle'];
const FEMALE_OTHER = ['serena', 'kate', 'stephanie', 'karen', 'moira', 'tessa', 'fiona', 'victoria', 'jenny', 'aria', 'zira', 'google us english'];

// Google's on-device en-US voices use short codes; these are female.
const ANDROID_FEMALE = ['sfg', 'iob', 'iog', 'tpc', 'tpf'];

const sendsTextAway = (v: VoiceInfo) =>
  v.localService === false || /-network$|network/i.test(v.identifier) || /\bonline\b/i.test(v.name);

const femaleRank = (v: VoiceInfo): number => {
  const name = v.name.toLowerCase();
  const id = v.identifier.toLowerCase();
  const i = FEMALE_NAMES.findIndex((n) => name === n || name.startsWith(`${n} `) || id.endsWith(`.${n}`) || id.includes(`.${n}-`));
  if (i >= 0) return i;
  const j = FEMALE_OTHER.findIndex((n) => name.includes(n) || id.endsWith(`.${n}`));
  if (j >= 0) return FEMALE_NAMES.length + j;
  const code = /^en-us-x-([a-z]{3})-/i.exec(v.identifier)?.[1]?.toLowerCase();
  if (code && ANDROID_FEMALE.includes(code)) return FEMALE_NAMES.length + FEMALE_OTHER.length + ANDROID_FEMALE.indexOf(code);
  return -1;
};

const qualityRank = (v: VoiceInfo) => {
  const id = v.identifier.toLowerCase();
  if (id.includes('premium')) return 0;
  if (v.quality === 'Enhanced' || id.includes('enhanced')) return 1;
  return 2;
};

const langRank = (v: VoiceInfo) => {
  const l = v.language.toLowerCase().replace('_', '-');
  return l === 'en-us' ? 0 : l.startsWith('en') ? 1 : 9;
};

/**
 * The best on-device female English voice, or null to let the system choose
 * (on most phones the default en-US voice is already female).
 */
export function pickVoice(voices: VoiceInfo[]): VoiceInfo | null {
  const ok = voices.filter((v) => !sendsTextAway(v) && langRank(v) < 9 && femaleRank(v) >= 0);
  ok.sort((a, b) => langRank(a) - langRank(b) || qualityRank(a) - qualityRank(b) || femaleRank(a) - femaleRank(b));
  return ok[0] ?? null;
}

/** Text tidied for speech: no links, symbols or emoji read out letter by letter. */
export function forSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[·•*_#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
