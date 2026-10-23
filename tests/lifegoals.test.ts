// Run with: npm test
// Checks the LifeGoals options and how goals are grouped and counted.
import assert from 'node:assert/strict';
import { seedLifeEvents } from '../src/data/seed';
import { LifeEvent } from '../src/data/types';
import { markDone, screenEntry, timeline, upcoming } from '../src/recovery/lifeEvents';
import { AREA_ORDER, AREAS, areaGoals, goalFor, newGoal, progress } from '../src/recovery/lifeGoals';
import { addDays, ymd } from '../src/util';

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

const now = new Date(2026, 9, 23, 12, 0, 0);

test('every area has a question and options', () => {
  for (const a of AREA_ORDER) {
    assert.ok(AREAS[a].question.endsWith('?'), a);
    assert.ok(AREAS[a].options.length >= 5, a);
  }
});

test('options are unique within an area, in label and in saved title', () => {
  for (const a of AREA_ORDER) {
    const o = AREAS[a].options;
    assert.equal(new Set(o.map((x) => x.label)).size, o.length, a);
    assert.equal(new Set(o.map((x) => x.title)).size, o.length, a);
  }
});

test("Ed's examples are offered", () => {
  const labels = (a: keyof typeof AREAS) => AREAS[a].options.map((o) => o.label).join(' | ');
  assert.match(labels('education'), /GED/);
  assert.match(labels('education'), /AA/);
  assert.match(labels('education'), /BA/);
  for (const job of ['Welding', 'Construction', 'Computers', 'Medical']) assert.match(labels('career'), new RegExp(job));
  for (const who of ['Parents', 'Brothers and sisters', 'Spouse']) assert.match(labels('family'), new RegExp(who));
});

test('no option trips the safety screen', () => {
  for (const a of AREA_ORDER) for (const o of AREAS[a].options) assert.equal(screenEntry(o.title).kind, 'none', o.title);
});

test('a picked option becomes a planned goal in its area, shown in LifeEvent too', () => {
  const g = newGoal('career', AREAS.career.options[0].title, 'g1', now);
  assert.equal(g.status, 'planned');
  assert.equal(g.area, 'career');
  assert.equal(g.kind, 'work_school');
  assert.equal(goalFor([g], 'career', g.title)?.id, 'g1');
  assert.equal(goalFor([g], 'education', g.title), undefined);
  assert.deepEqual(upcoming([g], null, now).map((e) => e.id), ['g1']);
});

test('area lists open goals first, soonest target first, then done', () => {
  const mk = (id: string, date: string | null, status: LifeEvent['status'] = 'planned'): LifeEvent => ({
    ...newGoal('family', id, id, now),
    date,
    status,
  });
  const done = markDone(mk('done', null), now);
  const list = areaGoals([mk('undated', null), done, mk('later', ymd(addDays(now, 40))), mk('soon', ymd(addDays(now, 3))), newGoal('career', 'x', 'x', now)], 'family');
  assert.deepEqual(list.map((e) => e.id), ['soon', 'later', 'undated', 'done']);
  assert.deepEqual(progress([...list], 'family'), { total: 4, done: 1 });
});

test('a goal marked done lands on the timeline', () => {
  const g = markDone(newGoal('education', 'Get my GED', 'ged', now), now);
  assert.equal(g.area, 'education');
  assert.deepEqual(timeline([g], null, now).map((e) => e.id), ['ged']);
});

test('demo goals match options so their chips show as picked', () => {
  for (const e of seedLifeEvents(now).filter((x) => x.area)) {
    assert.ok(AREAS[e.area!].options.some((o) => o.title === e.title), e.title);
  }
});

console.log(`${passed} passed`);
