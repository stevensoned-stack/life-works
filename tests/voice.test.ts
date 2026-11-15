// Run with: npm test
// Checks which voice Zoey speaks with and what she reads aloud.
import assert from 'node:assert/strict';
import { echoGuard, forSpeech, pickVoice, SENTENCE_MAX, speechChunks, VoiceInfo } from '../src/zoey/voice';
import { START_MS, Utterance, webSpeech } from '../src/zoey/webSpeech';

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const ios: VoiceInfo[] = [
  { identifier: 'com.apple.voice.compact.en-US.Fred', name: 'Fred', quality: 'Default', language: 'en-US' },
  { identifier: 'com.apple.ttsbundle.Samantha-compact', name: 'Samantha', quality: 'Default', language: 'en-US' },
  { identifier: 'com.apple.voice.compact.en-GB.Daniel', name: 'Daniel', quality: 'Default', language: 'en-GB' },
  { identifier: 'com.apple.voice.compact.fr-FR.Thomas', name: 'Thomas', quality: 'Default', language: 'fr-FR' },
];

test('iOS: picks the female en-US voice, not Fred or Daniel', () => {
  assert.equal(pickVoice(ios)?.name, 'Samantha');
});

test('iOS: an enhanced or premium female voice beats the compact one', () => {
  const more = [
    ...ios,
    { identifier: 'com.apple.voice.enhanced.en-US.Ava', name: 'Ava (Enhanced)', quality: 'Enhanced', language: 'en-US' },
    { identifier: 'com.apple.voice.premium.en-US.Zoe', name: 'Zoe (Premium)', quality: 'Enhanced', language: 'en-US' },
  ];
  assert.equal(pickVoice(more)?.name, 'Zoe (Premium)');
  assert.equal(pickVoice(more.slice(0, -1))?.name, 'Ava (Enhanced)');
});

test('iOS: falls back to a female voice in another English accent', () => {
  const uk = [
    { identifier: 'com.apple.voice.compact.en-US.Fred', name: 'Fred', language: 'en-US' },
    { identifier: 'com.apple.voice.compact.en-GB.Serena', name: 'Serena', language: 'en-GB' },
  ];
  assert.equal(pickVoice(uk)?.name, 'Serena');
});

test('Android: picks an on-device female voice and never a network one', () => {
  const android: VoiceInfo[] = [
    { identifier: 'en-us-x-tpc-network', name: 'en-us-x-tpc-network', quality: 'Enhanced', language: 'en-US' },
    { identifier: 'en-us-x-iom-local', name: 'en-us-x-iom-local', quality: 'Enhanced', language: 'en-US' },
    { identifier: 'en-us-x-sfg-local', name: 'en-us-x-sfg-local', quality: 'Enhanced', language: 'en-US' },
  ];
  assert.equal(pickVoice(android)?.identifier, 'en-us-x-sfg-local');
  assert.equal(pickVoice(android.slice(0, 2)), null);
});

test('Web: skips cloud voices', () => {
  const web: VoiceInfo[] = [
    { identifier: 'Microsoft Aria Online (Natural) - English (United States)', name: 'Microsoft Aria Online (Natural) - English (United States)', language: 'en-US', localService: false },
    { identifier: 'Google US English', name: 'Google US English', language: 'en-US', localService: false },
    { identifier: 'Microsoft Zira - English (United States)', name: 'Microsoft Zira - English (United States)', language: 'en-US', localService: true },
  ];
  assert.equal(pickVoice(web)?.name, 'Microsoft Zira - English (United States)');
});

test('no female voice means the system default', () => {
  assert.equal(pickVoice([ios[0], ios[2]]), null);
  assert.equal(pickVoice([]), null);
});

test('speech text drops links, emoji and symbols', () => {
  assert.equal(forSpeech('Find one at https://aa.org/find 🙂 · any time'), 'Find one at any time');
  assert.equal(forSpeech('Call 988 **now**'), 'Call nine eight eight now');
});

test('Mac browsers: picks Samantha from the system voices', () => {
  const mac: VoiceInfo[] = [
    { identifier: 'Alex', name: 'Alex', language: 'en-US', localService: true },
    { identifier: 'Google US English', name: 'Google US English', language: 'en-US', localService: false },
    { identifier: 'Samantha', name: 'Samantha', language: 'en-US', localService: true },
  ];
  assert.equal(pickVoice(mac)?.name, 'Samantha');
});

