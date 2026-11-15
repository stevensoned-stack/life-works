// The pretend call and text screens for the web demo (see src/demo/pretend.ts).
// Nothing is dialed and nothing is sent. Shown only in the browser preview.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '../data/store';
import { callClock, contactFor, onPretend, parseContactUrl, pretendPhoneOn, PretendRequest, showPretend } from '../demo/pretend';
import { formatPhone, initials } from '../recovery/contact';
import { colors, radius } from '../theme';
import Icon from './Icon';

// On the web build, tel: and sms: links open the pretend screen. If the screen
// isn't mounted, or this is a real phone, links work as they always have.
if (pretendPhoneOn(Platform.OS)) {
  const real = Linking.openURL.bind(Linking);
  Linking.openURL = async (url: string) => {
    const r = parseContactUrl(url);
    if (r && showPretend(r)) return;
    return real(url);
  };
}

export default function PretendPhone() {
  const [req, setReq] = useState<PretendRequest | null>(null);
  useEffect(() => onPretend(setReq), []);
  const close = useCallback(() => setReq(null), []);
  if (!req) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      {req.kind === 'call' ? <PretendCall req={req} close={close} /> : <PretendText req={req} close={close} />}
    </Modal>
  );
}

function useContact(req: PretendRequest) {
  const { state } = useStore();
  return contactFor(req.number, state);
}

function DemoNote({ crisis, kind, number }: { crisis: boolean; kind: 'call' | 'text'; number: string }) {
  const real = kind === 'call' ? 'calls' : 'texts';
  return (
    <View style={[styles.note, crisis && styles.noteCrisis]} accessibilityRole="alert">
      <Text style={[styles.noteText, crisis && { color: colors.redDark }]}>
        {crisis
          ? `Demo only. This is not a real ${kind}. On a real phone, this button ${real} ${formatPhone(number)} for real.`
          : `Pretend ${kind} for the demo. Nothing is ${kind === 'call' ? 'dialed' : 'sent'}.`}
      </Text>
    </View>
  );
}

function PretendCall({ req, close }: { req: PretendRequest; close: () => void }) {
  const who = useContact(req);
  const [phase, setPhase] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [secs, setSecs] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);

  useEffect(() => {
    if (phase === 'calling') {
      const t = setTimeout(() => setPhase('connected'), 2500);
      return () => clearTimeout(t);
    }
    if (phase === 'connected') {
      const t = setInterval(() => setSecs((s) => s + 1), 1000);
      return () => clearInterval(t);
    }
    const t = setTimeout(close, 1200);
    return () => clearTimeout(t);
  }, [phase, close]);

  const status = phase === 'calling' ? 'Calling…' : phase === 'connected' ? callClock(secs) : 'Call ended';
  return (
    <View style={styles.call}>
      <DemoNote crisis={who.crisis} kind="call" number={req.number} />
      <View style={styles.callTop}>
        <View style={[styles.avatar, who.crisis && { backgroundColor: colors.red }]}>
          {who.crisis || !initials(who.name) ? (
            <Icon name="phone" size={40} color="#fff" />
          ) : (
            <Text style={styles.avatarText}>{initials(who.name)}</Text>
          )}
        </View>
        <Text style={styles.callName}>{who.name}</Text>
        {who.detail ? <Text style={styles.callDetail}>{who.detail}</Text> : null}
        <Text style={styles.callNumber}>{formatPhone(req.number)}</Text>
        <Text style={styles.callStatus} accessibilityLiveRegion="polite">
          {status}
        </Text>
      </View>
      <View style={styles.callButtons}>
        <RoundButton label={muted ? 'Unmute' : 'Mute'} icon="mic" on={muted} onPress={() => setMuted((m) => !m)} />
        <RoundButton label="Speaker" icon={speaker ? 'speaker' : 'speakerOff'} on={speaker} onPress={() => setSpeaker((s) => !s)} />
      </View>
      <Pressable
        style={({ pressed }) => [styles.hangUp, pressed && { opacity: 0.8 }, phase === 'ended' && { opacity: 0.5 }]}
        onPress={() => (phase === 'ended' ? close() : setPhase('ended'))}
        accessibilityRole="button"
        accessibilityLabel="Hang up"
      >
        <View style={{ transform: [{ rotate: '135deg' }] }}>
          <Icon name="phone" size={30} color="#fff" />
        </View>
      </Pressable>
      <Text style={styles.hangLabel}>Hang up</Text>
    </View>
  );
}

