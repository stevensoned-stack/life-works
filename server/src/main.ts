// Starts the server. All settings come from the environment; see README.md.
import { Alerts } from './alerts';
import { buildApp } from './app';
import { addPerson, addStaff } from './auth';
import { connectMemory, connectPg, migrate, Sql } from './db';
import { DEFAULT_HOURS } from './routing';
import { addHome, setPersonHome } from './team';
import { LogSender, SmsSender, TwilioSender } from './sms';

async function main() {
  const env = process.env;
  const sql = env.DATABASE_URL ? await connectPg(env.DATABASE_URL) : await connectMemory();
  if (!env.DATABASE_URL) console.warn('DATABASE_URL not set: using a throwaway in-memory database.');
  await migrate(sql);
  if (env.DEMO === '1' && !env.DATABASE_URL) await seedDemo(sql);

  let sms: SmsSender = new LogSender();
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM)
    sms = new TwilioSender({ accountSid: env.TWILIO_ACCOUNT_SID, authToken: env.TWILIO_AUTH_TOKEN, from: env.TWILIO_FROM });
  else console.warn('Twilio not configured: alert texts are logged, not sent.');

  const hours = {
    ...DEFAULT_HOURS,
    ...(env.ORG_TIME_ZONE && { timeZone: env.ORG_TIME_ZONE }),
    ...(env.BUSINESS_HOURS && parseHours(env.BUSINESS_HOURS)),
  };
  const alerts = new Alerts(sql, sms, { hours, escalateAfterMin: Number(env.ESCALATE_AFTER_MIN ?? 15) });

  // No language model yet: Zoey's server endpoint returns the authored text.
  const app = buildApp({ sql, alerts, model: null, logger: true });
  setInterval(() => alerts.sweep().catch((e) => app.log.error(e, 'sweep failed')), 60_000).unref();

  await app.listen({ port: Number(env.PORT ?? 3000), host: env.HOST ?? '127.0.0.1' });
}

// Made-up staff and a demo person, for trying the server locally.
async function seedDemo(sql: Sql) {
  const maya = await addStaff(sql, { id: 'maya', name: 'Maya Torres', phone: '+15095550100', role: 'counselor' });
  const sup = await addStaff(sql, { id: 'sam', name: 'Sam Lee', phone: '+15095550101', role: 'supervisor', on_call: true });
  const jordan = await addPerson(sql, { id: 'jordan', displayName: 'Jordan', counselorId: 'maya' });
  // A Life Works Home whose house manager hasn't been named yet.
  await addHome(sql, { id: 'maple', name: 'Maple House' });
  await setPersonHome(sql, 'jordan', 'maple');
  console.log(`Demo keys (this run only):\n  Maya (console):     ${maya}\n  Sam (console):      ${sup}\n  Jordan (app):       ${jordan}`);
}

// "8-17" -> 8:00 to 17:00, Monday to Friday.
function parseHours(s: string) {
  const [start, end] = s.split('-').map(Number);
  return { start, end };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
