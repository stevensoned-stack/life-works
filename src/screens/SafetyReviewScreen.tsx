import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, ScreenHeader } from '../components/ui';
import { useStore } from '../data/store';
import { SafetyEvent } from '../data/types';
import { TIER_LABEL } from '../safety/events';
import { syncConfig } from '../safety/sync';
import { colors, radius } from '../theme';
import { timeLabel } from '../util';

// A preview of the counselor's alert queue (build plan sec. 08). In the real
// product this lives in the web console behind staff sign-in and a consent
// check; here it shows what Maya would see, using this phone's records.
export default function SafetyReviewScreen({ back }: { back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, reviewSafetyEvent } = useStore();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const coordinator = state.profile.coordinator;
  const events = [...state.safetyEvents]
    .filter((e) => e.alert.status !== 'not_shared')
    .filter((e) => filter === 'all' || !e.review)
    .sort((a, b) => b.tier - a.tier || b.at.localeCompare(a.at));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Counselor review" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        <Card style={{ gap: 6 }}>
          <Text style={styles.lead}>What {coordinator.name} sees</Text>
          <Text style={styles.small}>
            Preview of the counselor's alert list. Each alert shows the words that set it off, the messages before it, what
            Life Works showed, and what {state.profile.name} tapped. {coordinator.name} gets a short text alert when{' '}
            {state.profile.name} chooses to send one; the details stay here.
          </Text>
        </Card>
        <View style={styles.row}>
          <Chip label="Needs review" selected={filter === 'open'} onPress={() => setFilter('open')} />
          <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        </View>
        {events.length === 0 ? (
          <Text style={styles.empty}>{filter === 'open' ? 'Nothing waiting for review.' : 'No safety alerts yet.'}</Text>
        ) : (
          events.map((e) => <EventCard key={e.id} e={e} reviewer={coordinator.name} onReview={reviewSafetyEvent} />)
        )}
      </ScrollView>
    </View>
  );
}

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeLabel(iso)}`;
};

function EventCard({ e, reviewer, onReview }: { e: SafetyEvent; reviewer: string; onReview: (id: string, by: string, note: string) => void }) {
  const [note, setNote] = useState('');
  const tone = e.tier === 3 ? colors.red : colors.module.lifeevent;
  return (
    <View style={[styles.card, { borderLeftColor: tone }]}>
      <View style={[styles.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={[styles.tier, { color: tone }]}>
          Tier {e.tier} · {TIER_LABEL[e.tier]}
        </Text>
        <Text style={styles.small}>{when(e.at)}</Text>
      </View>
      <Text style={styles.small}>
        {{ ask: 'AskZoey', checkin: 'Check-in', checkinout: 'Check In/Out', myhome: 'MyHome' }[e.screen]} · flagged words: “{e.matched}”
      </Text>

      <View style={styles.context}>
        {e.context.map((t, i) => (
          <Text key={i} style={styles.ctx} numberOfLines={3}>
            <Text style={styles.who}>{t.from === 'me' ? 'Them: ' : 'Zoey: '}</Text>
            {t.text}
          </Text>
        ))}
        <Text style={[styles.ctx, styles.trigger]}>
          <Text style={styles.who}>Them: </Text>
          {e.message}
        </Text>
      </View>

      <Text style={styles.small}>Shown: {e.shown}</Text>
      <Text style={styles.small}>
        Tapped: {e.taken.length ? e.taken.map((a) => `${a.label} (${timeLabel(a.at)})`).join(', ') : 'nothing yet'}
      </Text>
      <Text style={styles.small}>
        Alert to {e.alert.to}:{' '}
        {e.alert.status === 'texted'
          ? `text opened on their phone at ${timeLabel(e.alert.sentAt!)} (can't confirm it was sent)`
          : e.alert.status === 'queued'
            ? 'not texted from the phone'
            : e.alert.status}
      </Text>
      <Text style={styles.small}>
        Life Works service:{' '}
        {e.alert.syncedAt
          ? `received ${when(e.alert.syncedAt)}; it texts ${e.alert.to} and keeps the alert for review`
          : syncConfig()
            ? 'waiting to send (no connection yet)'
            : 'not connected in this version'}
      </Text>

      {e.review ? (
        <Text style={styles.reviewed}>
          Reviewed by {e.review.by}, {when(e.review.at)}
          {e.review.note ? `: ${e.review.note}` : ''}
        </Text>
      ) : (
        <View style={{ gap: 8 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Note (what you did, e.g. called, left voicemail)"
            placeholderTextColor={colors.inkFaint}
            style={styles.input}
            accessibilityLabel="Review note"
          />
          <Button label="Mark reviewed" small onPress={() => onReview(e.id, reviewer, note.trim())} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 17, fontWeight: '700', color: colors.ink },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  empty: { textAlign: 'center', color: colors.inkSoft, fontSize: 15, padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, gap: 8, borderLeftWidth: 5 },
  tier: { fontSize: 15, fontWeight: '800' },
  context: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: 10, gap: 4 },
  ctx: { fontSize: 14, color: colors.inkSoft, lineHeight: 19 },
  who: { fontWeight: '700' },
  trigger: { color: colors.ink, fontWeight: '600' },
  reviewed: { fontSize: 14, color: colors.green, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: 10, fontSize: 15, color: colors.ink, backgroundColor: '#fff' },
});
