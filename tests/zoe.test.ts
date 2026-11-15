// Run with: npm test
// What Zoey's name means (zoe.ts).
import assert from 'node:assert/strict';
import { findNameMeaning, lifeNote, LIFE_NOTES, LIFE_NOTES_PLAIN, NAME_MEANING, NAME_MEANING_PLAIN, nameMeaning } from '../src/zoey/zoe';


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
test('hears the question many ways, with or without her name', () => {
  for (const q of [
    'Why are you called Zoey?',
    'why are you called',
    'hey zoey, why is your name zoey?',
    'What does your name mean?',
    'what does zoey mean',
    'whats the meaning of your name',
    'Where does your name come from?',
    'where did you get your name',
    'who named you',
    'does your name mean anything',
    'is zoey a bible name?',
    'tell me about your name',
    'why zoey',
    'so what does the name zoey mean lol',
  ])
    assert.equal(findNameMeaning(q), true, q);
});

test('leaves other talk alone', () => {
  for (const q of ['what is your name', 'your name is pretty', 'zoey is stupid', 'what does weak mean', 'why', 'I love Zoey', 'who are you', 'my name is Jordan'])
    assert.equal(findNameMeaning(q), false, q);
});

test('says it accurately: the Greek word zoe, about 135 times, translated life', () => {
  for (const line of [...NAME_MEANING, ...LIFE_NOTES]) {
    assert.match(line, /Greek word zoe|zoe, the Greek word|zoe, Greek for life|zoe, an old Greek word/);
    assert.ok(line.includes('about 135 times'), line);
    assert.ok(line.includes('Greek New Testament'), line);
    assert.match(line, /life/);
    assert.doesNotMatch(line, /Zoey (?:appears|is used|shows up)/);
  }
});

test('leaves out the New Testament for someone who said religion is not for them', () => {
  for (const line of [...NAME_MEANING_PLAIN, ...LIFE_NOTES_PLAIN]) {
    assert.doesNotMatch(line, /Testament|Bible|135/);
    assert.ok(line.includes('zoe'), line);
  }
  assert.ok(NAME_MEANING_PLAIN.includes(nameMeaning({ noFaith: true })));
  assert.ok(LIFE_NOTES_PLAIN.includes(lifeNote({ noFaith: true })));
});

test('has several versions and never says the same one twice in a row', () => {
  assert.ok(NAME_MEANING.length >= 4);
  assert.ok(LIFE_NOTES.length >= 4);
  let prev = '';
  for (let i = 0; i < 30; i++) {
    const a = nameMeaning();
    assert.notEqual(a, prev);
    prev = a;
  }
  prev = '';
  for (let i = 0; i < 30; i++) {
    const a = lifeNote();
    assert.notEqual(a, prev);
    prev = a;
  }
});

test('the note when down ends a talk, so it asks no question', () => {
  for (const line of [...LIFE_NOTES, ...LIFE_NOTES_PLAIN]) assert.doesNotMatch(line, /\?/, line);
});

test('follows Zoey’s wording rules', () => {
  for (const line of [...NAME_MEANING, ...NAME_MEANING_PLAIN, ...LIFE_NOTES, ...LIFE_NOTES_PLAIN]) {
    assert.doesNotMatch(line, /\bclean\b/i);
    assert.doesNotMatch(line, /thanks for telling me|988|911/i);
  }
});
console.log(`zoe: ${passed} passed`);
