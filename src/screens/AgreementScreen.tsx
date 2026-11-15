import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Art';
import { CRISIS } from '../components/CrisisSheet';
import { Sheet } from '../components/forms';
import Icon from '../components/Icon';
import { Button } from '../components/ui';
import { useStore } from '../data/store';
import { acceptAll, isUpdate, LEGAL_DOCS, LegalDoc, LegalDocId, pendingAgreements } from '../legal/documents';
import { colors, radius, shadow } from '../theme';

// Shown before anything else on first launch, and again whenever one of the
// legal documents gets a new version. Crisis lines work without agreeing.
export default function AgreementScreen() {
  const insets = useSafeAreaInsets();
  const { state, updateSettings } = useStore();
  const accepted = state.settings.agreements;
  const pending = pendingAgreements(accepted);
  const updating = isUpdate(accepted);
  const [checked, setChecked] = useState<Partial<Record<LegalDocId, boolean>>>({});
  const [reading, setReading] = useState<LegalDoc | null>(null);
  const allChecked = pending.every((d) => checked[d.id]);
  const draft = LEGAL_DOCS.some((d) => !d.final);
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 24 }]}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Logo />
          <Text style={styles.title} accessibilityRole="header">
            {updating ? 'We updated our terms' : 'Before you start'}
          </Text>
          <Text style={styles.lead}>
            {updating
              ? 'Please read what changed and agree to keep using Life Works.'
              : 'Please read and agree to these so we can support you. Tap a title to read the whole document.'}
          </Text>
        </View>

        <View style={styles.crisis}>
          <Text style={styles.crisisText}>In crisis? You don't have to agree to anything first.</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.crisisBtn} onPress={() => open(CRISIS.call988)} accessibilityRole="button">
              <Icon name="phone" size={16} color="#fff" />
              <Text style={styles.crisisBtnText}>Call 988</Text>
            </Pressable>
            <Pressable style={styles.crisisBtn} onPress={() => open(CRISIS.text988)} accessibilityRole="button">
              <Icon name="message" size={16} color="#fff" />
              <Text style={styles.crisisBtnText}>Text 988</Text>
            </Pressable>
            <Pressable style={styles.crisisBtn} onPress={() => open(CRISIS.call911)} accessibilityRole="button">
              <Icon name="phone" size={16} color="#fff" />
              <Text style={styles.crisisBtnText}>911</Text>
            </Pressable>
          </View>
        </View>

        {draft ? (
          <View style={styles.draft}>
            <Icon name="info" size={18} color={colors.ink} />
            <Text style={[styles.small, { flex: 1, color: colors.ink }]}>
              Draft: these documents are placeholders and are not legal text yet. They will be replaced before Life Works launches.
            </Text>
          </View>
        ) : null}

        {pending.map((d) => (
          <View key={d.id} style={styles.doc}>
            <Pressable onPress={() => setReading(d)} accessibilityRole="link" style={styles.docHead}>
              <Text style={styles.docTitle}>{d.title}</Text>
              {accepted?.[d.id] ? <Text style={styles.badge}>Updated</Text> : null}
              <Icon name="chevron" size={18} color={colors.inkFaint} />
            </Pressable>
            <Text style={styles.small}>{d.summary}</Text>
            <Pressable onPress={() => setReading(d)} accessibilityRole="link">
              <Text style={styles.read}>Read the {d.title}</Text>
            </Pressable>
            <Checkbox
              label={d.agreeLabel}
              value={!!checked[d.id]}
              onChange={(v) => setChecked((c) => ({ ...c, [d.id]: v }))}
            />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Text style={styles.small}>
          {allChecked
            ? 'All boxes checked.'
            : `Check ${pending.length === 1 ? 'the box' : `all ${pending.length} boxes`} above to continue.`}
        </Text>
        <Button
          label="I agree"
          icon="check"
          disabled={!allChecked}
          onPress={() => updateSettings({ agreements: acceptAll(accepted, pending) })}
          style={{ alignSelf: 'stretch' }}
        />
      </View>

      <LegalDocSheet doc={reading} onClose={() => setReading(null)} />
    </View>
  );
}

export function LegalDocSheet({ doc, onClose, agreedAt }: { doc: LegalDoc | null; onClose: () => void; agreedAt?: string }) {
  return (
    <Sheet visible={!!doc} title={doc?.title ?? ''} onClose={onClose}>
      {doc ? (
        <>
          <Text style={styles.small}>
            Version {doc.version}
            {agreedAt ? ` · you agreed on ${new Date(agreedAt).toLocaleDateString()}` : ''}
          </Text>
          {!doc.final ? (
            <View style={styles.draft}>
              <Icon name="info" size={18} color={colors.ink} />
              <Text style={[styles.small, { flex: 1, color: colors.ink }]}>
                Placeholder. This is not legal text. An attorney must write it before Life Works is offered to anyone.
              </Text>
            </View>
          ) : null}
          <Text style={styles.docBody}>{doc.summary}</Text>
          {doc.body.map((s) => (
            <View key={s.heading} style={{ gap: 4 }}>
              <Text style={styles.docTitle}>{s.heading}</Text>
              <Text style={styles.docBody}>{s.text}</Text>
            </View>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}

function Checkbox({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={styles.check}
    >
      <View style={[styles.box, value && styles.boxOn]}>{value ? <Icon name="check" size={16} color="#fff" strokeWidth={3} /> : null}</View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { padding: 18, gap: 14, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  lead: { fontSize: 16, color: colors.ink, lineHeight: 23, textAlign: 'center' },
  crisis: { backgroundColor: colors.redLight, borderRadius: radius.md, padding: 12, gap: 10 },
  crisisText: { fontSize: 14, color: colors.redDark, fontWeight: '600' },
  crisisBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: radius.pill,
    paddingVertical: 9,
  },
  crisisBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  draft: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: '#FDF3D6',
    borderColor: colors.amber,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: 10,
  },
  doc: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, gap: 8, ...shadow },
  docHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.ink },
  docBody: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.green,
    backgroundColor: colors.greenLight,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  read: { fontSize: 14, color: colors.green, fontWeight: '700' },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.inkFaint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  boxOn: { backgroundColor: colors.green, borderColor: colors.green },
  checkLabel: { flex: 1, fontSize: 15, color: colors.ink, fontWeight: '600' },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 12,
    gap: 10,
    alignItems: 'center',
  },
});