test('long replies are spoken a few sentences at a time', () => {
  const long = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i + 1}.`).join(' ');
  const pieces = speechChunks(long, 100);
  assert.ok(pieces.length > 1);
  assert.ok(pieces.every((p) => p.length <= 100));
  assert.equal(pieces.join(' '), long);
  assert.deepEqual(speechChunks('Call 988. Any time'), ['Call 988. Any time']);
  assert.deepEqual(speechChunks(''), []);
});

test('phone numbers are said digit by digit', () => {
  assert.equal(forSpeech('Call or text 988 any time.'), 'Call or text nine eight eight any time.');
  assert.equal(forSpeech('Call 911 or 211.'), 'Call nine one one or two one one.');
  assert.equal(forSpeech('Call 509-456-7000 today'), 'Call five zero nine, four five six, seven zero zero zero today');
  assert.equal(forSpeech('SAMHSA: 1-800-662-4357.'), 'SAMHSA: one, eight zero zero, six six two, four three five seven.');
  assert.equal(forSpeech('(509) 456-7000'), 'five zero nine, four five six, seven zero zero zero');
  // Counts and other numbers read normally.
  assert.equal(forSpeech('You have 78 days, 12 more to 90. Text 9881 to win.'), 'You have 78 days, 12 more to 90. Text 9881 to win.');
});

test('no pause before a name', () => {
  assert.equal(forSpeech('Hello, Jordan!'), 'Hello Jordan!');
  assert.equal(forSpeech('Good morning, Jordan! Wow, it’s day 78 of being clean!'), 'Good morning Jordan! Wow, it’s day 78 of being clean!');
  assert.equal(forSpeech('Good evening, Sam. How are you feeling?'), 'Good evening Sam. How are you feeling?');
  assert.equal(forSpeech('I’m proud of you, Jordan.'), 'I’m proud of you Jordan.');
  assert.equal(forSpeech('Hi Jordan, checking in.'), 'Hi Jordan, checking in.');
  // Other commas keep their pause.
  assert.equal(forSpeech('Call or text 988, the free Suicide and Crisis Lifeline.'), 'Call or text nine eight eight, the free Suicide and Crisis Lifeline.');
  assert.equal(forSpeech('Yes, I can help with that.'), 'Yes, I can help with that.');
});

test('one sentence at a time, so she pauses between sentences', () => {
  assert.deepEqual(speechChunks('Good evening Jordan! Wow, day 78 in recovery. How are you?', SENTENCE_MAX), [
    'Good evening Jordan!',
    'Wow, day 78 in recovery.',
    'How are you?',
  ]);
  // No stop after a title.
  assert.deepEqual(speechChunks('Call Dr. Lee today. Then rest.', SENTENCE_MAX), ['Call Dr. Lee today.', 'Then rest.']);
  assert.deepEqual(speechChunks('It is 2.5 miles away. Want directions?', SENTENCE_MAX), ['It is 2.5 miles away.', 'Want directions?']);
});

test('says each thing once: the same words again right away are dropped', () => {
  const echo = echoGuard(1500);
  assert.equal(echo('Good evening Jordan! How are you?', 1000), false);
  assert.equal(echo('Good evening Jordan! How are you?', 1001), true);
  assert.equal(echo('I hear you.', 2000), false);
  // The same words later on are a new reply, and she says them.
  assert.equal(echo('I hear you.', 9000), false);
});

// A pretend browser voice: `allowed` false acts like a browser that wants a tap first.
function fakeBrowser(opts: { allowed: boolean | 'silent'; voices?: { voiceURI: string; name: string; lang: string; localService: boolean }[] }) {
  const said: Utterance[] = [];
  let cancels = 0;
  class Utter {
    lang = '';
    rate = 1;
    pitch = 1;
    volume = 1;
    voice: unknown = null;
    onstart: Utterance['onstart'] = null;
    onend: Utterance['onend'] = null;
    onerror: Utterance['onerror'] = null;
    constructor(public text: string) {}
  }
  const synth = {
    speaking: false,
    speak(u: Utterance) {
      said.push(u);
      if (opts.allowed === true) u.onstart?.();
      else if (opts.allowed === false) u.onerror?.({ error: 'not-allowed' });
    },
    cancel() {
      cancels++;
    },
    getVoices: () => opts.voices ?? [],
  };
  const timers: (() => void)[] = [];
  const later = (f: () => void, ms: number) => {
    assert.equal(ms, START_MS);
    timers.push(f);
  };
  return { env: { synth, Utter }, said, timers, cancels: () => cancels, later };
}
const opts = { language: 'en-US', rate: 0.86, pitch: 1.04, volume: 0.9 };

test('web: the first tap anywhere says a silent word, so the greeting can play later', () => {
  const b = fakeBrowser({ allowed: true });
  const ws = webSpeech(b.env, b.later);
  const handlers: Record<string, () => void> = {};
  ws.unlockOnFirstTap({
    addEventListener: (k: string, f: () => void) => (handlers[k] = f),
    removeEventListener: (k: string) => delete handlers[k],
  });
  assert.deepEqual(Object.keys(handlers).sort(), ['click', 'keydown', 'touchend']);
  handlers.click();
  assert.equal(b.said.length, 1);
  assert.equal(b.said[0].volume, 0);
  assert.equal(ws.unlocked, true);
  // Taken straight back out, so it can't sit in front of her greeting.
  assert.equal(b.cancels(), 1);
  // Still listening until her words have really played once.
  assert.equal(Object.keys(handlers).length, 3);
  ws.speak(['Hi Jordan!'], opts);
  handlers.click();
  assert.deepEqual(Object.keys(handlers), []);
});

test('web: the greeting is not preceded by a stop when nothing is playing (Safari drops it)', () => {
  const b = fakeBrowser({ allowed: true });
  const ws = webSpeech(b.env, b.later);
  ws.stop();
  assert.equal(b.cancels(), 0);
  ws.speak(['Good evening Jordan!'], opts);
  ws.stop();
  assert.equal(b.cancels(), 1);
});

test('web: a browser stuck on something else (not her words) still shows "Tap to hear Zoey"', () => {
  const b = fakeBrowser({ allowed: 'silent' });
  (b.env.synth as { speaking: boolean }).speaking = true;
  let blocked = 0;
  webSpeech(b.env, b.later).speak(['Good evening Jordan!'], opts, { onBlocked: () => blocked++ });
  b.timers.forEach((f) => f());
  assert.equal(blocked, 1);
});

test('web: speaks every sentence right away, in Zoey\'s voice when the browser has it', () => {
  const b = fakeBrowser({
    allowed: true,
    voices: [
      { voiceURI: 'Google UK English Male', name: 'Google UK English Male', lang: 'en-GB', localService: true },
      { voiceURI: 'Samantha', name: 'Samantha', lang: 'en-US', localService: true },
    ],
  });
  let blocked = false;
  const ws = webSpeech(b.env, b.later);
  ws.speak(['Good evening Jordan!', 'How are you?'], opts, { onBlocked: () => (blocked = true) });
  assert.deepEqual(b.said.map((u) => u.text), ['Good evening Jordan!', 'How are you?']);
  assert.equal((b.said[0].voice as { name: string }).name, 'Samantha');
  assert.equal(b.said[0].rate, 0.86);
  b.timers.forEach((f) => f());
  assert.equal(blocked, false);
});

test('web: no voices listed yet still speaks (browser default voice), no waiting', () => {
  const b = fakeBrowser({ allowed: true, voices: [] });
  webSpeech(b.env, b.later).speak(['Hi Jordan!'], opts);
  assert.equal(b.said.length, 1);
  assert.equal(b.said[0].voice, null);
});

test('web: a browser that refuses (no tap yet) shows "Tap to hear Zoey"', () => {
  const b = fakeBrowser({ allowed: false });
  let blocked = 0;
  webSpeech(b.env, b.later).speak(['Good evening Jordan!', 'How are you?'], opts, { onBlocked: () => blocked++ });
  assert.equal(blocked, 1);
  assert.ok(b.cancels() >= 1);
  b.timers.forEach((f) => f());
  assert.equal(blocked, 1);
});

test('web: a browser that stays silent (Safari) shows "Tap to hear Zoey" after a few seconds', () => {
  const b = fakeBrowser({ allowed: 'silent' });
  let blocked = 0;
  webSpeech(b.env, b.later).speak(['Good evening Jordan!'], opts, { onBlocked: () => blocked++ });
  assert.equal(blocked, 0);
  b.timers.forEach((f) => f());
  assert.equal(blocked, 1);
});

test('web: no speech in this browser at all: nothing to do', () => {
  assert.equal(webSpeech(null).speak(['Hi'], opts), false);
});

console.log(`${passed} voice checks passed`);
