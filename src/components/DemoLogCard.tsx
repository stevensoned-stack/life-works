import React, { useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Field, ToggleRow } from './forms';
import { Button, Card, SectionLabel } from './ui';
import { useStore } from '../data/store';
import { colors, radius } from '../theme';
import { DemoIssueType, demoLogCsv, demoLogSummary } from '../zoey/demolog';

// Settings > Demo issue log (demolog.ts). Copy or download it as CSV and paste it
// into the demo issue sheet. Everything stays on this device until they copy it.

const NOTE_TYPES: DemoIssueType[] = ['Bug', 'Button', 'Voice', 'Wrong answer', 'Note'];

async function copyText(text: string): Promise<boolean> {
  const nav = (globalThis as any).navigator;
  if (Platform.OS === 'web' && nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the old way (some embedded pages block the clipboard).
    }
  }
  if (Platform.OS === 'web') {
    const doc = (globalThis as any).document;
    if (!doc) return false;
    const box = doc.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    doc.body.appendChild(box);
    box.select();
    let ok = false;
    try {
      ok = doc.execCommand('copy');
    } catch {
      ok = false;
    }
    doc.body.removeChild(box);
    return ok;
  }
  // On a phone: the share sheet, which has Copy, Mail, Notes and so on.
  await Share.share({ message: text }).catch(() => {});
  return true;
}

function download(text: string): boolean {
  const g = globalThis as any;
  if (Platform.OS !== 'web' || !g.document || !g.URL?.createObjectURL) return false;
  try {
    const url = g.URL.createObjectURL(new g.Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = g.document.createElement('a');
    a.href = url;
    a.download = `life-works-demo-issues-${new Date().toISOString().slice(0, 10)}.csv`;
    g.document.body.appendChild(a);
    a.click();
    g.document.body.removeChild(a);
    setTimeout(() => g.URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export default function DemoLogCard() {
  const { state, updateSettings, logDemoIssue, clearDemoLog } = useStore();
  const log = state.demoLog ?? [];
  const [msg, setMsg] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState<DemoIssueType>('Bug');
  const [sure, setSure] = useState(false);

  const copy = async (header: boolean) => {
    if (!log.length) return setMsg('Nothing to copy yet.');
    const ok = await copyText(demoLogCsv(log, header));
    setMsg(ok ? (Platform.OS === 'web' ? `Copied ${log.length} as CSV. Paste it into the demo issue sheet.` : null) : 'This browser blocked copying. Try Download CSV.');
  };
  const saveNote = () => {
    if (!note.trim()) return setMsg('Type what happened first.');
    logDemoIssue({ where: 'Settings note', typed: '', zoey: '', type: noteType, note: note.trim() });
    setNote('');
    setMsg('Note saved to the log.');
  };
  const recent = log.slice(-5).reverse();

  return (
    <>
      <SectionLabel>Demo issue log</SectionLabel>
      <Card style={{ gap: 10 }}>
        <ToggleRow
          title="Log messages Zoey can’t answer"
          sub={state.settings.demoLogOn ? 'On: kept only on this device, never sent anywhere' : 'Off: nothing new is logged'}
          value={state.settings.demoLogOn}
          onChange={(v) => updateSettings({ demoLogOn: v })}
        />
        <Text style={styles.small}>
          When Zoey has no answer, or someone says “you didn’t answer my question” or “you just said that”, it’s noted here with what she said. Safety messages are never
          logged.
        </Text>
        <Text style={styles.rowLabel}>{demoLogSummary(log)}</Text>
        {recent.map((x) => (
          <View key={x.id} style={styles.entry}>
            <Text style={styles.entryType}>{x.type}</Text>
            <Text style={styles.entryText} numberOfLines={2}>
              {x.typed ? `“${x.typed}”` : x.note}
            </Text>
          </View>
        ))}
        <View style={styles.row}>
          <Button label="Copy as CSV" tone="outline" small onPress={() => copy(true)} />
          {Platform.OS === 'web' ? (
            <Button
              label="Download CSV"
              tone="outline"
              small
              onPress={() => (log.length ? setMsg(download(demoLogCsv(log)) ? 'Downloaded.' : 'This browser blocked the download. Try Copy as CSV.') : setMsg('Nothing to download yet.'))}
            />
          ) : null}
          {log.length ? <Button label="Copy rows only" tone="outline" small onPress={() => copy(false)} /> : null}
        </View>

        <Text style={[styles.rowLabel, { marginTop: 6 }]}>Add a note</Text>
        <View style={styles.row}>
          {NOTE_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setNoteType(t)} style={[styles.chip, noteType === t && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: noteType === t }}>
              <Text style={[styles.chipText, noteType === t && styles.chipTextOn]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Field id="demo-note" label="What happened?" value={note} onChangeText={(t) => (setNote(t), setMsg(null))} placeholder="e.g. Call button did nothing on the check-in" multiline />
        <Button label="Save note" tone="outline" small onPress={saveNote} style={{ alignSelf: 'flex-start' }} />
        {msg ? <Text style={styles.small}>{msg}</Text> : null}
        {log.length ? (
          sure ? (
            <View style={styles.row}>
              <Button label="Yes, clear the log" tone="outline" small onPress={() => (clearDemoLog(), setSure(false), setMsg('Log cleared.'))} />
              <Button label="Keep it" tone="outline" small onPress={() => setSure(false)} />
            </View>
          ) : (
            <Button label="Clear log" tone="outline" small onPress={() => setSure(true)} style={{ alignSelf: 'flex-start' }} />
          )
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  entry: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, gap: 2 },
  entryType: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase' },
  entryText: { fontSize: 14, color: colors.ink },
  chip: { borderWidth: 1, borderColor: colors.inkFaint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextOn: { color: '#fff' },
});
