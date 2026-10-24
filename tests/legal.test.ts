// Run with: npm test
// Terms, privacy, EULA, HIPAA notice and Part 2 consent: who needs to agree,
// and asking again when a document's version changes.
import assert from 'node:assert/strict';
import { seedState } from '../src/data/seed';
import { acceptAll, isUpdate, LEGAL_DOCS, LegalDoc, pendingAgreements } from '../src/legal/documents';

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

const at = new Date('2026-10-24T12:00:00Z');

test('all five documents are asked for on first launch', () => {
  const s = seedState();
  assert.deepEqual(
    pendingAgreements(s.settings.agreements).map((d) => d.id),
    ['terms', 'privacy', 'eula', 'hipaa', 'part2'],
  );
  assert.equal(isUpdate(s.settings.agreements), false);
});

test('data saved before agreements existed still asks', () => {
  assert.equal(pendingAgreements(undefined).length, LEGAL_DOCS.length);
});

test('agreeing records each version and date, and nothing is left', () => {
  const a = acceptAll({}, LEGAL_DOCS, at);
  assert.equal(pendingAgreements(a).length, 0);
  assert.deepEqual(a.hipaa, { version: LEGAL_DOCS.find((d) => d.id === 'hipaa')!.version, at: at.toISOString() });
});

test('a new version of one document asks only for that one again', () => {
  const a = acceptAll({}, LEGAL_DOCS, at);
  const docs: LegalDoc[] = LEGAL_DOCS.map((d) => (d.id === 'privacy' ? { ...d, version: '1.0' } : d));
  assert.deepEqual(pendingAgreements(a, docs).map((d) => d.id), ['privacy']);
  assert.equal(isUpdate(a), true);
  const b = acceptAll(a, pendingAgreements(a, docs), new Date('2027-01-02T00:00:00Z'));
  assert.equal(pendingAgreements(b, docs).length, 0);
  assert.equal(b.terms!.at, at.toISOString());
  assert.equal(b.privacy!.version, '1.0');
});

test('every document is marked as placeholder text until a lawyer writes it', () => {
  for (const d of LEGAL_DOCS) {
    if (d.final) continue;
    assert.ok(d.body.every((s) => s.text.startsWith('PLACEHOLDER, attorney to write.')), d.id);
  }
});

console.log(`legal: ${passed} passed`);
