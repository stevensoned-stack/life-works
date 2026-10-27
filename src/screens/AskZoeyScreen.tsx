import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { spellFix } from '../zoey/spell';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MOOD_LABELS, ZoeyAvatar } from '../components/Art';
import { useChatScroll } from '../components/chatScroll';
import CrisisSheet from '../components/CrisisSheet';
import Icon from '../components/Icon';
import MoodScale, { moodBadge } from '../components/MoodScale';
import { Button, Chip, ScreenHeader } from '../components/ui';
import { newId, useStore } from '../data/store';
import { CheckIn, CheckInTurn, MoodValue } from '../data/types';
import { Route } from '../modules';
import { colors, radius } from '../theme';
import {
  copy,
  extractTags,
  FLOW_VERSION,
  KIND_LABEL,
  kindFor,
  NEGATIVE_TAGS,
  POSITIVE_TAGS,
  vary,
} from '../zoey/copy';
import { ask, urgentReply } from '../zoey/ask';
import { findFeeling, typedAnswer } from '../zoey/feelings';
import { buildContext } from '../zoey/context';
import { screen } from '../zoey/safety';
import { markSafe, raise, Risk, saysSafe, worry } from '../zoey/watch';
import { useZoeyVoice, VoiceToggle } from '../zoey/useVoice';
import { END, fill, lineFor, skipAfterShare, TreeAction, TreeNode, TREES } from '../zoey/trees';
import { alertText, makeEvent } from '../safety/events';
import { text as sendText } from '../recovery/contact';
import BreathingTimer from '../components/BreathingTimer';

const looksLikeQuestion = (t: string) =>
  /\?\s*$/.test(t) || /^(how|what|where|when|why|who|can|could|do|does|is|are|should|will)\b/i.test(t.trim());

type Item =
  // `quiet` lines are shown but never read aloud (urgent help and "are you safe?").
  | { id: string; kind: 'zoey'; text: string; quiet?: boolean }
  | { id: string; kind: 'me'; text: string }
  | { id: string; kind: 'mood' }
  | { id: string; kind: 'tags' }
  | { id: string; kind: 'breathing' }
  | { id: string; kind: 'footer' };

type Choice = { label: string; onPick: () => void };
type Stage = 'mood' | 'afterMood' | 'tree' | 'tags' | 'meds' | 'reflect' | 'journal' | 'done';

// Tags that come with an offer to call the coordinator, highest priority first.
const PRIORITY = ['Cravings', 'Housing', 'Feeling alone', 'Meds', 'Sleep', 'Money', 'Work or school', 'People'];
const CALL_TAGS = ['Cravings', 'Housing', 'Feeling alone'];

