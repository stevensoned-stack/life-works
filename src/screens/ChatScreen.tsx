// Chat with the people in your LifeCircle (build plan sec. 03, Messaging).
// Every message is screened for crisis language before it goes anywhere, the
// same as AskZoey: crisis opens the full-screen help, and urgent or unclear
// messages get Zoey's card with people to call. The message itself still goes
// to the person it was written to, because reaching a person is the point.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZoeyAvatar } from '../components/Art';
import CrisisSheet from '../components/CrisisSheet';
import Icon from '../components/Icon';
import { Button, Card, Chip, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { ChatMessage, SupportPerson } from '../data/types';
import { Route } from '../modules';
import { unreadFrom } from '../chat/sync';
import { call, QUICK_MESSAGES, text as sendText } from '../recovery/contact';
import { alertText, makeEvent } from '../safety/events';
import { syncConfig } from '../safety/sync';
import { colors, radius } from '../theme';
import { isToday, timeLabel } from '../util';
import { AnswerAction } from '../zoey/answers';
import { ask } from '../zoey/ask';
import { buildContext } from '../zoey/context';
import { screen } from '../zoey/safety';
import { Avatar } from './LifeCircleScreen';

const when = (iso: string) =>
  isToday(iso) ? timeLabel(iso) : new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// What the person is told about where a conversation's messages go.
export function routeNote(p: SupportPerson, connected: boolean) {
  if (!connected) return `Messages open your phone's texting app. ${p.name}'s replies show up there, not here.`;
  if (p.group === 'coordinator')
    return `Messages go to ${p.name} through Life Works and are kept as part of your care record. A supervisor covering for ${p.name} can read them too.`;
  return `${p.name} gets your messages as texts from the Life Works number and can text back. Your care team can't see this conversation.`;
}

export function ChatListScreen({ go, back }: { go: (r: Route) => void; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const coordinator = state.people.find((p) => p.group === 'coordinator');
  const team = state.people.filter((p) => p.group === 'team');
  const family = state.people.filter((p) => p.group === 'family');
  const lastWith = (id: string) => [...state.messages].reverse().find((m) => m.with === id);
  // People you've talked to most recently first, within each group.
  const recent = (xs: SupportPerson[]) =>
    [...xs].sort((a, b) => (lastWith(b.id)?.at ?? '').localeCompare(lastWith(a.id)?.at ?? ''));

  const row = (p: SupportPerson) => {
    const last = lastWith(p.id);
    const unread = unreadFrom(state.messages, p.id);
    return (
      <Pressable
        key={p.id}
        onPress={() => go({ name: 'chatthread', with: p.id })}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${p.role}${unread ? `, ${unread} new` : ''}`}
      >
        <Avatar person={p} size={44} />
        <View style={{ flex: 1 }}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread > 0 && { fontWeight: '800' }]}>{p.name}</Text>
            {last ? <Text style={styles.time}>{when(last.at)}</Text> : null}
          </View>
          <View style={styles.rowTop}>
            <Text style={[styles.preview, unread > 0 && { color: colors.ink }]} numberOfLines={1}>
              {last ? `${last.from === 'me' ? 'You: ' : ''}${last.text}` : p.role}
            </Text>
            {unread ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Chat" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {coordinator ? (
          <>
            <SectionLabel>Your coordinator</SectionLabel>
            <Card style={styles.list}>{row(coordinator)}</Card>
          </>
        ) : null}
        {team.length ? (
          <>
            <SectionLabel>My support team</SectionLabel>
            <Card style={styles.list}>{recent(team).map(row)}</Card>
          </>
        ) : null}
        {family.length ? (
          <>
            <SectionLabel>Chosen family</SectionLabel>
            <Card style={styles.list}>{recent(family).map(row)}</Card>
          </>
        ) : null}
        <Button label="Add someone to LifeCircle" icon="plus" tone="outline" onPress={() => go({ name: 'lifecircle' })} />
        <Text style={styles.note}>
          {syncConfig()
            ? `Messages to ${coordinator?.name ?? 'your coordinator'} stay in Life Works. Everyone else gets them as texts and can text back. If you write something that sounds like you're in danger, Life Works shows you help right away.`
            : "Messages open your phone's texting app. If you write something that sounds like you're in danger, Life Works shows you help right away."}
        </Text>
      </ScrollView>
    </View>
  );
}

// A note from Zoey inside a conversation, seen only by the person.
type ZoeyNote = { id: string; after: string; text: string; actions: AnswerAction[]; urgent: boolean; check: boolean; eventId: string };

export function ChatThreadScreen({ withId, go, back }: { withId: string; go: (r: Route) => void; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, sendChat, retryChat, markChatRead, logSafetyEvent, noteSafetyAction, markAlertTexted } = useStore();
  const ctx = useMemo(() => buildContext(state), [state]);
  const person = state.people.find((p) => p.id === withId);
  const [input, setInput] = useState('');
  const [notes, setNotes] = useState<ZoeyNote[]>([]);
  const [crisis, setCrisis] = useState<null | 'psychiatric' | 'medical'>(null);
  const [held, setHeld] = useState(false);
  const eventRef = useRef<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const connected = !!syncConfig();

  const thread = state.messages.filter((m) => m.with === withId);
  const unread = unreadFrom(state.messages, withId);
  useEffect(() => {
    if (unread) markChatRead(withId);
  }, [unread, withId, markChatRead]);
  useEffect(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [thread.length, notes.length]);

  if (!person)
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Chat" onBack={back} />
        <Text style={[styles.note, { padding: 16 }]}>This person isn't in your LifeCircle anymore.</Text>
      </View>
    );

  const coordinator = state.profile.coordinator;
  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  const share = state.settings.shareSafetyAlerts;

  const submit = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    // Safety screen first, before the message goes anywhere.
    const s = screen(t);
    let eventId: string | undefined;
    if (s.kind !== 'none') {
      eventId = newId();
      eventRef.current = eventId;
      if (s.kind === 'crisis') setCrisis(s.variant);
    }
    // Without the Life Works service, sending means leaving for the texting
    // app. In a crisis the help screen comes first and the message waits in
    // the box until the person is ready.
    const holdForCrisis = s.kind === 'crisis' && !connected;
    if (holdForCrisis) setHeld(true);
    else {
      setInput('');
      setHeld(false);
      const m = sendChat(person.id, t);
      if (!connected) sendText(person.phone, t);
      if (s.kind !== 'none' && s.kind !== 'crisis') {
        const r = ask(t, ctx);
        if (r.kind === 'urgent' || r.kind === 'check')
          setNotes((n) => [
            ...n,
            {
              id: newId(),
              after: m.id,
              text: r.text,
              actions: r.kind === 'urgent' ? (share ? [...r.actions, textAlertAction(2)] : r.actions).filter((a) => a.kind !== 'save') : [],
              urgent: r.kind === 'urgent' && r.variant !== 'housing',
              check: r.kind === 'check',
              eventId: eventId!,
            },
          ]);
      }
    }
    if (s.kind !== 'none')
      logSafetyEvent(
        makeEvent({
          id: eventId!,
          result: s,
          message: t,
          // Only the person's own words go in the record, never what the other
          // person wrote to them.
          history: thread.filter((m) => m.from === 'me').map((m) => ({ from: 'me' as const, text: m.text, at: m.at })),
          screen: 'chat',
          coordinatorName: coordinator.name,
          share,
        }),
      );
  };

  const textAlertAction = (tier: 1 | 2 | 3): AnswerAction => ({
    kind: 'text',
    label: `Text ${coordinator.name} to check on me`,
    who: 'coordinator',
    body: alertText(state.profile.name, tier),
  });

  const run = (a: AnswerAction, eventId: string) => {
    noteSafetyAction(eventId, a.label);
    if (a.kind === 'text' && a.body?.startsWith('Life Works alert')) markAlertTexted(eventId);
    switch (a.kind) {
      case 'route':
        return go(a.route);
      case 'call':
        return call(a.who === 'sponsor' && sponsor ? sponsor.phone : coordinator.phone);
      case 'text':
        return sendText(a.who === 'sponsor' && sponsor ? sponsor.phone : coordinator.phone, a.body);
      case 'phone':
        return call(a.number);
      case 'url':
        return Linking.openURL(a.url).catch(() => {});
      case 'crisis':
        eventRef.current = eventId;
        return setCrisis('psychiatric');
    }
  };

  const answerCheck = (note: ZoeyNote, label: string, safe: boolean) => {
    noteSafetyAction(note.eventId, label, safe ? undefined : 3);
    setNotes((n) =>
      n.map((x) =>
        x.id === note.id
          ? {
              ...x,
              check: false,
              text: safe ? "I'm glad you're safe right now. If that changes, you can call or text 988 any time, day or night." : x.text,
            }
          : x,
      ),
    );
    if (!safe) {
      eventRef.current = note.eventId;
      setCrisis('psychiatric');
    }
  };

  const textAlert = () => {
    const id = eventRef.current;
    const e = state.safetyEvents.find((x) => x.id === id);
    sendText(coordinator.phone, alertText(state.profile.name, e?.tier ?? 3));
    if (id) {
      noteSafetyAction(id, `Text ${coordinator.name}`);
      markAlertTexted(id);
    }
  };

  const status = (m: ChatMessage) =>
    ({ sending: 'Sending…', sent: 'Sent', texted: 'Opened in your texting app', failed: "Didn't send. Tap to try again.", received: '' })[m.status];
  const lastMine = [...thread].reverse().find((m) => m.from === 'me');

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={person.name} onBack={back} left={<Avatar person={person} size={28} />} />
      <Pressable style={styles.crisisBar} onPress={() => ((eventRef.current = null), setCrisis('psychiatric'))} accessibilityRole="button" accessibilityLabel="Need help now? Call or text 988">
        <Icon name="phone" size={15} />
        <Text style={styles.crisisText}>Need help now? Call or text 988</Text>
      </Pressable>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
          <View style={styles.routeNote}>
            <Icon name="info" size={16} color={colors.inkSoft} />
            <Text style={styles.routeText}>{routeNote(person, connected)}</Text>
          </View>
          {!thread.length ? <Text style={[styles.note, { textAlign: 'center' }]}>No messages yet. Say hi to {person.name}.</Text> : null}
          {thread.map((m) => (
            <View key={m.id} style={{ gap: 8 }}>
              {m.from === 'me' ? (
                <Pressable
                  disabled={m.status !== 'failed'}
                  onPress={() => retryChat(m.id)}
                  style={{ alignSelf: 'flex-end', maxWidth: '80%' }}
                  accessibilityRole={m.status === 'failed' ? 'button' : undefined}
                >
                  <View style={[styles.meBubble, m.status === 'failed' && { backgroundColor: colors.redDark }]}>
                    <Text style={[styles.bubbleText, { color: '#fff' }]}>{m.text}</Text>
                  </View>
                  {m === lastMine || m.status === 'failed' ? (
                    <Text style={[styles.status, m.status === 'failed' && { color: colors.red }]}>{status(m)}</Text>
                  ) : null}
                </Pressable>
              ) : (
                <View style={styles.themRow}>
                  <View style={styles.themBubble}>
                    {m.author ? <Text style={styles.author}>{m.author}</Text> : null}
                    <Text style={styles.bubbleText}>{m.text}</Text>
                  </View>
                  <Text style={styles.status}>{when(m.at)}</Text>
                </View>
              )}
              {notes
                .filter((n) => n.after === m.id)
                .map((n) => (
                  <View key={n.id} style={[styles.zoeyCard, n.urgent && { borderColor: colors.red }]}>
                    <View style={styles.zoeyTop}>
                      <ZoeyAvatar size={24} />
                      <Text style={styles.zoeyLabel}>From Zoey · only you see this</Text>
                    </View>
                    <Text style={styles.bubbleText}>{n.text}</Text>
                    {n.check ? (
                      <View style={styles.actions}>
                        <Chip label="Yes, I'm safe" onPress={() => answerCheck(n, "Yes, I'm safe", true)} />
                        <Chip label="No" onPress={() => answerCheck(n, 'No', false)} />
                        <Chip label="I'm not sure" onPress={() => answerCheck(n, "I'm not sure", false)} />
                      </View>
                    ) : null}
                    {n.actions.length ? (
                      <View style={styles.actions}>
                        {n.actions.map((a, i) => (
                          <Button
                            key={a.label}
                            label={a.label}
                            icon={a.kind === 'call' || a.kind === 'phone' ? 'phone' : a.kind === 'text' ? 'message' : undefined}
                            small
                            tone={i === 0 ? (n.urgent ? 'red' : 'green') : 'outline'}
                            onPress={() => run(a, n.eventId)}
                          />
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
            </View>
          ))}
          {held ? (
            <View style={styles.zoeyCard}>
              <Text style={styles.bubbleText}>Your message to {person.name} is still in the box below. Send it whenever you're ready.</Text>
            </View>
          ) : null}
        </ScrollView>

        {!input ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.quick}
            keyboardShouldPersistTaps="handled"
          >
            {QUICK_MESSAGES.map((q) => (
              <Chip key={q} label={q} onPress={() => setInput(q)} />
            ))}
          </ScrollView>
        ) : null}
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${person.name}`}
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            multiline
            maxLength={2000}
            accessibilityLabel={`Message ${person.name}`}
          />
          <Pressable onPress={() => submit(input)} style={styles.sendBtn} accessibilityRole="button" accessibilityLabel="Send">
            <Icon name="send" size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  list: { paddingVertical: 4, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  time: { fontSize: 12, color: colors.inkFaint },
  preview: { flex: 1, fontSize: 14, color: colors.inkSoft },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  note: { fontSize: 13, color: colors.inkSoft, lineHeight: 19 },
  crisisBar: { backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  crisisText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  thread: { padding: 14, gap: 10, paddingBottom: 24 },
  routeNote: { flexDirection: 'row', gap: 8, backgroundColor: '#fff', borderRadius: radius.sm, padding: 10, alignItems: 'flex-start' },
  routeText: { flex: 1, fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  meBubble: { backgroundColor: colors.blue, borderRadius: radius.md, borderBottomRightRadius: 4, paddingVertical: 10, paddingHorizontal: 14 },
  themRow: { alignSelf: 'flex-start', maxWidth: '80%', gap: 2 },
  themBubble: { backgroundColor: '#fff', borderRadius: radius.md, borderBottomLeftRadius: 4, padding: 12 },
  author: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, marginBottom: 2 },
  bubbleText: { fontSize: 16, lineHeight: 22, color: colors.ink },
  status: { fontSize: 12, color: colors.inkFaint, marginTop: 2, alignSelf: 'flex-end' },
  zoeyCard: { backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: 12, gap: 8 },
  zoeyTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoeyLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quick: { gap: 8, paddingHorizontal: 12, paddingTop: 6, alignItems: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.bg },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.ink,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
