import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, Sheet, TimeStepper, ToggleRow } from '../components/forms';
import { Button, Card, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { Reminder } from '../data/types';
import { checkInWindows, notificationsSupported } from '../recovery/notifications';
import { colors, radius } from '../theme';
import { clock, hhmm } from '../util';

const hourLabel = (h: number) => clock(hhmm(h, 0));

export default function RemindersScreen({ back }: { back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, updateSettings, saveReminder, removeReminder } = useStore();
  const { wakeHour, sleepHour, checkInReminders } = state.settings;
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [isNew, setIsNew] = useState(false);

  const windows = checkInWindows(wakeHour, sleepHour);

  const HourStepper = ({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) => (
    <View style={styles.stepRow}>
      <Text style={styles.title}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label}, earlier`}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{hourLabel(value)}</Text>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label}, later`}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Reminders" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {!notificationsSupported ? (
          <Card style={{ backgroundColor: colors.blueLight }}>
            <Text style={styles.sub}>Reminders only go off in the phone app. You can still set them up here.</Text>
          </Card>
        ) : null}

        <SectionLabel>Check-ins with Zoey</SectionLabel>
        <Card style={{ gap: 14 }}>
          <ToggleRow
            title="Check-in reminders"
            sub="Zoey checks in once in each window, at a different time each day."
            value={checkInReminders}
            onChange={(v) => updateSettings({ checkInReminders: v })}
          />
          {checkInReminders ? (
            <View style={styles.windows}>
              {windows.map((w) => (
                <View key={w.id} style={styles.window}>
                  <Text style={styles.windowLabel}>{w.label}</Text>
                  <Text style={styles.sub}>
                    {hourLabel(w.from)} to {hourLabel(w.to)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <HourStepper label="I wake up around" value={wakeHour} min={4} max={sleepHour - 4} onChange={(v) => updateSettings({ wakeHour: v })} />
          <HourStepper label="I go to sleep around" value={sleepHour} min={wakeHour + 4} max={23} onChange={(v) => updateSettings({ sleepHour: v })} />
          <Text style={styles.small}>Nothing goes off while you're asleep.</Text>
        </Card>

        <SectionLabel>Daily reminders</SectionLabel>
        <Card style={{ gap: 14 }}>
          {state.reminders.length ? (
            state.reminders.map((r) => (
              <View key={r.id} style={styles.reminderRow}>
                <Pressable style={{ flex: 1 }} onPress={() => (setIsNew(false), setEditing(r))} accessibilityRole="button" accessibilityLabel={`Edit ${r.title}`}>
                  <ToggleRow title={r.title} sub={`Every day at ${clock(hhmm(r.hour, r.minute))}`} value={r.on} onChange={(on) => saveReminder({ ...r, on })} />
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.sub}>No daily reminders yet.</Text>
          )}
          <Button
            label="Add a reminder"
            icon="plus"
            tone="outline"
            small
            style={{ alignSelf: 'flex-start' }}
            onPress={() => {
              setIsNew(true);
              setEditing({ id: newId(), title: '', hour: 9, minute: 0, on: true });
            }}
          />
        </Card>
        <Text style={styles.privacy}>
          To keep your lock screen private, reminders only show the time, never what they're for.
        </Text>
      </ScrollView>

      <Sheet visible={editing !== null} title={isNew ? 'New reminder' : 'Edit reminder'} onClose={() => setEditing(null)}>
        {editing ? (
          <>
            <Field id="reminder-title" label="What's it for? (only you see this)" value={editing.title} onChangeText={(title) => setEditing({ ...editing, title })} placeholder="e.g. Evening meds, call my sponsor" />
            <TimeStepper
              value={hhmm(editing.hour, editing.minute)}
              onChange={(t) => {
                const [hour, minute] = t.split(':').map(Number);
                setEditing({ ...editing, hour, minute });
              }}
            />
            <Button
              label="Save"
              style={editing.title.trim() ? undefined : { opacity: 0.4 }}
              onPress={() => {
                if (!editing.title.trim()) return;
                saveReminder({ ...editing, title: editing.title.trim() });
                setEditing(null);
              }}
            />
            {!isNew ? (
              <Pressable onPress={() => (removeReminder(editing.id), setEditing(null))} accessibilityRole="button">
                <Text style={styles.remove}>Delete reminder</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sub: { fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
  small: { fontSize: 13, color: colors.inkSoft },
  windows: { flexDirection: 'row', gap: 8 },
  window: { flex: 1, backgroundColor: colors.greenLight, borderRadius: radius.sm, padding: 10, gap: 2 },
  windowLabel: { fontSize: 13, fontWeight: '700', color: colors.greenDark },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: colors.greenDark, fontWeight: '700' },
  stepValue: { fontSize: 15, minWidth: 74, textAlign: 'center', color: colors.ink },
  reminderRow: { flexDirection: 'row', alignItems: 'center' },
  privacy: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
  remove: { color: colors.red, fontWeight: '600', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
