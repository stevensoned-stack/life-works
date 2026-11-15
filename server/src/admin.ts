// Adds staff, people and Life Works Homes, printing each sign-in key once (only
// its hash is kept). Roles can be filled in any order; until a role has
// someone, alerts that should reach it say so on the review page.
//   npm run admin -- add-staff maya "Maya Torres" +15095550100 counselor [--on-call]
//   npm run admin -- add-person jordan Jordan maya [home-id]
//   npm run admin -- add-home maple "Maple House" [house-manager-id]
//   npm run admin -- set-house-manager maple dee
//   npm run admin -- set-home jordan maple      (or "none")
//   npm run admin -- routing                    who is set up, and who gets which report
//   npm run admin -- add-admin ed "Ed Stevenson"   an administrator for the /admin setup page
//   npm run admin -- reset-admin-password ed
// After the first administrator, the /admin page does all of the above.
import { addPerson, addStaff } from './auth';
import { connectPg, migrate } from './db';
import { addAdmin, resetAdminPassword } from './setup';
import { addHome, routingSummary, setHouseManager, setPersonHome, STAFF_ROLES } from './team';

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL first.');
  const sql = await connectPg(process.env.DATABASE_URL);
  await migrate(sql);
  try {
    if (cmd === 'add-staff') {
      const [id, name, phone, role] = args;
      if (!id || !name || !/^\+\d{10,15}$/.test(phone ?? '') || !STAFF_ROLES.includes(role as never))
        throw new Error(`usage: add-staff <id> <name> <+phone> <${STAFF_ROLES.join('|')}> [--on-call]`);
      const token = await addStaff(sql, { id, name, phone, role: role as never, on_call: args.includes('--on-call') });
      console.log(`Added ${name}. Console sign-in key (shown once):\n${token}`);
    } else if (cmd === 'add-person') {
      const [id, displayName, counselorId, homeId] = args;
      if (!id || !displayName || !counselorId) throw new Error('usage: add-person <id> <first name> <counselor id> [home id]');
      const token = await addPerson(sql, { id, displayName, counselorId });
      if (homeId) await setPersonHome(sql, id, homeId);
      console.log(`Added ${displayName}. Device key for the app (shown once):\n${token}`);
    } else if (cmd === 'add-home') {
      const [id, name, managerId] = args;
      if (!id || !name) throw new Error('usage: add-home <id> <name> [house manager staff id]');
      await addHome(sql, { id, name, houseManagerId: managerId });
      console.log(`Added ${name}.`);
    } else if (cmd === 'set-house-manager') {
      const [homeId, staffId] = args;
      if (!homeId || !staffId) throw new Error('usage: set-house-manager <home id> <staff id|none>');
      await setHouseManager(sql, homeId, staffId === 'none' ? null : staffId);
      console.log('Done.');
    } else if (cmd === 'set-home') {
      const [personId, homeId] = args;
      if (!personId || !homeId) throw new Error('usage: set-home <person id> <home id|none>');
      await setPersonHome(sql, personId, homeId === 'none' ? null : homeId);
      console.log('Done.');
    } else if (cmd === 'routing') {
      const r = await routingSummary(sql);
      for (const x of r.roles) console.log(`${x.label}: ${x.people.join(', ') || 'nobody yet'}`);
      console.log(`On call: ${r.onCall.join(', ') || 'nobody yet'}`);
      for (const h of r.homes) console.log(`${h.name}: house manager ${h.houseManager ?? 'nobody yet'}`);
      console.log('\nEvery report goes to the counselor (on-call after hours). Also:');
      for (const x of r.reports)
        console.log(`  ${x.report}: ${x.also.map((a) => `${a.role} (${a.when})`).join(', ') || 'nobody else'}`);
    } else if (cmd === 'add-admin') {
      const [id, name] = args;
      if (!id || !/^[a-z0-9][a-z0-9-]{1,31}$/.test(id) || !name) throw new Error('usage: add-admin <id> <name>');
      const password = await addAdmin(sql, { id, name });
      console.log(`Added ${name}. Sign in at /admin as "${id}" with this password (shown once):\n${password}`);
    } else if (cmd === 'reset-admin-password') {
      const [id] = args;
      if (!id) throw new Error('usage: reset-admin-password <id>');
      console.log(`New password for ${id} (shown once):\n${await resetAdminPassword(sql, id)}`);
    } else
      throw new Error('commands: add-staff, add-person, add-home, set-house-manager, set-home, routing, add-admin, reset-admin-password');
  } finally {
    await sql.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
