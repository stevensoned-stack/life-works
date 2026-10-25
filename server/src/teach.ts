// Teach Zoey (src/zoey/teach.ts): the list of sayings Zoey missed, and what
// staff taught her. Nothing here knows who sent a saying: the phone sends only
// the scrubbed words and, if they told her, which answer they meant.
import { Sql } from './db';
import { canLearn } from '../../src/zoey/learn';
import { sayingKey, scrubPhrase, Taught } from '../../src/zoey/teach';
import { validateReply } from '../../src/zoey/validate';

export class TeachError extends Error {}

// answers.ts pulls in the app's screen types, which the server's compiler
// doesn't build, so the library is loaded at run time.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const library = (): { id: string; q: string }[] => require('../../src/zoey/answers').ANSWERS.map((a: { id: string; q: string }) => ({ id: a.id, q: a.q }));

export type MissedRow = { id: string; shown: string; times: number; picks: Record<string, number>; first_day: string; last_day: string };

// From a phone. Returns false when the saying is refused (the same scrub as the phone's).
export async function receiveMissed(sql: Sql, phrase: string, picked: string | null) {
  const shown = scrubPhrase(phrase);
  if (!shown || shown !== phrase.trim().toLowerCase()) return false;
  const saying = sayingKey(shown);
  if (!saying || !canLearn(saying)) return false;
  // Taught already: nothing more to collect.
  const done = await sql.query('select 1 from zoey_taught where saying = $1', [saying]);
  if (done.rows.length) return true;
  const known = picked && (await answerIds(sql)).has(picked) ? picked : null;
  await sql.query(
    `insert into zoey_missed (saying, shown, times, picks) values ($1, $2, $3, $4)
     on conflict (saying) do update set
       times = zoey_missed.times + excluded.times,
       picks = case when $5::text is null then zoey_missed.picks
                    else jsonb_set(zoey_missed.picks, array[$5::text], to_jsonb(coalesce((zoey_missed.picks ->> $5::text)::int, 0) + 1)) end,
       last_day = current_date`,
    [saying, shown, known ? 0 : 1, JSON.stringify(known ? { [known]: 1 } : {}), known],
  );
  return true;
}

async function answerIds(sql: Sql) {
  const r = await sql.query<{ answer_id: string }>('select distinct answer_id from zoey_taught where answer_text is not null');
  return new Set([...library().map((a) => a.id), ...r.rows.map((x) => x.answer_id)]);
}

export async function listMissed(sql: Sql, status: 'open' | 'all' = 'open') {
  const r = await sql.query<MissedRow & { status: string }>(
    `select id::text, shown, times, picks, first_day::text, last_day::text, status from zoey_missed
     ${status === 'open' ? "where status = 'open'" : ''} order by times desc, last_day desc limit 200`,
  );
  return r.rows;
}

// Answers staff can pick from: the library and the ones staff wrote.
export async function answerChoices(sql: Sql) {
  const own = await sql.query<{ answer_id: string; answer_q: string }>(
    'select distinct answer_id, answer_q from zoey_taught where answer_text is not null order by answer_q',
  );
  return [...library(), ...own.rows.map((r) => ({ id: r.answer_id, q: r.answer_q }))];
}

// Map a missed saying to an answer, or write a new one. `staffId` is recorded.
export async function teach(
  sql: Sql,
  staffId: string,
  missedId: string,
  to: { answer: string } | { q: string; text: string },
) {
  const m = await sql.query<{ saying: string; status: string }>('select saying, status from zoey_missed where id = $1', [missedId]);
  const row = m.rows[0];
  if (!row) throw new TeachError('not found');
  if (row.status !== 'open') throw new TeachError('already handled');
  if (!canLearn(row.saying)) throw new TeachError('this saying touches safety or medicine and can’t be taught');
  let answerId: string;
  let q: string | null = null;
  let text: string | null = null;
  if ('answer' in to) {
    if (!(await answerIds(sql)).has(to.answer)) throw new TeachError('unknown answer');
    answerId = to.answer;
  } else {
    q = to.q.trim();
    text = to.text.trim();
    if (!q || !text) throw new TeachError('question and answer are both needed');
    // The same rules as any reply that isn't from the library.
    const v = validateReply(text);
    if (!v.ok) throw new TeachError(`answer not allowed: ${v.reasons.join('; ')}`);
    answerId = `taught-${missedId}`;
  }
  await sql.query('insert into zoey_taught (saying, answer_id, answer_q, answer_text, taught_by) values ($1, $2, $3, $4, $5)', [
    row.saying,
    answerId,
    q,
    text,
    staffId,
  ]);
  await sql.query("update zoey_missed set status = 'taught', handled_by = $2, handled_at = now() where id = $1", [missedId, staffId]);
  return { answer: answerId };
}

export async function dismiss(sql: Sql, staffId: string, missedId: string) {
  const r = await sql.query("update zoey_missed set status = 'dismissed', handled_by = $2, handled_at = now() where id = $1 and status = 'open' returning id", [
    missedId,
    staffId,
  ]);
  if (!r.rows.length) throw new TeachError('not found or already handled');
}

// Undo: the saying goes back on the list.
export async function unteach(sql: Sql, staffId: string, taughtId: string) {
  const r = await sql.query<{ saying: string }>('delete from zoey_taught where id = $1 returning saying', [taughtId]);
  if (!r.rows.length) throw new TeachError('not found');
  await sql.query("update zoey_missed set status = 'open', handled_by = $2, handled_at = now() where saying = $1", [r.rows[0].saying, staffId]);
}

export async function listTaught(sql: Sql) {
  const r = await sql.query<{ id: string; saying: string; answer_id: string; answer_q: string | null; answer_text: string | null; taught_by: string; taught_at: string }>(
    'select id::text, saying, answer_id, answer_q, answer_text, taught_by, taught_at::text from zoey_taught order by taught_at desc',
  );
  return r.rows;
}

// What every phone fetches.
export async function taughtForPhones(sql: Sql): Promise<Taught> {
  const rows = await listTaught(sql);
  const answers = new Map<string, { id: string; q: string; text: string }>();
  for (const r of rows) if (r.answer_text && r.answer_q) answers.set(r.answer_id, { id: r.answer_id, q: r.answer_q, text: r.answer_text });
  return {
    phrases: rows.filter((r) => canLearn(r.saying)).map((r) => ({ said: r.saying, answer: r.answer_id })),
    answers: [...answers.values()],
    at: rows[0]?.taught_at ?? null,
  };
}
