import React, { useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZoeyAvatar } from '../components/Art';
import CrisisSheet from '../components/CrisisSheet';
import { DatePicker, Dropdown, Field, Sheet } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, Chip, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { LifeEvent, LifeEventFeel, LifeEventKind } from '../data/types';
import { Route } from '../modules';
import { call, text as sendText } from '../recovery/contact';
import { dateLabel, FEELS, KINDS, markDone, monthLabel, screenEntry, SUGGESTIONS, timeline, TimelineItem, upcoming } from '../recovery/lifeEvents';
import { alertText, makeEvent } from '../safety/events';
import { colors, radius } from '../theme';
import { addDays, ymd } from '../util';
import { AnswerAction, FIXED } from '../zoey/answers';
import { urgentReply } from '../zoey/ask';
import { buildContext } from '../zoey/context';

type Help =
  | { kind: 'check'; eventId: string }
  | { kind: 'urgent'; text: string; actions: AnswerAction[]; red: boolean; eventId: string };

const blank = (status: LifeEvent['status']): LifeEvent => ({
  id: newId(),
  status,
  date: status === 'done' ? ymd(new Date()) : null,
  title: '',
  kind: 'other',
  feel: 'mixed',
  createdAt: new Date().toISOString(),
});

export default function LifeEventScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, saveLifeEvent, removeLifeEvent, logSafetyEvent, noteSafetyAction, markAlertTexted } = useStore();
  const [editing, setEditing] = useState<LifeEvent | null>(null);
  const [filter, setFilter] = useState<LifeEventKind | null>(null);
  const [help, setHelp] = useState<Help | null>(null);
  const [crisis, setCrisis] = useState<null | 'psychiatric' | 'medical'>(null);
  // The safety event the crisis sheet belongs to.
  const eventRef = useRef<string | null>(null);

  const coordinator = state.profile.coordinator;
  const share = state.settings.shareSafetyAlerts;
  const isNew = editing ? !state.lifeEvents.some((e) => e.id === editing.id) : false;
  const today = ymd(new Date());
  const wasPlanned = editing?.status === 'done' && state.lifeEvents.find((e) => e.id === editing.id)?.status === 'planned';

  const items = useMemo(() => timeline(state.lifeEvents, state.sobrietyDate), [state.lifeEvents, state.sobrietyDate]);
  const goals = useMemo(() => upcoming(state.lifeEvents, state.sobrietyDate), [state.lifeEvents, state.sobrietyDate]);
  const kindsUsed = useMemo(() => (Object.keys(KINDS) as LifeEventKind[]).filter((k) => items.some((e) => e.kind === k)), [items]);
  const shown = filter ? items.filter((e) => e.kind === filter) : items;
  const months = useMemo(() => {
    const m: { label: string; items: TimelineItem[] }[] = [];
    for (const e of shown) {
      const label = monthLabel(e.date!);
      if (m[m.length - 1]?.label === label) m[m.length - 1].items.push(e);
      else m.push({ label, items: [e] });
    }
    return m;
  }, [shown]);

  const textAlert = () => {
    const id = eventRef.current;
    const e = state.safetyEvents.find((x) => x.id === id);
    sendText(coordinator.phone, alertText(state.profile.name, e?.tier ?? 3));
    if (id) {
      noteSafetyAction(id, `Text ${coordinator.name}`);
      markAlertTexted(id);
    }
  };

  // The event is always saved, so nothing the person wrote is lost. If the
  // safety screen flags it, help shows straight after, the same way it does in
  // a check-in, and the safety event is logged for the counselor.
  const save = () => {
    if (!editing || !editing.title.trim()) return;
    const title = editing.title.trim();
    const note = editing.note?.trim() || undefined;
    saveLifeEvent({ ...editing, title, note });
    setEditing(null);

    const s = screenEntry(title, note);
    if (s.kind === 'none') return;
    const eventId = newId();
    eventRef.current = eventId;
    if (s.kind === 'crisis') {
      // iOS can't present a modal while the form sheet is still closing, so the
      // crisis screen waits for that animation there.
      if (Platform.OS === 'ios') setTimeout(() => setCrisis(s.variant), 450);
      else setCrisis(s.variant);
    } else if (s.kind === 'check') {
      setHelp({ kind: 'check', eventId });
    } else {
      const r = urgentReply(s.variant, buildContext(state));
      const alert: AnswerAction[] = share
        ? [{ kind: 'text', label: `Text ${coordinator.name} to check on me`, who: 'coordinator', body: alertText(state.profile.name, 2) }]
        : [];
      setHelp({ kind: 'urgent', text: r.text, actions: [...r.actions, ...alert], red: s.variant !== 'housing', eventId });
    }
    logSafetyEvent(
      makeEvent({
        id: eventId,
        result: s,
        message: note ? `${title}\n${note}` : title,
        history: [],
        screen: 'lifeevent',
        coordinatorName: coordinator.name,
        share,
      }),
    );
  };

  const run = (a: AnswerAction, eventId: string) => {
    noteSafetyAction(eventId, a.label);
    switch (a.kind) {
      case 'route':
        return go(a.route);
      case 'call':
        return call(coordinator.phone);
      case 'text':
        markAlertTexted(eventId);
        return sendText(coordinator.phone, a.body);
      case 'phone':
        return call(a.number);
      case 'url':
        return Linking.openURL(a.url).catch(() => {});
      case 'crisis':
        return setCrisis('psychiatric');
    }
  };

  const answerCheck = (label: string, safe: boolean, eventId: string) => {
    noteSafetyAction(eventId, label, safe ? undefined : 3);
    setHelp(null);
    if (!safe) setCrisis('psychiatric');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="LifeEvent" onBack={back} />
      <Pressable
        style={styles.crisisBar}
        onPress={() => ((eventRef.current = null), setCrisis('psychiatric'))}
        accessibilityRole="button"
        accessibilityLabel="Need help now? Call or text 988"
      >
        <Icon name="phone" size={15} />
        <Text style={styles.crisisText}>Need help now? Call or text 988</Text>
      </Pressable>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {help ? (
          <Card style={help.kind === 'urgent' && help.red ? [styles.help, styles.helpRed] : styles.help}>
            <View style={styles.helpRow}>
              <ZoeyAvatar size={32} />
              <Text style={styles.helpText}>{help.kind === 'check' ? FIXED.safetyCheck : help.text}</Text>
            </View>
            <View style={styles.actions}>
              {help.kind === 'check' ? (
                <>
                  <Button small label="Yes, I'm safe" onPress={() => answerCheck("Yes, I'm safe", true, help.eventId)} />
                  <Button small tone="outline" label="No" onPress={() => answerCheck('No', false, help.eventId)} />
                  <Button small tone="outline" label="Not sure" onPress={() => answerCheck('Not sure', false, help.eventId)} />
                </>
              ) : (
                help.actions.map((a, i) => (
                  <Button
                    key={a.label}
                    small
                    label={a.label}
                    icon={a.kind === 'call' || a.kind === 'phone' ? 'phone' : a.kind === 'text' ? 'message' : undefined}
                    tone={i === 0 ? (help.red ? 'red' : 'green') : 'outline'}
                    onPress={() => run(a, help.eventId)}
                  />
                ))
              )}
            </View>
            {help.kind === 'urgent' ? (
              <Pressable onPress={() => setHelp(null)} accessibilityRole="button" style={{ alignSelf: 'center' }}>
                <Text style={styles.dismiss}>Close</Text>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ gap: 12 }}>
          <Text style={styles.intro}>
            Keep track of milestones and the important things you've done or want to do. What you've done shows up as dots on your LifePath
            mood chart.
          </Text>
          <View style={styles.addRow}>
            <Button label="I did something" icon="check" small onPress={() => setEditing(blank('done'))} style={{ flex: 1 }} />
            <Button label="I want to do" icon="target" small tone="outline" onPress={() => setEditing(blank('planned'))} style={{ flex: 1 }} />
          </View>
        </Card>

        {goals.length ? (
          <View>
            <SectionLabel>Goals and coming up</SectionLabel>
            <Card style={{ paddingVertical: 4 }}>
              {goals.map((e, i) => (
                <View key={e.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Pressable
                    disabled={e.auto}
                    onPress={() => setEditing(e)}
                    style={styles.rowMain}
                    accessibilityRole={e.auto ? undefined : 'button'}
                    accessibilityLabel={`${e.title}, ${e.date ? `by ${dateLabel(e.date)}` : 'no date yet'}, ${KINDS[e.kind].label}`}
                  >
                    <View style={[styles.dot, styles.dotOpen, { borderColor: KINDS[e.kind].color }]}>
                      <Icon name={e.auto ? 'star' : 'target'} size={14} color={KINDS[e.kind].color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.rowTitle}>{e.title}</Text>
                      <Text style={styles.rowSub}>
                        {e.auto ? `${dateLabel(e.date)} · From your clean date` : `${e.date ? `By ${dateLabel(e.date)}` : 'No date yet'} · ${KINDS[e.kind].label}`}
                      </Text>
                      {e.note ? <Text style={styles.rowNote}>{e.note}</Text> : null}
                    </View>
                  </Pressable>
                  {e.auto ? null : (
                    <Button small tone="outline" label="Done" onPress={() => setEditing(markDone(e))} />
                  )}
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {items.length ? <SectionLabel>Done</SectionLabel> : null}
        {kindsUsed.length > 1 ? (
          <View style={styles.chips}>
            <Chip label="All" selected={filter === null} onPress={() => setFilter(null)} />
            {kindsUsed.map((k) => (
              <Chip key={k} label={KINDS[k].label} selected={filter === k} onPress={() => setFilter(filter === k ? null : k)} />
            ))}
          </View>
        ) : null}

        {months.length ? (
          months.map((m) => (
            <View key={m.label}>
              <SectionLabel>{m.label}</SectionLabel>
              <Card style={{ paddingVertical: 4 }}>
                {m.items.map((e, i) => (
                  <Pressable
                    key={e.id}
                    disabled={e.auto}
                    onPress={() => setEditing(e)}
                    style={[styles.row, i > 0 && styles.rowBorder]}
                    accessibilityRole={e.auto ? undefined : 'button'}
                    accessibilityLabel={`${e.title}, ${dateLabel(e.date)}, ${KINDS[e.kind].label}, felt ${FEELS[e.feel].toLowerCase()}`}
                  >
                    <View style={[styles.dot, { backgroundColor: KINDS[e.kind].color }]}>
                      {e.auto ? <Icon name="star" size={14} /> : null}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.rowTitle}>{e.title}</Text>
                      <Text style={styles.rowSub}>
                        {dateLabel(e.date)} · {e.auto ? 'From your clean date' : KINDS[e.kind].label}
                      </Text>
                      {e.note ? <Text style={styles.rowNote}>{e.note}</Text> : null}
                    </View>
                    <Text style={[styles.feel, styles[e.feel]]}>{FEELS[e.feel]}</Text>
                  </Pressable>
                ))}
              </Card>
            </View>
          ))
        ) : (
          <Text style={styles.empty}>Nothing here yet. Add the first thing that happened.</Text>
        )}
        <Text style={styles.privacy}>Only you can see this for now. Your events are saved on this phone.</Text>
      </ScrollView>

      <Sheet
        visible={editing !== null}
        title={editing?.status === 'planned' ? (isNew ? 'Something I want to do' : 'Edit goal') : isNew ? 'Something I did' : wasPlanned ? 'Mark done' : 'Edit'}
        onClose={() => setEditing(null)}
      >
        {editing ? (
          <>
            <View style={styles.chips}>
              <Chip label="I did this" selected={editing.status === 'done'} onPress={() => setEditing({ ...editing, status: 'done', date: editing.date && editing.date <= today ? editing.date : today })} />
              <Chip
                label="I want to do this"
                selected={editing.status === 'planned'}
                onPress={() => setEditing({ ...editing, status: 'planned', date: editing.date && editing.date >= today ? editing.date : null })}
              />
            </View>
            <Dropdown
              label="Pick from a list"
              placeholder="Choose a milestone or goal"
              value={SUGGESTIONS.some((x) => x.title === editing.title) ? editing.title : null}
              options={SUGGESTIONS.map((x) => ({ label: x.title, value: x.title }))}
              onChange={(title) => setEditing({ ...editing, title, kind: SUGGESTIONS.find((x) => x.title === title)!.kind })}
            />
            <Field
              id="lifeevent-title"
              label="Or write your own"
              value={editing.title}
              onChangeText={(title) => setEditing({ ...editing, title })}
              placeholder={editing.status === 'done' ? 'e.g. New job, court date, moved' : 'e.g. Get my license'}
            />
            <Dropdown
              label="Type"
              value={editing.kind}
              options={(Object.keys(KINDS) as LifeEventKind[]).map((k) => ({ label: KINDS[k].label, value: k }))}
              onChange={(kind) => setEditing({ ...editing, kind })}
            />
            {editing.status === 'done' ? (
              <>
                <DatePicker label="When" value={editing.date ?? today} max={today} onChange={(date) => setEditing({ ...editing, date })} />
                <Text style={styles.fieldLabel}>How did it feel?</Text>
                <View style={styles.chips}>
                  {(Object.keys(FEELS) as LifeEventFeel[]).map((f) => (
                    <Chip key={f} label={FEELS[f]} selected={editing.feel === f} onPress={() => setEditing({ ...editing, feel: f })} />
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.chips}>
                  <Chip label="No date yet" selected={editing.date === null} onPress={() => setEditing({ ...editing, date: null })} />
                  <Chip
                    label="Set a target date"
                    selected={editing.date !== null}
                    onPress={() => setEditing({ ...editing, date: editing.date ?? ymd(addDays(new Date(), 30)) })}
                  />
                </View>
                {editing.date !== null ? (
                  <DatePicker label="Target date" value={editing.date} min={today} onChange={(date) => setEditing({ ...editing, date })} />
                ) : null}
              </>
            )}
            <Field
              id="lifeevent-note"
              label="Note (optional)"
              value={editing.note ?? ''}
              onChangeText={(note) => setEditing({ ...editing, note })}
              multiline
            />
            <Button label="Save" onPress={save} style={editing.title.trim() ? undefined : { opacity: 0.4 }} />
            {!isNew ? (
              <Pressable onPress={() => (removeLifeEvent(editing.id), setEditing(null))} accessibilityRole="button">
                <Text style={styles.remove}>Delete</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <CrisisSheet
        visible={crisis !== null}
        variant={crisis ?? 'psychiatric'}
        coordinator={coordinator}
        onSafe={() => setCrisis(null)}
        onAction={(label) => eventRef.current && noteSafetyAction(eventRef.current, label)}
        onTextCoordinator={share && eventRef.current ? textAlert : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  crisisBar: { backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  crisisText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  body: { padding: 16, gap: 14 },
  intro: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  help: { gap: 12, borderWidth: 1.5, borderColor: colors.green },
  helpRed: { borderColor: colors.red, backgroundColor: colors.redLight },
  helpRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  helpText: { flex: 1, fontSize: 15, color: colors.ink, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dismiss: { fontSize: 14, color: colors.inkSoft, fontWeight: '600', paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addRow: { flexDirection: 'row', gap: 10 },
  rowMain: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dotOpen: { backgroundColor: '#fff', borderWidth: 2 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'center' },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  rowSub: { fontSize: 13, color: colors.inkSoft },
  rowNote: { fontSize: 14, color: colors.ink, marginTop: 4, fontStyle: 'italic' },
  feel: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  good: { color: colors.greenDark, backgroundColor: colors.greenLight },
  hard: { color: colors.redDark, backgroundColor: colors.redLight },
  mixed: { color: colors.blue, backgroundColor: colors.blueLight },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  remove: { color: colors.red, fontWeight: '600', textAlign: 'center', paddingVertical: 6 },
  empty: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 8 },
  privacy: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
});
