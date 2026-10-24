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
import { Button, Chip, ScreenHeader } from '../components/ui';
import { newId, useStore } from '../data/store';
import { Route } from '../modules';
import { call, text as sendText } from '../recovery/contact';
import { colors, radius } from '../theme';
import { isToday, timeLabel } from '../util';
import { Answer, AnswerAction, ANSWERS, Topic, TOPICS } from '../zoey/answers';
import { answerFor, ask, Reply, urgentReply } from '../zoey/ask';
import { buildContext } from '../zoey/context';
import { copy } from '../zoey/copy';
import { followUp, typedAnswer } from '../zoey/feelings';
import { screen } from '../zoey/safety';
import { END, fill, lineFor, Tree, TreeAction, TREES } from '../zoey/trees';
import { useZoeyVoice, VoiceToggle } from '../zoey/useVoice';
import { alertText, makeEvent } from '../safety/events';

type Item =
  | { id: string; kind: 'me'; text: string }
  | {
      id: string;
      kind: 'zoey';
      text: string;
      question?: string;
      actions?: AnswerAction[];
      alternatives?: Answer[];
      urgent?: boolean;
      eventId?: string;
      // Shown but never read aloud (crisis, urgent and safety-check replies).
      quiet?: boolean;
    };

export default function AskScreen({ go, back }: { go: (r: Route) => void; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, saveQuestion, removeQuestion, logSafetyEvent, noteSafetyAction, markAlertTexted } = useStore();
  const ctx = useMemo(() => buildContext(state), [state]);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [crisis, setCrisis] = useState<null | 'psychiatric' | 'medical'>(null);
  const [checkPending, setCheckPending] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  // Yes / No buttons while Zoey asks about a feeling they typed.
  const [choices, setChoices] = useState<{ label: string; onPick: () => void }[]>([]);
  // While Zoey waits on a question in a tree: takes what they type and returns
  // true if it answered the question ("yes", "no", or the thing she asked for).
  const listening = useRef<((t: string) => boolean) | null>(null);
  // Zoey's last reply asked them to say more about something she couldn't place.
  const lastFallback = useRef(false);
  const scroll = useRef<ScrollViewInstance>(null);
  // The safety event the crisis sheet or safe-check chips belong to.
  const eventRef = useRef<string | null>(null);

  const coordinator = state.profile.coordinator;
  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  const checkedIn = [...state.checkins].reverse().find((c) => c.completedAt && isToday(c.completedAt));

  useEffect(() => {
    if (!items.length) return;
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [items]);

  const add = (...xs: Item[]) => setItems((s) => [...s, ...xs]);
  const spoken = useMemo(() => items.flatMap((i) => (i.kind === 'zoey' ? [i] : [])), [items]);
  useZoeyVoice(spoken, crisis !== null);

  const share = state.settings.shareSafetyAlerts;
  const textAlertAction = (tier: 1 | 2 | 3): AnswerAction => ({
    kind: 'text',
    label: `Text ${coordinator.name} to check on me`,
    who: 'coordinator',
    body: alertText(state.profile.name, tier),
  });
  const textAlert = () => {
    const id = eventRef.current;
    const e = state.safetyEvents.find((x) => x.id === id);
    sendText(coordinator.phone, alertText(state.profile.name, e?.tier ?? 3));
    if (id) {
      noteSafetyAction(id, `Text ${coordinator.name}`);
      markAlertTexted(id);
    }
  };

  const show = (r: Reply, question: string, eventId?: string) => {
    switch (r.kind) {
      case 'crisis':
        add({ id: newId(), kind: 'zoey', text: r.text, quiet: true });
        setCrisis(r.variant);
        return;
      case 'check':
        add({ id: newId(), kind: 'zoey', text: r.text, quiet: true });
        setCheckPending(true);
        return;
      case 'urgent':
        add({
          id: newId(),
          kind: 'zoey',
          text: r.text,
          actions: share && r.variant !== 'someone' ? [...r.actions, textAlertAction(2)] : r.actions,
          urgent: r.variant !== 'housing',
          eventId,
          quiet: true,
        });
        return;
      case 'answer':
        add({ id: newId(), kind: 'zoey', text: r.text, actions: r.actions, alternatives: r.alternatives, question });
        return;
      default:
        add({ id: newId(), kind: 'zoey', text: r.text, actions: r.actions, question });
    }
  };

  // --- Typed feelings: "Do you know why?" (trees.ts, feeling:*) -------------
  const vars = { coord: coordinator.name, sponsor: sponsor?.name.split(' ')[0] ?? null, name: ctx.name };
  const say = (t: string) => add({ id: newId(), kind: 'zoey', text: t });
  const walk = (tree: Tree, id: string): void => {
    setChoices([]);
    listening.current = null;
    if (id === END) return;
    const n = tree.nodes[id];
    const to = (x?: string) => () => walk(tree, x ?? END);
    const pick = (label: string, x?: string) => ({ label, onPick: () => (add({ id: newId(), kind: 'me', text: label }), to(x)()) });
    if (n.say) say(fill(lineFor(n), vars));
    if (n.save) saveQuestion(n.save);
    if (n.safety) {
      // A tapped answer that means danger ("no safe place tonight") gets the same help as typed words.
      const eventId = flag({ kind: 'urgent', variant: n.safety, matched: `tree:${tree.id}/${id}` }, `${tree.title}: ${n.safety}`);
      show(urgentReply(n.safety, ctx), tree.title, eventId);
      return to(n.next)();
    }
    if (n.topics) {
      // "What do you need help with?" Typing goes through the usual safety screen and answers.
      return setChoices(
        n.topics.map((t) => ({
          label: t.label,
          onPick: () => {
            add({ id: newId(), kind: 'me', text: t.label });
            const next = t.tree ? TREES[t.tree] : tree;
            walk(next, t.node ?? next.start);
          },
        })),
      );
    }
    if (n.yes || n.no) {
      // Typing works too: "yes" / "no", or for "Can you tell me more?" just telling more.
      listening.current = (t) => {
        const r = typedAnswer(tree, id, t);
        if (r) walk(tree, r.to);
        return !!r;
      };
      return setChoices([pick('Yes', n.yes), pick('No', n.no), ...(n.notSure ? [pick("I'm not sure", n.notSure)] : [])]);
    }
    if (n.share) {
      listening.current = () => (to(n.share)(), true);
      const after = tree.nodes[n.share];
      // "I'd rather not" skips the "thank you for telling me" line.
      const skip = after && !after.yes && !after.no && !after.share && !after.offer ? after.next : n.share;
      return setChoices([{ label: "I'd rather not", onPick: () => (add({ id: newId(), kind: 'me', text: "I'd rather not" }), say(copy.rather), to(skip)()) }]);
    }
    const offers = (n.offer ?? []).filter((o) => sponsor || (o.action !== 'callSponsor' && o.action !== 'textSponsor'));
    if (offers.length) {
      return setChoices([
        ...offers.map((o) => {
          const label = fill(o.label, vars);
          return { label, onPick: () => (add({ id: newId(), kind: 'me', text: label }), treeAction(o.action), to(n.next)()) };
        }),
        pick('Not now', n.next),
      ]);
    }
    to(n.next)();
  };
  const treeAction = (a: TreeAction) => {
    switch (a) {
      case 'callCoordinator':
        return call(coordinator.phone);
      case 'callSponsor':
        return call(sponsor?.phone ?? coordinator.phone);
      case 'textSponsor':
        return sendText(sponsor?.phone ?? coordinator.phone);
      case 'call211':
        return call('211');
      case 'breathing':
        return say(`${copy.breathing.title}: ${copy.breathing.steps.join(' ')}`);
      case 'findMeeting':
        return go({ name: 'calendar', tab: 'meetings' });
      case 'localHelp':
        return go({ name: 'resources' });
    }
  };

  // Saved for the counselor in the same update that shows the help, so it never delays it.
  const flag = (result: Exclude<ReturnType<typeof screen>, { kind: 'none' }>, message: string) => {
    const id = newId();
    eventRef.current = id;
    logSafetyEvent(
      makeEvent({
        id,
        result,
        message,
        history: items.map((i) => ({ from: i.kind === 'me' ? ('me' as const) : ('zoey' as const), text: i.text, at: '' })),
        screen: 'ask',
        coordinatorName: coordinator.name,
        share: state.settings.shareSafetyAlerts,
      }),
    );
    return id;
  };

  const submit = (q: string) => {
    const t = q.trim();
    if (!t) return;
    setInput('');
    setTopic(null);
    setChoices([]);
    const answering = listening.current;
    listening.current = null;
    const again = lastFallback.current;
    lastFallback.current = false;
    add({ id: newId(), kind: 'me', text: t });
    // Crisis help shows first; saving the event for the counselor is a local
    // state update and never holds it up.
    const r = ask(t, ctx, { again });
    const s = screen(t);
    if (s.kind !== 'none') {
      const eventId = flag(s, t);
      show(r, t, eventId);
      return;
    }
    // Their answer to the question Zoey just asked ("Can you tell me more?").
    if (answering?.(t)) return;
    // Feelings and feeling sick get a conversation, never "no good answer" (Ed, 2026-10-24).
    const f = followUp(t, r.kind);
    if (f) return walk(TREES[f.tree], f.node);
    // Two misses in a row: hand it to a person instead of asking again.
    if (r.kind === 'fallback') lastFallback.current = !again;
    show(r, t);
  };

  const pickAnswer = (a: Answer) => {
    setTopic(null);
    add({ id: newId(), kind: 'me', text: a.q });
    const r = answerFor(a, ctx);
    add({ id: newId(), kind: 'zoey', text: r.text, actions: r.actions, alternatives: r.alternatives, question: a.q });
  };

  const run = (a: AnswerAction, question?: string, eventId?: string) => {
    if (eventId) noteSafetyAction(eventId, a.label);
    if (eventId && a.kind === 'text') markAlertTexted(eventId);
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
        return setCrisis('psychiatric');
      case 'save':
        if (question) {
          saveQuestion(question);
          setSaved(question);
        }
    }
  };

  const answerCheck = (label: string, safe: boolean) => {
    setCheckPending(false);
    add({ id: newId(), kind: 'me', text: label });
    if (eventRef.current) noteSafetyAction(eventRef.current, label, safe ? undefined : 3);
    if (safe) add({ id: newId(), kind: 'zoey', text: "I'm glad you're safe right now. If that changes, you can call or text 988 any time, day or night." });
    else setCrisis('psychiatric');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="AskZoey" onBack={back} left={<ZoeyAvatar size={28} />} right={<VoiceToggle />} />
      <Pressable style={styles.crisisBar} onPress={() => ((eventRef.current = null), setCrisis('psychiatric'))} accessibilityRole="button" accessibilityLabel="Need help now? Call or text 988">
        <Icon name="phone" size={15} />
        <Text style={styles.crisisText}>Need help now? Call or text 988</Text>
      </Pressable>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.checkCard} onPress={() => go({ name: 'askzoey' })} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.checkTitle}>Daily check-in</Text>
              <Text style={styles.checkSub}>
                {checkedIn ? `Done at ${timeLabel(checkedIn.completedAt!)}. Tap to check in again.` : 'How are you feeling? It takes a minute.'}
              </Text>
            </View>
            <View style={styles.checkBtn}>
              <Text style={styles.checkBtnText}>{checkedIn ? 'Again' : 'Start'}</Text>
            </View>
          </Pressable>

          <View style={styles.zoeyRow}>
            <View style={styles.avatar}>
              <ZoeyAvatar size={30} />
            </View>
            <View style={styles.zoeyBubble}>
              <Text style={styles.bubbleText}>
                Hi {ctx.name}! Ask me about cravings, meetings, sponsors, or how to use Life Works. I share general information, not medical advice.
              </Text>
            </View>
          </View>

          {items.map((it) =>
            it.kind === 'me' ? (
              <View key={it.id} style={styles.meBubble}>
                <Text style={[styles.bubbleText, { color: '#fff' }]}>{it.text}</Text>
              </View>
            ) : (
              <View key={it.id} style={{ gap: 8 }}>
                <View style={styles.zoeyRow}>
                  <View style={styles.avatar}>
                    <ZoeyAvatar size={30} />
                  </View>
                  <View style={[styles.zoeyBubble, it.urgent && styles.urgentBubble]}>
                    <Text style={styles.bubbleText}>{it.text}</Text>
                  </View>
                </View>
                {it.actions?.length ? (
                  <View style={styles.actions}>
                    {it.actions.map((a, i) => {
                      const isSaved = a.kind === 'save' && saved === it.question;
                      return (
                        <Button
                          key={a.label}
                          label={isSaved ? 'Saved' : a.label}
                          icon={isSaved ? 'check' : a.kind === 'call' || a.kind === 'phone' ? 'phone' : a.kind === 'text' ? 'message' : undefined}
                          small
                          tone={i === 0 ? (it.urgent ? 'red' : 'green') : 'outline'}
                          onPress={() => run(a, it.question, it.eventId)}
                        />
                      );
                    })}
                  </View>
                ) : null}
                {it.alternatives?.length ? (
                  <View style={styles.alts}>
                    <Text style={styles.altLabel}>You might also ask</Text>
                    {it.alternatives.map((a) => (
                      <Pressable key={a.id} onPress={() => pickAnswer(a)} accessibilityRole="button" style={styles.alt}>
                        <Text style={styles.altText}>{a.q}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ),
          )}

          {choices.length ? (
            <View style={styles.actions}>
              {choices.map((c) => (
                <Chip key={c.label} label={c.label} onPress={c.onPick} />
              ))}
            </View>
          ) : null}

          {checkPending ? (
            <View style={styles.actions}>
              <Chip label="Yes, I'm safe" onPress={() => answerCheck("Yes, I'm safe", true)} />
              <Chip label="No" onPress={() => answerCheck('No', false)} />
              <Chip label="I'm not sure" onPress={() => answerCheck("I'm not sure", false)} />
            </View>
          ) : null}

          <View style={styles.browse}>
            <Text style={styles.browseLabel}>{items.length ? 'Browse more questions' : 'Pick a topic'}</Text>
            <View style={styles.chips}>
              {TOPICS.map((t) => (
                <Chip key={t} label={t} selected={topic === t} onPress={() => setTopic(topic === t ? null : t)} />
              ))}
            </View>
            {topic ? (
              <View style={{ gap: 6 }}>
                {ANSWERS.filter((a) => a.topic === topic).map((a) => (
                  <Pressable key={a.id} onPress={() => pickAnswer(a)} style={styles.qRow} accessibilityRole="button">
                    <Text style={styles.qText}>{a.q}</Text>
                    <Icon name="chevron" size={16} color={colors.inkFaint} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {state.questions.length ? (
            <View style={styles.savedCard}>
              <Text style={styles.browseLabel}>Saved for my team</Text>
              {state.questions.map((q) => (
                <View key={q.id} style={styles.savedRow}>
                  <Text style={styles.savedText}>{q.text}</Text>
                  <Pressable onPress={() => removeQuestion(q.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove saved question: ${q.text}`}>
                    <Icon name="close" size={16} color={colors.inkFaint} />
                  </Pressable>
                </View>
              ))}
              <Button
                label={`Send these to ${coordinator.name}`}
                icon="message"
                small
                tone="outline"
                style={{ alignSelf: 'flex-start' }}
                onPress={() => sendText(coordinator.phone, `Questions for my next appointment:\n${state.questions.map((q) => `- ${q.text}`).join('\n')}`)}
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            onSubmitEditing={(e) => submit(e.nativeEvent.text)}
            returnKeyType="send"
            accessibilityLabel="Ask Zoey a question"
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
  crisisBar: { backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  crisisText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 14, gap: 10, paddingBottom: 24 },
  checkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  checkTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  checkSub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  checkBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  zoeyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '90%' },
  avatar: { width: 30, height: 30, flexShrink: 0 },
  urgentBubble: { borderWidth: 2, borderColor: colors.red },
  zoeyBubble: { backgroundColor: '#fff', borderRadius: radius.md, borderBottomLeftRadius: 4, padding: 12, flexShrink: 1 },
  meBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '80%',
  },
  bubbleText: { fontSize: 16, lineHeight: 22, color: colors.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 38 },
  alts: { marginLeft: 38, gap: 4 },
  altLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  alt: { paddingVertical: 4 },
  altText: { fontSize: 15, color: colors.blue, fontWeight: '600' },
  browse: { gap: 10, marginTop: 8 },
  browseLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qText: { flex: 1, fontSize: 15, color: colors.ink },
  savedCard: { backgroundColor: colors.greenLight, borderRadius: radius.md, padding: 14, gap: 8, marginTop: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedText: { flex: 1, fontSize: 15, color: colors.ink },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.bg },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.ink,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
