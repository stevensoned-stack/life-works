import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';
import { addDays, clock, fromYmd, hhmm, ymd } from '../util';
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
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  id?: string;
  multiline?: boolean;
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
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
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

// A drop-down: a field that opens a list to pick from, so nothing needs typing.
export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose',
  compact,
}: {
  label: string;
  value: T | null;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = options.find((o) => o.value === value);
  return (
    <View style={[{ gap: 6 }, compact && { flex: 1 }]}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, styles.dropdown]}
        accessibilityRole="button"
        accessibilityLabel={`${label || placeholder}: ${current?.label ?? 'not set'}`}
      >
        <Text style={[styles.dropdownText, !current && { color: colors.inkFaint }]} numberOfLines={1}>
          {current?.label ?? placeholder}
        </Text>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="chevron" size={16} color={colors.inkSoft} />
        </View>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.listBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close" />
          <View style={[styles.list, { marginBottom: insets.bottom + 24 }]}>
            <Text style={styles.listTitle}>{label || placeholder}</Text>
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={String(o.value)}
                  onPress={() => (onChange(o.value), setOpen(false))}
                  style={[styles.listItem, o.value === value && styles.listItemOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: o.value === value }}
                >
                  <Text style={[styles.listItemText, o.value === value && { color: colors.greenDark, fontWeight: '700' }]}>{o.label}</Text>
                  {o.value === value ? <Icon name="check" size={18} color={colors.green} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// Month / day / year drop-downs for a YYYY-MM-DD value. The result is kept
// between min and max, and the day is pulled back when a month is shorter.
export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const d = fromYmd(value);
  const y = d.getFullYear();
  const m = d.getMonth();
  const now = new Date().getFullYear();
  const lo = min ? fromYmd(min).getFullYear() : now - 30;
  const hi = max ? fromYmd(max).getFullYear() : now + 10;
  const set = (yy: number, mm: number, dd: number) => {
    let next = ymd(new Date(yy, mm, Math.min(dd, daysIn(yy, mm))));
    if (min && next < min) next = min;
    if (max && next > max) next = max;
    onChange(next);
  };
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.dateRow}>
        <Dropdown compact label="" placeholder="Month" value={m} onChange={(mm) => set(y, mm, d.getDate())} options={MONTHS.map((l, i) => ({ label: l, value: i }))} />
        <Dropdown
          compact
          label=""
          placeholder="Day"
          value={d.getDate()}
          onChange={(dd) => set(y, m, dd)}
          options={Array.from({ length: daysIn(y, m) }, (_, i) => ({ label: String(i + 1), value: i + 1 }))}
        />
        <Dropdown
          compact
          label=""
          placeholder="Year"
          value={y}
          onChange={(yy) => set(yy, m, d.getDate())}
          options={Array.from({ length: hi - lo + 1 }, (_, i) => ({ label: String(hi - i), value: hi - i }))}
        />
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
  multiline: { minHeight: 84, textAlignVertical: 'top' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dropdownText: { fontSize: 16, color: colors.ink, flex: 1 },
  dateRow: { flexDirection: 'row', gap: 8 },
  listBackdrop: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: 'rgba(20,30,15,0.45)' },
  list: { backgroundColor: '#fff', borderRadius: radius.lg, padding: 8, maxHeight: '70%' },
  listTitle: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, padding: 12 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 14, borderRadius: radius.sm },
  listItemOn: { backgroundColor: colors.greenLight },
  listItemText: { fontSize: 17, color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stepBtn: { backgroundColor: colors.greenLight, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 10, minWidth: 48, alignItems: 'center' },
  stepBtnText: { fontSize: 14, fontWeight: '700', color: colors.greenDark },
  stepValue: { fontSize: 18, fontWeight: '700', color: colors.ink, minWidth: 84, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  toggleSub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
});
