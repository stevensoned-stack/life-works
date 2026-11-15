/**
 * Zoey's voice in a web browser (the web demo; the phone app uses expo-speech).
 *
 * Ed, 2026-11-15: "when I click on the askzoey she didn't talk in the beginning".
 * Browsers only let a page talk after the person has tapped it, and Safari (Mac
 * and iPhone) wants the first words started inside a tap. The opening greeting
 * came after the forecast wait and an async voice lookup, outside any tap, so it
 * could be silently dropped. Three fixes here:
 *
 * 1. `unlockOnFirstTap`: the first tap or key anywhere on the page (the consent
 *    screen, Get started, the AskZoey button) says a silent word. After that the
 *    browser lets her talk any time, so the greeting plays when it shows.
 * 2. `speak`: talks straight to the browser, with no waiting. expo-speech's web
 *    speak looks the voice list up again before every sentence, and that lookup
 *    never answers if the list is still empty.
 * 3. If the browser still won't let her talk (an error, or no sound starting in
 *    a few seconds), `onBlocked` fires, and the screen shows "Tap to hear Zoey".
 *    That tap is itself a tap, so it always works.
 */
import { pickVoice, VoiceInfo } from './voice';

/** The parts of the browser's speechSynthesis this uses (a fake one in tests). */
export type Synth = {
  speak(u: Utterance): void;
  cancel(): void;
  resume?(): void;
  getVoices(): { voiceURI: string; name: string; lang: string; localService: boolean; default?: boolean }[];
  speaking?: boolean;
};
export type Utterance = {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  voice: unknown;
  onstart: ((e?: unknown) => void) | null;
  onend: ((e?: unknown) => void) | null;
  onerror: ((e?: { error?: string }) => void) | null;
};
type Env = { synth: Synth; Utter: new (text: string) => Utterance };

/** No sound by then means the browser held her back. */
export const START_MS = 3000;

function browser(): Env | null {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  if (!w?.speechSynthesis || typeof w.SpeechSynthesisUtterance !== 'function') return null;
  return { synth: w.speechSynthesis, Utter: w.SpeechSynthesisUtterance };
}

export type SpeakOpts = { rate: number; pitch: number; volume: number; language: string };
export type SpeakHooks = {
  /** Each sentence finished, was stopped, or failed. */
  onPieceDone?: () => void;
  /** The browser would not let her talk. */
  onBlocked?: () => void;
};

/** Zoey's voice from the browser's list right now (none yet: the browser's default voice). */
export function browserVoice(synth: Synth) {
  let list: ReturnType<Synth['getVoices']> = [];
  try {
    list = synth.getVoices() ?? [];
  } catch {
    list = [];
  }
  const infos: VoiceInfo[] = list.map((v) => ({
    identifier: v.voiceURI,
    name: v.name,
    language: v.lang,
    localService: v.localService,
  }));
  const pick = pickVoice(infos);
  return pick ? list.find((v) => v.voiceURI === pick.identifier) ?? null : null;
}

export function webSpeech(env: Env | null = browser(), later: (f: () => void, ms: number) => unknown = setTimeout) {
  let unlocked = false;

  /** A silent word, inside a tap, so the browser lets her talk from now on. */
  function unlock() {
    if (!env || unlocked) return;
    try {
      const u = new env.Utter(' ');
      u.volume = 0;
      u.onstart = u.onend = u.onerror = null;
      env.synth.speak(u);
      unlocked = true;
    } catch {
      // Not allowed yet; the next tap tries again.
    }
  }

  /** Listens for the first tap or key on the page, and unlocks her voice then. */
  function unlockOnFirstTap(doc: { addEventListener: Function; removeEventListener: Function } | null = typeof document !== 'undefined' ? document : null) {
    if (!env || !doc) return;
    const kinds = ['click', 'touchend', 'keydown'];
    const go = () => {
      unlock();
      if (unlocked) kinds.forEach((k) => doc.removeEventListener(k, go, true));
    };
    kinds.forEach((k) => doc.addEventListener(k, go, true));
  }

  /**
   * Says each piece in order, right now. Returns false when this browser can't talk.
   * `onBlocked` fires once if the browser refuses or no sound starts in START_MS.
   */
  function speak(pieces: string[], opts: SpeakOpts, hooks: SpeakHooks = {}): boolean {
    if (!env || !pieces.length) return false;
    const { synth, Utter } = env;
    // Chrome can be left paused after a tab was hidden; this un-sticks it.
    try {
      synth.resume?.();
    } catch {}
    const voice = browserVoice(synth);
    let started = false;
    let blocked = false;
    const block = () => {
      if (started || blocked) return;
      blocked = true;
      try {
        synth.cancel();
      } catch {}
      hooks.onBlocked?.();
    };
    pieces.forEach((text, i) => {
      const u = new Utter(text);
      u.lang = opts.language;
      u.rate = opts.rate;
      u.pitch = opts.pitch;
      u.volume = opts.volume;
      try {
        if (voice) u.voice = voice;
      } catch {
        // Not one of this browser's voices after all: its default voice is fine.
      }
      u.onstart = () => {
        started = true;
      };
      u.onend = () => hooks.onPieceDone?.();
      u.onerror = (e) => {
        hooks.onPieceDone?.();
        // "not-allowed": no tap yet. Others ("interrupted", "canceled") are a new reply cutting in.
        if (i === 0 && e?.error === 'not-allowed') block();
      };
      synth.speak(u);
    });
    later(() => {
      // Still waiting in line behind earlier words is not blocked.
      if (!started && !blocked && !synth.speaking) block();
    }, START_MS);
    return true;
  }

  return { available: !!env, unlock, unlockOnFirstTap, speak, get unlocked() { return unlocked; } };
}
