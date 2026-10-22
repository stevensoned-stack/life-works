import React, { useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrisisSheet from '../components/CrisisSheet';
import { Field, Sheet, TimeStepper, ToggleRow } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, Chip, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { LocationCheck, Place, PlaceKind, PlanSlot } from '../data/types';
import { Route } from '../modules';
import {
  attendanceReport,
  checkLocation,
  dayPlan,
  distanceLabel,
  duration,
  openVisit,
  overdueReturn,
  PLACE_KINDS,
  slotLabel,
  suggestedPlace,
  WEEKDAYS,
} from '../recovery/attendance';
import { call, text as sendText } from '../recovery/contact';
import { askLocationPermission, readHere } from '../recovery/location';
import { alertText, makeEvent } from '../safety/events';
import { colors, radius } from '../theme';
import { clock, timeLabel, ymd } from '../util';
import { screen } from '../zoey/safety';

const KIND_COLOR: Record<PlaceKind, string> = {
  work: colors.red,
  school: colors.blue,
  home: colors.module.myhome,
  treatment: colors.module.chat,
  meeting: colors.module.lifepath,
  other: colors.inkFaint,
};

const hhmmOf = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

export default function CheckInOutScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, checkIn, checkOut, savePlace, removePlace, saveSlot, removeSlot, updateSettings, logSafetyEvent, noteSafetyAction, markAlertTexted } =
    useStore();
  const { places, plan, attendance, settings } = state;
  const coordinator = state.profile.coordinator;

  const [now, setNow] = useState(() => new Date());
  const today = ymd(now);
  const items = useMemo(() => dayPlan(plan, places, attendance, today, now), [plan, places, attendance, today, now]);
  const open = openVisit(attendance);
  const openPlace = open ? places.find((p) => p.id === open.placeId) ?? null : null;

  const [picked, setPicked] = useState<string | null>(null);
  const place = open ? openPlace : (places.find((p) => p.id === picked) ?? suggestedPlace(items, attendance, places));

  const [busy, setBusy] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);
  const [onMyWay, setOnMyWay] = useState<string | null>(null); // the visit id the person answered for
  const [needHelp, setNeedHelp] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [editingSlot, setEditingSlot] = useState<PlanSlot | null>(null);
  const [spotNote, setSpotNote] = useState<string | null>(null);
  const [crisis, setCrisis] = useState(false);
  const eventRef = useRef<string | null>(null);

  const overdue = overdueReturn(plan, places, attendance, now);
  const lastHomeOut = overdue ? attendance.find((r) => r.outAt === overdue.leftAt)?.id ?? null : null;
  const showOverdue = overdue && !open && onMyWay !== lastHomeOut;

  // One location reading, only if the person turned it on and the place has a
  // saved spot. Turned straight into here/away; the reading itself is dropped.
  const locate = async (p: Place | null): Promise<LocationCheck | null> => {
    if (!settings.checkInLocation || !p?.spot) return null;
    const r = await readHere();
    if (!r.ok) {
      setLocNote(
        r.reason === 'denied'
          ? "Location is off for Life Works, so this check-in isn't confirmed. You can turn it on in your phone's settings."
          : "Couldn't get a location fix, so this check-in isn't confirmed.",
      );
      return null;
    }
    return checkLocation(p, r.reading, r.reading.accuracyM);
  };

  const describe = (c: LocationCheck | null, p: Place, verb: string) => {
    if (!c) return;
    setLocNote(
      c.at === 'here'
        ? `Location confirmed: you're at ${p.name}.`
        : `Your phone says you're about ${distanceLabel(c.meters)} from ${p.name}. You're still ${verb}; it will show as not confirmed.`,
    );
  };

  const doCheckIn = async (p: Place | null) => {
    if (!p || busy) return;
    setBusy(true);
    setLocNote(null);
    const c = await locate(p);
    checkIn(p, c, settings.shareAttendance);
    describe(c, p, 'checked in');
    setNeedHelp(false);
    setNow(new Date());
    setBusy(false);
  };

  const doCheckOut = async () => {
    if (!open || busy) return;
    setBusy(true);
    setLocNote(null);
    const c = await locate(openPlace);
    checkOut(c);
    if (openPlace) describe(c, openPlace, 'checked out');
    setNow(new Date());
    setBusy(false);
  };

  const sendReport = () => {
    Share.share({ message: attendanceReport(state.profile.name, attendance, places) }).catch(() => {});
  };

  // Place names are free text, so they go through the same safety screen as
  // everything else typed into the app. Only a crisis result interrupts here.
  const savePlaceAndScreen = (p: Place) => {
    const name = p.name.trim();
    if (!name) return;
    const detail = p.detail?.trim() || undefined;
    savePlace({ ...p, name, detail });
    setEditingPlace(null);
    const s = screen(`${name}\n${detail ?? ''}`);
    if (s.kind !== 'crisis') return;
    const id = newId();
    eventRef.current = id;
    logSafetyEvent(
      makeEvent({
        id,
        result: s,
        message: detail ? `${name}\n${detail}` : name,
        history: [],
        screen: 'checkinout',
        coordinatorName: coordinator.name,
        share: settings.shareSafetyAlerts,
      }),
    );
    if (Platform.OS === 'ios') setTimeout(() => setCrisis(true), 450);
    else setCrisis(true);
  };

  const saveSpot = async () => {
    if (!editingPlace) return;
    setSpotNote('Finding where you are…');
    const r = await readHere();
    if (!r.ok) {
      setSpotNote(r.reason === 'denied' ? "Location is off for Life Works. Turn it on in your phone's settings to save a spot." : "Couldn't get a location fix. Try again outside or near a window.");
      return;
    }
    const { lat, lng } = r.reading;
    setEditingPlace({ ...editingPlace, spot: { lat, lng } });
    setSpotNote(`Spot saved. Check-ins within about ${distanceLabel(150)} of here will be confirmed.`);
  };

  const toggleLocation = async (v: boolean) => {
    if (v && !(await askLocationPermission())) {
      setLocNote("Location wasn't allowed, so check-ins can't be confirmed. You can still check in by tapping.");
      return;
    }
    updateSettings({ checkInLocation: v });
  };

  const statusLine = () => {
    if (open) {
      const shared = open.share === 'queued' ? ` ${coordinator.name} can see you arrived once your program connects Life Works.` : '';
      return `Checked in at ${timeLabel(open.inAt)}.${shared}`;
    }
    const last = [...attendance].reverse().find((r) => r.outAt);
    if (last?.outAt && new Date(last.outAt).toDateString() === now.toDateString())
      return `Checked out of ${last.placeName} at ${timeLabel(last.outAt)}.`;
    return 'Not checked in yet today';
  };

  const history = [...attendance].sort((a, b) => b.inAt.localeCompare(a.inAt)).slice(0, 12);
  const unsaved = places.filter((p) => !p.spot).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Check In/Out" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {showOverdue && overdue ? (
          <Card style={styles.alert}>
            <Text style={styles.alertTitle}>Are you on your way back?</Text>
            <Text style={styles.body}>
              You checked out of {overdue.place.name} at {timeLabel(overdue.leftAt)}, and the plan says to be back by {timeLabel(overdue.dueAt.toISOString())}.
            </Text>
            <View style={styles.actions}>
              <Button small label="I'm back" icon="check" onPress={() => doCheckIn(overdue.place)} />
              <Button small tone="outline" label="On my way" onPress={() => setOnMyWay(lastHomeOut)} />
              <Button small tone="outline" label="I need help" onPress={() => setNeedHelp(true)} />
            </View>
            {needHelp ? (
              <View style={styles.actions}>
                <Button small tone="red" icon="phone" label={`Call ${coordinator.name}`} onPress={() => call(coordinator.phone)} />
                <Button small tone="outline" icon="message" label={`Text ${coordinator.name}`} onPress={() => sendText(coordinator.phone)} />
                <Button small tone="outline" label="A place to stay tonight" onPress={() => go({ name: 'resources', category: 'Shelter tonight' })} />
              </View>
            ) : null}
          </Card>
        ) : null}

        <Card style={{ gap: 12 }}>
          <Text style={styles.cardTitle}>{open ? "You're checked in at" : 'Where are you?'}</Text>
          <View style={styles.chips}>
            {places.map((p) => (
              <Chip key={p.id} label={p.name} selected={place?.id === p.id} disabled={!!open && p.id !== open.placeId} onPress={() => setPicked(p.id)} />
            ))}
            {!open ? <Chip label="+ Place" onPress={() => (setSpotNote(null), setEditingPlace({ id: newId(), name: '', kind: 'other' }))} /> : null}
          </View>
          {open ? (
            <Button label={busy ? 'Checking out…' : `Check out of ${open.placeName}`} tone="red" onPress={doCheckOut} />
          ) : place ? (
            <Button label={busy ? 'Checking in…' : `Check in to ${place.name}`} onPress={() => doCheckIn(place)} />
          ) : (
            <Text style={styles.small}>Add a place, like work, school or home, to check in.</Text>
          )}
          <Text style={styles.status}>{statusLine()}</Text>
          {locNote ? (
            <View style={styles.locRow}>
              <Icon name="pin" size={15} color={colors.inkSoft} />
              <Text style={[styles.small, { flex: 1 }]}>{locNote}</Text>
            </View>
          ) : null}
        </Card>

        <SectionLabel>
          {`Where to be today · ${now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`}
        </SectionLabel>
        <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
          {items.length ? (
            items.map((it, i) => {
              const st = it.status;
              const pill =
                st.kind === 'upcoming'
                  ? null
                  : st.kind === 'due'
                    ? { text: it.place.kind === 'home' && it.start <= now ? 'Not back yet' : 'Check in now', color: colors.blue, bg: colors.blueLight }
                    : st.kind === 'missed'
                      ? { text: 'Missed', color: colors.red, bg: colors.redLight }
                      : st.kind === 'here'
                        ? { text: `Here since ${timeLabel(st.inAt)}${st.late ? ' · late' : ''}`, color: colors.greenDark, bg: colors.greenLight }
                        : { text: `${timeLabel(st.inAt)} to ${timeLabel(st.outAt)}${st.late ? ' · late' : ''}`, color: colors.greenDark, bg: colors.greenLight };
              return (
                <Pressable
                  key={it.slot.id}
                  onPress={() => setEditingSlot(it.slot)}
                  style={[styles.item, i > 0 && styles.itemBorder]}
                  accessibilityRole="button"
                  accessibilityLabel={`${it.place.name}, ${slotLabel(it.slot)}${pill ? `, ${pill.text}` : ''}`}
                >
                  <Text style={styles.itemTime}>{clock(it.slot.start)}</Text>
                  <View style={[styles.itemBar, { backgroundColor: KIND_COLOR[it.place.kind] }]} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.itemTitle}>{it.place.kind === 'home' && !it.slot.end ? `Back at ${it.place.name}` : it.place.name}</Text>
                    <Text style={styles.small}>{it.slot.end ? `Until ${clock(it.slot.end)}` : `By ${clock(it.slot.start)}`}{it.place.detail ? ` · ${it.place.detail}` : ''}</Text>
                    {pill ? <Text style={[styles.pill, { color: pill.color, backgroundColor: pill.bg }]}>{pill.text}</Text> : null}
                  </View>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.empty}>Nowhere planned today. Add the places you're expected to be, like work, school or home.</Text>
          )}
        </Card>
        <Button
          label="Add to my plan"
          icon="plus"
          tone="outline"
          onPress={() => places[0] && setEditingSlot({ id: newId(), placeId: places[0].id, days: [now.getDay()], start: '09:00', end: '12:00' })}
        />

        <SectionLabel>Recent check-ins</SectionLabel>
        <Card style={{ paddingVertical: 2, paddingHorizontal: 0 }}>
          {history.length ? (
            history.map((r, i) => (
              <View key={r.id} style={[styles.item, i > 0 && styles.itemBorder]}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.itemTitle}>{r.placeName}</Text>
                  <Text style={styles.small}>
                    {new Date(r.inAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · {timeLabel(r.inAt)}
                    {r.outAt ? ` to ${timeLabel(r.outAt)} (${duration(r.inAt, r.outAt)})` : ', still here'}
                  </Text>
                </View>
                {r.inCheck ? (
                  <View accessibilityLabel={r.inCheck.at === 'here' ? 'Location confirmed' : 'Location not confirmed'}>
                    <Icon name={r.inCheck.at === 'here' ? 'pin' : 'info'} size={16} color={r.inCheck.at === 'here' ? colors.green : colors.amber} />
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.empty}>No check-ins yet.</Text>
          )}
        </Card>
        <Button label="Send my attendance" icon="send" tone="outline" onPress={sendReport} />
        <Text style={styles.small}>
          Sends the last two weeks of places and times from your own phone, to whoever you pick. It never includes your moods, notes or messages.
        </Text>

        <SectionLabel>Privacy and sharing</SectionLabel>
        <Card style={{ gap: 14 }}>
          <ToggleRow
            title="Confirm with my location"
            sub={`Only at the moment you tap Check in or out. Life Works never tracks where you go and doesn't keep your position, just whether you were at the place.${
              settings.checkInLocation && unsaved ? ` ${unsaved} place${unsaved === 1 ? " doesn't" : "s don't"} have a saved spot yet.` : ''
            }`}
            value={settings.checkInLocation}
            onChange={toggleLocation}
          />
          <ToggleRow
            title={`Share check-ins with ${coordinator.name}`}
            sub={`Places and times only, never your moods, messages or location. Sending starts when your program connects Life Works; until then, use Send my attendance.`}
            value={settings.shareAttendance}
            onChange={(v) => updateSettings({ shareAttendance: v })}
          />
          <ToggleRow
            title="Remind me to check in"
            sub="A notification when it's time. It won't say where."
            value={settings.attendanceReminders}
            onChange={(v) => updateSettings({ attendanceReminders: v })}
          />
          <Text style={styles.small}>Tap a place below to rename it or save its spot.</Text>
          <View style={styles.chips}>
            {places.map((p) => (
              <Chip key={p.id} label={`${p.name}${p.spot ? ' ✓' : ''}`} onPress={() => (setSpotNote(null), setEditingPlace(p))} />
            ))}
          </View>
        </Card>
      </ScrollView>

      <Sheet visible={editingPlace !== null} title={editingPlace && places.some((p) => p.id === editingPlace.id) ? 'Edit place' : 'Add a place'} onClose={() => setEditingPlace(null)}>
        {editingPlace ? (
          <>
            <Field id="place-name" label="Name" value={editingPlace.name} onChangeText={(name) => setEditingPlace({ ...editingPlace, name })} placeholder="e.g. Work crew, School, The house" />
            <View style={styles.chips}>
              {(Object.keys(PLACE_KINDS) as PlaceKind[]).map((k) => (
                <Chip key={k} label={PLACE_KINDS[k].label} selected={editingPlace.kind === k} onPress={() => setEditingPlace({ ...editingPlace, kind: k })} />
              ))}
            </View>
            <Field id="place-detail" label="Details (optional)" value={editingPlace.detail ?? ''} onChangeText={(detail) => setEditingPlace({ ...editingPlace, detail })} placeholder="e.g. Check in with staff" />
            {settings.checkInLocation ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.small}>
                  {editingPlace.spot
                    ? 'This place has a saved spot, so check-ins here can be confirmed.'
                    : "Standing at this place? Save its spot so your check-ins here can be confirmed. Only the place's spot is saved."}
                </Text>
                <View style={styles.actions}>
                  <Button small tone="outline" icon="pin" label={editingPlace.spot ? 'Move spot to here' : "I'm here, save this spot"} onPress={saveSpot} />
                  {editingPlace.spot ? (
                    <Button small tone="outline" label="Remove spot" onPress={() => (setEditingPlace({ ...editingPlace, spot: undefined }), setSpotNote(null))} />
                  ) : null}
                </View>
                {spotNote ? <Text style={styles.small}>{spotNote}</Text> : null}
              </View>
            ) : null}
            <Button label="Save" onPress={() => savePlaceAndScreen(editingPlace)} style={editingPlace.name.trim() ? undefined : { opacity: 0.4 }} />
            {places.some((p) => p.id === editingPlace.id) && editingPlace.id !== open?.placeId ? (
              <Pressable onPress={() => (removePlace(editingPlace.id), setEditingPlace(null))} accessibilityRole="button">
                <Text style={styles.remove}>Remove place (past check-ins stay)</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={editingSlot !== null} title={editingSlot && plan.some((s) => s.id === editingSlot.id) ? 'Edit plan' : 'Add to my plan'} onClose={() => setEditingSlot(null)}>
        {editingSlot ? (
          <>
            <Text style={styles.fieldLabel}>Where</Text>
            <View style={styles.chips}>
              {places.map((p) => (
                <Chip key={p.id} label={p.name} selected={editingSlot.placeId === p.id} onPress={() => setEditingSlot({ ...editingSlot, placeId: p.id })} />
              ))}
            </View>
            <Text style={styles.fieldLabel}>Days</Text>
            <View style={styles.chips}>
              {WEEKDAYS.map((d, i) => {
                const on = editingSlot.days.includes(i);
                return (
                  <Chip
                    key={d}
                    label={d}
                    selected={on}
                    onPress={() => setEditingSlot({ ...editingSlot, days: on ? editingSlot.days.filter((x) => x !== i) : [...editingSlot.days, i].sort() })}
                  />
                );
              })}
            </View>
            <TimeStepper label={editingSlot.end ? 'From' : 'Be there by'} value={editingSlot.start} onChange={(start) => setEditingSlot({ ...editingSlot, start })} />
            <View style={styles.toggle}>
              <Text style={[styles.body, { flex: 1 }]}>Has an end time</Text>
              <Switch
                value={!!editingSlot.end}
                onValueChange={(v) => {
                  const [h, m] = editingSlot.start.split(':').map(Number);
                  const end = new Date(2000, 0, 1, Math.min(h + 2, 23), m);
                  setEditingSlot({ ...editingSlot, end: v ? hhmmOf(end) : undefined });
                }}
                trackColor={{ true: colors.green, false: colors.border }}
                thumbColor="#fff"
                accessibilityLabel="Has an end time"
              />
            </View>
            {editingSlot.end ? <TimeStepper label="Until" value={editingSlot.end} onChange={(end) => setEditingSlot({ ...editingSlot, end })} /> : null}
            <Text style={styles.small}>
              {editingSlot.end ? 'Check in when you get there and out when you leave.' : 'No end time works like a curfew: check in when you get back.'}
            </Text>
            <Button
              label="Save"
              onPress={() => {
                if (!editingSlot.days.length || (editingSlot.end && editingSlot.end <= editingSlot.start)) return;
                saveSlot(editingSlot);
                setEditingSlot(null);
              }}
              style={editingSlot.days.length && !(editingSlot.end && editingSlot.end <= editingSlot.start) ? undefined : { opacity: 0.4 }}
            />
            {plan.some((s) => s.id === editingSlot.id) ? (
              <Pressable onPress={() => (removeSlot(editingSlot.id), setEditingSlot(null))} accessibilityRole="button">
                <Text style={styles.remove}>Remove from plan</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <CrisisSheet
        visible={crisis}
        variant="psychiatric"
        coordinator={coordinator}
        onSafe={() => setCrisis(false)}
        onAction={(label) => eventRef.current && noteSafetyAction(eventRef.current, label)}
        onTextCoordinator={
          settings.shareSafetyAlerts && eventRef.current
            ? () => {
                const id = eventRef.current!;
                sendText(coordinator.phone, alertText(state.profile.name, 3));
                noteSafetyAction(id, `Text ${coordinator.name}`);
                markAlertTexted(id);
              }
            : undefined
        }
      />
    </View>
  );

}

const styles = StyleSheet.create({
  alert: { gap: 10, borderWidth: 1.5, borderColor: colors.amber },
  alertTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  status: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  itemBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  itemTime: { width: 70, fontSize: 14, fontWeight: '600', color: colors.ink, fontVariant: ['tabular-nums'] },
  itemBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.ink },
  pill: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  empty: { fontSize: 14, color: colors.inkSoft, padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remove: { color: colors.red, fontWeight: '600', fontSize: 14, textAlign: 'center', paddingVertical: 8 },
});
