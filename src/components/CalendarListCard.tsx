// Zoey's list of what's coming up (Ed, 2026-11-15: "add list of calendar event to
// the ask zoey"). Shown in the AskZoey chat under her answer to "show my calendar"
// or a tap on the calendar button. Day by day for the next week, then one-off
// Calendar events later in the month. Tapping a day opens Calendar on that day.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { clock } from '../util';
import type { CalendarList } from '../zoey/schedule';
import type { DayItem } from '../zoey/today';
import Icon from './Icon';

const KIND_COLOR: Record<string, string> = {
  appointment: colors.red,
  meeting: colors.module.lifepath,
  work: colors.red,
  school: colors.blue,
};
const dot = (kind: string) => KIND_COLOR[kind] ?? colors.module.myhome;

const laterLabel = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

function Row({ item, day }: { item: DayItem; day?: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: dot(item.kind) }]} />
      <Text style={styles.time}>{day ?? clock(item.time)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.title}</Text>
        {day || item.detail ? <Text style={styles.detail}>{[day ? clock(item.time) : null, item.detail].filter(Boolean).join(' · ')}</Text> : null}
      </View>
    </View>
  );
}

export default function CalendarListCard({ list, onOpen }: { list: CalendarList; onOpen: (date?: string) => void }) {
  return (
    <View style={styles.card} accessibilityLabel="My calendar">
      <View style={styles.head}>
        <Icon name="calendar" size={18} color={colors.ink} />
        <Text style={styles.headText}>Coming up</Text>
      </View>
      {list.days.map((d) => (
        <Pressable key={d.date} onPress={() => onOpen(d.date)} accessibilityRole="button" accessibilityLabel={`${d.label}, open in Calendar`} style={styles.day}>
          <Text style={styles.dayLabel}>{d.label}</Text>
          {d.items.map((x) => (
            <Row key={`${x.time} ${x.title}`} item={x} />
          ))}
        </Pressable>
      ))}
      {list.later.length ? (
        <View style={styles.day}>
          <Text style={styles.dayLabel}>Later this month</Text>
          {list.later.map((x) => (
            <Row key={`${x.date} ${x.time} ${x.title}`} item={x} day={laterLabel(x.date)} />
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => onOpen()} accessibilityRole="button" style={styles.open} hitSlop={6}>
        <Text style={styles.openText}>Open Calendar</Text>
        <Icon name="chevron" size={16} color={colors.blue} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginLeft: 38, backgroundColor: '#fff', borderRadius: radius.md, padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  day: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 8 },
  dayLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  time: { width: 76, fontSize: 15, color: colors.inkSoft, fontVariant: ['tabular-nums'] },
  title: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  detail: { fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  openText: { fontSize: 15, color: colors.blue, fontWeight: '600' },
});
