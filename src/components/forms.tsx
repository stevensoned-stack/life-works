import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { clock, hhmm } from '../util';
import Icon from './Icon';

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  id,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  id?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        nativeID={id}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkFaint}
        keyboardType={keyboardType}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

function StepBtn({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  return (
    <Pressable onPress={onPress} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={a11y}>
      <Text style={styles.stepBtnText}>{label}</Text>
    </Pressable>
  );
}

// Time picker built from steppers: big tap targets, no tiny wheels.
export function TimeStepper({ value, onChange, label = 'Time' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const [h, m] = value.split(':').map(Number);
  const shift = (mins: number) => {
    const t = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
    onChange(hhmm(Math.floor(t / 60), t % 60));
  };
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepRow}>
        <StepBtn label="−1h" onPress={() => shift(-60)} a11y="One hour earlier" />
        <StepBtn label="−15" onPress={() => shift(-15)} a11y="15 minutes earlier" />
        <Text style={styles.stepValue}>{clock(value)}</Text>
        <StepBtn label="+15" onPress={() => shift(15)} a11y="15 minutes later" />
        <StepBtn label="+1h" onPress={() => shift(60)} a11y="One hour later" />
      </View>
    </View>
  );
}

export function ToggleRow({
  title,
  sub,
  value,
  onChange,
}: {
  title: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleTitle}>{title}</Text>
        {sub ? <Text style={styles.toggleSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.green, false: colors.border }}
        thumbColor="#fff"
        accessibilityLabel={title}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20,30,15,0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 18,
    paddingTop: 16,
    maxHeight: '88%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sheetTitle: { fontSize: 19, fontWeight: '700', color: colors.ink, flex: 1 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stepBtn: { backgroundColor: colors.greenLight, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 10, minWidth: 48, alignItems: 'center' },
  stepBtnText: { fontSize: 14, fontWeight: '700', color: colors.greenDark },
  stepValue: { fontSize: 18, fontWeight: '700', color: colors.ink, minWidth: 84, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  toggleSub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
});
