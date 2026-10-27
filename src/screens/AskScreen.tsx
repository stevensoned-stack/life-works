import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ZoeyAvatar } from '../components/Art';
import { useChatScroll } from '../components/chatScroll';
import CrisisSheet from '../components/CrisisSheet';
import Icon from '../components/Icon';
import { Button, Chip, ScreenHeader } from '../components/ui';
import { newId, useStore } from '../data/store';
import { Route } from '../modules';
import { call, text as sendText } from '../recovery/contact';
import { colors, radius } from '../theme';
import { addDays, isToday, sameWords, timeLabel, wordsKey } from '../util';
import { Answer, AnswerAction, ANSWERS, Topic, TOPICS } from '../zoey/answers';
import { answerFor, ask, Reply, sayAnswer, urgentReply } from '../zoey/ask';
import { buildContext } from '../zoey/context';
import { copy, vary } from '../zoey/copy';
import { badDayLine, findBadDay, findBig, findOneWord, findUrge, oneWordLine, followUp, isHopelessCheck, metaReply, typedAnswer, yesNo } from '../zoey/feelings';
import { define, findDefine, HEAVY_ASK, HEAVY_NO, UNKNOWN } from '../zoey/define';
import { findSelfDoubt, SELF_HEARD, selfWorthLine } from '../zoey/selfworth';
import { screen } from '../zoey/safety';
import { GLAD_OPEN, AFTER_WHY, findDismiss, findGreeting, findInsult, findShutUp, GLAD, greetLine, HEEEY, HEEEY_INSULT, howAnswer, openingLine, QUIET_CARE, WHY_THINK } from '../zoey/greet';
import { DayItem, dayItems, todayItems, todayLine } from '../zoey/today';
import { dayChoices, dayOnly, findScheduleAsk, parseDay, scheduleReply, ScheduleQ } from '../zoey/schedule';
import { clockLine, findClock, findFunnyAsk, findWord, JOKE_LATER, JOKE_OFFER, wordLine } from '../zoey/words';
import { CLARIFY_LINES, complaintReply, findComplaint } from '../zoey/complaints';
import { alertLine, findWeatherAsk, Outlook, outlook, weatherAnswer, weatherLine, weatherWarning } from '../zoey/weather';
import { markSafe, raise, Risk, saysSafe, worry, worryActions } from '../zoey/watch';
import { END, fill, isHardFeeling, lineFor, skipAfterShare, Tree, TreeAction, TREES } from '../zoey/trees';
import { useZoeyVoice, VoiceToggle } from '../zoey/useVoice';
import { FAVORITE_HEARD, favoriteAnswer, favoriteLine, findFavorite, findFavoriteQuestion, GOT_IT, GUESS, GUESS_WRONG, makeFavorite, readFavoriteReply, STUMPED } from '../zoey/favorites';
import { countTopic, emptyLearned, favoriteOf, findNickname, findReplyPref, helloBack, learnFavorite, learnPick, learnRephrase, observe, replyStyle, screenHeard, setNickname, setReplies, shorten } from '../zoey/learn';
import { alertText, makeEvent } from '../safety/events';
import { cityAnswer, cityHeard, cityLabel, CITY_NOT_FOUND, cityOrNot, findCity, findPlaceAsk, NEAR_DENIED, NEAR_PERMISSION, nearAnswer, NearWhat, Point, zoneAnswer } from '../zoey/place';
import { CURRENT_REGION } from '../data/resources';
import { readHere } from '../recovery/location';
import { whereIs } from '../recovery/geocode';
import { SAMPLE_MEETINGS } from '../recovery/meetings';
import { didYouMean, spellFix, Spelled } from '../zoey/spell';
import BreathingTimer from '../components/BreathingTimer';
import { AFTER_BREATHING, BREATH_ASK, BREATH_GO, BREATH_LATER, BREATH_WELL_DONE, findBreathAsk } from '../zoey/breath';

type Item =
  | { id: string; kind: 'me'; text: string }
  // Ed's paced breathing timer, wherever she offers breathing (breath.ts).
  | { id: string; kind: 'breathing' }
  | {
      id: string;
      kind: 'zoey';
      text: string;
      question?: string;
      actions?: AnswerAction[];
      alternatives?: Answer[];
      urgent?: boolean;
      eventId?: string;
      // Shown but never read aloud (crisis, urgent and safety-check replies).
      quiet?: boolean;
      // The rest of a long answer, behind "More", for people who like short replies.
      more?: string;
    };

