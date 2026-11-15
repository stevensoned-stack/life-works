// The admin setup screen (/admin): a Life Works administrator signs in with a
// name and password and sets up staff, Life Works Homes and residents. Every
// change and sign-in goes into admin_audit. Administrators never see alerts,
// and residents have no setup in the app.
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addPerson, addStaff, bearer, hashToken, newToken } from './auth';
import { Sql } from './db';
import { ROLE_LABEL, StaffRole } from './routing';
import { addHome, routingSummary, setHouseManager, setPersonHome, STAFF_ROLES } from './team';

export type Admin = { id: string; name: string };

const SESSION_HOURS = 8;
const MAX_FAILURES = 5; // then locked for LOCK_MIN
const LOCK_MIN = 15;

export class SetupError extends Error {}

// ---- Administrators and their sign-in ----

export function hashPassword(password: string) {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function passwordMatches(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const got = scryptSync(password, Buffer.from(salt, 'hex'), 32);
  return timingSafeEqual(got, Buffer.from(hash, 'hex'));
}

// Made with the admin script; the password is printed once.
export async function addAdmin(sql: Sql, a: Admin) {
  const password = randomBytes(12).toString('base64url');
  await sql.query('insert into admin_user (id, name, password_hash) values ($1, $2, $3)', [a.id, a.name, hashPassword(password)]);
  await audit(sql, null, 'admin.added', `admin:${a.id}`, { name: a.name, by: 'admin script' });
  return password;
}

export async function resetAdminPassword(sql: Sql, id: string) {
  const password = randomBytes(12).toString('base64url');
  const r = await sql.query('update admin_user set password_hash = $2 where id = $1 returning id', [id, hashPassword(password)]);
  if (!r.rows.length) throw new SetupError(`no administrator ${id}`);
  await sql.query('delete from admin_session where admin_id = $1', [id]);
  await audit(sql, null, 'admin.password_reset', `admin:${id}`, { by: 'admin script' });
  return password;
}

export function audit(sql: Sql, adminId: string | null, action: string, target: string | null, detail: object = {}) {
  return sql.query('insert into admin_audit (admin_id, action, target, detail) values ($1, $2, $3, $4)', [
    adminId,
    action,
    target,
    JSON.stringify(detail),
  ]);
}

export class AdminAuth {
  private failures = new Map<string, { count: number; until: number }>();
  constructor(
    private sql: Sql,
    private now: () => Date = () => new Date(),
  ) {}

  async signIn(id: string, password: string): Promise<{ token: string; admin: Admin } | null> {
    const t = this.now().getTime();
    const f = this.failures.get(id);
    if (f && f.count >= MAX_FAILURES && f.until > t) {
      await audit(this.sql, null, 'sign_in.locked', `admin:${id}`);
      throw new SetupError(`Too many tries. Try again in ${LOCK_MIN} minutes.`);
    }
    const row = (await this.sql.query<Admin & { password_hash: string }>('select id, name, password_hash from admin_user where id = $1', [id]))
      .rows[0];
    if (!row || !passwordMatches(password, row.password_hash)) {
      const count = (f && f.until > t ? f.count : 0) + 1;
      this.failures.set(id, { count, until: t + LOCK_MIN * 60_000 });
      await audit(this.sql, row ? row.id : null, 'sign_in.failed', `admin:${id}`);
      return null;
    }
    this.failures.delete(id);
    const token = newToken();
    await this.sql.query('insert into admin_session (token_hash, admin_id, expires_at) values ($1, $2, $3)', [
      hashToken(token),
      row.id,
      new Date(t + SESSION_HOURS * 3600_000),
    ]);
    await audit(this.sql, row.id, 'sign_in', `admin:${row.id}`);
    return { token, admin: { id: row.id, name: row.name } };
  }

  async adminFor(token: string | null): Promise<Admin | null> {
    if (!token) return null;
    const r = await this.sql.query<Admin>(
      'select a.id, a.name from admin_session s join admin_user a on a.id = s.admin_id where s.token_hash = $1 and s.expires_at > $2',
      [hashToken(token), this.now()],
    );
    return r.rows[0] ?? null;
  }

  async signOut(admin: Admin, token: string) {
    await this.sql.query('delete from admin_session where token_hash = $1', [hashToken(token)]);
    await audit(this.sql, admin.id, 'sign_out', `admin:${admin.id}`);
  }
}

// ---- What the administrator changes ----

const ID = /^[a-z0-9][a-z0-9-]{1,31}$/;
const PHONE = /^\+\d{10,15}$/;

type StaffRow = { id: string; name: string; phone: string; role: StaffRole; on_call: boolean; active: boolean };

export class Setup {
  constructor(private sql: Sql) {}

  async overview() {
    const staff = (await this.sql.query<StaffRow>('select id, name, phone, role, on_call, active from staff order by active desc, name')).rows;
    const homes = (
      await this.sql.query<{ id: string; name: string; house_manager_id: string | null }>('select id, name, house_manager_id from home order by name')
    ).rows;
    const people = (
      await this.sql.query<{ id: string; display_name: string; counselor_id: string; home_id: string | null }>(
        'select id, display_name, counselor_id, home_id from person order by display_name',
      )
    ).rows;
    return {
      roles: STAFF_ROLES.map((role) => ({ role, label: ROLE_LABEL[role] })),
      staff: staff.map((s) => ({ id: s.id, name: s.name, phone: s.phone, role: s.role, onCall: s.on_call, active: s.active })),
      homes: homes.map((h) => ({
        id: h.id,
        name: h.name,
        houseManagerId: h.house_manager_id,
        residents: people.filter((p) => p.home_id === h.id).length,
      })),
      people: people.map((p) => ({ id: p.id, name: p.display_name, counselorId: p.counselor_id, homeId: p.home_id })),
      routing: await routingSummary(this.sql),
    };
  }

  async auditLog(limit: number) {
    const r = await this.sql.query<{ id: string; admin: string | null; action: string; target: string | null; detail: object; at: Date }>(
      `select l.id, a.name as admin, l.action, l.target, l.detail, l.at from admin_audit l
       left join admin_user a on a.id = l.admin_id order by l.id desc limit $1`,
      [limit],
    );
    return r.rows.map((x) => ({ ...x, at: new Date(x.at).toISOString() }));
  }

  // ---- Staff ----

  async addStaff(by: Admin, s: { id: string; name: string; phone: string; role: StaffRole; onCall?: boolean }) {
    if (!ID.test(s.id)) throw new SetupError('The short name must be 2-32 lowercase letters, numbers or dashes.');
    if (!PHONE.test(s.phone)) throw new SetupError('Phone must look like +15095550100.');
    if (await this.staffRow(s.id)) throw new SetupError(`There is already a staff member with the short name ${s.id}.`);
    const key = await addStaff(this.sql, { id: s.id, name: s.name, phone: s.phone, role: s.role, on_call: s.onCall ?? false });
    await audit(this.sql, by.id, 'staff.added', `staff:${s.id}`, { name: s.name, role: s.role, onCall: s.onCall ?? false });
    return key;
  }

  async updateStaff(by: Admin, id: string, c: { name?: string; phone?: string; role?: StaffRole; onCall?: boolean }) {
    const s = await this.mustStaff(id);
    if (c.phone !== undefined && !PHONE.test(c.phone)) throw new SetupError('Phone must look like +15095550100.');
    if (c.role && c.role !== s.role) await this.mustBeFree(s, `change ${s.name}'s role`);
    if (c.onCall && !s.active) throw new SetupError(`${s.name} is switched off; switch them back on first.`);
    const next = { name: c.name ?? s.name, phone: c.phone ?? s.phone, role: c.role ?? s.role, on_call: c.onCall ?? s.on_call };
    await this.sql.query('update staff set name = $2, phone = $3, role = $4, on_call = $5 where id = $1', [
      id,
      next.name,
      next.phone,
      next.role,
      next.on_call,
    ]);
    // Phone numbers stay out of the log; it only says the phone changed.
    const changed: Record<string, unknown> = {};
    if (next.name !== s.name) changed.name = { from: s.name, to: next.name };
    if (next.phone !== s.phone) changed.phone = 'changed';
    if (next.role !== s.role) changed.role = { from: s.role, to: next.role };
    if (next.on_call !== s.on_call) changed.onCall = next.on_call;
    if (Object.keys(changed).length) await audit(this.sql, by.id, 'staff.updated', `staff:${id}`, changed);
  }

  // A new review-page key; the old one stops working.
  async newStaffKey(by: Admin, id: string) {
    await this.mustStaff(id);
    const key = newToken();
    await this.sql.query('update staff set token_hash = $2 where id = $1', [id, hashToken(key)]);
    await audit(this.sql, by.id, 'staff.new_key', `staff:${id}`);
    return key;
  }

  // Switched off: can't sign in, isn't texted or counted in any role. Their
  // people and homes have to be given to someone else first.
  async setStaffActive(by: Admin, id: string, active: boolean) {
    const s = await this.mustStaff(id);
    if (s.active === active) return;
    if (!active) await this.mustBeFree(s, `switch off ${s.name}`);
    await this.sql.query('update staff set active = $2::boolean, on_call = on_call and $2::boolean where id = $1', [id, active]);
    await audit(this.sql, by.id, active ? 'staff.switched_on' : 'staff.switched_off', `staff:${id}`);
  }

  // ---- Life Works Homes ----

  async addHome(by: Admin, h: { id: string; name: string; houseManagerId?: string | null }) {
    if (!ID.test(h.id)) throw new SetupError('The short name must be 2-32 lowercase letters, numbers or dashes.');
    if ((await this.sql.query('select 1 from home where id = $1', [h.id])).rows.length)
      throw new SetupError(`There is already a home with the short name ${h.id}.`);
    if (h.houseManagerId) await this.mustHaveRole(h.houseManagerId, 'house_manager');
    await addHome(this.sql, h);
    await audit(this.sql, by.id, 'home.added', `home:${h.id}`, { name: h.name, houseManager: h.houseManagerId ?? null });
  }

  async updateHome(by: Admin, id: string, c: { name?: string; houseManagerId?: string | null }) {
    const h = (await this.sql.query<{ name: string; house_manager_id: string | null }>('select name, house_manager_id from home where id = $1', [id])).rows[0];
    if (!h) throw new SetupError(`No home ${id}.`);
    const changed: Record<string, unknown> = {};
    if (c.name !== undefined && c.name !== h.name) {
      await this.sql.query('update home set name = $2 where id = $1', [id, c.name]);
      changed.name = { from: h.name, to: c.name };
    }
    if (c.houseManagerId !== undefined && c.houseManagerId !== h.house_manager_id) {
      if (c.houseManagerId) await this.mustHaveRole(c.houseManagerId, 'house_manager');
      await setHouseManager(this.sql, id, c.houseManagerId);
      changed.houseManager = { from: h.house_manager_id, to: c.houseManagerId };
    }
    if (Object.keys(changed).length) await audit(this.sql, by.id, 'home.updated', `home:${id}`, changed);
  }

  // ---- Residents ----

  async addPerson(by: Admin, p: { id: string; name: string; counselorId: string; homeId?: string | null }) {
    if (!ID.test(p.id)) throw new SetupError('The short name must be 2-32 lowercase letters, numbers or dashes.');
    if ((await this.sql.query('select 1 from person where id = $1', [p.id])).rows.length)
      throw new SetupError(`There is already a resident with the short name ${p.id}.`);
    await this.mustHaveRole(p.counselorId, 'counselor');
    if (p.homeId) await this.mustHome(p.homeId);
    const key = await addPerson(this.sql, { id: p.id, displayName: p.name, counselorId: p.counselorId });
    if (p.homeId) await setPersonHome(this.sql, p.id, p.homeId);
    await audit(this.sql, by.id, 'person.added', `person:${p.id}`, { name: p.name, counselor: p.counselorId, home: p.homeId ?? null });
    return key;
  }

  async updatePerson(by: Admin, id: string, c: { name?: string; counselorId?: string; homeId?: string | null }) {
    const p = (
      await this.sql.query<{ display_name: string; counselor_id: string; home_id: string | null }>(
        'select display_name, counselor_id, home_id from person where id = $1',
        [id],
      )
    ).rows[0];
    if (!p) throw new SetupError(`No resident ${id}.`);
    const changed: Record<string, unknown> = {};
    if (c.name !== undefined && c.name !== p.display_name) {
      await this.sql.query('update person set display_name = $2 where id = $1', [id, c.name]);
      changed.name = { from: p.display_name, to: c.name };
    }
    if (c.counselorId !== undefined && c.counselorId !== p.counselor_id) {
      await this.mustHaveRole(c.counselorId, 'counselor');
      await this.sql.query('update person set counselor_id = $2 where id = $1', [id, c.counselorId]);
      changed.counselor = { from: p.counselor_id, to: c.counselorId };
    }
    if (c.homeId !== undefined && c.homeId !== p.home_id) {
      if (c.homeId) await this.mustHome(c.homeId);
      await setPersonHome(this.sql, id, c.homeId);
      changed.home = { from: p.home_id, to: c.homeId };
    }
    if (Object.keys(changed).length) await audit(this.sql, by.id, 'person.updated', `person:${id}`, changed);
  }

  // A new key for the resident's phone (lost or new phone); the old one stops working.
  async newPersonKey(by: Admin, id: string) {
    const key = newToken();
    const r = await this.sql.query('update person set device_token_hash = $2 where id = $1 returning id', [id, hashToken(key)]);
    if (!r.rows.length) throw new SetupError(`No resident ${id}.`);
    await audit(this.sql, by.id, 'person.new_key', `person:${id}`);
    return key;
  }

  // ---- Checks ----

  private async staffRow(id: string) {
    return (await this.sql.query<StaffRow>('select id, name, phone, role, on_call, active from staff where id = $1', [id])).rows[0];
  }

  private async mustStaff(id: string) {
    const s = await this.staffRow(id);
    if (!s) throw new SetupError(`No staff member ${id}.`);
    return s;
  }

  private async mustHaveRole(id: string, role: StaffRole) {
    const s = await this.mustStaff(id);
    if (!s.active) throw new SetupError(`${s.name} is switched off.`);
    if (s.role !== role) throw new SetupError(`${s.name} is not a ${ROLE_LABEL[role].toLowerCase()}.`);
  }

  private async mustHome(id: string) {
    if (!(await this.sql.query('select 1 from home where id = $1', [id])).rows.length) throw new SetupError(`No home ${id}.`);
  }

  // Nobody may be left without a counselor, or a home without the manager it
  // thinks it has, by a role change or switch-off.
  private async mustBeFree(s: StaffRow, doing: string) {
    const people = (await this.sql.query('select 1 from person where counselor_id = $1', [s.id])).rows.length;
    if (people) throw new SetupError(`Give ${s.name}'s ${people} resident${people === 1 ? '' : 's'} another counselor before you ${doing}.`);
    const homes = (await this.sql.query<{ name: string }>('select name from home where house_manager_id = $1', [s.id])).rows;
    if (homes.length) throw new SetupError(`${s.name} is house manager of ${homes.map((h) => h.name).join(', ')}. Change that before you ${doing}.`);
  }
}

// ---- HTTP ----

const str = (max: number) => ({ type: 'string', minLength: 1, maxLength: max });
// type list, not anyOf: Fastify's type coercion would turn null into "" in the first branch.
const nullableId = { type: ['string', 'null'], maxLength: 32 };
const role = { enum: STAFF_ROLES };
const obj = (properties: object, required: string[] = []) => ({ type: 'object', additionalProperties: false, required, properties });

// In its own plugin scope, so the error handler only covers these routes.
export const setupRoutes = (sql: Sql, auth = new AdminAuth(sql)) => async (app: FastifyInstance) => {
  const setup = new Setup(sql);
  type Req = FastifyRequest & { admin: Admin };
  const admin = async (req: FastifyRequest, reply: FastifyReply) => {
    const a = await auth.adminFor(bearer(req.headers.authorization));
    if (!a) return reply.code(401).send({ error: 'Please sign in again.' });
    (req as Req).admin = a;
    reply.header('Cache-Control', 'no-store');
  };
  const by = (req: FastifyRequest) => (req as Req).admin;

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof SetupError) return reply.code(409).send({ error: err.message });
    if ((err as { validation?: unknown }).validation) return reply.code(400).send({ error: 'Please check the form: ' + (err as Error).message });
    reply.log.error(err);
    return reply.code(500).send({ error: 'Something went wrong.' });
  });

  const page = readFileSync(join(__dirname, 'admin.html'), 'utf8');
  app.get('/admin', async (_req, reply) =>
    reply
      .type('text/html; charset=utf-8')
      .header('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'")
      .header('X-Frame-Options', 'DENY')
      .header('Referrer-Policy', 'no-referrer')
      .header('Cache-Control', 'no-store')
      .send(page),
  );

  app.post<{ Body: { id: string; password: string } }>(
    '/v1/admin/sign-in',
    { schema: { body: obj({ id: str(32), password: str(200) }, ['id', 'password']) } },
    async (req, reply) => {
      const r = await auth.signIn(req.body.id.trim().toLowerCase(), req.body.password);
      if (!r) return reply.code(401).send({ error: 'That name and password don’t match.' });
      return r;
    },
  );
  app.post('/v1/admin/sign-out', { preHandler: admin }, async (req) => {
    await auth.signOut(by(req), bearer(req.headers.authorization)!);
    return { ok: true };
  });

  app.get('/v1/admin/setup', { preHandler: admin }, async (req) => ({ me: by(req), ...(await setup.overview()) }));
  app.get<{ Querystring: { limit?: number } }>(
    '/v1/admin/audit',
    { preHandler: admin, schema: { querystring: obj({ limit: { type: 'integer', minimum: 1, maximum: 500 } }) } },
    async (req) => ({ entries: await setup.auditLog(req.query.limit ?? 100) }),
  );

  app.post<{ Body: { id: string; name: string; phone: string; role: StaffRole; onCall?: boolean } }>(
    '/v1/admin/staff',
    { preHandler: admin, schema: { body: obj({ id: str(32), name: str(80), phone: str(16), role, onCall: { type: 'boolean' } }, ['id', 'name', 'phone', 'role']) } },
    async (req) => ({ key: await setup.addStaff(by(req), req.body) }),
  );
  app.patch<{ Params: { id: string }; Body: { name?: string; phone?: string; role?: StaffRole; onCall?: boolean } }>(
    '/v1/admin/staff/:id',
    { preHandler: admin, schema: { body: obj({ name: str(80), phone: str(16), role, onCall: { type: 'boolean' } }) } },
    async (req) => (await setup.updateStaff(by(req), req.params.id, req.body), { ok: true }),
  );
  app.post<{ Params: { id: string } }>('/v1/admin/staff/:id/new-key', { preHandler: admin }, async (req) => ({
    key: await setup.newStaffKey(by(req), req.params.id),
  }));
  app.post<{ Params: { id: string }; Body: { active: boolean } }>(
    '/v1/admin/staff/:id/active',
    { preHandler: admin, schema: { body: obj({ active: { type: 'boolean' } }, ['active']) } },
    async (req) => (await setup.setStaffActive(by(req), req.params.id, req.body.active), { ok: true }),
  );

  app.post<{ Body: { id: string; name: string; houseManagerId?: string | null } }>(
    '/v1/admin/homes',
    { preHandler: admin, schema: { body: obj({ id: str(32), name: str(80), houseManagerId: nullableId }, ['id', 'name']) } },
    async (req) => (await setup.addHome(by(req), req.body), { ok: true }),
  );
  app.patch<{ Params: { id: string }; Body: { name?: string; houseManagerId?: string | null } }>(
    '/v1/admin/homes/:id',
    { preHandler: admin, schema: { body: obj({ name: str(80), houseManagerId: nullableId }) } },
    async (req) => (await setup.updateHome(by(req), req.params.id, req.body), { ok: true }),
  );

  app.post<{ Body: { id: string; name: string; counselorId: string; homeId?: string | null } }>(
    '/v1/admin/people',
    { preHandler: admin, schema: { body: obj({ id: str(32), name: str(40), counselorId: str(32), homeId: nullableId }, ['id', 'name', 'counselorId']) } },
    async (req) => ({ key: await setup.addPerson(by(req), req.body) }),
  );
  app.patch<{ Params: { id: string }; Body: { name?: string; counselorId?: string; homeId?: string | null } }>(
    '/v1/admin/people/:id',
    { preHandler: admin, schema: { body: obj({ name: str(40), counselorId: str(32), homeId: nullableId }) } },
    async (req) => (await setup.updatePerson(by(req), req.params.id, req.body), { ok: true }),
  );
  app.post<{ Params: { id: string } }>('/v1/admin/people/:id/new-key', { preHandler: admin }, async (req) => ({
    key: await setup.newPersonKey(by(req), req.params.id),
  }));
};
