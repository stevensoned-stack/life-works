import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { breathAt, clock, DEFAULT_MINUTES, DONE_LINE, LENGTHS, Pattern, PATTERNS, perMinute, SMALL, SUB, TITLE } from '../zoey/breath';
import { Button, Chip } from './ui';

const SIZE = 220;

// Ed's Paced Breathing Timer in the chat, wherever Zoey offers breathing (breath.ts).
export default function BreathingTimer({ onDone }: { onDone?: () => void }) {
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0]);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [still, setStill] = useState(false);
  const raf = useRef(0);
  const last = useRef(0);
  // Seconds in, for the animation loop (state lags a frame).
  const at = useRef(0);
  const total = minutes * 60;
  const done = elapsed >= total;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(setStill)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!running) return;
    last.current = 0;
    const tick = (ts: number) => {
      const dt = last.current ? (ts - last.current) / 1000 : 0;
      last.current = ts;
      const next = Math.min(total, at.current + dt);
      at.current = next;
      setElapsed(next);
      if (next >= total) {
        setRunning(false);
        onDone?.();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, total]);

  const b = breathAt(elapsed, pattern);
  const started = running || elapsed > 0;
  const scale = !started || done ? SMALL : still ? (b.inhale ? 1 : SMALL) : b.scale;
  const reset = () => {
    setRunning(false);
    setElapsed((at.current = 0));
  };
  const start = () => {
    if (done) setElapsed((at.current = 0));
    setRunning(true);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{TITLE}</Text>
      <Text style={styles.sub}>{SUB}</Text>

      <View style={styles.ring} accessibilityLiveRegion="polite">
        <View style={[styles.orb, { transform: [{ scale }] }]} />
        <View style={styles.cue}>
          <Text style={styles.cueWord}>{done ? 'Done' : !started ? 'Ready' : running ? b.cue : 'Paused'}</Text>
          <Text style={styles.cueCount}>{running ? b.count : ''}</Text>
        </View>
      </View>

      <View style={styles.status}>
        <Stat n={clock(total - elapsed)} label="time left" />
        <Stat n={String(b.breaths)} label="breaths" />
        <Stat n={perMinute(pattern)} label="breaths / min" />
      </View>

      {done ? <Text style={styles.done}>{DONE_LINE}</Text> : null}

      <View style={styles.row}>
        <Button label={running ? 'Pause' : done ? 'Start again' : elapsed > 0 ? 'Resume' : 'Start'} small onPress={running ? () => setRunning(false) : start} />
        <Button label="Reset" small tone="outline" onPress={reset} />
      </View>

      <Text style={styles.label}>LENGTH</Text>
      <View style={styles.row}>
        {LENGTHS.map((m) => (
          <Chip key={m} label={`${m} min`} selected={m === minutes} onPress={() => (setMinutes(m), reset())} />
        ))}
      </View>
      <Text style={styles.label}>PATTERN (IN / OUT)</Text>
      <View style={styles.row}>
        {PATTERNS.map((p) => (
          <Chip key={`${p.in}/${p.out}`} label={`${p.in} / ${p.out}`} selected={p === pattern} onPress={() => (setPattern(p), reset())} />
        ))}
      </View>
    </View>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={styles.statN}>{n}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginLeft: 38, backgroundColor: colors.greenLight, borderRadius: radius.md, padding: 16, gap: 10, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.greenDark },
  sub: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: -6 },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.greenLine, alignItems: 'center', justifyContent: 'center' },
  orb: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: 'rgba(62,107,23,0.14)', borderWidth: 3, borderColor: colors.green },
  cue: { alignItems: 'center', gap: 2 },
  cueWord: { fontSize: 28, fontWeight: '600', color: colors.ink },
  cueCount: { fontSize: 24, fontWeight: '700', color: colors.green, minHeight: 30 },
  status: { flexDirection: 'row', gap: 22, justifyContent: 'center' },
  statN: { fontSize: 20, fontWeight: '700', color: colors.ink },
  statLabel: { fontSize: 13, color: colors.inkSoft },
  done: { fontSize: 15, fontWeight: '700', color: colors.green, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  label: { fontSize: 12, letterSpacing: 1, color: colors.inkSoft, marginTop: 2 },
});
