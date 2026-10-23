import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { Button, Card, Chip, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { GoalArea, LifeEvent } from '../data/types';
import { Route } from '../modules';
import { dateLabel, markDone } from '../recovery/lifeEvents';
import { AREA_ORDER, AREAS, areaGoals, goalFor, newGoal, progress } from '../recovery/lifeGoals';
import { colors, radius } from '../theme';

export default function LifeGoalsScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, saveLifeEvent, removeLifeEvent } = useStore();
  const events = state.lifeEvents;
  const other = events.filter((e) => e.status === 'planned' && !e.area);

  // Tapping an option adds it as a goal. Tapping it again takes it off, unless
  // the person has added a date or note, in which case it opens to edit.
  const toggle = (area: GoalArea, title: string) => {
    const g = goalFor(events, area, title);
    if (!g) return saveLifeEvent(newGoal(area, title, newId()));
    if (g.status === 'done') return;
    if (g.date || g.note) return go({ name: 'lifeevent', edit: g.id });
    removeLifeEvent(g.id);
  };

  const row = (e: LifeEvent, i: number, color: string) => (
    <View key={e.id} style={[styles.row, i > 0 && styles.rowBorder]}>
      <Pressable
        style={styles.rowMain}
        onPress={() => go({ name: 'lifeevent', edit: e.id })}
        accessibilityRole="button"
        accessibilityLabel={`${e.title}, ${e.status === 'done' ? 'done' : e.date ? `by ${dateLabel(e.date)}` : 'no date yet'}. Edit`}
      >
        <View style={[styles.box, e.status === 'done' ? { backgroundColor: color, borderColor: color } : { borderColor: color }]}>
          {e.status === 'done' ? <Icon name="check" size={14} strokeWidth={3} /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.rowTitle, e.status === 'done' && styles.doneTitle]}>{e.title}</Text>
          <Text style={styles.rowSub}>
            {e.status === 'done' ? `Done ${dateLabel(e.date).toLowerCase()}` : e.date ? `By ${dateLabel(e.date)}` : 'Tap to set a target date'}
          </Text>
        </View>
      </Pressable>
      {e.status === 'planned' ? <Button small tone="outline" label="Done" onPress={() => saveLifeEvent(markDone(e))} /> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="LifeGoals" onBack={back} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Card>
          <Text style={styles.intro}>
            Pick goals for each part of your life, or write your own. Tap a goal to give it a target date. When you reach one, tap Done and
            it goes on your LifeEvent timeline.
          </Text>
        </Card>

        {AREA_ORDER.map((area) => {
          const a = AREAS[area];
          const mine = areaGoals(events, area);
          const p = progress(events, area);
          return (
            <Card key={area} style={{ gap: 12 }}>
              <View style={styles.areaHead}>
                <View style={[styles.areaDot, { backgroundColor: a.color }]} />
                <Text style={styles.areaTitle} accessibilityRole="header">
                  {a.title}
                </Text>
                {p.total ? (
                  <Text style={styles.count}>
                    {p.done} of {p.total} done
                  </Text>
                ) : null}
              </View>
              <Text style={styles.question}>{a.question}</Text>
              <View style={styles.chips}>
                {a.options.map((o) => {
                  const g = goalFor(events, area, o.title);
                  return (
                    <Chip
                      key={o.title}
                      label={g?.status === 'done' ? `✓ ${o.label}` : o.label}
                      selected={!!g}
                      disabled={g?.status === 'done'}
                      onPress={() => toggle(area, o.title)}
                    />
                  );
                })}
              </View>
              <Pressable onPress={() => go({ name: 'lifeevent', newGoal: area })} accessibilityRole="button" style={styles.own}>
                <Icon name="plus" size={16} color={colors.green} />
                <Text style={styles.link}>Write your own</Text>
              </Pressable>
              {mine.length ? (
                <View>
                  <Text style={styles.yours}>Your {a.title.toLowerCase()} goals</Text>
                  {mine.map((e, i) => row(e, i, a.color))}
                </View>
              ) : null}
            </Card>
          );
        })}

        {other.length ? (
          <View>
            <SectionLabel>Other goals</SectionLabel>
            <Card style={{ paddingVertical: 4 }}>{other.map((e, i) => row(e, i, colors.inkSoft))}</Card>
          </View>
        ) : null}
        <Text style={styles.privacy}>Only you can see your goals for now. They are saved on this phone.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  intro: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  areaHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  areaDot: { width: 14, height: 14, borderRadius: 7 },
  areaTitle: { flex: 1, fontSize: 19, fontWeight: '700', color: colors.ink },
  count: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  question: { fontSize: 15, color: colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  own: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  link: { fontSize: 15, fontWeight: '700', color: colors.green },
  yours: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  box: { width: 22, height: 22, borderRadius: radius.sm / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  doneTitle: { color: colors.inkSoft },
  rowSub: { fontSize: 13, color: colors.inkSoft },
  privacy: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
});
