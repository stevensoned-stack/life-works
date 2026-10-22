import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo, ZoeyAvatar } from '../components/Art';
import { CRISIS } from '../components/CrisisSheet';
import { ToggleRow } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, ScreenHeader, SectionLabel } from '../components/ui';
import { useStore } from '../data/store';
import { MODULES, ModuleId, Route } from '../modules';
import { colors, radius } from '../theme';

const safetyAlertText = (coord: string) =>
  `If you write something that sounds like you might be in danger (like hurting yourself, an overdose, abuse, withdrawal or losing your housing), Life Works saves those words and the few messages before them for ${coord} to go over with you, and gives you a button to text ${coord} a short alert asking for a check-in. The text doesn't include what you wrote. Nothing else you write is shared. You can change this in Settings.`;

const ZOEY_DISCLOSURE =
  "Zoey is an automated assistant. She is not a person, a counselor, or a therapist. She asks how you're doing, keeps your notes, and helps you reach real people.";

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { state, updateSettings } = useStore();
  return (
    <ScrollView
      style={{ backgroundColor: '#fff' }}
      contentContainerStyle={[styles.onb, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}
    >
      <Logo />
      <Text style={styles.onbTitle}>Welcome to Life Works, {state.profile.name}</Text>
      <View style={styles.onbZoey}>
        <ZoeyAvatar size={64} />
        <Text style={styles.onbZoeyName}>Meet Zoey</Text>
        <Text style={styles.onbText}>{ZOEY_DISCLOSURE}</Text>
      </View>
      <View style={styles.onbPoints}>
        {[
          'Check in a few times a day. Every question can be answered with a tap.',
          'Track your mood on LifePath and see how your weeks go.',
          'Ask Zoey questions about recovery, meetings and the app, any time.',
          'Count your clean time and keep your sponsor and support people one tap away.',
          'Your check-ins are saved on this phone.',
        ].map((t) => (
          <View key={t} style={styles.onbPoint}>
            <Icon name="check" size={18} color={colors.green} strokeWidth={3} />
            <Text style={[styles.onbText, { flex: 1, textAlign: 'left' }]}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={styles.onbShare}>
        <Text style={styles.onbShareTitle}>Safety alerts to {state.profile.coordinator.name}</Text>
        <Text style={[styles.onbText, { textAlign: 'left', fontSize: 15 }]}>{safetyAlertText(state.profile.coordinator.name)}</Text>
        <ToggleRow
          title={`Let ${state.profile.coordinator.name} know`}
          value={state.settings.shareSafetyAlerts}
          onChange={(v) => updateSettings({ shareSafetyAlerts: v })}
        />
      </View>
      <View style={styles.onbCrisis}>
        <Text style={styles.onbCrisisText}>
          If you ever feel unsafe, call or text <Text style={{ fontWeight: '800' }}>988</Text> any time, or{' '}
          <Text style={{ fontWeight: '800' }}>911</Text> in an emergency.
        </Text>
      </View>
      <Button label="Get started" onPress={() => updateSettings({ onboarded: true })} style={{ alignSelf: 'stretch' }} />
    </ScrollView>
  );
}

export function ComingSoonScreen({ module, back }: { module: ModuleId; back: () => void }) {
  const m = MODULES.find((x) => x.id === module)!;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={m.title} onBack={back} />
      <View style={styles.soon}>
        <View style={[styles.soonIcon, { backgroundColor: m.color }]}>
          {m.icon === 'zoey' ? <ZoeyAvatar size={72} /> : <Icon name={m.icon} size={36} />}
        </View>
        <Text style={styles.soonTitle}>{m.title} is coming soon</Text>
        <Text style={styles.soonText}>{m.about}</Text>
      </View>
    </View>
  );
}

export function SettingsScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, resetDemo, updateSettings } = useStore();
  const shared = state.safetyEvents.filter((e) => e.alert.status !== 'not_shared');
  const coord = state.profile.coordinator.name;
  const { wakeHour, sleepHour } = state.settings;
  const fmt = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Settings" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        <SectionLabel>About Zoey</SectionLabel>
        <Card style={{ flexDirection: 'row', gap: 12 }}>
          <ZoeyAvatar size={40} />
          <Text style={[styles.rowText, { flex: 1 }]}>{ZOEY_DISCLOSURE}</Text>
        </Card>

        <SectionLabel>Reminders</SectionLabel>
        <Pressable style={styles.linkCard} onPress={() => go({ name: 'reminders' })} accessibilityRole="button">
          <Icon name="bell" size={20} color={colors.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Check-in times and reminders</Text>
            <Text style={styles.small}>
              Awake {fmt(wakeHour)} to {fmt(sleepHour)}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={colors.inkFaint} />
        </Pressable>

        <SectionLabel>Crisis lines</SectionLabel>
        <Card style={{ gap: 4 }}>
          {[
            { label: 'Call 988', sub: 'Suicide & Crisis Lifeline, 24/7', url: CRISIS.call988 },
            { label: 'Text 988', sub: 'Suicide & Crisis Lifeline, 24/7', url: CRISIS.text988 },
            { label: 'Crisis Text Line', sub: 'Text HOME to 741741', url: CRISIS.crisisText },
            { label: '911', sub: 'Emergency', url: CRISIS.call911 },
          ].map((c) => (
            <Pressable key={c.label} style={styles.linkRow} onPress={() => Linking.openURL(c.url).catch(() => {})} accessibilityRole="button">
              <Icon name="phone" size={18} color={colors.red} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{c.label}</Text>
                <Text style={styles.small}>{c.sub}</Text>
              </View>
            </Pressable>
          ))}
        </Card>

        <SectionLabel>Safety alerts</SectionLabel>
        <Card style={{ gap: 10 }}>
          <Text style={styles.rowText}>{safetyAlertText(coord)}</Text>
          <ToggleRow
            title={`Let ${coord} know`}
            sub={state.settings.shareSafetyAlerts ? 'On' : `Off: alerts stay on this phone and ${coord} is not told`}
            value={state.settings.shareSafetyAlerts}
            onChange={(v) => updateSettings({ shareSafetyAlerts: v })}
          />
          <Text style={styles.small}>
            {shared.length} alert{shared.length === 1 ? '' : 's'} saved, {shared.filter((e) => e.alert.status === 'texted').length}{' '}
            texted to {coord}. The details stay on this phone until the Life Works service is connected; {coord} only gets the
            texts you choose to send.
          </Text>
          <Pressable style={styles.linkRow} onPress={() => go({ name: 'safetyreview' })} accessibilityRole="button">
            <Icon name="shield" size={18} color={colors.green} />
            <Text style={[styles.rowLabel, { flex: 1 }]}>See what {coord} sees</Text>
            <Icon name="chevron" size={18} color={colors.inkFaint} />
          </Pressable>
        </Card>

        <SectionLabel>Your data</SectionLabel>
        <Card style={{ gap: 12 }}>
          <Text style={styles.rowText}>
            Your mood entries and check-ins are saved on this phone. The only thing set to be shared is safety alerts, above.
          </Text>
          <Text style={styles.small}>
            {state.moods.length} mood entries · {state.checkins.filter((c) => c.completedAt).length} check-ins completed
          </Text>
          <Button label="Reset demo data" tone="outline" small onPress={resetDemo} style={{ alignSelf: 'flex-start' }} />
        </Card>
        <Text style={styles.version}>Life Works · preview</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  onb: { paddingHorizontal: 24, alignItems: 'center', gap: 20 },
  onbTitle: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  onbZoey: { alignItems: 'center', gap: 8, backgroundColor: colors.bg, borderRadius: radius.lg, padding: 18 },
  onbZoeyName: { fontSize: 18, fontWeight: '700', color: colors.ink },
  onbText: { fontSize: 16, color: colors.ink, lineHeight: 23, textAlign: 'center' },
  onbPoints: { gap: 12, alignSelf: 'stretch' },
  onbPoint: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  onbShare: { backgroundColor: colors.bg, borderRadius: radius.lg, padding: 16, gap: 8, alignSelf: 'stretch' },
  onbShareTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  onbCrisis: { backgroundColor: colors.redLight, borderRadius: radius.md, padding: 14, alignSelf: 'stretch' },
  onbCrisisText: { fontSize: 15, color: colors.redDark, textAlign: 'center', lineHeight: 21 },
  soon: { alignItems: 'center', padding: 32, gap: 14 },
  soonIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  soonTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  soonText: { fontSize: 16, color: colors.inkSoft, textAlign: 'center', lineHeight: 23 },
  rowText: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  version: { textAlign: 'center', fontSize: 12, color: colors.inkFaint },
});
