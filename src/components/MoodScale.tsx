import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MoodValue } from '../data/types';
import { colors, radius } from '../theme';
import { MOOD_LABELS, MoodFace } from './Art';

const VALUES: MoodValue[] = [-2, -1, 0, 1, 2];

export const moodBadge = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

export default function MoodScale({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: MoodValue | null;
  onChange?: (v: MoodValue) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Rate your mood from minus 2 to plus 2">
      {VALUES.map((v) => {
        const on = value === v;
        return (
          <Pressable
            key={v}
            disabled={disabled}
            onPress={() => onChange?.(v)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled: !!disabled }}
            accessibilityLabel={`${MOOD_LABELS[v]}, ${v}`}
            style={({ pressed }) => [styles.item, on && styles.itemOn, pressed && { opacity: 0.7 }]}
          >
            <View style={[styles.badge, on && { backgroundColor: colors.green }]}>
              <Text style={styles.badgeText}>{moodBadge(v)}</Text>
            </View>
            <MoodFace value={v} size={compact ? 30 : 36} />
            <Text style={styles.label} numberOfLines={2}>
              {MOOD_LABELS[v]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  itemOn: { borderColor: colors.green, backgroundColor: colors.greenLight },
  badge: { backgroundColor: colors.blue, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 1 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  label: { fontSize: 12, color: colors.ink, textAlign: 'center' },
});
