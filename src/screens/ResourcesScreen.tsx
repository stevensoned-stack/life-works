import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, ScreenHeader } from '../components/ui';
import { CURRENT_REGION, Resource, RESOURCE_CATEGORIES, ResourceCategory } from '../data/resources';
import { useStore } from '../data/store';
import { call, formatPhone, text } from '../recovery/contact';
import { colors, radius } from '../theme';
import { fromYmd } from '../util';

export default function ResourcesScreen({ back, initialCategory }: { back: () => void; initialCategory?: ResourceCategory }) {
  const insets = useSafeAreaInsets();
  const { state } = useStore();
  const [cat, setCat] = useState<ResourceCategory | null>(initialCategory ?? null);
  const region = CURRENT_REGION;
  const coordinator = state.profile.coordinator;
  const checked = fromYmd(region.checked).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const shown = RESOURCE_CATEGORIES.filter((c) => !cat || c === cat);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Local help" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        <Card style={{ gap: 10 }}>
          <Text style={styles.lead}>{region.name}</Text>
          <Text style={styles.small}>
            Checked {checked}. Beds and hours change often, so call ahead. {coordinator.name} can help you choose and make the call.
          </Text>
          <View style={styles.row}>
            <Button label={`Call ${coordinator.name}`} icon="phone" small onPress={() => call(coordinator.phone)} />
            <Button label="Call 211" icon="phone" small tone="outline" onPress={() => call('211')} />
            {region.shelterFinder ? (
              <Button
                label={region.shelterFinder.label}
                small
                tone="outline"
                onPress={() => Linking.openURL(region.shelterFinder!.url).catch(() => {})}
              />
            ) : null}
          </View>
        </Card>

        <View style={styles.row}>
          <Chip label="All" selected={!cat} onPress={() => setCat(null)} />
          {RESOURCE_CATEGORIES.map((c) => (
            <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(cat === c ? null : c)} />
          ))}
        </View>

        {shown.map((c) => (
          <View key={c} style={{ gap: 8 }}>
            <Text style={styles.section}>{c}</Text>
            {region.resources
              .filter((r) => r.category === c)
              .map((r) => (
                <ResourceCard key={r.id} r={r} />
              ))}
          </View>
        ))}
        <Text style={styles.foot}>
          Listings come from the City of Spokane and other public sources. Life Works is not connected to these organizations.
        </Text>
      </ScrollView>
    </View>
  );
}

function ResourceCard({ r }: { r: Resource }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{r.name}</Text>
      <Text style={styles.body}>{r.about}</Text>
      {r.address || r.hours ? <Text style={styles.small}>{[r.address, r.hours].filter(Boolean).join(' · ')}</Text> : null}
      <View style={styles.row}>
        {r.phone ? <Button label={formatPhone(r.phone)} icon="phone" small onPress={() => call(r.phone!)} /> : null}
        {r.textNumber ? <Button label="Text" icon="message" small tone="outline" onPress={() => text(r.textNumber!)} /> : null}
        {r.url ? <Button label="Website" small tone="outline" onPress={() => Linking.openURL(r.url!).catch(() => {})} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 18, fontWeight: '700', color: colors.ink },
  section: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: radius.md, padding: 14, gap: 6 },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foot: { fontSize: 12, color: colors.inkFaint, textAlign: 'center', lineHeight: 17 },
});
