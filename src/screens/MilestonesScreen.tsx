import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DatePicker, Sheet } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, ScreenHeader, SectionLabel } from '../components/ui';
import { useStore } from '../data/store';
import { call, text } from '../recovery/contact';
import { cleanTime, daysLabel, MILESTONES } from '../recovery/milestones';
import { colors, radius } from '../theme';
import { addDays, fromYmd, ymd } from '../util';

const longDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

export default function MilestonesScreen({ back }: { back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, setSobrietyDate } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.sobrietyDate ?? ymd(new Date()));
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarted, setRestarted] = useState(false);

  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  const today = ymd(new Date());

  if (!state.sobrietyDate) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="In Recovery" onBack={back} />
        <View style={{ padding: 24, gap: 14 }}>
          <Text style={styles.big}>Start counting</Text>
          <Text style={styles.body}>Set the day your recovery started and Life Works will count your days and milestones.</Text>
          <Button label="Start from today" onPress={() => setSobrietyDate(today)} />
          <Button label="Pick another date" tone="outline" onPress={() => setEditing(true)} />
        </View>
        {renderEditor()}
      </View>
    );
  }

  const t = cleanTime(state.sobrietyDate);

  function renderEditor() {
    return (
      <Sheet visible={editing} title="My recovery date" onClose={() => setEditing(false)}>
        <Text style={styles.body}>The first day of your current recovery.</Text>
        {/* Never in the future. */}
        <DatePicker label="Recovery date" value={draft} max={today} onChange={setDraft} />
        <Button
          label="Save date"
          onPress={() => {
            setSobrietyDate(draft);
            setEditing(false);
          }}
        />
      </Sheet>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="In Recovery" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        <Card style={styles.hero}>
          <Text style={styles.heroNum} accessibilityLabel={daysLabel(t.days)}>
            {t.days.toLocaleString()}
          </Text>
          <Text style={styles.heroUnit}>{t.days === 1 ? 'day' : 'days'}</Text>
          <Text style={styles.since}>since {longDate(fromYmd(state.sobrietyDate))}</Text>
          {t.hitToday ? (
            <View style={styles.today}>
              <Text style={styles.todayText}>You reached {t.hitToday.label} today!</Text>
              {sponsor ? (
                <Button
                  label={`Tell ${sponsor.name.split(' ')[0]}`}
                  icon="message"
                  tone="white"
                  small
                  onPress={() => text(sponsor.phone, `I hit ${t.hitToday!.label} today!`)}
                />
              ) : null}
            </View>
          ) : null}
          {t.next ? (
            <View style={{ alignSelf: 'stretch', gap: 6, marginTop: 6 }}>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.round(t.progress * 100)}%` }]} />
              </View>
              <Text style={styles.nextText}>
                {daysLabel(t.daysToNext)} to {t.next.label} · {t.nextDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          ) : null}
        </Card>

        {restarted ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.body}>
              Today is day one again. A slip doesn't erase what you learned or the work you did. Reaching out now can help.
            </Text>
            {sponsor ? <Button label={`Call ${sponsor.name.split(' ')[0]}`} icon="phone" small onPress={() => call(sponsor.phone)} style={{ alignSelf: 'flex-start' }} /> : null}
          </Card>
        ) : null}

        <SectionLabel>Milestones</SectionLabel>
        <View style={styles.grid}>
          {MILESTONES.map((m) => {
            const got = t.days >= m.days;
            const isNext = t.next?.days === m.days;
            return (
              <View
                key={m.days}
                style={[styles.chip, got && styles.chipGot, isNext && styles.chipNext]}
                accessibilityLabel={`${m.label}, ${got ? 'reached' : isNext ? 'next' : 'not yet'}`}
              >
                {got ? <Icon name="check" size={16} color="#fff" strokeWidth={3} /> : null}
                <Text style={[styles.chipText, got && { color: '#fff' }]}>{m.label}</Text>
              </View>
            );
          })}
        </View>

        <SectionLabel>Settings</SectionLabel>
        <Card style={{ gap: 12 }}>
          <Button label="Change my date" tone="outline" small onPress={() => (setDraft(state.sobrietyDate!), setEditing(true))} style={{ alignSelf: 'flex-start' }} />
          {confirmRestart ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.body}>Start your count again from today?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button
                  label="Yes, start from today"
                  small
                  onPress={() => {
                    setSobrietyDate(today);
                    setConfirmRestart(false);
                    setRestarted(true);
                  }}
                />
                <Button label="Cancel" tone="outline" small onPress={() => setConfirmRestart(false)} />
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmRestart(true)} accessibilityRole="button">
              <Text style={styles.link}>Start my count again</Text>
            </Pressable>
          )}
        </Card>
        <Text style={styles.note}>Only you can see your days in recovery.</Text>
      </ScrollView>
      {renderEditor()}
    </View>
  );
}

const styles = StyleSheet.create({
  big: { fontSize: 24, fontWeight: '800', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  hero: { alignItems: 'center', paddingVertical: 24, gap: 2 },
  heroNum: { fontSize: 64, fontWeight: '800', color: colors.green, fontVariant: ['tabular-nums'], lineHeight: 70 },
  heroUnit: { fontSize: 18, fontWeight: '700', color: colors.ink },
  since: { fontSize: 14, color: colors.inkSoft, marginTop: 4 },
  today: { backgroundColor: colors.green, borderRadius: radius.md, padding: 12, gap: 8, alignItems: 'center', marginTop: 10, alignSelf: 'stretch' },
  todayText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: colors.greenLight, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5, backgroundColor: colors.greenLine },
  nextText: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipGot: { backgroundColor: colors.green, borderColor: colors.green },
  chipNext: { borderColor: colors.green, borderStyle: 'dashed' },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  link: { color: colors.inkSoft, fontSize: 14, textDecorationLine: 'underline' },
  note: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
});
