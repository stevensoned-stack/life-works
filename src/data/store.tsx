import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { outbox } from '../safety/events';
import { pushAlerts, Synced, syncConfig } from '../safety/sync';
import { seedState } from './seed';
import {
  Attendance,
  CalendarItem,
  CheckIn,
  MoodEntry,
  MoodValue,
  LocationCheck,
  Place,
  PlanSlot,
  Reminder,
  SafetyEvent,
  SafetyTier,
  Settings,
  State,
  SupportPerson,
} from './types';

const KEY = 'lifeworks:v1';

type Store = {
  state: State;
  ready: boolean;
  recordMood: (value: MoodValue, tags?: string[], note?: string) => MoodEntry;
  updateMood: (id: string, patch: Partial<Pick<MoodEntry, 'tags' | 'note'>>) => void;
  saveCheckIn: (c: CheckIn) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setSobrietyDate: (date: string | null) => void;
  savePerson: (p: SupportPerson) => void;
  removePerson: (id: string) => void;
  saveEvent: (e: CalendarItem) => void;
  removeEvent: (id: string) => void;
  saveReminder: (r: Reminder) => void;
  removeReminder: (id: string) => void;
  toggleVisit: (meetingId: string, date: string) => void;
  saveQuestion: (text: string) => void;
  removeQuestion: (id: string) => void;
  resetDemo: () => void;
  logSafetyEvent: (e: SafetyEvent) => void;
  noteSafetyAction: (id: string, label: string, raiseTo?: SafetyTier) => void;
  reviewSafetyEvent: (id: string, by: string, note: string) => void;
  markAlertTexted: (id: string) => void;
  checkIn: (place: Place, check: LocationCheck | null, share: boolean) => Attendance;
  checkOut: (check?: LocationCheck | null) => void;
  savePlace: (p: Place) => void;
  removePlace: (id: string) => void;
  saveSlot: (s: PlanSlot) => void;
  removeSlot: (id: string) => void;
};

const Ctx = createContext<Store | null>(null);

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const upsert = <T extends { id: string }>(xs: T[], x: T) =>
  xs.some((y) => y.id === x.id) ? xs.map((y) => (y.id === x.id ? x : y)) : [...xs, x];

