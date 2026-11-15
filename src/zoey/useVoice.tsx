import * as Speech from 'expo-speech';
import React, { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import Icon from '../components/Icon';
import { useStore } from '../data/store';
import { echoGuard, forSpeech, pickVoice, SENTENCE_MAX, SPEECH, speechChunks } from './voice';

// A line Zoey shows. `quiet` lines are never read aloud: crisis, urgent and
// "are you safe?" messages stay on screen only, so nobody nearby hears them.
export type SpokenLine = { id: string; text: string; quiet?: boolean };

const QUEUE_MS = 2000;
// Shared by every screen, so two readers of the same chat never say it twice.
const isEcho = echoGuard();

let voiceId: Promise<string | undefined> | null = null;
// A browser with no speech voices never answers the voice list; give up after 2s.
const voices = () =>
  Promise.race([Speech.getAvailableVoicesAsync(), new Promise<never[]>((ok) => setTimeout(() => ok([]), 2000))]);
const zoeyVoiceOn = () =>
  (voiceId ??= voices()
    .then((vs) => {
      // Android can list no voices until its speech engine has started; look again next time.
      if (!vs.length) voiceId = null;
      return pickVoice(vs)?.identifier;
    })
    .catch(() => ((voiceId = null), undefined)));

/**
 * Reads each new Zoey line aloud while the voice setting is on. `hold` (the
 * crisis sheet is open) stops her mid-sentence and keeps her silent.
 * Lines already on screen when the voice is turned on are not read back.
 * Returns `speaking()` (is she reading out loud right now?) and `hush()` (stop now),
 * for "stop" typed while she talks (stop.ts).
 */
export function useZoeyVoice(lines: SpokenLine[], hold: boolean) {
  const on = useStore().state.settings.zoeyVoiceOn;
  const said = useRef(new Set<string>());
  // Bumped on every stop, so a line that was waiting for the voice list is dropped.
  const turn = useRef(0);
  // When the last lines were sent to the voice. Lines that follow within QUEUE_MS
  // belong to the same reply (the greeting, then a weather warning) and wait their turn.
  const lastAt = useRef(0);
  // Pieces sent to the voice and not finished yet; and when the last one should be
  // done, for browsers that never say when they finish.
  const pending = useRef(0);
  const until = useRef(0);

  useEffect(() => {
    const fresh = lines.filter((l) => !said.current.has(l.id));
    fresh.forEach((l) => said.current.add(l.id));
    if (!on || hold) return;
    const text = fresh
      .filter((l) => !l.quiet)
      .map((l) => forSpeech(l.text))
      .filter(Boolean)
      .join(' ')
      .slice(0, Speech.maxSpeechInputLength);
    if (!text) return;
    const now = Date.now();
    if (isEcho(text, now)) return;
    const sameReply = now - lastAt.current < QUEUE_MS;
    lastAt.current = now;
    // A new reply cuts off the old one; more of the same reply is queued after it.
    const mine = sameReply ? turn.current : ++turn.current;
    if (!sameReply) quiet();
    zoeyVoiceOn().then((voice) => {
      if (mine !== turn.current) return;
      for (const piece of speechChunks(text, SENTENCE_MAX)) {
        pending.current++;
        // About 2.5 words a second at her slower pace, plus a little.
        until.current = Math.max(until.current, Date.now()) + 1000 + (piece.split(/\s+/).length / 2.5) * 1000;
        const done = () => {
          if (mine === turn.current) pending.current = Math.max(0, pending.current - 1);
        };
        Speech.speak(piece, { language: 'en-US', voice, ...SPEECH, onDone: done, onStopped: done, onError: done });
      }
    });
  }, [lines, on, hold]);

  useEffect(() => {
    if (on && !hold) return;
    turn.current++;
    quiet();
  }, [on, hold]);

  useEffect(
    () => () => {
      turn.current++;
      quiet();
    },
    [],
  );

  function quiet() {
    pending.current = 0;
    until.current = 0;
    void Speech.stop();
  }
  return {
    speaking: () => on && !hold && pending.current > 0 && Date.now() < until.current,
    hush: () => {
      turn.current++;
      quiet();
    },
  };
}

/** Speaker button for the screen header: turns Zoey's voice on and off. */
export function VoiceToggle() {
  const { state, updateSettings } = useStore();
  const on = state.settings.zoeyVoiceOn;
  return (
    <Pressable
      onPress={() => updateSettings({ zoeyVoiceOn: !on })}
      hitSlop={12}
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="Zoey's voice"
      accessibilityHint={on ? 'Zoey reads her replies aloud. Tap to mute.' : 'Tap to have Zoey read her replies aloud.'}
    >
      <Icon name={on ? 'speaker' : 'speakerOff'} size={24} />
    </Pressable>
  );
}