function RoundButton({ label, icon, on, onPress }: { label: string; icon: 'mic' | 'speaker' | 'speakerOff'; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={styles.round}>
      <View style={[styles.roundCircle, on && { backgroundColor: '#fff' }]}>
        <Icon name={icon} size={26} color={on ? colors.ink : '#fff'} />
      </View>
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

type Sent = { id: number; text: string; status: 'Sending…' | 'Delivered' };

function PretendText({ req, close }: { req: PretendRequest; close: () => void }) {
  const who = useContact(req);
  const [draft, setDraft] = useState(req.body ?? '');
  const [sent, setSent] = useState<Sent[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    const id = Date.now();
    setSent((s) => [...s, { id, text, status: 'Sending…' }]);
    setDraft('');
    timers.current.push(setTimeout(() => setSent((s) => s.map((m) => (m.id === id ? { ...m, status: 'Delivered' } : m))), 900));
  };

  return (
    <KeyboardAvoidingView style={styles.text} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.textHeader}>
        <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close" style={styles.textClose}>
          <Icon name="back" size={22} color={colors.blue} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={[styles.smallAvatar, who.crisis && { backgroundColor: colors.red }]}>
            <Text style={styles.smallAvatarText}>{initials(who.name) || '#'}</Text>
          </View>
          <Text style={styles.textName}>{who.name}</Text>
          <Text style={styles.textNumber}>{formatPhone(req.number)}</Text>
        </View>
        <View style={styles.textClose} />
      </View>
      <DemoNote crisis={who.crisis} kind="text" number={req.number} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.thread}>
        {sent.length === 0 ? <Text style={styles.empty}>Type a message and press Send.</Text> : null}
        {sent.map((m) => (
          <View key={m.id} style={styles.bubbleWrap}>
            <View style={styles.bubble}>
              <Text style={styles.bubbleText}>{m.text}</Text>
            </View>
            <Text style={styles.delivered}>{m.status}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.compose}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Text message"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          multiline
          onSubmitEditing={send}
          accessibilityLabel="Text message"
        />
        <Pressable
          onPress={send}
          accessibilityRole="button"
          accessibilityLabel="Send"
          style={[styles.send, !draft.trim() && { opacity: 0.4 }]}
        >
          <Icon name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  note: { backgroundColor: '#FFF6DA', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.sm, margin: 12 },
  noteCrisis: { backgroundColor: colors.redLight },
  noteText: { fontSize: 13, color: '#6B5200', textAlign: 'center', fontWeight: '600' },

  call: { flex: 1, backgroundColor: '#1D2A22', alignItems: 'center', paddingTop: 24, paddingBottom: 40 },
  callTop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  avatar: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: '700' },
  callName: { color: '#fff', fontSize: 28, fontWeight: '600', textAlign: 'center' },
  callDetail: { color: '#C9D3C5', fontSize: 16, marginTop: 4 },
  callNumber: { color: '#C9D3C5', fontSize: 16, marginTop: 4 },
  callStatus: { color: '#fff', fontSize: 18, marginTop: 16, fontVariant: ['tabular-nums'] },
  callButtons: { flexDirection: 'row', gap: 40, marginBottom: 36 },
  round: { alignItems: 'center' },
  roundCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  roundLabel: { color: '#fff', fontSize: 13, marginTop: 6 },
  hangUp: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#E5352B', alignItems: 'center', justifyContent: 'center' },
  hangLabel: { color: '#fff', fontSize: 13, marginTop: 6 },

  text: { flex: 1, backgroundColor: '#fff' },
  textHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 8, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#F7F7F7' },
  textClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  smallAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  textName: { fontSize: 15, fontWeight: '600', color: colors.ink, marginTop: 4 },
  textNumber: { fontSize: 12, color: colors.inkSoft },
  thread: { padding: 14, flexGrow: 1, justifyContent: 'flex-end' },
  empty: { textAlign: 'center', color: colors.inkFaint, marginBottom: 12 },
  bubbleWrap: { alignItems: 'flex-end', marginBottom: 10 },
  bubble: { backgroundColor: '#1F8AFF', borderRadius: 18, paddingVertical: 9, paddingHorizontal: 14, maxWidth: '80%' },
  bubbleText: { color: '#fff', fontSize: 16, lineHeight: 21 },
  delivered: { fontSize: 11, color: colors.inkFaint, marginTop: 3, marginRight: 4 },
  compose: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, gap: 8, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 16, color: colors.ink },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1F8AFF', alignItems: 'center', justifyContent: 'center' },
});
