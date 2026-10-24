// Life Works Homes and the routing summary: who is set up in each staff role,
// and which reports reach which role. Real people are added with the admin
// script; until then a role shows as "nobody yet".
import { Sql } from './db';
import { REPORT_ROUTES, ROLE_LABEL, StaffRole } from './routing';

export const STAFF_ROLES = Object.keys(ROLE_LABEL) as StaffRole[];

export async function addHome(sql: Sql, h: { id: string; name: string; houseManagerId?: string | null }) {
  await sql.query('insert into home (id, name, house_manager_id) values ($1, $2, $3)', [h.id, h.name, h.houseManagerId ?? null]);
}

export async function setHouseManager(sql: Sql, homeId: string, staffId: string | null) {
  const r = await sql.query('update home set house_manager_id = $2 where id = $1 returning id', [homeId, staffId]);
  if (!r.rows.length) throw new Error(`no home ${homeId}`);
}

// homeId null: the person doesn't live in a Life Works Home.
export async function setPersonHome(sql: Sql, personId: string, homeId: string | null) {
  const r = await sql.query('update person set home_id = $2 where id = $1 returning id', [personId, homeId]);
  if (!r.rows.length) throw new Error(`no person ${personId}`);
}

export async function routingSummary(sql: Sql) {
  const staff = (await sql.query<{ name: string; role: StaffRole; on_call: boolean }>('select name, role, on_call from staff order by name')).rows;
  const homes = (
    await sql.query<{ name: string; manager: string | null }>(
      'select h.name, s.name as manager from home h left join staff s on s.id = h.house_manager_id order by h.name',
    )
  ).rows;
  return {
    roles: STAFF_ROLES.map((role) => ({ role, label: ROLE_LABEL[role], people: staff.filter((s) => s.role === role).map((s) => s.name) })),
    onCall: staff.filter((s) => s.on_call).map((s) => s.name),
    homes: homes.map((h) => ({ name: h.name, houseManager: h.manager })),
    reports: REPORT_ROUTES.map((r) => ({
      report: r.label,
      also: r.also.map((x) => ({ role: ROLE_LABEL[x.role], when: x.when === 'always' ? 'any time' : 'business hours' })),
    })),
  };
}
