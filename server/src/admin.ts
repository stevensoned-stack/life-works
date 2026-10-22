// Adds staff and people, printing each sign-in key once (only its hash is kept).
//   npm run admin -- add-staff maya "Maya Torres" +15095550100 counselor [--on-call]
//   npm run admin -- add-person jordan Jordan maya
import { addPerson, addStaff } from './auth';
import { connectPg, migrate } from './db';

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL first.');
  const sql = await connectPg(process.env.DATABASE_URL);
  await migrate(sql);
  try {
    if (cmd === 'add-staff') {
      const [id, name, phone, role] = args;
      if (!id || !name || !/^\+\d{10,15}$/.test(phone ?? '') || !['counselor', 'supervisor'].includes(role))
        throw new Error('usage: add-staff <id> <name> <+phone> <counselor|supervisor> [--on-call]');
      const token = await addStaff(sql, { id, name, phone, role: role as 'counselor', on_call: args.includes('--on-call') });
      console.log(`Added ${name}. Console sign-in key (shown once):\n${token}`);
    } else if (cmd === 'add-person') {
      const [id, displayName, counselorId] = args;
      if (!id || !displayName || !counselorId) throw new Error('usage: add-person <id> <first name> <counselor id>');
      const token = await addPerson(sql, { id, displayName, counselorId });
      console.log(`Added ${displayName}. Device key for the app (shown once):\n${token}`);
    } else throw new Error('commands: add-staff, add-person');
  } finally {
    await sql.close();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