export default function AskScreen({ go, back }: { go: (r: Route) => void; back: () => void }) {
  const insets = useSafeAreaInsets();
  const { state, saveQuestion, removeQuestion, logSafetyEvent, noteSafetyAction, markAlertTexted, updateLearned, updateSettings } = useStore();
  const ctx = useMemo(() => buildContext(state), [state]);
  // How they talk (learn.ts). With learning off she still knows common shorthand.
  const learning = state.settings.zoeyLearns;
  const learned = useMemo(() => (learning ? state.learned : emptyLearned()), [learning, state.learned]);
  const knownNames = useMemo(() => state.people.map((p) => p.name.split(' ')[0]), [state.people]);
  // Their last message Zoey couldn't place: if the next one works, she learns from it.
  const missed = useRef<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [input, setInput] = useState('');
  const [topic, setTopic] = useState<Topic | null>(null);
  const [crisis, setCrisis] = useState<null | 'psychiatric' | 'medical'>(null);
  const [checkPending, setCheckPending] = useState(false);
  // The words that raised "are you safe right now?".
  const checkMatched = useRef('');
  const [saved, setSaved] = useState<string | null>(null);
  // Yes / No buttons while Zoey asks about a feeling they typed.
  const [choices, showChoices] = useState<{ label: string; onPick: () => void }[]>([]);
  // A tapped button goes through submit() like typed words (Ed, 2026-10-27: "when they
  // click on a selection respond just like you would if they typed it"). The button's
  // own step runs there, after the safety screen, as the answer to her open question.
  const buttons = useRef(new Map<string, () => void>());
  const setChoices = (cs: { label: string; onPick: () => void }[]) => {
    buttons.current = new Map(cs.map((c) => [wordsKey(c.label), c.onPick]));
    showChoices(cs);
  };
  // submit() already showed their words, so the button's step doesn't show them again.
  const echo = useRef<string | null>(null);
  // While Zoey waits on a question in a tree: takes what they type and returns
  // true if it answered the question ("yes", "no", or the thing she asked for).
  const listening = useRef<((t: string) => boolean) | null>(null);
  // The rest of a flow, waiting while they breathe with the timer.
  const afterBreath = useRef<(() => void) | null>(null);
  // Zoey's last reply asked them to say more about something she couldn't place.
  const lastFallback = useRef(false);
  // The safety event the crisis sheet or safe-check chips belong to.
  const eventRef = useRef<string | null>(null);
  // Danger words from earlier in this chat; Zoey keeps checking on them (watch.ts).
  const risk = useRef<Risk | null>(null);
  // Zoey opens every time with hello by name and time of day, and every few
  // days their clean time (Ed, 2026-10-24). Then she listens for how they are.
  const [opening] = useState(() => openingLine({ now: new Date(), name: ctx.name, cleanDays: ctx.cleanDays }));
  useEffect(() => {
    listening.current = hearHow;
  }, []);
  // The city they live in: what they told Zoey or Settings, else their MyHome city (place.ts).
  // A ref, so a city they name in this chat is used right away.
  const city = useRef(state.settings.city ?? (state.home?.city ? findCity(state.home.city, CURRENT_REGION.weatherAt) : null));
  const cityAt = () => (city.current ? { lat: city.current.lat, lon: city.current.lon, place: cityLabel(city.current) } : null);
  // The city's forecast, if the lookup worked (weather.ts). `weather` is the period they're in now.
  const sky = useRef<Outlook | null>(null);
  const weather = { get current() { return sky.current?.periods[0] ?? null; } };
  // Weather warnings already given this chat.
  const warned = useRef(new Set<string>());
  const warnOnce = (line: string | null) => {
    if (!line || warned.current.has(line) || risk.current) return;
    warned.current.add(line);
    say(line);
  };
  useEffect(() => {
    outlook(Date.now(), cityAt()).then(
      (o) => {
        sky.current = o;
        // Bad weather before an early plan, or a severe alert: say so once, right away (Ed, 2026-10-25).
        const now = new Date();
        warnOnce(alertLine(o));
        warnOnce(weatherWarning(o, [...dayItems(state, now, now), ...dayItems(state, addDays(now, 1))], now));
      },
      () => {},
    );
  }, []);

  const coordinator = state.profile.coordinator;
  const sponsor = state.people.find((p) => p.role.toLowerCase() === 'sponsor');
  // Their counselor or therapist in LifeCircle, for "Call my counselor".
  const counselor = state.people.find((p) => /counsel|therap/i.test(p.role));
  const checkedIn = [...state.checkins].reverse().find((c) => c.completedAt && isToday(c.completedAt));

  const { scrollProps, track, keep } = useChatScroll(useMemo(() => items.map((i) => i.id), [items]), choices.length > 0 || checkPending);

  const add = (...xs: Item[]) => {
    const at = echo.current ? xs.findIndex((x) => x.kind === 'me' && sameWords(x.text, echo.current!)) : -1;
    if (at >= 0) echo.current = null;
    const ys = at >= 0 ? xs.filter((_, i) => i !== at) : xs;
    if (ys.length) setItems((s) => [...s, ...ys]);
  };
  // The opening greeting is read aloud too, so people can read it and hear it.
  const spoken = useMemo(() => [{ id: 'opening', text: opening }, ...items.flatMap((i) => (i.kind === 'zoey' ? [i] : []))], [items, opening]);
  useZoeyVoice(spoken, crisis !== null);

  const share = state.settings.shareSafetyAlerts;
  const textAlertAction = (tier: 1 | 2 | 3): AnswerAction => ({
    kind: 'text',
    label: `Text ${coordinator.name} to check on me`,
    who: 'coordinator',
    body: alertText(state.profile.name, tier),
  });
  const textAlert = () => {
    const id = eventRef.current;
    const e = state.safetyEvents.find((x) => x.id === id);
    sendText(coordinator.phone, alertText(state.profile.name, e?.tier ?? 3));
    if (id) {
      noteSafetyAction(id, `Text ${coordinator.name}`);
      markAlertTexted(id);
    }
  };

  const show = (r: Reply, question: string, eventId?: string) => {
    switch (r.kind) {
      case 'crisis':
        add({ id: newId(), kind: 'zoey', text: r.text, quiet: true });
        setCrisis(r.variant);
        return;
      case 'check':
        add({ id: newId(), kind: 'zoey', text: r.text, quiet: true });
        setCheckPending(true);
        return;
      case 'urgent':
        add({
          id: newId(),
          kind: 'zoey',
          text: r.text,
          actions: share && r.variant !== 'someone' ? [...r.actions, textAlertAction(2)] : r.actions,
          urgent: r.variant !== 'housing',
          eventId,
          quiet: true,
        });
        return;
      case 'answer':
        add(answerItem(r, question));
        // "How do I calm down?": the breathing timer right under it.
        if (r.answer.id === 'calm') add({ id: newId(), kind: 'breathing' });
        if (r.answer.id === 'joke') toldJoke.current = true;
        return;
      default:
        add({ id: newId(), kind: 'zoey', text: r.text, actions: r.actions, question });
    }
  };

  // People who like short replies get the first two sentences and "More" (learn.ts).
  const answerItem = (r: { answer?: Answer; text: string; alts?: string[]; actions: AnswerAction[]; alternatives: Answer[] }, question: string): Item => {
    const said = sayAnswer(r);
    const cut = replyStyle(learned) === 'short' ? shorten(said) : null;
    return { id: newId(), kind: 'zoey', text: cut?.short ?? said, more: cut?.rest, actions: r.actions, alternatives: r.alternatives, question };
  };
  const showMore = (id: string) =>
    setItems((xs) => xs.map((x) => (x.id === id && x.kind === 'zoey' && x.more ? { ...x, text: `${x.text} ${x.more}`, more: undefined } : x)));

  // --- Typed feelings: "Do you know why?" (trees.ts, feeling:*) -------------
  // The person in "Jim hates me", for the `hates` tree.
  const whoRef = useRef<string | null>(null);
  const vars = {
    coord: coordinator.name,
    sponsor: sponsor?.name.split(' ')[0] ?? null,
    name: ctx.name,
    get who() {
      return whoRef.current;
    },
  };
  const say = (t: string) => add({ id: newId(), kind: 'zoey', text: t });
  // `quiet`: Zoey already rephrased this node's question, so don't say it twice.
  const walk = (tree: Tree, id: string, quiet = false): void => {
    setChoices([]);
    listening.current = null;
    if (id === END) return;
    const n = tree.nodes[id];
    const to = (x?: string) => () => walk(tree, x ?? END);
    const pick = (label: string, x?: string) => ({ label, onPick: () => (add({ id: newId(), kind: 'me', text: label }), to(x)()) });
    // Typed replies to her question: an answer, "what do you mean?", "why?", "no".
    const hear = (t: string) => {
      // "I wanted to use" in the middle of another talk gets the urge question, not "I like that plan".
      if (tree.id !== 'urge' && findUrge(t)) return false;
      // So does "I hate my family": "Wow, that's big. Tell me more..." (Ed, 2026-10-27).
      if (tree.id !== 'big' && findBig(t)) return false;
      const r = typedAnswer(tree, id, t);
      if (!r) return false;
      if (r.say) say(fill(r.say, vars));
      walk(tree, r.to, r.again);
      return true;
    };
    if (n.say && !quiet) say(fill(lineFor(n), vars));
    if (n.save) saveQuestion(n.save);
    if (n.safety) {
      // A tapped answer that means danger ("no safe place tonight") gets the same help as typed words.
      const hit = { kind: 'urgent' as const, variant: n.safety, matched: `tree:${tree.id}/${id}` };
      risk.current = raise(risk.current, hit);
      const eventId = flag(hit, `${tree.title}: ${n.safety}`);
      show(urgentReply(n.safety, ctx), tree.title, eventId);
      return to(n.next)();
    }
    if (n.topics) {
      // "What do you need help with?" Typing goes through the usual safety screen and answers.
      listening.current = hear;
      return setChoices(
        n.topics.map((t) => ({
          label: t.label,
          onPick: () => {
            add({ id: newId(), kind: 'me', text: t.label });
            const next = t.tree ? TREES[t.tree] : tree;
            walk(next, t.node ?? next.start);
          },
        })),
      );
    }
    if (n.yes || n.no) {
      // Typing works too: "yes" / "no", or for "Can you tell me more?" just telling more.
      listening.current = hear;
      return setChoices([pick('Yes', n.yes), pick('No', n.no), ...(n.notSure ? [pick("I'm not sure", n.notSure)] : [])]);
    }
    if (n.share) {
      listening.current = hear;
      // "I'd rather not" skips the "thank you for telling me" line.
      const skip = skipAfterShare(tree, id);
      // "Can I ask why?" says its own "that's okay", so no "you don't have to" first.
      return setChoices([{ label: "I'd rather not", onPick: () => (add({ id: newId(), kind: 'me', text: "I'd rather not" }), skip !== 'whyNo' && say(vary('rather')), to(skip)()) }]);
    }
    const offers = (n.offer ?? []).filter((o) => (sponsor || (o.action !== 'callSponsor' && o.action !== 'textSponsor')) && (counselor || o.action !== 'callCounselor'));
    if (offers.length) {
      // "Please tell me more, or reach out": typing is telling more.
      if (n.share) listening.current = hear;
      return setChoices([
        ...offers.map((o) => {
          const label = fill(o.label, vars);
          if (o.action === 'breathing')
            // The timer first; her next question waits until they finish or tap "Done breathing".
            return {
              label,
              onPick: () => {
                add({ id: newId(), kind: 'me', text: label });
                treeAction(o.action);
                afterBreath.current = to(n.next);
                setChoices([{ label: 'Done breathing', onPick: () => (add({ id: newId(), kind: 'me', text: 'Done breathing' }), breathDone()) }]);
              },
            };
          return { label, onPick: () => (add({ id: newId(), kind: 'me', text: label }), treeAction(o.action), to(n.next)()) };
        }),
        pick('Not now', n.next),
      ]);
    }
    to(n.next)();
  };
  const treeAction = (a: TreeAction) => {
    switch (a) {
      case 'callCoordinator':
        return call(coordinator.phone);
      case 'callSponsor':
        return call(sponsor?.phone ?? coordinator.phone);
      case 'textSponsor':
        return sendText(sponsor?.phone ?? coordinator.phone);
      case 'call211':
        return call('211');
      case 'breathing':
        return add({ id: newId(), kind: 'breathing' });
      case 'findMeeting':
        return go({ name: 'calendar', tab: 'meetings' });
      case 'localHelp':
        return go({ name: 'resources' });
      case 'openLifeCircle':
        return go({ name: 'lifecircle' });
      case 'callCounselor':
        return call(counselor?.phone ?? coordinator.phone);
    }
  };

  // Saved for the counselor in the same update that shows the help, so it never delays it.
  const flag = (result: Exclude<ReturnType<typeof screen>, { kind: 'none' }>, message: string) => {
    const id = newId();
    eventRef.current = id;
    logSafetyEvent(
      makeEvent({
        id,
        result,
        message,
        history: items.flatMap((i) => (i.kind === 'breathing' ? [] : [{ from: i.kind === 'me' ? ('me' as const) : ('zoey' as const), text: i.text, at: '' }])),
        screen: 'ask',
        coordinatorName: coordinator.name,
        share: state.settings.shareSafetyAlerts,
      }),
    );
    return id;
  };

  const submit = (q: string, tapped = false) => {
    const t = q.trim();
    if (!t) return;
    setInput('');
    setTopic(null);
    // Their words match a button on screen (tapped or typed): that button's step answers.
    const button = buttons.current.get(wordsKey(t));
    setChoices([]);
    const breathing = afterBreath.current;
    afterBreath.current = null;
    const answering = listening.current;
    listening.current = null;
    const again = lastFallback.current;
    lastFallback.current = false;
    const missedBefore = missed.current;
    missed.current = null;
    const meId = newId();
    add({ id: meId, kind: 'me', text: t });
    // Typos fixed (spell.ts): `heard` has the sure fixes, the rest wait for "Did you mean...?".
    const sp = spellFix(t, [ctx.name, coordinator.name, ...state.people.map((p) => p.name), ...learned.words.map((w) => w.said)]);
    spelled.current = sp;
    const heard = sp.sure;
    // Crisis help shows first; saving the event for the counselor is a local
    // state update and never holds it up.
    // What they typed first; then with their own words swapped in, then with typos
    // fixed. Learning and spelling can only add help here, never take it away.
    let s: ReturnType<typeof screenHeard> = { kind: 'none' };
    let said = heard;
    for (const x of [...new Set([t, sp.sure, sp.all])]) {
      s = screenHeard(x, learned);
      if (s.kind !== 'none') {
        said = x;
        break;
      }
    }
    const r = ask(said, ctx, { again, learned });
    if (s.kind !== 'none') {
      if (s.kind === 'check') checkMatched.current = s.matched;
      risk.current = raise(risk.current, s);
      const eventId = flag(s, t);
      show(r, t, eventId);
      // "Closest shelter": the housing help above, then the closest shelters if she knows where they are.
      const gps = state.settings.nearbyLocation && !noGps.current;
      const near = s.kind === 'urgent' && s.variant === 'housing' && (gps || city.current) ? findPlaceAsk(t) : null;
      if (near?.kind === 'near') void findNear('shelter', gps);
      return;
    }
    // Nothing is learned from a message that set off the safety screen (above), or
    // from a button's words, which aren't theirs.
    if (!tapped) updateLearned((l) => observe(l, t, knownNames));
    // "Shut up" after danger words: no joke, just space and help.
    if (risk.current && (findShutUp(t) || findInsult(t))) {
      add({ id: newId(), kind: 'zoey', text: QUIET_CARE, actions: worryActions(risk.current.topic, ctx), quiet: true });
      return;
    }
    // Earlier danger words: say she's still worried, ask how they are, offer help.
    if (risk.current && saysSafe(t)) risk.current = markSafe(risk.current);
    const w = risk.current ? worry(risk.current, ctx) : null;
    if (w) risk.current = w.risk;
    // Her check-in already asks them to say more, so skip "can you tell me more?".
    // A button's words: its own step, the same as tapping it, before anything else she'd say.
    if (button) {
      if (breathing) afterBreath.current = breathing;
      echo.current = t;
      button();
      echo.current = null;
    }
    const answered = button ? false : reply(heard, r, answering, again, !!w?.reply, missedBefore);
    // After "good" to "how are you?" (hearHow) or her first real answer: today's plans.
    if (!listening.current && !w && answered) {
      const plans = nextToday();
      if (plans) say(plans);
    }
    if (!w?.reply) return;
    const item: Item = { id: newId(), kind: 'zoey', text: w.reply.text, actions: w.reply.actions, quiet: true };
    // If her reply ends on a question they should answer, check on them first.
    if (listening.current) setItems((xs) => {
      const at = xs.findIndex((x) => x.id === meId) + 1;
      return [...xs.slice(0, at), item, ...xs.slice(at)];
    });
    else add(item);
  };

  // Once a chat, what's on today (Ed, 2026-10-24). Null once said or if nothing's on.
  const todaySaid = useRef(false);
  const nextToday = () => {
    if (todaySaid.current || risk.current) return null;
    const line = todayLine(todayItems(state));
    if (line) {
      todaySaid.current = true;
      schedLast.current = null;
    }
    return line;
  };
  const oneOf = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];
  // Timer done (or "Done breathing"): the flow they were in carries on, or "how do you feel now?"
  const breathDone = () => {
    const next = afterBreath.current;
    afterBreath.current = null;
    setChoices([]);
    if (!next) return say(oneOf(AFTER_BREATHING));
    say(oneOf(BREATH_WELL_DONE));
    next();
  };
  // "Can you be funny?": offer the joke first (Ed, 2026-10-27). Not after danger words.
  const funnyAsk = (x: string) => {
    if (risk.current || !findFunnyAsk(x)) return false;
    lastAsked.current = null;
    say(JOKE_OFFER);
    const go = (yes: boolean) => {
      setChoices([]);
      if (!yes) return say(oneOf(JOKE_LATER));
      show(answerFor(ANSWERS.find((a) => a.id === 'joke')!, ctx), x);
    };
    setChoices([
      { label: 'Yes', onPick: () => (add({ id: newId(), kind: 'me', text: 'Yes' }), go(true)) },
      { label: 'Not now', onPick: () => (add({ id: newId(), kind: 'me', text: 'Not now' }), go(false)) },
    ]);
    listening.current = (y) => {
      const yn = yesNo(y);
      const later = /\b(?:not now|later|maybe later|no thanks)\b/i.test(y);
      return yn || later ? (go(!later && yn?.answer === 'yes'), true) : false;
    };
    return true;
  };
  // "Breathing exercise": "Do you want to do that now?" Yes brings up the timer,
  // no is "Okay, we can do it later." (Ed, 2026-10-27).
  const breathAsk = (x: string) => {
    if (!findBreathAsk(x)) return false;
    lastAsked.current = null;
    say(BREATH_ASK);
    const go = (yes: boolean) => {
      setChoices([]);
      if (!yes) return say(oneOf(BREATH_LATER));
      say(oneOf(BREATH_GO));
      add({ id: newId(), kind: 'breathing' });
      setChoices([{ label: 'Done breathing', onPick: () => (add({ id: newId(), kind: 'me', text: 'Done breathing' }), breathDone()) }]);
    };
    setChoices([
      { label: 'Yes', onPick: () => (add({ id: newId(), kind: 'me', text: 'Yes' }), go(true)) },
      { label: 'No', onPick: () => (add({ id: newId(), kind: 'me', text: 'No' }), go(false)) },
    ]);
    listening.current = (y) => {
      const yn = yesNo(y);
      return yn ? (go(yn.answer === 'yes'), true) : false;
    };
    return true;
  };
  // "I had a bad day": say it back, ask what made it bad, then the "sad" flow listens
  // quietly for their answer (Ed, 2026-10-27).
  const badDay = (x: string) => {
    const b = findBadDay(x);
    if (!b) return false;
    lastAsked.current = null;
    say(badDayLine(b));
    walk(TREES['feeling:sad'], 'more', true);
    // She asked "what made it bad?", so no Yes / No buttons under it.
    setChoices([]);
    return true;
  };
  // "Bad? What do you mean by bad?" Their answer goes on into that feeling's flow
  // ("bad" is the sad one), quietly; "fine" or "meh" just goes through as usual.
  const oneWord = (x: string) => {
    const o = findOneWord(x);
    if (!o) return false;
    lastAsked.current = null;
    say(oneWordLine(o));
    const tree = o.key ? TREES[`feeling:${o.key}`] : null;
    const node = tree && (isHardFeeling(o.key!) ? 'more' : 'share');
    if (tree && node && tree.nodes[node]) {
      walk(tree, node, true);
      setChoices([]);
    }
    return true;
  };
  // Their answer to "how are you?": a feeling goes to the feeling flows as usual.
  const hearHow = (x: string) => {
    if (badDay(x)) return true;
    if (followUp(x, ask(x, ctx).kind)) return false;
    const how = howAnswer(x);
    if (how === 'good') {
      const plans = nextToday();
      say(plans ? `${oneOf(GLAD_OPEN)} ${plans}` : oneOf(GLAD));
    }
    else if (how === 'bad') walk(TREES['feeling:sad'], 'more');
    return how !== null;
  };

  // True when it showed a library answer (the moment for today's plans).
  // Zoey just joked ("shut up", "you're dumb"), so "sorry" gets "apology accepted".
  const joked = useRef(false);
  // Zoey just told her joke, so "haha" gets "I'm glad you liked it!" (Ed, 2026-10-27).
  const toldJoke = useRef(false);
  // The last thing on their schedule Zoey named, for "and after that?".
  const schedLast = useRef<DayItem | null>(null);
  // Their last question Zoey tried to answer, for "you didn't answer my question".
  const lastAsked = useRef<string | null>(null);
  // This message's typo fixes, for "Did you mean...?" (spell.ts).
  const spelled = useRef<Spelled | null>(null);

  // --- Where they live and what's near them (place.ts, Ed 2026-10-25) ---
  // Their "no" to checking their location, for the rest of this chat.
  const noGps = useRef(false);
  const saveCity = (c: NonNullable<typeof city.current>) => {
    city.current = c;
    updateSettings({ city: c });
    // The weather is for their city now.
    outlook(Date.now(), cityAt()).then((o) => (sky.current = o), () => {});
  };
  // Their answer to "What city do you live in?". `then`: what to do once it's saved.
  const hearCity = (then?: () => void) => {
    let tries = 0;
    const hear = (x: string): boolean => {
      if (cityOrNot(x)) {
        say('Okay. You can add it any time in Settings.');
        return true;
      }
      const set = findPlaceAsk(x, CURRENT_REGION.weatherAt);
      const c = set?.kind === 'setCity' ? set.city : findCity(x, CURRENT_REGION.weatherAt);
      if (c) {
        saveCity(c);
        say(cityHeard(c));
        then?.();
        return true;
      }
      // A short reply that isn't a town they know: ask once for the state too.
      if (tries++ === 0 && x.trim().split(/\s+/).length <= 4 && !/\?\s*$/.test(x)) {
        say(CITY_NOT_FOUND);
        listening.current = hear;
        return true;
      }
      return false;
    };
    return hear;
  };
  const mapsUrl = (q: string) =>
    Platform.OS === 'ios' ? `http://maps.apple.com/?q=${encodeURIComponent(q)}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  // One location reading if they said yes, used here and dropped: never saved or sent.
  const findNear = async (what: NearWhat, gps: boolean) => {
    const reading = gps ? await readHere() : null;
    const here: Point | null = reading?.ok ? { lat: reading.reading.lat, lon: reading.reading.lng } : null;
    const from = here ?? (city.current ? { lat: city.current.lat, lon: city.current.lon } : null);
    if (!from) {
      say(`${gps ? 'I couldn’t get your location, and I' : 'I'} don’t know what city you live in yet. What city do you live in?`);
      listening.current = hearCity(() => void findNear(what, false));
      return;
    }
    const area = CURRENT_REGION.area ?? '';
    const resources = await Promise.all(CURRENT_REGION.resources.map(async (x) => ({ ...x, at: x.address ? await whereIs(x.address, area) : null })));
    const r = nearAnswer({
      what,
      from,
      fromCity: !here,
      regionName: CURRENT_REGION.name,
      regionAt: CURRENT_REGION.weatherAt ?? null,
      resources,
      meetings: SAMPLE_MEETINGS,
      places: state.places,
    });
    const actions: AnswerAction[] = [
      ...(r.maps ? [{ kind: 'url' as const, label: 'Open in Maps', url: mapsUrl(r.maps) }] : []),
      ...(r.call211 ? [{ kind: 'phone' as const, label: 'Call 211', number: '211' }] : []),
      ...(r.resources ? [{ kind: 'route' as const, label: 'Local help', route: { name: 'resources' as const, ...(r.resources !== true && { category: r.resources }) } }] : []),
      ...(r.meetings ? [{ kind: 'route' as const, label: 'Find a meeting', route: { name: 'calendar' as const, tab: 'meetings' as const } }] : []),
    ];
    add({ id: newId(), kind: 'zoey', text: `${gps && !here && city.current ? `${NEAR_DENIED} ` : ''}${r.text}`, actions });
  };
  // "What's near me?", "closest food bank": ask before the first location check.
  const nearby = (what: NearWhat) => {
    if (state.settings.nearbyLocation || noGps.current) return void findNear(what, state.settings.nearbyLocation && !noGps.current);
    say(NEAR_PERMISSION);
    const go = (yes: boolean) => {
      setChoices([]);
      if (yes) updateSettings({ nearbyLocation: true });
      else noGps.current = true;
      void findNear(what, yes);
    };
    setChoices([
      { label: 'Yes, check my location', onPick: () => (add({ id: newId(), kind: 'me', text: 'Yes, check my location' }), go(true)) },
      { label: 'No, use my city', onPick: () => (add({ id: newId(), kind: 'me', text: 'No, use my city' }), go(false)) },
    ]);
    listening.current = (x) => {
      const yn = yesNo(x);
      if (!yn) return false;
      go(yn.answer === 'yes');
      return true;
    };
  };
  // Their day: "what's next?", "what's on Monday?", "I'm going to be late" (Ed, 2026-10-25).
  // "What's on my calendar?" with no day: she asks which day, with buttons.
  const answerSchedule = (q: ScheduleQ): boolean => {
    const now = new Date();
    const sr = scheduleReply(q, {
      state,
      now,
      name: ctx.name,
      coordinatorName: ctx.coordinatorName,
      sponsorName: ctx.sponsorName,
      recent: todaySaid.current || !!schedLast.current,
      last: schedLast.current,
    });
    if (!sr) return false;
    if (sr.item !== undefined) schedLast.current = sr.item;
    if (q.ask === 'today') todaySaid.current = true;
    add({ id: newId(), kind: 'zoey', text: sr.text, actions: sr.actions });
    // "Tomorrow you have work at 8" -> "Heads up: it's going to be 27° and snowy..."
    const shown = sr.item ? [sr.item] : q.ask === 'today' ? dayItems(state, now, now) : q.ask === 'tomorrow' ? dayItems(state, addDays(now, 1)) : q.ask === 'day' && q.days?.offsets.length === 1 ? dayItems(state, addDays(now, q.days.offsets[0])) : [];
    warnOnce(weatherWarning(sky.current, shown, now));
    if (sr.pickDay) {
      // Typing a day works too: "monday", "tmrw", "the 28th".
      listening.current = (x) => {
        const days = dayOnly(x, new Date());
        return days ? answerSchedule({ ask: 'day', days }) : false;
      };
      setChoices(
        dayChoices(now).map((c) => ({
          label: c.label,
          onPick: () => {
            setChoices([]);
            listening.current = null;
            add({ id: newId(), kind: 'me', text: c.label });
            answerSchedule(c.q);
          },
        })),
      );
    }
    return true;
  };
  // Their answer or hint after "I don't know your favorite color. Give me a hint?"
  const saveFavorite = (what: string, value: string, lead = '') => {
    const f = { what, value, asked: false, keep: true };
    say(`${lead}${favoriteLine(f, { remembered: null, learning })}`);
    updateLearned((l) => learnFavorite(l, what, value));
    listening.current = (x) => (/\?\s*$/.test(x) || findFavoriteQuestion(x) || findFavorite(x) ? false : (say(oneOf(FAVORITE_HEARD)), true));
  };
  const hearFavorite = (what: string) => (x: string): boolean => {
    const r = readFavoriteReply(what, x);
    if (!r) return false;
    if ('value' in r) return (saveFavorite(what === 'thing' && makeFavorite(what, r.value)?.what === 'color' ? 'color' : what, r.value), true);
    if (!r.guess) {
      say(STUMPED);
      listening.current = hearFavorite(what);
      return true;
    }
    const guess = r.guess;
    const kind = what === 'thing' && r.base ? 'color' : what;
    say(GUESS(guess));
    // "Yes" saves her guess; "no" asks again (for a color: "just plain green?").
    listening.current = (y) => {
      const yn = yesNo(y);
      const right = /^(?:you got it|you got me|correct|thats it|that s it|bingo|right|exactly)\b/i.test(y.replace(/[’']/g, '').trim());
      if (right || (yn?.answer === 'yes' && (!yn.rest || /^(?:it is|its|it s|thats it|you got it|correct|right|exactly)\b/.test(yn.rest))))
        return (saveFavorite(kind, guess, `${oneOf(GOT_IT)} `), true);
      if (yn?.answer === 'no' && !yn.rest) {
        say(GUESS_WRONG(r.base));
        listening.current = (z) => {
          const yz = yesNo(z);
          if (r.base && yz?.answer === 'yes' && !yz.rest) return (saveFavorite(kind, r.base), true);
          return hearFavorite(kind)(z);
        };
        return true;
      }
      // "No, it's sky blue": the rest is the answer.
      return hearFavorite(kind)(yn?.rest || y);
    };
    return true;
  };
  const reply = (t: string, r: Reply, answering: ((t: string) => boolean) | null, again: boolean, worried: boolean, missedBefore: string | null): boolean => {
    // A calendar question works at any point, even while Zoey waits on her own question (Ed, 2026-10-25).
    const sched = findScheduleAsk(t);
    const calendarQ = !!sched && (['today', 'tomorrow', 'week', 'when', 'day', 'askDay'].includes(sched.ask) || (sched.ask === 'next' && /\b(?:next|coming up)\b/.test(t.toLowerCase())));
    // Just "tonight" or "Monday" may be her question's answer ("When did it start?"), so that comes first.
    const bareDay = calendarQ && !!dayOnly(t) && !/\b(?:what|whats|anything|any|am i|do i|got|how about)\b/i.test(t.replace(/[’']/g, ''));
    // Her question ("How are you feeling?") is still open after the calendar answer.
    const calendar = () => (answerSchedule(sched!) ? ((listening.current ??= answering), true) : false);
    if (calendarQ && !(answering && bareDay) && calendar()) return false;
    // A weather question too, even while her own question is open; it stays open after.
    const wx = answering ? findWeatherAsk(t, new Date(), parseDay) : null;
    if (wx) return (say(weatherAnswer(wx, sky.current, new Date())), (listening.current ??= answering), false);
    // "Do you think I am weak?": a firm, warm no with what's true about them, then
    // "what's making you feel that way?" into the feelings flow (Ed, 2026-10-25).
    const doubt = findSelfDoubt(t);
    if (doubt) {
      lastAsked.current = null;
      say(selfWorthLine(doubt, { name: ctx.name, cleanDays: ctx.cleanDays }));
      // Her question is already asked, so the flow listens quietly.
      walk(TREES['feeling:sad'], 'more', true);
      // When they say what happened, answer the hurt before the flow asks about a plan.
      const hear = listening.current;
      listening.current = (x) => {
        const shares = x.trim().split(/\s+/).length >= 3 && !/\?\s*$/.test(x) && yesNo(x)?.answer !== 'no' && !/rather not|dont want to talk|don't want to talk/i.test(x);
        if (shares) say(oneOf(SELF_HEARD));
        return hear ? hear(x) : shares;
      };
      return false;
    }
    // "Do you know what the word weak means?": a plain definition, at any point (Ed, 2026-10-25).
    const asked = findDefine(t);
    if (asked) {
      const d = define(asked);
      lastAsked.current = d.text ? null : t;
      if (!d.text || !d.heavy) {
        say(d.text ?? UNKNOWN(d.word, ctx.coordinatorName));
        // Her own open question ("How are you feeling?") stays open.
        listening.current ??= answering;
      } else {
        // Asking about "weak" or "worthless" can mean feeling it: check gently.
        say(`${d.text} ${HEAVY_ASK(d.word)}`);
        listening.current = (x) => {
          const yn = yesNo(x);
          const feel = followUp(x, 'fallback');
          if (yn?.answer === 'no' && !feel) return (say(HEAVY_NO), true);
          if (yn?.answer !== 'yes' && !feel && !/^(?:i am|im|kinda|kind of|a little|sometimes|maybe|i think so)\b/.test(x.toLowerCase())) return false;
          // "Yes": the same help as typing "I feel worthless", safety first.
          const said = `I feel ${d.word}`;
          const hit = screen(said);
          if (hit.kind !== 'none') {
            risk.current = raise(risk.current, hit);
            show(ask(said, ctx, { learned }), said, flag(hit, `${x} (asked what “${d.word}” means)`));
            return true;
          }
          const f = feel ?? followUp(said, 'fallback');
          if (f) walk(TREES[f.tree], f.node);
          else walk(TREES['feeling:sad'], 'more');
          return true;
        };
      }
      return false;
    }
    // "Call me J", "keep it short": she remembers, and her open question stays open.
    const nick = findNickname(t);
    const pref = nick ? null : findReplyPref(t);
    if (nick || pref) {
      if (!learning) {
        add({ id: newId(), kind: 'zoey', text: 'I’d love to remember that. Turn on “Zoey learns how I talk” in Settings and I will.', actions: [{ kind: 'route', label: 'Open Settings', route: { name: 'learned' } }] });
      } else if (nick) {
        updateLearned((l) => setNickname(l, nick));
        say(`Got it, I’ll call you ${nick}. You can change that any time in Settings.`);
      } else {
        updateLearned((l) => setReplies(l, pref));
        say(pref === 'short' ? 'Got it, I’ll keep my answers short. Tap “More” when you want the rest.' : 'Got it, I’ll give you the whole answer.');
      }
      listening.current ??= answering;
      return false;
    }
    // One word, like "bad" or "meh": say it back and ask what they mean (Ed, 2026-10-27).
    if (breathAsk(t)) return false;
    if (funnyAsk(t)) return false;
    if (oneWord(t)) return false;
    // Their answer to the question Zoey just asked ("Can you tell me more?").
    if (answering?.(t)) return false;
    if (bareDay && calendar()) return false;
    // "My favorite color is mint green", "I love pizza": warm and curious, and remembered (Ed, 2026-10-25).
    const fav = findFavorite(t);
    if (fav) {
      lastAsked.current = null;
      const remembered = fav.keep ? favoriteOf(learned, fav.what) : null;
      say(favoriteLine(fav, { remembered, learning }));
      if (fav.keep) updateLearned((l) => learnFavorite(l, fav.what, fav.value));
      // Their answer to "What do you like about it?"
      listening.current = (x) => {
        if (/\?\s*$/.test(x) || /^(?:what|whats|who|where|when|why|how|do|does|is|are|can|could|will|would)\b/i.test(x.trim()) || findFavorite(x) || findSelfDoubt(x) || findDefine(x) || findScheduleAsk(x)) return false;
        return (say(oneOf(FAVORITE_HEARD)), true);
      };
      return false;
    }
    const favQ = findFavoriteQuestion(t);
    if (favQ) {
      const known = favoriteOf(learned, favQ);
      say(favoriteAnswer(favQ, known));
      // Not saved yet: "Can you tell me, or at least give me a hint?" (Ed, 2026-10-25).
      if (!known) listening.current = hearFavorite(favQ);
      return false;
    }
    // "Shut up" and insults at Zoey: light and human (Ed, 2026-10-24/25). "That's stupid": ask why, caringly.
    const afterJoke = joked.current;
    joked.current = false;
    const laughJoke = toldJoke.current;
    toldJoke.current = false;
    // "You didn't answer my question": own it, say what she heard, offer a person (Ed, 2026-10-25).
    if (findComplaint(t)) {
      const c = complaintReply({ last: lastAsked.current, c: ctx });
      lastAsked.current = null;
      add({ id: newId(), kind: 'zoey', text: c.text, actions: c.actions });
      return false;
    }
    if (metaReply(t) === 'clarify') return (say(oneOf(CLARIFY_LINES)), false);
    // "What city do I live in?", "what time zone am I in?", "I live in Cheney", "closest meeting" (Ed, 2026-10-25).
    const pq = findPlaceAsk(t, city.current ?? CURRENT_REGION.weatherAt);
    if (pq) {
      lastAsked.current = null;
      if (pq.kind === 'zone') say(zoneAnswer(new Date()));
      else if (pq.kind === 'setCity') {
        saveCity(pq.city);
        say(cityHeard(pq.city));
      } else if (pq.kind === 'near') nearby(pq.what);
      else if (state.settings.nearbyLocation && !noGps.current && /\bwhere am i\b|\bam i (?:in|at)\b|\bthis\b/i.test(t)) {
        // "Where am I?": a reading now, if they've said yes before.
        readHere().then((x) => say(cityAnswer({ city: city.current, here: x.ok ? { lat: x.reading.lat, lon: x.reading.lng } : null })));
      } else {
        say(cityAnswer({ city: city.current, here: null }));
        if (!city.current) listening.current = hearCity();
      }
      return false;
    }
    // "What's the weather tomorrow?", "will it rain Monday?", "do I need a jacket?" (Ed, 2026-10-25).
    const wq = findWeatherAsk(t, new Date(), parseDay);
    if (wq) return (say(weatherAnswer(wq, sky.current, new Date())), false);
    // "What time is it?", "what's the weather?"
    const clock = findClock(t);
    if (clock) {
      say(clock === 'weather' ? weatherAnswer({ kind: 'general', offsets: [0], label: 'today', tonight: false }, sky.current, new Date()) : clockLine(clock, new Date()));
      return false;
    }
    if (findShutUp(t)) return (say(oneOf(HEEEY)), (joked.current = true), false);
    if (findInsult(t)) return (say(oneOf(HEEEY_INSULT)), (joked.current = true), false);
    if (findDismiss(t)) {
      say(oneOf(WHY_THINK));
      listening.current = (x) => (findDismiss(x) || findShutUp(x) || findInsult(x) || findComplaint(x) ? false : (say(oneOf(AFTER_WHY)), true));
      return false;
    }
    // Everyday words ("sorry", "thanks", "lol", "bye"): a reply that fits what the word means (Ed, 2026-10-25).
    const word = findWord(t);
    if (word) {
      const line = wordLine(word, { name: ctx.name, now: new Date(), afterJoke, toldJoke: laughJoke, worried: !!risk.current });
      if (line) say(line);
      else if (!worried) say('I’m right here with you.');
      return false;
    }
    // "Hi": hello back by time of day, sometimes the weather, then "how are you?" (Ed, 2026-10-24).
    const g = findGreeting(t);
    if (g) {
      const w = weather.current && Math.random() < 0.5 ? weatherLine(weather.current) : null;
      say(greetLine({ now: new Date(), name: ctx.name, asked: g.asked, weather: w, hello: helloBack(learned) }));
      listening.current = hearHow;
      return false;
    }
    if (badDay(t)) return false;
    // Late, can't make it, don't want to go, nervous, free, done for the day.
    if (sched && !calendarQ && answerSchedule(sched)) return false;
    // Feelings and feeling sick get a conversation, never "no good answer" (Ed, 2026-10-24).
    const f = followUp(t, r.kind);
    if (f) {
      // A feeling or "I need help", not a question she could have missed.
      lastAsked.current = null;
      whoRef.current = f.who ?? null;
      walk(TREES[f.tree], f.node);
      return false;
    }
    if (r.kind === 'fallback' && worried) return false;
    // A typo she isn't sure about, and the fixed words would work: "Did you mean “evicted”?"
    const sp = spelled.current;
    spelled.current = null;
    if (r.kind === 'fallback' && sp && sp.all !== t && sp.fixes.some((f) => !f.sure)) {
      const fixed = ask(sp.all, ctx, { learned });
      if (fixed.kind !== 'fallback' || followUp(sp.all, fixed.kind)) {
        say(didYouMean(sp.fixes));
        const pick = (yes: boolean) => {
          setChoices([]);
          if (yes) reply(sp.all, fixed, null, false, false, null);
          else show(r, t);
        };
        setChoices([
          { label: 'Yes', onPick: () => (add({ id: newId(), kind: 'me', text: 'Yes' }), pick(true)) },
          { label: 'No', onPick: () => (add({ id: newId(), kind: 'me', text: 'No' }), pick(false)) },
        ]);
        listening.current = (x) => {
          const yn = yesNo(x);
          return yn ? (pick(yn.answer === 'yes'), true) : false;
        };
        return false;
      }
    }
    // Two misses in a row: hand it to a person instead of asking again.
    if (r.kind === 'fallback') lastFallback.current = !again;
    lastAsked.current = t;
    // A miss, then a rephrase that worked: next time the first way works too (learn.ts).
    if (r.kind === 'fallback') missed.current = t;
    if (r.kind === 'answer') {
      const id = r.answer.id;
      updateLearned((l) => countTopic(missedBefore ? learnRephrase(l, missedBefore, t, id) : l, id, r.answer.q));
    }
    show(r, t);
    // Not right after she asked them something ("How are you feeling?").
    return r.kind === 'answer' && !/\?\s*$/.test(r.text);
  };

  // `from`: their question, when they tapped "You might also ask" under her answer to it.
  // A question from a list: answered just like typing it (every one finds its own answer, tests §36).
  const pickAnswer = (a: Answer, from?: string) => {
    if (from) updateLearned((l) => learnPick(l, from, a.id));
    submit(a.q, true);
  };

  const run = (a: AnswerAction, question?: string, eventId?: string) => {
    if (eventId) noteSafetyAction(eventId, a.label);
    if (eventId && a.kind === 'text') markAlertTexted(eventId);
    switch (a.kind) {
      case 'route':
        return go(a.route);
      case 'call':
        return call(a.who === 'sponsor' && sponsor ? sponsor.phone : coordinator.phone);
      case 'text':
        return sendText(a.who === 'sponsor' && sponsor ? sponsor.phone : coordinator.phone, a.body);
      case 'phone':
        return call(a.number);
      case 'url':
        return Linking.openURL(a.url).catch(() => {});
      case 'crisis':
        return setCrisis('psychiatric');
      case 'save':
        if (question) {
          saveQuestion(question);
          setSaved(question);
        }
    }
  };

  const answerCheck = (label: string, safe: boolean) => {
    setCheckPending(false);
    add({ id: newId(), kind: 'me', text: label });
    if (eventRef.current) noteSafetyAction(eventRef.current, label, safe ? undefined : 3);
    if (!safe) return setCrisis('psychiatric');
    risk.current = markSafe(risk.current);
    add({ id: newId(), kind: 'zoey', text: copy.safeYes });
    // "It's hopeless": once they're safe, ask what inspires them (Ed, 2026-10-24).
    // Otherwise still ask what's behind it, then the LifeCircle (Ed, 2026-10-25).
    if (isHopelessCheck(checkMatched.current)) walk(TREES.hopeless, TREES.hopeless.start);
    else walk(TREES['after-safe'], 'why');
  };
  // Left the crisis screen with "I'm safe right now": same follow-up.
  const crisisSafe = () => {
    setCrisis(null);
    risk.current = markSafe(risk.current);
    walk(TREES['after-safe'], 'why');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="AskZoey" onBack={back} left={<ZoeyAvatar size={28} />} right={<VoiceToggle />} />
      <Pressable style={styles.crisisBar} onPress={() => ((eventRef.current = null), setCrisis('psychiatric'))} accessibilityRole="button" accessibilityLabel="Need help now? Call or text 988, the Suicide and Crisis Lifeline">
        <Icon name="phone" size={15} />
        <Text style={styles.crisisText}>Need help now? 988 Crisis Lifeline</Text>
      </Pressable>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView {...scrollProps} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.checkCard} onPress={() => go({ name: 'askzoey' })} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.checkTitle}>Daily check-in</Text>
              <Text style={styles.checkSub}>
                {checkedIn ? `Done at ${timeLabel(checkedIn.completedAt!)}. Tap to check in again.` : 'How are you feeling? It takes a minute.'}
              </Text>
            </View>
            <View style={styles.checkBtn}>
              <Text style={styles.checkBtnText}>{checkedIn ? 'Again' : 'Start'}</Text>
            </View>
          </Pressable>

          <View style={styles.zoeyRow}>
            <View style={styles.avatar}>
              <ZoeyAvatar size={30} />
            </View>
            <View style={styles.zoeyBubble}>
              <Text style={styles.bubbleText}>
                {opening}
              </Text>
              <Text style={styles.introNote}>Ask me about cravings, meetings, sponsors, or how to use Life Works. I share general information, not medical advice.</Text>
            </View>
          </View>

          {items.map((it) =>
            it.kind === 'breathing' ? (
              <View key={it.id} onLayout={track(it.id)}>
                <BreathingTimer onDone={breathDone} />
              </View>
            ) : it.kind === 'me' ? (
              <View key={it.id} style={styles.meBubble} onLayout={track(it.id)}>
                <Text style={[styles.bubbleText, { color: '#fff' }]}>{it.text}</Text>
              </View>
            ) : (
              <View key={it.id} style={{ gap: 8 }} onLayout={track(it.id)}>
                <View style={styles.zoeyRow}>
                  <View style={styles.avatar}>
                    <ZoeyAvatar size={30} />
                  </View>
                  <View style={[styles.zoeyBubble, it.urgent && styles.urgentBubble]}>
                    <Text style={styles.bubbleText}>{it.text}</Text>
                    {it.more ? (
                      <Pressable onPress={() => showMore(it.id)} accessibilityRole="button" hitSlop={8}>
                        <Text style={styles.more}>More</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {it.actions?.length ? (
                  <View style={styles.actions}>
                    {it.actions.map((a, i) => {
                      const isSaved = a.kind === 'save' && saved === it.question;
                      return (
                        <Button
                          key={a.label}
                          label={isSaved ? 'Saved' : a.label}
                          icon={isSaved ? 'check' : a.kind === 'call' || a.kind === 'phone' ? 'phone' : a.kind === 'text' ? 'message' : undefined}
                          small
                          tone={i === 0 ? (it.urgent ? 'red' : 'green') : 'outline'}
                          onPress={() => run(a, it.question, it.eventId)}
                        />
                      );
                    })}
                  </View>
                ) : null}
                {it.alternatives?.length ? (
                  <View style={styles.alts}>
                    <Text style={styles.altLabel}>You might also ask</Text>
                    {it.alternatives.map((a) => (
                      <Pressable key={a.id} onPress={() => pickAnswer(a, it.question)} accessibilityRole="button" style={styles.alt}>
                        <Text style={styles.altText}>{a.q}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ),
          )}

          {choices.length ? (
            <View style={styles.actions} onLayout={keep}>
              {choices.map((c) => (
                <Chip key={c.label} label={c.label} onPress={() => submit(c.label, true)} />
              ))}
            </View>
          ) : null}

          {checkPending ? (
            <View style={styles.actions} onLayout={keep}>
              <Chip label="Yes, I'm safe" onPress={() => answerCheck("Yes, I'm safe", true)} />
              <Chip label="No" onPress={() => answerCheck('No', false)} />
              <Chip label="I'm not sure" onPress={() => answerCheck("I'm not sure", false)} />
            </View>
          ) : null}

          <View style={styles.browse}>
            <Text style={styles.browseLabel}>{items.length ? 'Browse more questions' : 'Pick a topic'}</Text>
            <View style={styles.chips}>
              {TOPICS.map((t) => (
                <Chip key={t} label={t} selected={topic === t} onPress={() => setTopic(topic === t ? null : t)} />
              ))}
            </View>
            {topic ? (
              <View style={{ gap: 6 }}>
                {ANSWERS.filter((a) => a.topic === topic).map((a) => (
                  <Pressable key={a.id} onPress={() => pickAnswer(a)} style={styles.qRow} accessibilityRole="button">
                    <Text style={styles.qText}>{a.q}</Text>
                    <Icon name="chevron" size={16} color={colors.inkFaint} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {state.questions.length ? (
            <View style={styles.savedCard}>
              <Text style={styles.browseLabel}>Saved for my team</Text>
              {state.questions.map((q) => (
                <View key={q.id} style={styles.savedRow}>
                  <Text style={styles.savedText}>{q.text}</Text>
                  <Pressable onPress={() => removeQuestion(q.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove saved question: ${q.text}`}>
                    <Icon name="close" size={16} color={colors.inkFaint} />
                  </Pressable>
                </View>
              ))}
              <Button
                label={`Send these to ${coordinator.name}`}
                icon="message"
                small
                tone="outline"
                style={{ alignSelf: 'flex-start' }}
                onPress={() => sendText(coordinator.phone, `Questions for my next appointment:\n${state.questions.map((q) => `- ${q.text}`).join('\n')}`)}
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 10 }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question"
            placeholderTextColor={colors.inkFaint}
            // The phone's own spell check and autocorrect (Ed, 2026-10-25).
            autoCorrect
            spellCheck
            autoCapitalize="sentences"
            style={styles.input}
            onSubmitEditing={(e) => submit(e.nativeEvent.text)}
            returnKeyType="send"
            accessibilityLabel="Ask Zoey a question"
          />
          <Pressable onPress={() => submit(input)} style={styles.sendBtn} accessibilityRole="button" accessibilityLabel="Send">
            <Icon name="send" size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <CrisisSheet
        visible={crisis !== null}
        variant={crisis ?? 'psychiatric'}
        coordinator={coordinator}
        onSafe={crisisSafe}
        onAction={(label) => eventRef.current && noteSafetyAction(eventRef.current, label)}
        onTextCoordinator={share && eventRef.current ? textAlert : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  introNote: { fontSize: 13, color: colors.inkSoft, marginTop: 6, lineHeight: 18 },
  crisisBar: { backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 8 },
  crisisText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 14, gap: 10, paddingBottom: 24 },
  checkCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: radius.md, padding: 14 },
  checkTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  checkSub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  checkBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  zoeyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '90%' },
  avatar: { width: 30, height: 30, flexShrink: 0 },
  urgentBubble: { borderWidth: 2, borderColor: colors.red },
  zoeyBubble: { backgroundColor: '#fff', borderRadius: radius.md, borderBottomLeftRadius: 4, padding: 12, flexShrink: 1 },
  meBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '80%',
  },
  bubbleText: { fontSize: 16, lineHeight: 22, color: colors.ink },
  more: { fontSize: 15, color: colors.blue, fontWeight: '600', marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginLeft: 38 },
  alts: { marginLeft: 38, gap: 4 },
  altLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  alt: { paddingVertical: 4 },
  altText: { fontSize: 15, color: colors.blue, fontWeight: '600' },
  browse: { gap: 10, marginTop: 8 },
  browseLabel: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qText: { flex: 1, fontSize: 15, color: colors.ink },
  savedCard: { backgroundColor: colors.greenLight, borderRadius: radius.md, padding: 14, gap: 8, marginTop: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedText: { flex: 1, fontSize: 15, color: colors.ink },
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: colors.bg },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.ink,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
});
