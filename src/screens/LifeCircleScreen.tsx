import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, Sheet } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, Chip, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { Route } from '../modules';
import { SupportPerson } from '../data/types';
import { call, formatPhone, initials, QUICK_MESSAGES, text } from '../recovery/contact';
import { colors, radius } from '../theme';

const ROLES = ['Sponsor', 'Peer mentor', 'Counselor', 'Case manager', 'Family', 'Friend', 'Other'];
const PALETTE = [colors.module.lifepath, colors.blue, colors.module.chat, colors.module.lifeevent, colors.module.myhome, colors.greenDark];

export function Avatar({ person, size = 40 }: { person: SupportPerson; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: person.color }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(person.name)}</Text>
    </View>
  );
}

function PersonRow({ p, onOpen }: { p: SupportPerson; onOpen: () => void }) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.rowMain} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${p.name}, ${p.role}. Options`}>
        <Avatar person={p} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={styles.role}>{[p.role, p.detail].filter(Boolean).join(' · ')}</Text>
        </View>
      </Pressable>
      <Pressable onPress={() => text(p.phone)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Text ${p.name}`}>
        <Icon name="message" size={20} color={colors.green} />
      </Pressable>
      <Pressable onPress={() => call(p.phone)} style={[styles.iconBtn, { backgroundColor: colors.green }]} accessibilityRole="button" accessibilityLabel={`Call ${p.name}`}>
        <Icon name="phone" size={18} />
      </Pressable>
    </View>
  );
}

export default function LifeCircleScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, savePerson, removePerson } = useStore();
  const [open, setOpen] = useState<SupportPerson | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', role: 'Sponsor', phone: '', group: 'team' as SupportPerson['group'] });

  const coordinator = state.people.find((p) => p.group === 'coordinator');
  const team = state.people.filter((p) => p.group === 'team');
  const family = state.people.filter((p) => p.group === 'family');
  const canSave = draft.name.trim().length > 0 && draft.phone.replace(/\D/g, '').length >= 7;

  const add = () => {
    savePerson({
      id: newId(),
      name: draft.name.trim(),
      role: draft.role,
      detail: '',
      group: draft.group,
      phone: draft.phone.trim(),
      color: PALETTE[state.people.length % PALETTE.length],
    });
    setDraft({ name: '', role: 'Sponsor', phone: '', group: 'team' });
    setAdding(false);
  };

  const close = () => {
    setOpen(null);
    setConfirmRemove(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="LifeCircle" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {coordinator ? (
          <View style={styles.touch}>
            <View style={styles.touchTop}>
              <View style={styles.touchAvatar}>
                <Text style={styles.touchAvatarText}>{initials(coordinator.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.touchEyebrow}>LIFETOUCH</Text>
                <Text style={styles.touchName}>{coordinator.name}</Text>
                <Text style={styles.touchRole}>
                  {coordinator.role} · {coordinator.detail}
                </Text>
              </View>
            </View>
            <View style={styles.touchBtns}>
              <Button label="Call now" tone="white" small onPress={() => call(coordinator.phone)} style={{ flex: 1 }} />
              <Pressable onPress={() => text(coordinator.phone)} style={styles.touchText} accessibilityRole="button">
                <Text style={styles.touchTextLabel}>Text</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <SectionLabel>My support team</SectionLabel>
        <Card style={styles.list}>
          {team.map((p) => (
            <PersonRow key={p.id} p={p} onOpen={() => setOpen(p)} />
          ))}
        </Card>

        <SectionLabel>Chosen family</SectionLabel>
        <Card style={styles.list}>
          {family.length ? (
            family.map((p) => <PersonRow key={p.id} p={p} onOpen={() => setOpen(p)} />)
          ) : (
            <Text style={styles.empty}>Add the people you trust most.</Text>
          )}
        </Card>

        <Button label="Add a person" icon="plus" tone="outline" onPress={() => setAdding(true)} />
        <Text style={styles.privacy}>
          Calls and texts open your phone's own apps. Life Works doesn't share anything with these people for you.
        </Text>
      </ScrollView>

      <Sheet visible={open !== null} title={open?.name ?? ''} onClose={close}>
        {open ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Avatar person={open} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{open.role}</Text>
                <Text selectable style={styles.role}>
                  {formatPhone(open.phone)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button label="Call" icon="phone" onPress={() => call(open.phone)} style={{ flex: 1 }} />
              <Button label="Chat" icon="chat" tone="outline" onPress={() => (close(), go({ name: 'chatthread', with: open.id }))} style={{ flex: 1 }} />
            </View>
            <Text style={styles.sheetLabel}>Quick messages</Text>
            {QUICK_MESSAGES.map((m) => (
              <Pressable key={m} style={styles.quick} onPress={() => text(open.phone, m)} accessibilityRole="button" accessibilityHint="Opens your messages app with this text filled in">
                <Text style={styles.quickText}>{m}</Text>
                <Icon name="send" size={16} color={colors.green} />
              </Pressable>
            ))}
            {open.group !== 'coordinator' ? (
              confirmRemove ? (
                <View style={{ gap: 8 }}>
                  <Text style={styles.role}>Remove {open.name} from your LifeCircle?</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Button label="Remove" tone="red" small onPress={() => (removePerson(open.id), close())} />
                    <Button label="Keep" tone="outline" small onPress={() => setConfirmRemove(false)} />
                  </View>
                </View>
              ) : (
                <Pressable onPress={() => setConfirmRemove(true)} accessibilityRole="button">
                  <Text style={styles.remove}>Remove from LifeCircle</Text>
                </Pressable>
              )
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={adding} title="Add a person" onClose={() => setAdding(false)}>
        <Field id="person-name" label="Name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="First name or nickname" />
        <Field id="person-phone" label="Phone number" value={draft.phone} onChangeText={(phone) => setDraft({ ...draft, phone })} keyboardType="phone-pad" placeholder="(509) 555-0100" />
        <Text style={styles.sheetLabel}>Who are they to you?</Text>
        <View style={styles.chips}>
          {ROLES.map((r) => (
            <Chip
              key={r}
              label={r}
              selected={draft.role === r}
              onPress={() => setDraft({ ...draft, role: r, group: r === 'Family' || r === 'Friend' ? 'family' : 'team' })}
            />
          ))}
        </View>
        <Button label="Save" onPress={() => canSave && add()} style={canSave ? undefined : { opacity: 0.4 }} />
        {!canSave ? <Text style={styles.role}>Add a name and a phone number to save.</Text> : null}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  touch: { backgroundColor: colors.red, borderRadius: radius.md, padding: 16, gap: 14 },
  touchTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  touchAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  touchAvatarText: { color: colors.red, fontWeight: '800', fontSize: 16 },
  touchEyebrow: { color: '#FCE9E7', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  touchName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  touchRole: { color: '#FCE9E7', fontSize: 13 },
  touchBtns: { flexDirection: 'row', gap: 10 },
  touchText: { flex: 1, borderWidth: 1.5, borderColor: '#fff', borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  touchTextLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { paddingVertical: 4, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '800' },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  role: { fontSize: 13, color: colors.inkSoft },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  empty: { fontSize: 14, color: colors.inkSoft, paddingVertical: 12 },
  privacy: { fontSize: 12, color: colors.inkFaint, textAlign: 'center' },
  sheetLabel: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: { fontSize: 15, color: colors.ink, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  remove: { color: colors.red, fontWeight: '600', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
