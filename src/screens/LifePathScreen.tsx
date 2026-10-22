import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOOD_LABELS, MoodFace, ZoeyAvatar } from '../components/Art';
import MoodChart, { ChartPoint } from '../components/MoodChart';
import MoodScale, { moodBadge } from '../components/MoodScale';
import { Card, ScreenHeader, SectionLabel } from '../components/ui';
import { useStore } from '../data/store';
import { MoodEntry, MoodValue } from '../data/types';
import { Route } from '../modules';
import { chartMarks, dateLabel, FEELS, inRange, KINDS, Range, timeline } from '../recovery/lifeEvents';
import { colors, radius } from '../theme';
import { dayKey, isToday, timeLabel } from '../util';

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

function byDay(moods: MoodEntry[]) {
  const m = new Map<string, MoodEntry[]>();
  for (const e of moods) {
    const k = dayKey(new Date(e.recordedAt));
    m.set(k, [...(m.get(k) ?? []), e]);
  }
  return m;
}

export function buildSeries(moods: MoodEntry[], range: Range, now = new Date()) {
  const days = byDay(moods);
  const points: ChartPoint[] = [];
  const inRange: MoodEntry[][] = []; // entries grouped per day, for the pattern note

  const dayEntries = (d: Date) => days.get(dayKey(d)) ?? [];

  if (range === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const es = dayEntries(d);
      if (es.length) inRange.push(es);
      points.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), value: avg(es.map((e) => e.value)) });
    }
  } else if (range === 'monthly') {
    for (let w = 3; w >= 0; w--) {
      const vals: number[] = [];
      let start = new Date(now);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - (w * 7 + i));
        if (i === 6) start = d;
        const es = dayEntries(d);
        if (es.length) inRange.push(es);
        vals.push(...es.map((e) => e.value));
      }
      points.push({ label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value: avg(vals) });
    }
  } else {
    for (let m = 11; m >= 0; m--) {
      const first = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const vals: number[] = [];
      for (const [, es] of days) {
        const d = new Date(es[0].recordedAt);
        if (d.getFullYear() === first.getFullYear() && d.getMonth() === first.getMonth()) {
          inRange.push(es);
          vals.push(...es.map((e) => e.value));
        }
      }
      points.push({ label: first.toLocaleDateString('en-US', { month: 'narrow' }), value: avg(vals) });
    }
  }
  return { points, days: inRange };
}

