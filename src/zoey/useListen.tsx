import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import Icon from '../components/Icon';
import { colors } from '../theme';
import { withSpoken } from './voice';

// Talk instead of type (Ed, 2026-10-28). On phones the words are made on the
// phone itself (requiresOnDeviceRecognition), so no recording leaves it, the
// same rule as Zoey's own voice. A phone that can't do that gets no mic button.
// In a browser (the web preview) it is the browser's own speech recognition.
//
// The spoken words only fill the message box. The person sends them like typed
// words, so they go through the same safety check, spell fixes and learning.

type Rec = typeof import('expo-speech-recognition');
let rec: Rec | null = null;
try {
  // Expo Go has no speech recognition module; the mic just doesn't show there.
  rec = require('expo-speech-recognition') as Rec;
} catch {
  rec = null;
}

const onDevice = Platform.OS !== 'web';

function canListen(): boolean {
  try {
    const m = rec?.ExpoSpeechRecognitionModule;
    if (!m?.isRecognitionAvailable()) return false;
    return !onDevice || m.supportsOnDeviceRecognition();
  } catch {
    return false;
  }
}

/**
 * The mic for a message box. `onWords` gets the box's text as the person talks
 * (what they had typed, then their words so far). `listening` is true while
 * the mic is open, so Zoey can stay quiet.
 */
export function useListen(typed: string, onWords: (text: string) => void) {
  const [available] = useState(canListen);
  const [listening, setListening] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const base = useRef('');
  // Results that arrive after a send are dropped, so the cleared box stays clear.
  const live = useRef(false);
  const words = useRef(onWords);
  words.current = onWords;

  useEffect(() => {
    const m = rec?.ExpoSpeechRecognitionModule;
    if (!available || !m) return;
    const subs = [
      m.addListener('result', (e) => {
        const said = e.results[0]?.transcript ?? '';
        if (said && live.current) words.current(withSpoken(base.current, said));
      }),
      m.addListener('end', () => {
        live.current = false;
        setListening(false);
      }),
      m.addListener('error', (e) => {
        setListening(false);
        if (e.error === 'not-allowed') setProblem('Turn on the microphone for Life Works in your settings to talk to Zoey.');
        else if (e.error === 'language-not-supported') setProblem("Talking to Zoey needs English speech on this phone. Check your phone's voice typing settings.");
        else if (e.error !== 'no-speech' && e.error !== 'aborted') setProblem("Zoey couldn't hear that. Try again, or type it.");
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      try {
        m.abort();
      } catch {}
    };
  }, [available]);

  const start = async () => {
    const m = rec?.ExpoSpeechRecognitionModule;
    if (!m) return;
    setProblem(null);
    if (onDevice) {
      const ok = await m.requestPermissionsAsync();
      if (!ok.granted) {
        setProblem('Turn on the microphone for Life Works in your settings to talk to Zoey.');
        return;
      }
    }
    base.current = typed;
    live.current = true;
    setListening(true);
    try {
      m.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: onDevice,
        addsPunctuation: true,
        // Words are never starred out, so the safety check reads what was really said.
        androidIntentOptions: { EXTRA_MASK_OFFENSIVE_WORDS: false },
        // Zoey's voice still plays out loud on the speaker after the mic closes.
        iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth'], mode: 'default' },
      });
    } catch {
      setListening(false);
      setProblem("Zoey couldn't hear that. Try again, or type it.");
    }
  };

  const stop = () => {
    try {
      rec?.ExpoSpeechRecognitionModule.stop();
    } catch {}
  };

  // Sent while the mic was still open: close it without adding more words.
  const cancel = () => {
    if (!listening) return;
    live.current = false;
    try {
      rec?.ExpoSpeechRecognitionModule.abort();
    } catch {}
    setListening(false);
  };

  return { available, listening, problem, cancel, toggle: () => (listening ? stop() : void start()) };
}

/** The mic button beside the message box. */
export function MicButton({ listening, onPress }: { listening: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.mic, listening && styles.micOn]}
      accessibilityRole="button"
      accessibilityState={{ selected: listening }}
      accessibilityLabel={listening ? 'Stop listening' : 'Talk to Zoey'}
      accessibilityHint={listening ? 'Your words are in the message box. Tap Send when they look right.' : 'Say your message instead of typing it.'}
    >
      <Icon name="mic" size={20} color={listening ? '#fff' : colors.ink} />
    </Pressable>
  );
}

/** Why the mic didn't work, shown above the message box. */
export function MicProblem({ text }: { text: string | null }) {
  return text ? <Text style={styles.problem}>{text}</Text> : null;
}

const styles = StyleSheet.create({
  mic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  problem: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: 16, paddingTop: 6 },
});