// Data saved by an earlier version may lack newer fields; fill them from the seed.
function migrate(saved: Partial<State>): State {
  const seed = seedState();
  return { ...seed, ...saved, settings: { ...seed.settings, ...saved.settings } };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(seedState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setState(migrate(JSON.parse(raw)));
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  // Everything is stored on the device. The only thing that leaves it is a
  // safety event the person agreed to share, and only when a server is set up.
  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const markSynced = useCallback((done: Synced[]) => {
    const at = new Date().toISOString();
    const version = new Map(done.map((d) => [d.id, d.version]));
    setState((s) => ({
      ...s,
      safetyEvents: s.safetyEvents.map((e) =>
        version.has(e.id) ? { ...e, alert: { ...e.alert, syncedVersion: version.get(e.id), syncedAt: at } } : e,
      ),
    }));
  }, []);

  // Send shared alerts as soon as they're logged or change, and retry every
  // minute while any are waiting (no signal, server down).
  const sending = useRef(false);
  const pending = outbox(state.safetyEvents).length;
  useEffect(() => {
    const cfg = syncConfig();
    if (!ready || !cfg || !pending) return;
    const run = () => {
      if (sending.current) return;
      sending.current = true;
      pushAlerts(cfg, stateRef.current.safetyEvents)
        .then((done) => done.length && markSynced(done))
        .finally(() => (sending.current = false));
    };
    run();
    const t = setInterval(run, 60_000);
    return () => clearInterval(t);
  }, [ready, pending, state.safetyEvents, markSynced]);

  const recordMood = useCallback((value: MoodValue, tags: string[] = [], note?: string) => {
    const entry: MoodEntry = {
      id: newId(),
      value,
      source: 'self_report',
      recordedAt: new Date().toISOString(),
      tags,
      note,
    };
    setState((s) => ({ ...s, moods: [...s.moods, entry] }));
    return entry;
  }, []);

  const updateMood = useCallback((id: string, patch: Partial<Pick<MoodEntry, 'tags' | 'note'>>) => {
    setState((s) => ({ ...s, moods: s.moods.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  }, []);

  const saveCheckIn = useCallback((c: CheckIn) => {
    setState((s) => ({ ...s, checkins: upsert(s.checkins, c) }));
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const setSobrietyDate = useCallback((date: string | null) => setState((s) => ({ ...s, sobrietyDate: date })), []);
  const savePerson = useCallback((p: SupportPerson) => setState((s) => ({ ...s, people: upsert(s.people, p) })), []);
  const removePerson = useCallback(
    (id: string) => setState((s) => ({ ...s, people: s.people.filter((p) => p.id !== id) })),
    [],
  );
  const saveEvent = useCallback((e: CalendarItem) => setState((s) => ({ ...s, calendar: upsert(s.calendar, e) })), []);
  const removeEvent = useCallback(
    (id: string) => setState((s) => ({ ...s, calendar: s.calendar.filter((e) => e.id !== id) })),
    [],
  );
  const saveReminder = useCallback((r: Reminder) => setState((s) => ({ ...s, reminders: upsert(s.reminders, r) })), []);
  const removeReminder = useCallback(
    (id: string) => setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) })),
    [],
  );
  const toggleVisit = useCallback((meetingId: string, date: string) => {
    setState((s) => {
      const has = s.visits.find((v) => v.meetingId === meetingId && v.date === date);
      return {
        ...s,
        visits: has ? s.visits.filter((v) => v !== has) : [...s.visits, { id: newId(), meetingId, date }],
      };
    });
  }, []);

  const saveQuestion = useCallback((text: string) => {
    setState((s) =>
      s.questions.some((q) => q.text === text)
        ? s
        : { ...s, questions: [...s.questions, { id: newId(), text, savedAt: new Date().toISOString() }] },
    );
  }, []);
  const removeQuestion = useCallback(
    (id: string) => setState((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== id) })),
    [],
  );

  // Safety events are append-only. Actions and reviews add to a record; nothing
  // here removes one or rewrites what triggered it.
  const logSafetyEvent = useCallback((e: SafetyEvent) => setState((s) => ({ ...s, safetyEvents: [...s.safetyEvents, e] })), []);
  const noteSafetyAction = useCallback((id: string, label: string, raiseTo?: SafetyTier) => {
    setState((s) => ({
      ...s,
      safetyEvents: s.safetyEvents.map((e) =>
        e.id === id
          ? {
              ...e,
              tier: raiseTo && raiseTo > e.tier ? raiseTo : e.tier,
              taken: [...e.taken, { label, at: new Date().toISOString() }],
            }
          : e,
      ),
    }));
  }, []);
  const reviewSafetyEvent = useCallback((id: string, by: string, note: string) => {
    setState((s) => ({
      ...s,
      safetyEvents: s.safetyEvents.map((e) =>
        e.id === id && !e.review ? { ...e, review: { by, at: new Date().toISOString(), note } } : e,
      ),
    }));
  }, []);

  // The phone's messages app opened with the alert; we can't see whether it was sent.
  const markAlertTexted = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      safetyEvents: s.safetyEvents.map((e) =>
        e.id === id && e.alert.status === 'queued'
          ? { ...e, alert: { ...e.alert, status: 'texted', sentAt: new Date().toISOString() } }
          : e,
      ),
    }));
  }, []);

  // Checking in somewhere new closes any visit still open, at the same moment:
  // people forget to check out, and a person can only be in one place.
  const checkIn = useCallback((place: Place, check: LocationCheck | null, share: boolean) => {
    const now = new Date().toISOString();
    const visit: Attendance = {
      id: newId(),
      placeId: place.id,
      placeName: place.name,
      method: check ? 'location' : 'tap',
      inAt: now,
      inCheck: check ?? undefined,
      share: share ? 'queued' : 'not_shared',
    };
    setState((s) => ({
      ...s,
      attendance: [...s.attendance.map((r) => (r.outAt ? r : { ...r, outAt: now })), visit],
    }));
    return visit;
  }, []);
  const checkOut = useCallback((check?: LocationCheck | null) => {
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      attendance: s.attendance.map((r) => (r.outAt ? r : { ...r, outAt: now, outCheck: check ?? undefined })),
    }));
  }, []);
  const savePlace = useCallback((p: Place) => setState((s) => ({ ...s, places: upsert(s.places, p) })), []);
  // Past check-ins keep the place's name, so removing a place doesn't rewrite history.
  const removePlace = useCallback(
    (id: string) =>
      setState((s) => ({ ...s, places: s.places.filter((p) => p.id !== id), plan: s.plan.filter((x) => x.placeId !== id) })),
    [],
  );
  const saveSlot = useCallback((x: PlanSlot) => setState((s) => ({ ...s, plan: upsert(s.plan, x) })), []);
  const removeSlot = useCallback((id: string) => setState((s) => ({ ...s, plan: s.plan.filter((x) => x.id !== id) })), []);

  const resetDemo = useCallback(() => {
    setState((s) => ({ ...seedState(), settings: { ...seedState().settings, onboarded: s.settings.onboarded } }));
  }, []);

  return (
    <Ctx.Provider
      value={{
        state,
        ready,
        recordMood,
        updateMood,
        saveCheckIn,
        updateSettings,
        setSobrietyDate,
        savePerson,
        removePerson,
        saveEvent,
        removeEvent,
        saveReminder,
        removeReminder,
        toggleVisit,
        saveQuestion,
        removeQuestion,
        resetDemo,
        logSafetyEvent,
        noteSafetyAction,
        reviewSafetyEvent,
        markAlertTexted,
        checkIn,
        checkOut,
        savePlace,
        removePlace,
        saveSlot,
        removeSlot,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}
