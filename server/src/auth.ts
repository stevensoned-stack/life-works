// Bearer tokens for the pilot: one per phone and one per staff member, made by
// the admin script and stored only as a sha256 hash. A real staff sign-in
// (SSO, MFA) replaces the staff tokens before launch.
import { createHash, randomBytes } from 'node:crypto';
import { Sql } from './db';
import { Staff } from './alerts';

export const newToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function bearer(header: string | undefined) {
  const m = /^Bearer\s+(\S+)$/i.exec(header ?? '');
  return m ? m[1] : null;
}

export async function personFor(sql: Sql, token: string | null) {
  if (!token) return null;
  const r = await sql.query<{ id: string }>('select id from person where device_token_hash = $1', [hashToken(token)]);
  return r.rows[0]?.id ?? null;
}

export async function staffFor(sql: Sql, token: string | null): Promise<Staff | null> {
  if (!token) return null;
  const r = await sql.query<Staff>('select id, name, phone, role, on_call from staff where token_hash = $1', [hashToken(token)]);
  return r.rows[0] ?? null;
}

export async function addStaff(sql: Sql, s: Omit<Staff, 'on_call'> & { on_call?: boolean }) {
  const token = newToken();
  await sql.query('insert into staff (id, name, phone, role, on_call, token_hash) values ($1, $2, $3, $4, $5, $6)', [
    s.id,
    s.name,
    s.phone,
    s.role,
    s.on_call ?? false,
    hashToken(token),
  ]);
  return token;
}

export async function addPerson(sql: Sql, p: { id: string; displayName: string; counselorId: string }) {
  const token = newToken();
  await sql.query('insert into person (id, display_name, counselor_id, device_token_hash) values ($1, $2, $3, $4)', [
    p.id,
    p.displayName,
    p.counselorId,
    hashToken(token),
  ]);
  return token;
}
