// Run with: npm test
// Pretend calls and texts in the web demo: which links they catch, who the
// number belongs to, and that crisis lines are marked as crisis lines.
import assert from 'node:assert/strict';
import { seedState } from '../src/data/seed';
import { callClock, contactFor, isCrisisNumber, parseContactUrl, pretendPhoneOn, showNumber, showPretend, onPretend } from '../src/demo/pretend';

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

test('only on in the browser, never on a phone', () => {
  assert.equal(pretendPhoneOn('web', undefined), true);
  assert.equal(pretendPhoneOn('ios', undefined), false);
  assert.equal(pretendPhoneOn('android', undefined), false);
  assert.equal(pretendPhoneOn('web', '0'), false);
});

test('reads tel: and sms: links, with or without a body', () => {
  assert.deepEqual(parseContactUrl('tel:5095551234'), { kind: 'call', number: '5095551234', body: undefined });
  assert.deepEqual(parseContactUrl('sms:988'), { kind: 'text', number: '988', body: undefined });
  assert.deepEqual(parseContactUrl('sms:741741?body=HOME'), { kind: 'text', number: '741741', body: 'HOME' });
  assert.deepEqual(parseContactUrl('sms:741741&body=HOME'), { kind: 'text', number: '741741', body: 'HOME' });
  assert.equal(parseContactUrl(`sms:5095551234?body=${encodeURIComponent("I'm having a hard day. Can you call me?")}`)?.body, "I'm having a hard day. Can you call me?");
});

test('leaves websites and empty numbers alone', () => {
  assert.equal(parseContactUrl('https://aa.org'), null);
  assert.equal(parseContactUrl('tel:'), null);
  assert.equal(parseContactUrl('mailto:a@b.c'), null);
});

test('crisis lines are always marked as crisis', () => {
  for (const n of ['988', '911', '741741', '18004843731', '800-484-3731']) {
    assert.equal(isCrisisNumber(n), true, n);
    assert.equal(contactFor(n).crisis, true, n);
  }
  assert.equal(contactFor('988').name, '988 Suicide & Crisis Lifeline');
  assert.equal(isCrisisNumber('5095551234'), false);
});

test('names the people already in the app', () => {
  const s = seedState();
  const p = s.people[0];
  assert.equal(contactFor(p.phone, s).name, p.name);
  // Maya is in LifeCircle with her full name, so that wins over the profile's short name.
  assert.match(contactFor(s.profile.coordinator.phone, s).name, new RegExp(s.profile.coordinator.name));
  assert.match(contactFor(showNumber(s.profile.coordinator.phone), s).name, new RegExp(s.profile.coordinator.name));
  assert.equal(contactFor(s.profile.coordinator.phone, { ...s, people: [] }).name, s.profile.coordinator.name);
});

test('names local help numbers and falls back to the number', () => {
  assert.equal(contactFor('5095074624').detail, 'Local help');
  assert.equal(contactFor('211').name, '211 (local help)');
  assert.equal(contactFor('5095550000').name, '(509) 555-0000');
});

test('call timer reads like a phone', () => {
  assert.equal(callClock(0), '0:00');
  assert.equal(callClock(65), '1:05');
  assert.equal(callClock(750), '12:30');
});

test('with no screen showing, links go through as normal', () => {
  assert.equal(showPretend({ kind: 'call', number: '988' }), false);
  let got = '';
  const off = onPretend((r) => (got = r.number));
  assert.equal(showPretend({ kind: 'call', number: '988' }), true);
  assert.equal(got, '988');
  off();
  assert.equal(showPretend({ kind: 'call', number: '988' }), false);
});

console.log(`pretend: ${passed} passed`);
