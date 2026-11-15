import React from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import Icon, { IconName } from './Icon';

// The Tier 3 interrupt from build plan section 06. Shown full screen, with
// one-tap actions rather than links in a chat bubble. It has no close button;
// the person leaves it by confirming they are safe. 988 replaced the old
// 1-800-273-8255 Lifeline number in 2022, so the old number is not offered.
// Numbers must be re-verified before launch and quarterly after.

export const CRISIS = {
  call988: 'tel:988',
  text988: 'sms:988',
  call911: 'tel:911',
  crisisText: Platform.OS === 'ios' ? 'sms:741741&body=HOME' : 'sms:741741?body=HOME',
};

type Action = { label: string; sub: string; url: string; icon: IconName; primary?: boolean };

export default function CrisisSheet({
  visible,
  variant,
  coordinator,
  onSafe,
  onAction,
  onTextCoordinator,
}: {
  visible: boolean;
  variant: 'psychiatric' | 'medical';
  coordinator: { name: string; phone: string };
  onSafe: () => void;
  onAction?: (label: string) => void;
  // Shown only when the person has said yes to safety alerts.
  onTextCoordinator?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  const call911: Action = { label: 'Call 911', sub: 'Emergency services', url: CRISIS.call911, icon: 'phone' };
  const call988: Action = { label: 'Call 988', sub: 'Suicide & Crisis Lifeline, 24/7', url: CRISIS.call988, icon: 'phone' };
  const actions: Action[] =
    variant === 'medical'
      ? [
          { ...call911, primary: true },
          call988,
          { label: 'Text 988', sub: 'Suicide & Crisis Lifeline, by text', url: CRISIS.text988, icon: 'message' },
        ]
      : [
          { ...call988, primary: true },
          { label: 'Text 988', sub: 'Suicide & Crisis Lifeline, by text', url: CRISIS.text988, icon: 'message' },
          call911,
          { label: 'Crisis Text Line', sub: 'Text HOME to 741741', url: CRISIS.crisisText, icon: 'message' },
        ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => {}} statusBarTranslucent>
      <View style={[styles.wrap, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView contentContainerStyle={{ gap: 12 }}>
          <View style={styles.top}>
            <Icon name="shield" size={34} />
            <Text style={styles.title} accessibilityRole="header">
              {variant === 'medical' ? 'Get help right now' : "You don't have to go through this alone"}
            </Text>
            <Text style={styles.sub}>
              {variant === 'medical'
                ? 'If someone may have overdosed, or you are having trouble breathing, call 911 now.'
                : 'Real people are ready to talk, any time, day or night. It is free and confidential.'}
            </Text>
          </View>
          {actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={() => (onAction?.(a.label), open(a.url))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, a.primary && styles.actionPrimary, pressed && { opacity: 0.85 }]}
            >
              <Icon name={a.icon} size={24} color={a.primary ? colors.red : '#fff'} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionLabel, a.primary && { color: colors.red }]}>{a.label}</Text>
                <Text style={[styles.actionSub, a.primary && { color: colors.redDark }]}>{a.sub}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable
            onPress={() => (onAction?.(`Call ${coordinator.name}`), open(`tel:${coordinator.phone}`))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
          >
            <Icon name="phone" size={24} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionLabel}>Call {coordinator.name}</Text>
              <Text style={styles.actionSub}>Your care coordinator</Text>
            </View>
          </Pressable>
          {onTextCoordinator ? (
            <Pressable
              onPress={onTextCoordinator}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
            >
              <Icon name="message" size={24} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>Text {coordinator.name} to check on me</Text>
                <Text style={styles.actionSub}>A short alert. It doesn't include what you wrote.</Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>
        <Pressable onPress={() => (onAction?.("I'm safe right now"), onSafe())} accessibilityRole="button" style={styles.safe}>
          <Text style={styles.safeText}>I'm safe right now</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.red, paddingHorizontal: 18 },
  top: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  sub: { color: '#FCE9E7', fontSize: 16, textAlign: 'center', lineHeight: 22 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.md,
    padding: 16,
  },
  actionPrimary: { backgroundColor: '#fff', borderColor: '#fff' },
  actionLabel: { color: '#fff', fontSize: 19, fontWeight: '800' },
  actionSub: { color: '#FCE9E7', fontSize: 14, marginTop: 2 },
  safe: { alignItems: 'center', paddingVertical: 14, marginTop: 8 },
  safeText: { color: '#fff', fontSize: 16, fontWeight: '600', textDecorationLine: 'underline' },
});
