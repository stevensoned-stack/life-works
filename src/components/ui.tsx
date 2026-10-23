import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, type } from '../theme';
import Icon, { IconName } from './Icon';

export function ScreenHeader({
  title,
  onBack,
  left,
  right,
}: {
  title: string;
  onBack?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="back" size={26} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.headerTitleRow}>
        {left}
        <Text style={styles.headerTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle | ViewStyle[] }) {
  return <View style={[styles.card, style as ViewStyle]}>{children}</View>;
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        disabled && !selected && { opacity: 0.5 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  tone = 'green',
  icon,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'green' | 'red' | 'outline' | 'white';
  icon?: IconName;
  small?: boolean;
  style?: ViewStyle;
}) {
  const bg = { green: colors.green, red: colors.red, outline: 'transparent', white: '#fff' }[tone];
  const fg = { green: '#fff', red: '#fff', outline: colors.green, white: colors.red }[tone];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: bg },
        tone === 'outline' && { borderWidth: 1.5, borderColor: colors.green },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 16 : 20} color={fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={[type.label, { marginBottom: 8, marginTop: 4 }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.green,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  headerSide: { width: 32 },
  headerTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: 16,
    ...shadow,
  },
  chip: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  chipOn: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipText: { fontSize: 15, color: colors.ink, fontWeight: '500' },
  chipTextOn: { color: '#fff' },
  button: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: radius.sm + 2,
  },
  buttonSmall: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.pill },
  buttonText: { fontSize: 17, fontWeight: '700' },
});
