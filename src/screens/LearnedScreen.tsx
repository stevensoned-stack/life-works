import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ToggleRow } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, ScreenHeader, SectionLabel } from '../components/ui';
import { useStore } from '../data/store';
import { colors } from '../theme';
import { ANSWERS } from '../zoey/answers';
import { forget, isEmpty, LearnedKind, replyStyle } from '../zoey/learn';

// Settings > What Zoey has learned: everything in their "how I talk" profile
// (learn.ts), in plain words, each with a remove button, and clear all.
export const LEARNING_TEXT =
  'Zoey learns a little about how you talk so she understands you better: words and spellings you use, the way you ask things, what to call you, and whether you like short answers. It is encrypted and kept only on this phone. It is never sent to staff. She never learns from messages about your safety or medicine, and learning never changes how she responds when you might be in danger.';

// The second, separate choice: sending missed sayings to the team (teach.ts).
export const SHARE_MISSED_TEXT =
  'When Zoey doesn’t understand a short saying, Life Works can send just that saying to the Life Works team so they can teach her, and every resident’s Zoey gets better. Names, numbers and links are taken out first, it never includes who said it, and it never includes anything about your safety or medicine. Long messages are never sent.';

export default function LearnedScreen({ back }: { back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, updateSettings, forgetLearned, clearLearned } = useStore();
  const l = state.learned;
  const on = state.settings.zoeyLearns;
  const drop = (kind: LearnedKind, key?: string) => forgetLearned((x) => forget(x, kind, key));
  const style = replyStyle(l);

  const Row = ({ label, sub, kind, k }: { label: string; sub?: string; kind: LearnedKind; k?: string }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={styles.small}>{sub}</Text> : null}
      </View>
      <Pressable onPress={() => drop(kind, k)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove: ${label}`}>
        <Icon name="close" size={16} color={colors.inkFaint} />
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="What Zoey has learned" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        <Card style={{ gap: 10 }}>
          <Text style={styles.text}>{LEARNING_TEXT}</Text>
          <ToggleRow
            title="Zoey learns how I talk"
            sub={on ? 'On' : 'Off: Zoey won’t learn anything new or use what she learned'}
            value={on}
            onChange={(v) => updateSettings({ zoeyLearns: v })}
          />
        </Card>

        {isEmpty(l) ? (
          <Card>
            <Text style={styles.text}>Nothing yet. As you talk with Zoey, what she learns shows up here.</Text>
          </Card>
        ) : null}

        {l.nickname || style ? (
          <>
            <SectionLabel>About you</SectionLabel>
            <Card style={{ gap: 4 }}>
              {l.nickname ? <Row label={`Calls you ${l.nickname}`} kind="nickname" /> : null}
              {style ? (
                <Row
                  label={style === 'short' ? 'You like short answers' : 'You like the whole answer'}
                  sub={l.replies ? 'You asked for this' : 'From how you write'}
                  kind="replies"
                />
              ) : null}
              {l.hellos[0] && l.hellos[0].n >= 2 ? <Row label={`You usually say “${l.hellos[0].word}”`} kind="hello" /> : null}
            </Card>
          </>
        ) : null}

        {l.words.length ? (
          <>
            <SectionLabel>Your words</SectionLabel>
            <Card style={{ gap: 4 }}>
              {l.words.map((w) => (
                <Row key={w.said} label={`“${w.said}” means “${w.means}”`} kind="word" k={w.said} />
              ))}
            </Card>
          </>
        ) : null}

        {l.phrases.length ? (
          <>
            <SectionLabel>How you ask things</SectionLabel>
            <Card style={{ gap: 4 }}>
              {l.phrases.map((p) => (
                <Row key={p.said} label={`“${p.said}”`} sub={`Zoey answers: ${ANSWERS.find((a) => a.id === p.answer)?.q ?? p.answer}`} kind="phrase" k={p.said} />
              ))}
            </Card>
          </>
        ) : null}

        {l.topics.length ? (
          <>
            <SectionLabel>What you ask about most</SectionLabel>
            <Card style={{ gap: 4 }}>
              {l.topics.slice(0, 8).map((t) => (
                <Row key={t.answer} label={t.q} sub={`${t.n} time${t.n === 1 ? '' : 's'}`} kind="topic" k={t.answer} />
              ))}
            </Card>
          </>
        ) : null}

        {l.people.length ? (
          <>
            <SectionLabel>People you mention</SectionLabel>
            <Card style={{ gap: 4 }}>
              {l.people.map((p) => (
                <Row key={p.who} label={p.rel && p.rel !== p.who ? `${p.who} (your ${p.rel})` : p.who} kind="person" k={p.who} />
              ))}
            </Card>
          </>
        ) : null}

        <SectionLabel>Help teach Zoey for everyone</SectionLabel>
        <Card style={{ gap: 10 }}>
          <Text style={styles.text}>{SHARE_MISSED_TEXT}</Text>
          <ToggleRow
            title="Help teach Zoey"
            sub={state.settings.shareMissed ? 'On' : 'Off: sayings Zoey misses stay on this phone'}
            value={state.settings.shareMissed}
            onChange={(v) => updateSettings({ shareMissed: v })}
          />
          {state.settings.shareMissed && state.missedOutbox.length ? (
            <Text style={styles.small}>
              {state.missedOutbox.length} saying{state.missedOutbox.length === 1 ? '' : 's'} waiting to send:{' '}
              {state.missedOutbox.slice(-3).map((m) => `“${m.phrase}”`).join(', ')}
            </Text>
          ) : null}
        </Card>

        {!isEmpty(l) ? <Button label="Clear everything Zoey learned" tone="outline" small onPress={clearLearned} style={{ alignSelf: 'flex-start' }} /> : null}
        <Text style={styles.small}>
          Zoey doesn’t keep your conversations here, only these short notes. Your safety alerts are separate and work the same
          whether learning is on or off.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
});