export default function AskZoeyScreen({ go, back }: { go: (r: Route) => void; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, recordMood, updateMood, saveCheckIn, logSafetyEvent, noteSafetyAction, markAlertTexted, saveQuestion } = useStore();
  const { name, coordinator } = state.profile;
  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  const kind = useRef(kindFor()).current;

  const [items, setItems] = useState<Item[]>(() => [
    { id: 'g', kind: 'zoey', text: copy.greet(name, kind) },
    { id: 'm', kind: 'mood' },
  ]);
  const [stage, setStage] = useState<Stage>('mood');
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsLocked, setTagsLocked] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [text, setText] = useState('');
  const [crisis, setCrisis] = useState<null | 'psychiatric' | 'medical'>(null);
  const [crisisShown, setCrisisShown] = useState(false);

  const moodId = useRef<string | null>(null);
  const resumeChoices = useRef<Choice[] | null>(null);
  const eventRef = useRef<string | null>(null);
  const noteAction = (label: string, raiseTo?: 3) => eventRef.current && noteSafetyAction(eventRef.current, label, raiseTo);
  const share = state.settings.shareSafetyAlerts;
  const textAlert = (tier: 1 | 2 | 3) => {
    sendText(coordinator.phone, alertText(name, tier));
    noteAction(`Text ${coordinator.name}`);
    if (eventRef.current) markAlertTexted(eventRef.current);
  };
  const record = useRef<CheckIn>({
    id: newId(),
    kind,
    flowVersion: FLOW_VERSION,
    startedAt: new Date().toISOString(),
    tags: [],
    turns: [{ from: 'zoey', text: copy.greet(name, kind), at: new Date().toISOString() }],
  });

  const persist = (patch: Partial<CheckIn> = {}) => {
    record.current = { ...record.current, ...patch };
    saveCheckIn(record.current);
  };

  const turn = (from: CheckInTurn['from'], t: string) => {
    record.current.turns = [...record.current.turns, { from, text: t, at: new Date().toISOString() }];
  };

  const add = (...next: Item[]) => setItems((xs) => [...xs, ...next]);
  const zoey = (t: string, quiet?: boolean): Item => {
    turn('zoey', t);
    return { id: newId(), kind: 'zoey', text: t, quiet };
  };
  const me = (t: string): Item => {
    turn('me', t);
    return { id: newId(), kind: 'me', text: t };
  };

  const spoken = useMemo(() => items.flatMap((i) => (i.kind === 'zoey' ? [i] : [])), [items]);
  useZoeyVoice(spoken, crisis !== null);

  const { scrollProps, track, keep } = useChatScroll(useMemo(() => items.map((i) => i.id), [items]), choices.length > 0);

  // Step 1: mood. Recorded as a self-report the moment it's tapped.
  const pickMood = (v: MoodValue) => {
    if (mood !== null) return;
    setMood(v);
    const entry = recordMood(v);
    moodId.current = entry.id;
    add(me(`${MOOD_LABELS[v]} (${moodBadge(v)})`), zoey(copy.afterMood(v)));
    persist({ moodId: entry.id });
    setStage('afterMood');
    setChoices([
      {
        label: 'Keep going',
        onPick: () => {
          add(me('Keep going'));
          if (v < 0) runTrees(['feeling-bad'], () => toTags(v));
          else toTags(v);
        },
      },
      { label: 'Just journal', onPick: toJournal },
    ]);
  };

  // Step 2: what's behind it.
  const toTags = (v: MoodValue) => {
    add(zoey(tagsRef.current.length ? copy.askMoreTags : copy.askTags(v)), { id: newId(), kind: 'tags' });
    setChoices([]);
    setStage('tags');
  };

  const toggleTag = (t: string) => setTags((xs) => (xs.includes(t) ? xs.filter((x) => x !== t) : [...xs, t]));

  const finishTags = () => {
    setTagsLocked(true);
    if (moodId.current) updateMood(moodId.current, { tags });
    persist({ tags });
    add(me(tags.length ? tags.join(', ') : 'Nothing in particular'));
    if (kind === 'morning') {
      add(zoey(copy.askMeds));
      setStage('meds');
      setChoices([
        { label: 'Yes', onPick: () => answerMeds('yes', 'Yes') },
        { label: 'Not yet', onPick: () => answerMeds('not_yet', 'Not yet') },
        { label: "I don't take any", onPick: () => answerMeds('none', "I don't take any") },
      ]);
    } else {
      startReflect();
    }
  };

  const answerMeds = (a: 'yes' | 'not_yet' | 'none', label: string) => {
    add(me(label));
    persist({ meds: a });
    if (a === 'not_yet') return runTrees(['meds-not-yet'], startReflect);
    add(zoey(copy.meds[a]));
    startReflect();
  };

  // Step 3: a short yes/no tree for up to two of their tags, then close.
  const startReflect = () => {
    setStage('reflect');
    setChoices([]);
    const evening = kind === 'evening' && buildContext(state).meetingsThisWeek === 0 ? ['meetings'] : [];
    if (mood !== null && mood >= 1) {
      add(zoey(vary('positive')));
      return runTrees(['going-well', ...evening], finish);
    }
    const queue = PRIORITY.filter((t) => tagsRef.current.includes(t) && TREES[t]).slice(0, 2);
    runTrees([...queue, ...evening], finish);
  };

  const tagsRef = useRef(tags);
  tagsRef.current = tags;

  // --- Decision trees (src/zoey/trees.ts) -----------------------------------
  const vars = { coord: coordinator.name, sponsor: sponsor?.name.split(' ')[0] ?? null, name };
  const sharing = useRef<{ node: TreeNode; go: () => void } | null>(null);
  // A typed answer to a yes / no question; true if it answered it.
  const listening = useRef<((t: string) => boolean) | null>(null);

  const runTrees = (ids: string[], then: () => void): void => {
    const [id, ...rest] = ids;
    if (!id) return then();
    const tree = TREES[id];
    if (!tree) return runTrees(rest, then);
    setStage('tree');
    runNode(tree.id, tree.start, () => runTrees(rest, then));
  };

  // `quiet`: Zoey already rephrased this node's question, so don't say it twice.
  const runNode = (treeId: string, nodeId: string, done: () => void, quiet = false): void => {
    listening.current = null;
    if (nodeId === END) return done();
    const n = TREES[treeId].nodes[nodeId];
    const next = (id: string | undefined) => (): void => runNode(treeId, id ?? END, done);
    // Typed replies to her question: an answer, "what do you mean?", "why?", "no".
    // Something shared on a share node is left to the sharing step in send().
    const hear = (t: string) => {
      const r = typedAnswer(TREES[treeId], nodeId, t);
      if (!r || (n.share && r.told)) return false;
      sharing.current = null;
      if (r.told) noteMood(t);
      if (r.say) add(zoey(fill(r.say, vars)));
      if (r.again) runNode(treeId, nodeId, done, true);
      else next(r.to)();
      return true;
    };
    if (n.tags?.length) {
      const merged = Array.from(new Set([...tagsRef.current, ...n.tags]));
      tagsRef.current = merged;
      setTags(merged);
    }
    if (n.say && !quiet) add(zoey(fill(lineFor(n), vars)));
    if (n.save && !quiet) saveQuestion(n.save);
    persist();

    if (n.safety) {
      // A tapped answer that means danger gets the same help as typed words.
      flagSafety({ kind: 'urgent', variant: n.safety, matched: `tree:${treeId}/${nodeId}` }, `${TREES[treeId].title}: ${n.safety}`);
      return showUrgent(n.safety, next(n.next));
    }
    if (n.yes || n.no) {
      const pick = (label: string, to: string | undefined) => ({ label, onPick: () => (add(me(label)), next(to)()) });
      // Typing works too: "yes" / "no", or for "Can you tell me more?" just telling more.
      listening.current = hear;
      return setChoices([
        pick('Yes', n.yes),
        pick('No', n.no),
        ...(n.notSure ? [pick("I'm not sure", n.notSure)] : []),
      ]);
    }
    if (n.share) {
      sharing.current = { node: n, go: next(n.share) };
      listening.current = hear;
      return setChoices([
        {
          label: "I'd rather not",
          onPick: (): void => {
            add(me("I'd rather not"));
            sharing.current = null;
            add(zoey(vary('rather')));
            next(skipAfterShare(TREES[treeId], nodeId))();
          },
        },
      ]);
    }
    // Sponsor buttons only when there is a sponsor in LifeCircle.
    const offers = (n.offer ?? []).filter((o) => sponsor || (o.action !== 'callSponsor' && o.action !== 'textSponsor'));
    if (offers.length) {
      return setChoices([
        ...offers.map((o) => {
          const label = fill(o.label, vars);
          return { label, onPick: () => (add(me(label)), doAction(o.action), next(n.next)()) };
        }),
        { label: 'Keep going', onPick: () => (add(me('Keep going')), next(n.next)()) },
      ]);
    }
    next(n.next)();
  };

  const noteMood = (t: string) => {
    if (!moodId.current) return;
    const prev = state.moods.find((m) => m.id === moodId.current)?.note;
    updateMood(moodId.current, { note: prev ? `${prev}\n${t}` : t });
  };

  const doAction = (a: TreeAction) => {
    const phone = a === 'callSponsor' || a === 'textSponsor' ? (sponsor?.phone ?? coordinator.phone) : coordinator.phone;
    switch (a) {
      case 'callCoordinator':
      case 'callSponsor':
        return Linking.openURL(`tel:${phone}`).catch(() => {});
      case 'textSponsor':
        return sendText(phone);
      case 'call211':
        return Linking.openURL('tel:211').catch(() => {});
      case 'breathing':
        return add({ id: newId(), kind: 'breathing' });
      case 'findMeeting':
        return go({ name: 'calendar', tab: 'meetings' });
      case 'localHelp':
        return go({ name: 'resources', category: 'Eviction and legal help' });
      case 'openLifeCircle':
        return go({ name: 'lifecircle' });
    }
  };

  const toJournal = () => {
    add(me('Just journal'), zoey(copy.journalPrompt));
    setChoices([]);
    setStage('journal');
  };

  const finish = () => {
    add(zoey(copy.done(name)), { id: newId(), kind: 'footer' });
    persist({ completedAt: new Date().toISOString() });
    setStage('done');
    setChoices([
      { label: 'See my LifePath', onPick: () => go({ name: 'lifepath' }) },
      { label: 'Ask a question', onPick: () => go({ name: 'ask' }) },
      { label: 'Back to home', onPick: back },
    ]);
  };

  // Abuse, withdrawal, using, pregnancy, someone else, or housing: people and 911 first, then carry on with `after`.
  const showUrgent = (variant: Parameters<typeof urgentReply>[0], after: () => void) => {
    const r = urgentReply(variant, buildContext(state));
    add(zoey(r.text, true));
    setChoices([
      ...r.actions.map((a) => ({
        label: a.label,
        onPick: () => {
          add(me(a.label));
          noteAction(a.label);
          if (a.kind === 'route') return go(a.route);
          if (a.kind === 'url') Linking.openURL(a.url).catch(() => {});
          else {
            const n = a.kind === 'phone' ? a.number : a.kind === 'call' && a.who === 'sponsor' ? sponsor?.phone : coordinator.phone;
            if (n) Linking.openURL(`tel:${n}`).catch(() => {});
          }
          after();
        },
      })),
      ...(share
        ? [
            {
              label: `Text ${coordinator.name} to check on me`,
              onPick: () => (add(me(`Text ${coordinator.name}`)), textAlert(2), after()),
            },
          ]
        : []),
      { label: 'Not now', onPick: () => (add(me('Not now')), noteAction('Not now'), after()) },
    ]);
    persist();
  };

  // Saved for the counselor in the same update that shows the help, so it never delays it.
  const flagSafety = (s: Exclude<ReturnType<typeof screen>, { kind: 'none' }>, message: string) => {
    risk.current = raise(risk.current, s);
    const id = newId();
    eventRef.current = id;
    logSafetyEvent(
      makeEvent({
        id,
        result: s,
        message,
        history: record.current.turns.slice(0, -1),
        screen: 'checkin',
        coordinatorName: coordinator.name,
        share: state.settings.shareSafetyAlerts,
      }),
    );
  };

  // Danger words from earlier in this check-in; Zoey keeps checking on them (watch.ts).
  const risk = useRef<Risk | null>(null);

  // Free text: the safety screen runs first, every time.
  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    add(me(t));
    // Typos fixed for reading (spell.ts); safety reads what they typed first, and the
    // fixed text can only add a safety reply. Their note is saved as they wrote it.
    const sp = spellFix(t, [state.profile.coordinator.name, ...state.people.map((p) => p.name)]);
    const heard = sp.sure;
    const first = screen(t);
    const s = first.kind !== 'none' ? first : screen(sp.all);
    if (s.kind !== 'none') flagSafety(s, t);
    if (s.kind === 'crisis') {
      resumeChoices.current = resumeChoices.current ?? choices;
      setChoices([]);
      setCrisis(s.variant);
      setCrisisShown(true);
      persist();
      return;
    }
    if (s.kind === 'urgent') {
      resumeChoices.current = resumeChoices.current ?? choices;
      showUrgent(s.variant, restoreChoices);
      return;
    }
    if (s.kind === 'check') {
      resumeChoices.current = resumeChoices.current ?? choices;
      add(zoey(copy.safetyCheck, true));
      setChoices([
        { label: "Yes, I'm safe", onPick: () => (add(me("Yes, I'm safe")), noteAction("Yes, I'm safe"), afterSafe()) },
        { label: 'No', onPick: () => (add(me('No')), noteAction('No', 3), setCrisis('psychiatric'), setCrisisShown(true)) },
        {
          label: "I'm not sure",
          onPick: () => (add(me("I'm not sure")), noteAction("I'm not sure", 3), setCrisis('psychiatric'), setCrisisShown(true)),
        },
      ]);
      persist();
      return;
    }

    // Earlier danger words: before carrying on, say she's still worried and offer help.
    if (risk.current) {
      if (saysSafe(t)) risk.current = markSafe(risk.current);
      const w = worry(risk.current, buildContext(state));
      risk.current = w.risk;
      if (w.reply) add(zoey(w.reply.text, true));
    }

    // A typed yes / no, or telling more, while a tree asks a question.
    const answering = listening.current;
    if (answering) {
      listening.current = null;
      if (answering(t)) return persist();
    }
    // An answer to a tree's "would you share...?" question.
    if (sharing.current) {
      const { node, go: onward } = sharing.current;
      sharing.current = null;
      if (moodId.current) {
        const prev = state.moods.find((m) => m.id === moodId.current)?.note;
        updateMood(moodId.current, { note: prev ? `${prev}\n${t}` : t });
      }
      for (const f of extractTags(t).filter((x) => NEGATIVE_TAGS.includes(x))) {
        if (!tagsRef.current.includes(f)) tagsRef.current = [...tagsRef.current, f];
      }
      setTags(tagsRef.current);
      if (node.saveShared) saveQuestion(t);
      persist();
      return onward();
    }
    // A typed feeling ("I'm angry"): ask if they know why, then carry on where they were.
    const feeling = stage !== 'tree' && stage !== 'tags' && stage !== 'journal' ? findFeeling(t) : null;
    if (feeling) {
      if (moodId.current) {
        const prev = state.moods.find((m) => m.id === moodId.current)?.note;
        updateMood(moodId.current, { note: prev ? `${prev}\n${t}` : t });
      }
      resumeChoices.current = resumeChoices.current ?? choices;
      const was = stage;
      runTrees([`feeling:${feeling.key}`], () => (setStage(was), restoreChoices()));
      persist();
      return;
    }
    const found = extractTags(heard);
    const qa = looksLikeQuestion(heard) ? ask(heard, buildContext(state)) : null;
    if (moodId.current) {
      const prev = state.moods.find((m) => m.id === moodId.current)?.note;
      updateMood(moodId.current, { note: prev ? `${prev}\n${t}` : t });
    }
    if (stage === 'journal') {
      add(zoey(vary('journalSaved')));
      finish();
    } else if (stage === 'tags' && !tagsLocked) {
      setTags((xs) => Array.from(new Set([...xs, ...found.filter((f) => NEGATIVE_TAGS.includes(f))])));
      add(zoey(found.length ? `Got it. I've marked ${found.join(', ')}. Tap Done when you're ready.` : vary('freeTextAck')));
    } else if (qa?.kind === 'medication') {
      add(zoey(vary('medsFreeText')));
    } else if (qa?.kind === 'answer') {
      // A question mid check-in gets the same authored answer AskZoey gives.
      add(zoey(qa.text));
    } else if (found.includes('Meds') && /hate|stop|quit|dont want|don't want|not taking/i.test(t)) {
      add(zoey(vary('medsFreeText')));
    } else if (found.some((f) => CALL_TAGS.includes(f))) {
      // e.g. "my roommate says I have to be out tonight": reflect and offer the coordinator.
      const tag = PRIORITY.find((p) => found.includes(p) && CALL_TAGS.includes(p))!;
      resumeChoices.current = resumeChoices.current ?? choices;
      add(zoey(vary(`reflect.${tag}`)));
      setChoices([
        {
          label: `Call ${coordinator.name}`,
          onPick: () => {
            add(me(`Call ${coordinator.name}`));
            Linking.openURL(`tel:${coordinator.phone}`).catch(() => {});
            restoreChoices();
          },
        },
        { label: 'Not now', onPick: () => (add(me('Not now')), restoreChoices()) },
      ]);
    } else if (stage === 'mood') {
      add(zoey(`${vary('freeTextAck')} When you're ready, tap how you're feeling above.`));
    } else {
      add(zoey(vary('freeTextAck')));
    }
    persist();
  };

  const restoreChoices = () => {
    setChoices(resumeChoices.current ?? []);
    resumeChoices.current = null;
  };

  const afterSafe = () => {
    risk.current = markSafe(risk.current);
    add(zoey(copy.safeYes));
    // Still ask what's behind it, then the LifeCircle (Ed, 2026-10-25), then carry on.
    const was = stage;
    runTrees(['after-safe'], () => (setStage(was), restoreChoices()));
    persist();
  };

  const step = stage === 'mood' || stage === 'afterMood' || (stage === 'tree' && !tagsLocked) ? 1 : stage === 'tags' || stage === 'meds' ? 2 : 3;
  const tagOptions = mood !== null && mood >= 1 ? POSITIVE_TAGS : NEGATIVE_TAGS;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="AskZoey" onBack={back} left={<ZoeyAvatar size={28} />} right={<VoiceToggle />} />
      {crisisShown ? (
        <Pressable style={styles.crisisBar} onPress={() => setCrisis(crisis ?? 'psychiatric')} accessibilityRole="button">
          <Icon name="phone" size={16} />
          <Text style={styles.crisisBarText}>988 Crisis Lifeline · 911 in an emergency</Text>
        </Pressable>
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Text style={styles.step}>
          {KIND_LABEL[kind]} · Step {step} of 3
        </Text>
        <ScrollView {...scrollProps} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {items.map((it) => {
            switch (it.kind) {
              case 'zoey':
                return (
                  <View key={it.id} style={styles.zoeyRow} onLayout={track(it.id)}>
                    <View style={styles.avatar}>
                      <ZoeyAvatar size={30} />
                    </View>
                    <View style={styles.zoeyBubble}>
                      <Text style={styles.bubbleText}>{it.text}</Text>
                    </View>
                  </View>
                );
              case 'me':
                return (
                  <View key={it.id} style={styles.meBubble} onLayout={track(it.id)}>
                    <Text style={[styles.bubbleText, { color: '#fff' }]}>{it.text}</Text>
                  </View>
                );
              case 'mood':
                return (
                  <View key={it.id} style={styles.widget} onLayout={track(it.id)}>
                    <Text style={styles.widgetLabel}>Rate your mood from −2 to +2</Text>
                    <MoodScale value={mood} onChange={pickMood} disabled={mood !== null} compact />
                  </View>
                );
              case 'tags':
                return (
                  <View key={it.id} style={styles.chipsWrap} onLayout={track(it.id)}>
                    <View style={styles.chips}>
                      {tagOptions.map((t) => (
                        <Chip key={t} label={t} selected={tags.includes(t)} onPress={() => toggleTag(t)} disabled={tagsLocked} />
                      ))}
                    </View>
                    {!tagsLocked ? <Button label={tags.length ? 'Done' : 'Nothing in particular'} small onPress={finishTags} style={{ alignSelf: 'flex-start' }} /> : null}
                  </View>
                );
              case 'breathing':
                return (
                  <View key={it.id} onLayout={track(it.id)}>
                    <BreathingTimer />
                  </View>
                );
              case 'footer':
                return (
                  <Text key={it.id} style={styles.footer} onLayout={track(it.id)}>
                    {copy.footer}
                  </Text>
                );
            }
          })}
          {choices.length ? (
            <View style={[styles.chips, { marginLeft: 38 }]} onLayout={keep}>
              {choices.map((c, i) => (
                <Chip
                  key={c.label}
                  label={c.label}
                  onPress={() => {
                    setChoices([]);
                    c.onPick();
                  }}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={colors.inkFaint}
            // The phone's own spell check and autocorrect (Ed, 2026-10-25).
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
            style={styles.input}
            onSubmitEditing={send}
            returnKeyType="send"
            accessibilityLabel="Message to Zoey"
          />
          <Pressable onPress={send} style={styles.sendBtn} accessibilityRole="button" accessibilityLabel="Send">
            <Icon name="send" size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <CrisisSheet
        visible={crisis !== null}
        variant={crisis ?? 'psychiatric'}
        coordinator={coordinator}
        onSafe={() => {
          setCrisis(null);
          afterSafe();
        }}
        onAction={(label) => noteAction(label)}
        onTextCoordinator={share && eventRef.current ? () => textAlert(3) : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  crisisBar: {
    backgroundColor: colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  crisisBarText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  step: { ...{ fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: colors.inkSoft }, textAlign: 'center', textTransform: 'uppercase', paddingTop: 12 },
  list: { padding: 14, gap: 10, paddingBottom: 24 },
  zoeyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '88%' },
  avatar: { width: 30, height: 30, flexShrink: 0 },
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
  widget: { backgroundColor: '#fff', borderRadius: radius.md, padding: 10, marginLeft: 38, gap: 6 },
  widgetLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: colors.inkSoft, textAlign: 'center', textTransform: 'uppercase' },
  chipsWrap: { marginLeft: 38, gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', paddingHorizontal: 16, marginTop: 4 },
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