// Counts the person's own tags on their own lower days. It reports what they
// logged; it does not interpret or infer anything about them.
export function patternNote(days: MoodEntry[][], range: Range) {
  const phrase = { daily: 'this week', monthly: 'in the last 4 weeks', yearly: 'this year' }[range];
  const lower = days.filter((es) => (avg(es.map((e) => e.value)) ?? 0) < 0);
  if (!days.length) return `No check-ins logged ${phrase} yet.`;
  if (!lower.length) return `No lower days logged ${phrase}.`;
  const counts = new Map<string, number>();
  for (const es of lower) {
    for (const t of new Set(es.flatMap((e) => e.tags))) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const n = lower.length;
  if (!top || top[1] < 2) return `You logged ${n} lower day${n === 1 ? '' : 's'} ${phrase}.`;
  return `${top[1]} of your ${n} lower days ${phrase} were days you tagged ${top[0]}.`;
}

export default function LifePathScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, recordMood } = useStore();
  const [range, setRange] = useState<Range>('daily');

  const todays = state.moods.filter((m) => isToday(m.recordedAt));
  const latestToday = todays[todays.length - 1];
  const { points, days } = useMemo(() => buildSeries(state.moods, range), [state.moods, range]);
  const note = patternNote(days, range);
  const events = useMemo(() => timeline(state.lifeEvents, state.sobrietyDate), [state.lifeEvents, state.sobrietyDate]);
  const marks = useMemo(() => chartMarks(events, range), [events, range]);
  const shown = useMemo(() => inRange(events, range), [events, range]);
  const recent = useMemo(() => [...state.moods].reverse().slice(0, 14), [state.moods]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="LifePath" onBack={back} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <Text style={styles.cardLabel}>Today's mood</Text>
          <MoodScale value={(latestToday?.value as MoodValue) ?? null} onChange={(v) => recordMood(v)} />
          <Text style={styles.hint}>
            {latestToday
              ? `Logged at ${timeLabel(latestToday.recordedAt)}${todays.length > 1 ? ` · ${todays.length} times today` : ''}. Tap again any time your mood changes.`
              : 'Tap a face to log how you feel right now.'}
          </Text>
        </Card>

        <Card>
          <View style={styles.seg} accessibilityRole="tablist">
            {(['daily', 'monthly', 'yearly'] as Range[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                style={[styles.segItem, range === r && styles.segOn]}
                accessibilityRole="tab"
                accessibilityState={{ selected: range === r }}
              >
                <Text style={[styles.segText, range === r && { color: '#fff' }]}>{r[0].toUpperCase() + r.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <MoodChart points={points} marks={marks} />
        </Card>

        <Card style={{ gap: 10 }}>
          <View style={styles.eventsHead}>
            <Text style={styles.noteTitle}>Life events</Text>
            <Pressable onPress={() => go({ name: 'lifeevent' })} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>{shown.length ? 'See all' : 'Add one'}</Text>
            </Pressable>
          </View>
          {shown.length ? (
            shown.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <View style={[styles.eventDot, { backgroundColor: KINDS[e.kind].color }]} />
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {e.title}
                </Text>
                <Text style={styles.entryWhen}>
                  {dateLabel(e.date)} · {FEELS[e.feel]}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noteText}>Nothing logged in this range. Events you add show up as dots on the chart.</Text>
          )}
        </Card>

        <Card style={styles.noteCard}>
          <ZoeyAvatar size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noteTitle}>From your check-ins</Text>
            <Text style={styles.noteText}>{note}</Text>
          </View>
        </Card>

        <SectionLabel>Recent entries</SectionLabel>
        <Card style={{ paddingVertical: 4 }}>
          {recent.map((m, i) => (
            <View key={m.id} style={[styles.entry, i > 0 && styles.entryBorder]}>
              <MoodFace value={m.value} size={30} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.entryTitle}>
                  {MOOD_LABELS[m.value]} ({moodBadge(m.value)})
                </Text>
                <Text style={styles.entryWhen}>
                  {new Date(m.recordedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
                  {timeLabel(m.recordedAt)}
                </Text>
                {m.tags.length ? (
                  <View style={styles.tags}>
                    {m.tags.map((t) => (
                      <Text key={t} style={styles.tag}>
                        {t}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {m.note ? <Text style={styles.entryNote}>{m.note}</Text> : null}
              </View>
            </View>
          ))}
        </Card>
        <Text style={styles.privacy}>Only you can see this for now. Your entries are saved on this phone.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  cardLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, color: colors.inkSoft, textAlign: 'center', textTransform: 'uppercase', marginBottom: 10 },
  hint: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', marginTop: 10 },
  seg: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.sm, padding: 4, marginBottom: 14 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm - 2 },
  segOn: { backgroundColor: colors.green },
  segText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  noteCard: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  noteTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  noteText: { fontSize: 14, color: colors.inkSoft, marginTop: 2, lineHeight: 20 },
  eventsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontSize: 14, fontWeight: '700', color: colors.green },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventTitle: { flex: 1, fontSize: 15, color: colors.ink },
  entry: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
  entryBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  entryTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  entryWhen: { fontSize: 13, color: colors.inkSoft },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: {
    fontSize: 12,
    color: colors.blue,
    backgroundColor: colors.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  entryNote: { fontSize: 14, color: colors.ink, marginTop: 4, fontStyle: 'italic' },
  privacy: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
});
