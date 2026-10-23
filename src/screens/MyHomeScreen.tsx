import React, { useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CrisisSheet from '../components/CrisisSheet';
import { DatePicker, Dropdown, Field, Sheet } from '../components/forms';
import Icon from '../components/Icon';
import { Button, Card, ScreenHeader, SectionLabel } from '../components/ui';
import { newId, useStore } from '../data/store';
import { MyHome, Roommate } from '../data/types';
import { Route } from '../modules';
import { call, formatPhone, text as sendText } from '../recovery/contact';
import {
  BED_OPTIONS,
  BEDROOM_OPTIONS,
  blankRoommate,
  dateLabel,
  daysUntil,
  DUE_DAY_OPTIONS,
  emptyHome,
  homeCalendarItems,
  HOUSING_TYPES,
  leaseEndFor,
  LEASE_TERMS,
  livedFor,
  nextRentDates,
  rentLabel,
  roleLabel,
  ROOMMATE_ROLES,
  termLabel,
  typedText,
  typeLabel,
  WEEKDAYS,
} from '../recovery/home';
import { alertText, makeEvent } from '../safety/events';
import { colors, radius } from '../theme';
import { ymd } from '../util';
import { AnswerAction } from '../zoey/answers';
import { urgentReply } from '../zoey/ask';
import { buildContext } from '../zoey/context';
import { screen, SafetyResult } from '../zoey/safety';

type Flag = { kind: 'urgent'; text: string; actions: AnswerAction[] } | { kind: 'check' };

export default function MyHomeScreen({ back, go }: { back: () => void; go: (r: Route) => void }) {
  const insets = useSafeAreaInsets();
  const { state, saveHome, saveEvent, logSafetyEvent, noteSafetyAction, markAlertTexted } = useStore();
  const { home, settings } = state;
  const coordinator = state.profile.coordinator;
  const [draft, setDraft] = useState<MyHome | null>(null);
  const [mate, setMate] = useState<Roommate | null>(null);
  const [crisis, setCrisis] = useState<'psychiatric' | 'medical' | null>(null);
  const [flag, setFlag] = useState<Flag | null>(null);
  const [calNote, setCalNote] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const eventRef = useRef<string | null>(null);
  const today = ymd(new Date());

  // Everything typed here goes through the same safety screen as the rest of
  // the app. The home is always saved first; help is shown after.
  const check = (typed: string) => {
    const s: SafetyResult = screen(typed);
    if (s.kind === 'none') return;
    const id = newId();
    eventRef.current = id;
    logSafetyEvent(
      makeEvent({ id, result: s, message: typed, history: [], screen: 'myhome', coordinatorName: coordinator.name, share: settings.shareSafetyAlerts }),
    );
    if (s.kind === 'crisis') {
      if (Platform.OS === 'ios') setTimeout(() => setCrisis(s.variant), 450);
      else setCrisis(s.variant);
    } else if (s.kind === 'urgent') {
      const r = urgentReply(s.variant, buildContext(state));
      setFlag({ kind: 'urgent', text: r.text, actions: r.actions });
    } else setFlag({ kind: 'check' });
  };

  const tidy = (h: MyHome): MyHome => ({
    ...h,
    name: h.name?.trim() || undefined,
    address: h.address.trim(),
    city: h.city.trim(),
    notes: h.notes?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  });

  const saveDraft = () => {
    if (!draft) return;
    const h = tidy(draft);
    saveHome(h);
    setDraft(null);
    check(typedText(h));
  };

  const saveMate = () => {
    if (!home || !mate || !mate.name.trim()) return;
    const m = { ...mate, name: mate.name.trim(), phone: mate.phone?.trim() || undefined };
    const exists = home.roommates.some((x) => x.id === m.id);
    saveHome({ ...home, roommates: exists ? home.roommates.map((x) => (x.id === m.id ? m : x)) : [...home.roommates, m], updatedAt: new Date().toISOString() });
    setMate(null);
    check(m.name);
  };

  const removeMate = (id: string) => {
    if (!home) return;
    saveHome({ ...home, roommates: home.roommates.filter((x) => x.id !== id), updatedAt: new Date().toISOString() });
    setMate(null);
  };

  const addToCalendar = () => {
    if (!home) return;
    const items = homeCalendarItems(home);
    items.forEach(saveEvent);
    setCalNote(
      items.length
        ? `Added ${items.length === 1 ? '1 date' : `${items.length} dates`} to your calendar with a reminder ahead of each. The reminder won't say what it's for.`
        : 'Add a rent due day or a lease end date first.',
    );
  };

  const run = (a: AnswerAction) => {
    if (eventRef.current) noteSafetyAction(eventRef.current, a.label);
    switch (a.kind) {
      case 'route':
        return go(a.route);
      case 'call': {
        const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
        return call(a.who === 'sponsor' && sponsor ? sponsor.phone : coordinator.phone);
      }
      case 'phone':
        return call(a.number);
      case 'url':
        return Linking.openURL(a.url).catch(() => {});
      case 'crisis':
        return setCrisis('psychiatric');
    }
  };

  const answerCheck = (label: string, safe: boolean) => {
    if (eventRef.current) noteSafetyAction(eventRef.current, label, safe ? undefined : 3);
    setFlag(null);
    if (!safe) setCrisis('psychiatric');
  };

  // Changing move-in or the lease length moves a fixed-term end date with it.
  const setLease = (patch: Partial<MyHome['lease']>, moveIn = draft?.moveIn ?? null) => {
    if (!draft) return;
    const lease = { ...draft.lease, ...patch };
    if (('term' in patch || moveIn !== draft.moveIn) && moveIn) {
      const end = leaseEndFor(moveIn, lease.term);
      if (end) lease.end = end;
      else if ('term' in patch && (lease.term === 'month_to_month' || lease.term === 'none')) lease.end = null;
    }
    setDraft({ ...draft, moveIn, lease });
  };

  const lease = home?.lease;
  const rent = home ? rentLabel(home) : null;
  const nextDue = home ? nextRentDates(home, new Date(), 1)[0] : undefined;
  const endIn = lease?.end ? daysUntil(lease.end) : null;
  const size = home
    ? [
        home.bedrooms == null ? null : home.bedrooms === 0 ? 'Studio' : `${BEDROOM_OPTIONS.find((o) => o.value === home.bedrooms)?.label} bedroom${home.bedrooms === 1 ? '' : 's'}`,
        home.beds == null ? null : `${BED_OPTIONS.find((o) => o.value === home.beds)?.label} bed${home.beds === 1 ? '' : 's'}`,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="MyHome" onBack={back} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}>
        {flag?.kind === 'urgent' ? (
          <Card style={styles.alert}>
            <Text style={styles.body}>{flag.text}</Text>
            <View style={styles.actions}>
              {flag.actions.map((a, i) => (
                <Button key={a.label} small label={a.label} icon={a.kind === 'call' || a.kind === 'phone' ? 'phone' : undefined} tone={i === 0 ? 'red' : 'outline'} onPress={() => run(a)} />
              ))}
            </View>
            <Pressable onPress={() => setFlag(null)} accessibilityRole="button">
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </Card>
        ) : flag?.kind === 'check' ? (
          <Card style={styles.alert}>
            <Text style={styles.cardTitle}>Are you safe right now?</Text>
            <View style={styles.actions}>
              <Button small label="Yes" onPress={() => answerCheck('Yes', true)} />
              <Button small tone="outline" label="No" onPress={() => answerCheck('No', false)} />
              <Button small tone="outline" label="Not sure" onPress={() => answerCheck('Not sure', false)} />
            </View>
          </Card>
        ) : null}

        {!home ? (
          <Card style={{ gap: 10 }}>
            <Text style={styles.cardTitle}>Where are you living?</Text>
            <Text style={styles.small}>
              Keep your housing details in one place: the kind of place, who lives there, your move-in date and your lease. It stays on this phone.
            </Text>
            <Button label="Add my home" icon="plus" onPress={() => setDraft(emptyHome())} />
          </Card>
        ) : (
          <>
            <Card style={{ gap: 8 }}>
              <View style={styles.headRow}>
                <View style={styles.badge}>
                  <Icon name="home" size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{home.name || typeLabel(home.type)}</Text>
                  <Text style={styles.small}>{home.name ? typeLabel(home.type) : [home.address, home.city].filter(Boolean).join(', ') || 'No address yet'}</Text>
                </View>
                <Button small tone="outline" label="Edit" icon="pencil" onPress={() => setDraft(home)} />
              </View>
              {home.name && (home.address || home.city) ? <Text style={styles.body}>{[home.address, home.city].filter(Boolean).join(', ')}</Text> : null}
              {home.moveIn ? (
                <Text style={styles.body}>
                  Moved in {dateLabel(home.moveIn)} · {livedFor(home.moveIn)}
                </Text>
              ) : null}
              {size ? <Text style={styles.body}>{size}</Text> : null}
            </Card>

            <SectionLabel>Lease and rent</SectionLabel>
            <Card style={{ gap: 8 }}>
              <Text style={styles.cardTitle}>{termLabel(lease!.term)}</Text>
              {lease!.end ? (
                <Text style={[styles.body, endIn != null && endIn >= 0 && endIn <= 60 && styles.soon]}>
                  {endIn != null && endIn < 0 ? `Ended ${dateLabel(lease!.end)}` : `Ends ${dateLabel(lease!.end)}${endIn === 0 ? ', today' : ` · in ${endIn} day${endIn === 1 ? '' : 's'}`}`}
                </Text>
              ) : null}
              {rent ? <Text style={styles.body}>{rent}</Text> : null}
              {nextDue ? <Text style={styles.small}>Next due {daysUntil(nextDue) === 0 ? 'today' : dateLabel(nextDue)}</Text> : null}
              {nextDue || (endIn != null && endIn >= 0) ? (
                <Button small tone="outline" icon="calendar" label="Add rent and lease dates to my calendar" onPress={addToCalendar} />
              ) : null}
              {calNote ? <Text style={styles.small}>{calNote}</Text> : null}
            </Card>

            <SectionLabel>Who lives here</SectionLabel>
            <Card style={{ paddingVertical: 4 }}>
              {home.roommates.length ? (
                home.roommates.map((m) => (
                  <View key={m.id} style={styles.mateRow}>
                    <Pressable style={{ flex: 1 }} onPress={() => setMate(m)} accessibilityRole="button" accessibilityLabel={`${m.name}, ${roleLabel(m.role)}. Edit`}>
                      <Text style={styles.name}>{m.name}</Text>
                      <Text style={styles.small}>{[roleLabel(m.role), m.phone ? formatPhone(m.phone) : null].filter(Boolean).join(' · ')}</Text>
                    </Pressable>
                    {m.phone ? (
                      <>
                        <Pressable onPress={() => sendText(m.phone!)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Text ${m.name}`}>
                          <Icon name="message" size={20} color={colors.green} />
                        </Pressable>
                        <Pressable onPress={() => call(m.phone!)} style={[styles.iconBtn, { backgroundColor: colors.green }]} accessibilityRole="button" accessibilityLabel={`Call ${m.name}`}>
                          <Icon name="phone" size={18} />
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={[styles.small, { paddingVertical: 10 }]}>Just you, or add the people you live with.</Text>
              )}
              <Pressable onPress={() => setMate(blankRoommate(newId()))} style={styles.addRow} accessibilityRole="button">
                <Icon name="plus" size={18} color={colors.green} />
                <Text style={styles.link}>Add someone</Text>
              </Pressable>
            </Card>

            {home.notes ? (
              <>
                <SectionLabel>House rules and notes</SectionLabel>
                <Card>
                  <Text style={styles.body}>{home.notes}</Text>
                </Card>
              </>
            ) : null}
          </>
        )}

        <SectionLabel>Trouble with housing?</SectionLabel>
        <Card style={{ gap: 10 }}>
          <Text style={styles.small}>
            Behind on rent, an eviction notice, or not safe where you are? {coordinator.name} can help you make a plan, and these local services can help too.
          </Text>
          <View style={styles.actions}>
            <Button small icon="phone" label={`Call ${coordinator.name}`} onPress={() => call(coordinator.phone)} />
            <Button small tone="outline" label="Housing help" onPress={() => go({ name: 'resources', category: 'Housing help' })} />
            <Button small tone="outline" label="Eviction and legal help" onPress={() => go({ name: 'resources', category: 'Eviction and legal help' })} />
            <Button small tone="outline" label="A place to stay tonight" onPress={() => go({ name: 'resources', category: 'Shelter tonight' })} />
          </View>
        </Card>
      </ScrollView>

      <Sheet visible={draft !== null} title={home ? 'Edit my home' : 'Add my home'} onClose={() => (setDraft(null), setConfirmRemove(false))}>
        {draft ? (
          <>
            <Dropdown label="Kind of place" value={draft.type} options={HOUSING_TYPES} onChange={(type) => setDraft({ ...draft, type })} />
            <Field id="home-name" label="Name (optional)" value={draft.name ?? ''} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="e.g. Oxford House Maple" />
            <Field id="home-address" label="Street address (optional)" value={draft.address} onChangeText={(address) => setDraft({ ...draft, address })} placeholder="e.g. 123 N Main St, Apt 4" />
            <Field id="home-city" label="City" value={draft.city} onChangeText={(city) => setDraft({ ...draft, city })} placeholder="e.g. Spokane, WA" />
            {draft.moveIn ? (
              <DatePicker label="Move-in date" value={draft.moveIn} max={today} onChange={(d) => setLease({}, d)} />
            ) : (
              <Button small tone="outline" icon="calendar" label="Add move-in date" onPress={() => setLease({}, today)} />
            )}
            <View style={styles.pair}>
              <View style={{ flex: 1 }}>
                <Dropdown label="Bedrooms" value={draft.bedrooms} options={BEDROOM_OPTIONS} onChange={(bedrooms) => setDraft({ ...draft, bedrooms })} />
              </View>
              <View style={{ flex: 1 }}>
                <Dropdown label="Beds" value={draft.beds} options={BED_OPTIONS} onChange={(beds) => setDraft({ ...draft, beds })} />
              </View>
            </View>

            <Text style={styles.group}>Lease</Text>
            <Dropdown label="Lease" value={draft.lease.term} options={LEASE_TERMS.map(({ value, label }) => ({ value, label }))} onChange={(term) => setLease({ term })} />
            {draft.lease.end ? (
              <>
                <DatePicker label="Lease ends" value={draft.lease.end} min={draft.moveIn ?? undefined} onChange={(end) => setDraft({ ...draft, lease: { ...draft.lease, end } })} />
                <Pressable onPress={() => setDraft({ ...draft, lease: { ...draft.lease, end: null } })} accessibilityRole="button">
                  <Text style={styles.link}>No end date</Text>
                </Pressable>
              </>
            ) : draft.lease.term !== 'none' ? (
              <Button
                small
                tone="outline"
                icon="calendar"
                label="Add lease end date"
                onPress={() => setDraft({ ...draft, lease: { ...draft.lease, end: (draft.moveIn && leaseEndFor(draft.moveIn, '12_months')) || today } })}
              />
            ) : null}
            <View style={styles.pair}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.fieldLabel}>Rent ($)</Text>
                <TextInput
                  value={draft.lease.rent == null ? '' : String(draft.lease.rent)}
                  onChangeText={(t) => {
                    const n = t.replace(/\D/g, '').slice(0, 6);
                    setDraft({ ...draft, lease: { ...draft.lease, rent: n ? Number(n) : null } });
                  }}
                  keyboardType="number-pad"
                  placeholder="e.g. 650"
                  placeholderTextColor={colors.inkFaint}
                  style={styles.input}
                  accessibilityLabel="Rent in dollars"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Dropdown
                  label="Paid every"
                  value={draft.lease.every}
                  options={[
                    { value: 'month', label: 'Month' },
                    { value: 'week', label: 'Week' },
                  ]}
                  onChange={(every) => setDraft({ ...draft, lease: { ...draft.lease, every, due: every === draft.lease.every ? draft.lease.due : null } })}
                />
              </View>
            </View>
            <Dropdown
              label="Rent is due"
              value={draft.lease.due}
              options={draft.lease.every === 'week' ? WEEKDAYS.map((label, value) => ({ value, label })) : DUE_DAY_OPTIONS}
              onChange={(due) => setDraft({ ...draft, lease: { ...draft.lease, due } })}
            />

            <Field
              id="home-notes"
              label="House rules or notes (optional)"
              value={draft.notes ?? ''}
              onChangeText={(notes) => setDraft({ ...draft, notes })}
              placeholder="e.g. Curfew 10 PM, landlord is Pat"
              multiline
            />
            <Button label="Save" onPress={saveDraft} />
            {home ? (
              confirmRemove ? (
                <View style={styles.actions}>
                  <Button small tone="red" label="Yes, remove" onPress={() => (saveHome(null), setDraft(null), setConfirmRemove(false))} />
                  <Button small tone="outline" label="Keep it" onPress={() => setConfirmRemove(false)} />
                </View>
              ) : (
                <Pressable onPress={() => setConfirmRemove(true)} accessibilityRole="button">
                  <Text style={styles.remove}>Remove my home details</Text>
                </Pressable>
              )
            ) : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={mate !== null} title={mate && home?.roommates.some((x) => x.id === mate.id) ? 'Edit' : 'Who lives with you?'} onClose={() => setMate(null)}>
        {mate ? (
          <>
            <Field id="mate-name" label="Name" value={mate.name} onChangeText={(name) => setMate({ ...mate, name })} placeholder="First name is fine" />
            <Dropdown label="Who they are" value={mate.role} options={ROOMMATE_ROLES} onChange={(role) => setMate({ ...mate, role })} />
            <Field id="mate-phone" label="Phone (optional)" value={mate.phone ?? ''} onChangeText={(phone) => setMate({ ...mate, phone })} keyboardType="phone-pad" placeholder="(509) 555-0123" />
            <Button label="Save" onPress={saveMate} style={mate.name.trim() ? undefined : { opacity: 0.4 }} />
            {home?.roommates.some((x) => x.id === mate.id) ? (
              <Pressable onPress={() => removeMate(mate.id)} accessibilityRole="button">
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </Sheet>

      <CrisisSheet
        visible={crisis !== null}
        variant={crisis ?? 'psychiatric'}
        coordinator={coordinator}
        onSafe={() => setCrisis(null)}
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
  alert: { gap: 10, borderWidth: 1.5, borderColor: colors.red },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 21 },
  small: { fontSize: 13, color: colors.inkSoft, lineHeight: 18 },
  soon: { color: colors.redDark, fontWeight: '700' },
  link: { fontSize: 15, fontWeight: '700', color: colors.green },
  remove: { fontSize: 15, fontWeight: '600', color: colors.red, textAlign: 'center', paddingVertical: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.module.myhome, alignItems: 'center', justifyContent: 'center' },
  mateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenLight },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  pair: { flexDirection: 'row', gap: 10 },
  group: { fontSize: 13, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
});
