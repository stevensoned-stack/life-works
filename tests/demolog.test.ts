// Run with: npm test
// Demo issue log (demolog.ts): kept on the device, copied as CSV for the issue sheet.
import assert from 'node:assert/strict';
import { seedState } from '../src/data/seed';
import { addDemoIssue, CSV_HEADERS, csvCell, DEMO_LOG_MAX, DemoIssue, demoLogCsv, demoLogSummary } from '../src/zoey/demolog';
import { ask } from '../src/zoey/ask';
import { buildContext } from '../src/zoey/context';

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

const at = (min: number) => new Date(Date.UTC(2026, 10, 15, 18, min)).toISOString();
const miss = (typed: string, min = 0, id = `id-${typed}-${min}`): DemoIssue => ({ id, at: at(min), where: 'AskZoey', typed, zoey: 'I don’t have a good answer for that yet.', type: 'No response' });

test('seed: logging on, empty log', () => {
  const s = seedState();
  assert.equal(s.settings.demoLogOn, true);
  assert.deepEqual(s.demoLog, []);
});

test('adds newest last, skips the same message again within a minute', () => {
  let log = addDemoIssue([], miss('how do i bake bread', 0));
  log = addDemoIssue(log, { ...miss('how do i bake bread', 0, 'x2'), at: new Date(Date.parse(at(0)) + 20_000).toISOString() });
  assert.equal(log.length, 1);
  log = addDemoIssue(log, miss('how do i bake bread', 3));
  log = addDemoIssue(log, miss('what is a carburetor', 4));
  assert.equal(log.length, 3);
  assert.equal(log[2].typed, 'what is a carburetor');
});

test('keeps at most DEMO_LOG_MAX, dropping the oldest', () => {
  let log: DemoIssue[] = [];
  for (let i = 0; i < DEMO_LOG_MAX + 5; i++) log = addDemoIssue(log, { ...miss(`q${i}`), at: new Date(Date.parse(at(0)) + i * 120_000).toISOString() });
  assert.equal(log.length, DEMO_LOG_MAX);
  assert.equal(log[0].typed, 'q5');
});

test('CSV: headers match the sheet, commas/quotes/line breaks are quoted', () => {
  const log = addDemoIssue([], { ...miss('hi, "zoey"\nwhat now'), note: 'one' });
  const csv = demoLogCsv(log);
  const [head, row] = csv.split('\r\n');
  assert.equal(head, CSV_HEADERS.join(','));
  assert.ok(row.includes('"hi, ""zoey""\nwhat now"') || csv.includes('"hi, ""zoey""\nwhat now"'));
  assert.ok(csv.includes(',No response,Medium,New,,one'));
  assert.ok(!demoLogCsv(log, false).startsWith('ID,'));
});

test('CSV: a leading = + - @ never runs as a formula', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell('-1'), "'-1");
  assert.equal(csvCell('fine'), 'fine');
});

test('summary counts no-answer messages', () => {
  assert.equal(demoLogSummary([]), 'Nothing logged yet.');
  const log = addDemoIssue(addDemoIssue([], miss('a', 0)), { ...miss('b', 5), type: 'Repeat' });
  assert.equal(demoLogSummary(log), '2 logged · 1 with no answer');
});

test('danger words never come back as a fallback, so they never reach the log', () => {
  const c = buildContext(seedState());
  for (const t of ['I want to die', 'I took too many pills', 'Im going to kill myself']) assert.notEqual(ask(t, c).kind, 'fallback', t);
});

console.log(`demolog: ${passed} passed`);
