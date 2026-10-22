import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, Sheet, TimeStepper } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, Chip, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { CalendarItem, EventKind, Meeting } from '../data/types';
import { Route } from '../modules';
import { meetsOn, OFFICIAL_FINDERS, SAMPLE_MEETINGS } from '../recovery/meetings';
import { colors, radius } from '../theme';
import { addDays, clock, fromYmd, ymd } from '../util';

const KIND: Record<EventKind, { label: string; color: string }> = {
  appointment: { label: 'Appointment', color: colors.red },
  meeting: { label: 'Meeting', color: colors.module.lifepath },
  work: { label: 'Work', color: colors.red },
  school: { label: 'School', color: colors.blue },
  other: { label: 'Other', color: colors.module.myhome },
};

const REMIND_OPTIONS: { label: string; mins: number | null }[] = [
  { label: 'No reminder', mins: null },
  { label: '15 min before', mins: 15 },
  { label: '1 hour before', mins: 60 },
  { label: '1 day before', mins: 1440 },
];

const remindLabel = (m: number | null) => REMIND_OPTIONS.find((o) => o.mins === m)?.label ?? `${m} min before`;

function WeekStrip({ selected, onSelect, dots }: { selected: string; onSelect: (d: string) => void; dots: Set<string> }) {
  const today = new Date();
  return (
    <View style={styles.week}>
      {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => {
        const key = ymd(d);
        const on = key === selected;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[styles.day, on && styles.dayOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          >
            <Text style={[styles.dayName, on && { color: '#fff' }]}>{d.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
            <Text style={[styles.dayNum, on && { color: '#fff' }]}>{d.getDate()}</Text>
            <View style={[styles.dot, { opacity: dots.has(key) ? 1 : 0 }, on && { backgroundColor: '#fff' }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CalendarScreen({
  back,
  go,
  initialTab = 'schedule',
}: {
  back: () => void;
  go: (r: Route) => void;
  initialTab?: 'schedule' | 'meetings';
}) {
  const insets = useSafeAreaInsets();
  const { state, saveEvent, removeEvent, toggleVisit } = useStore();
  const [tab, setTab] = useState(initialTab);
  const [day, setDay] = useState(ymd(new Date()));
  const [editing, setEditing] = useState<CalendarItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [fellowship, setFellowship] = useState<'All' | Meeting['fellowship']>('All');
  const [format, setFormat] = useState<'any' | Meeting['format']>('any');

  const dots = useMemo(() => new Set(state.calendar.map((e) => e.date)), [state.calendar]);
  const items = state.calendar.filter((e) => e.date === day).sort((a, b) => a.time.localeCompare(b.time));
  const dayDate = fromYmd(day);
  const weekday = dayDate.getDay();

  const meetings = SAMPLE_MEETINGS.filter(
    (m) => meetsOn(m, weekday) && (fellowship === 'All' || m.fellowship === fellowship) && (format === 'any' || m.format === format),
  ).sort((a, b) => a.time.localeCompare(b.time));

  const weekStart = addDays(new Date(), -6);
  const visitsThisWeek = state.visits.filter((v) => fromYmd(v.date) >= new Date(weekStart.toDateString())).length;

  const startNew = () => {
    setIsNew(true);
    setEditing({ id: newId(), date: day, time: '12:00', title: '', subtitle: '', kind: 'appointment', remindMins: 15 });
  };

  const addMeeting = (m: Meeting) =>
    saveEvent({
      id: `meeting-${m.id}-${day}`,
      date: day,
      time: m.time,
      title: m.name,
      subtitle: `${m.fellowship} · ${m.place}`,
      kind: 'meeting',
      remindMins: 60,
      meetingId: m.id,
    });

  const dayHeading =
    day === ymd(new Date())
      ? `Today · ${dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
      : dayDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Calendar" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        <View style={styles.seg} accessibilityRole="tablist">
          {(['schedule', 'meetings'] as const).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.segItem, tab === t && styles.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === t }}>
              <Text style={[styles.segText, tab === t && { color: '#fff' }]}>{t === 'schedule' ? 'My schedule' : 'Find a meeting'}</Text>
            </Pressable>
          ))}
        </View>
        <WeekStrip selected={day} onSelect={setDay} dots={dots} />
        <SectionLabel>{dayHeading}</SectionLabel>

        {tab === 'schedule' ? (
          <>
            <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
              {items.length ? (
                items.map((e, i) => (
                  <Pressable key={e.id} onPress={() => (setIsNew(false), setEditing(e))} style={[styles.item, i > 0 && styles.itemBorder]} accessibilityRole="button">
                    <Text style={styles.itemTime}>{clock(e.time)}</Text>
                    <View style={[styles.itemBar, { backgroundColor: KIND[e.kind].color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{e.title}</Text>
                      {e.subtitle ? <Text style={styles.itemSub}>{e.subtitle}</Text> : null}
                    </View>
                    {e.remindMins != null ? <Icon name="bell" size={16} color={colors.inkFaint} /> : null}
                  </Pressable>
                ))
              ) : (
                <Text style={styles.empty}>Nothing planned. Tap Add to put something on your calendar.</Text>
              )}
            </Card>
            <Button label="Add" icon="plus" tone="outline" onPress={startNew} />
            <Pressable style={styles.linkCard} onPress={() => go({ name: 'reminders' })} accessibilityRole="button">
              <Icon name="bell" size={20} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>Reminders</Text>
                <Text style={styles.itemSub}>Check-in times and daily reminders</Text>
              </View>
              <Icon name="chevron" size={18} color={colors.inkFaint} />
            </Pressable>
          </>
        ) : (
          <>
            <Card style={styles.stat}>
              <Text style={styles.statNum}>{visitsThisWeek}</Text>
              <Text style={styles.itemSub}>{visitsThisWeek === 1 ? 'meeting' : 'meetings'} in the last 7 days</Text>
            </Card>
            <View style={styles.chips}>
              {(['All', 'AA', 'NA', 'SMART', 'Celebrate Recovery', 'Recovery Dharma'] as const).map((f) => (
                <Chip key={f} label={f} selected={fellowship === f} onPress={() => setFellowship(f)} />
              ))}
            </View>
            <View style={styles.chips}>
              {([
                ['any', 'Any'],
                ['in_person', 'In person'],
                ['online', 'Online'],
              ] as const).map(([k, l]) => (
                <Chip key={k} label={l} selected={format === k} onPress={() => setFormat(k)} />
              ))}
            </View>
            {meetings.length ? (
              meetings.map((m) => {
                const added = state.calendar.some((e) => e.meetingId === m.id && e.date === day);
                const went = state.visits.some((v) => v.meetingId === m.id && v.date === day);
                const canMark = day <= ymd(new Date());
                return (
                  <Card key={m.id} style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <Text style={styles.meetTime}>{clock(m.time)}</Text>
                      <Text style={styles.badge}>{m.fellowship}</Text>
                    </View>
                    <Text style={styles.itemTitle}>{m.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name={m.format === 'online' ? 'chat' : 'pin'} size={15} color={colors.inkSoft} />
                      <Text style={styles.itemSub}>{m.place}</Text>
                    </View>
                    <Text style={styles.itemSub}>{m.notes}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Button
                        label={added ? 'On your calendar' : 'Add to calendar'}
                        icon={added ? 'check' : 'plus'}
                        small
                        tone={added ? 'green' : 'outline'}
                        onPress={() => (added ? removeEvent(`meeting-${m.id}-${day}`) : addMeeting(m))}
                      />
                      {canMark ? (
                        <Button label={went ? 'I went' : 'Mark I went'} icon={went ? 'check' : undefined} small tone={went ? 'green' : 'outline'} onPress={() => toggleVisit(m.id, day)} />
                      ) : null}
                    </View>
                  </Card>
                );
              })
            ) : (
              <Text style={styles.empty}>No meetings match. Try another day or filter.</Text>
            )}
            <Card style={{ gap: 8, backgroundColor: colors.greenLight }}>
              <Text style={styles.itemSub}>
                These are sample listings for this preview. For real meetings near you, use an official finder:
              </Text>
              {OFFICIAL_FINDERS.map((f) => (
                <Pressable key={f.url} onPress={() => Linking.openURL(f.url).catch(() => {})} accessibilityRole="link">
                  <Text style={styles.link}>{f.name}</Text>
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      <Sheet visible={editing !== null} title={isNew ? 'Add to calendar' : 'Edit'} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <Field id="event-title" label="What" value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} placeholder="e.g. Doctor, group, work shift" />
            <Field id="event-where" label="Where or with whom (optional)" value={editing.subtitle} onChangeText={(subtitle) => setEditing({ ...editing, subtitle })} />
            <View style={styles.chips}>
              {(Object.keys(KIND) as EventKind[]).map((k) => (
                <Chip key={k} label={KIND[k].label} selected={editing.kind === k} onPress={() => setEditing({ ...editing, kind: k })} />
              ))}
            </View>
            <Text style={styles.itemSub}>{fromYmd(editing.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            <TimeStepper value={editing.time} onChange={(time) => setEditing({ ...editing, time })} />
            <View style={styles.chips}>
              {REMIND_OPTIONS.map((o) => (
                <Chip key={o.label} label={o.label} selected={editing.remindMins === o.mins} onPress={() => setEditing({ ...editing, remindMins: o.mins })} />
              ))}
            </View>
            <Text style={styles.itemSub}>
              {editing.remindMins == null
                ? 'No reminder.'
                : `Reminder ${remindLabel(editing.remindMins).toLowerCase()}. It won't say what it's for, just the time.`}
            </Text>
            <Button
              label="Save"
              onPress={() => {
                if (!editing.title.trim()) return;
                saveEvent({ ...editing, title: editing.title.trim() });
                setEditing(null);
              }}
              style={editing.title.trim() ? undefined : { opacity: 0.4 }}
            />
            {!isNew ? (
              <Pressable onPress={() => (removeEvent(editing.id), setEditing(null))} accessibilityRole="button">
                <Text style={styles.remove}>Delete</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  seg: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.sm, padding: 4 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.sm - 2 },
  segOn: { backgroundColor: colors.green },
  segText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  week: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.sm, backgroundColor: '#fff', gap: 2 },
  dayOn: { backgroundColor: colors.blue },
  dayName: { fontSize: 11, color: colors.inkSoft, fontWeight: '600' },
  dayNum: { fontSize: 17, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.blue },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemTime: { width: 70, fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  itemBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  itemSub: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  empty: { fontSize: 14, color: colors.inkSoft, padding: 16 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  statNum: { fontSize: 26, fontWeight: '800', color: colors.green },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  meetTime: { fontSize: 15, fontWeight: '700', color: colors.green },
  badge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.blue,
    backgroundColor: colors.blueLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  link: { color: colors.green, fontWeight: '700', fontSize: 15, textDecorationLine: 'underline' },
  remove: { color: colors.red, fontWeight: '600', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
