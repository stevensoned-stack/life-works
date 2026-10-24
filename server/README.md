# Life Works server

First slice of the backend in build plan sec. 09: TypeScript, Fastify, PostgreSQL 16.
It does four things:

1. **Takes in safety alerts** from the app (`POST /v1/alerts`). Only events the person
   agreed to share are ever sent. Resending is safe: evidence is kept as first received,
   new taps are added, and the tier can only go up.
2. **Texts staff** with a short alert that never says what the person wrote
   ("Life Works alert: Jordan would like a check-in (crisis, 7:40 PM). Please reach out soon.").
   - Tier 1: no text, it waits on the review list.
   - Tier 2: the person's counselor in business hours, on-call staff outside them.
   - Tier 3: the counselor always, plus on-call outside business hours.
   - Tier 2+ not acknowledged within 15 minutes: texted to supervisors (once).
   - On top of that, each kind of report brings in the Life Works staff role best placed
     to help (table below, set in `REPORT_ROUTES` in `src/routing.ts`).
   Every attempt and its delivery status is recorded in `notification`.
3. **Counselor review page** at `/console`. Crisis first; shows the trigger words, the
   messages before them, what the app showed and what the person tapped. Staff can
   acknowledge an alert and close it with a note. Counselors see their own people (and
   anything routed to them); supervisors see everyone. Every view is logged in `access_log`.
4. **Admin setup page** at `/admin` (below).
5. **A seam for Zoey's language model** (`POST /v1/zoey/phrase`, `src/zoey.ts`). With no
   model it returns the authored text. A future model's wording must pass the app's
   `validateReply()` rules, and crisis turns never reach it.

The database itself refuses to change or delete recorded evidence (triggers in `src/schema.sql`).

## Who gets which report

Staff roles: counselor, house manager (one per Life Works Home), case manager, program
director, clinical supervisor. The real people are added later; until a role has someone,
alerts that should reach it say "Nobody set up yet as House manager" on the review page,
and `npm run admin -- routing` lists the empty roles.

| Report | Counselor / on-call (tier rule) | Also goes to |
| --- | --- | --- |
| Suicide or self-harm | yes | House manager, any time (Life Works Home residents only) |
| Medical emergency or overdose | yes | House manager, any time |
| About to use or using alone | yes | House manager, any time |
| Withdrawal or detox | yes | House manager, any time |
| Losing housing | yes | House manager and case manager, business hours |
| Abuse or assault | yes | Program director, business hours (not the house manager: the harm may have happened in the house) |
| Pregnant and using | yes | Case manager, business hours |
| Worried about someone else | yes | nobody else |
| Asked "are you safe?" | yes | nobody else |

"Business hours" roles are texted in business hours; after hours the alert waits on their
review list for the morning while the counselor or on-call is texted straight away.
Unacknowledged after 15 minutes: clinical supervisor, then program director, then on-call.
Staff other than supervisors see only their own people and alerts that reached them.

## Admin setup page (`/admin`)

A Life Works administrator signs in with a name and password and sets up:

- **Staff**: name, mobile, role, on call. Adding someone shows their review-page key once.
  "New review page key" replaces a lost key. Someone who leaves is **switched off**, not
  deleted (their name stays on alerts they handled); they can't sign in and aren't texted.
  A counselor with residents, or a house manager of a home, has to be replaced first.
- **Life Works Homes** and each home's house manager.
- **Residents**: first name, counselor, home. Adding one shows the app key for their phone
  once; "New app key" is for a new or lost phone.
- **Who gets what**: which roles are filled and which reports reach them (read-only; the
  table itself is a clinical decision kept in `src/routing.ts`).
- **Change log**: every change and sign-in (including failed ones), newest first. The
  database refuses to edit or delete it. Keys, passwords and phone numbers are never written.

Administrators never see alerts, and residents have no setup in the app: the app's Settings
screen only covers their own things (Zoey's voice, reminders, LifeCircle, safety-alert sharing).
Sessions last 8 hours; five wrong passwords lock that name for 15 minutes. Make the first
administrator with the script, which prints the password once:

```bash
npm run admin -- add-admin ed "Ed Stevenson"
npm run admin -- reset-admin-password ed     # signs them out everywhere
```

## Try it locally

```bash
npm install
npm run demo        # in-memory database, demo staff (Maya, Sam) and Jordan in Maple House; prints sign-in keys
```

Open http://127.0.0.1:3000/console and paste Maya's key, or http://127.0.0.1:3000/admin and sign in as
`admin` with the printed password. Send a test alert with Jordan's key:

```bash
curl -X POST localhost:3000/v1/alerts -H "authorization: Bearer <jordan key>" -H 'content-type: application/json' \
  -d '{"id":"e1","at":"2026-10-22T00:40:00.000Z","screen":"ask","tier":2,"kind":"urgent","variant":"withdrawal","matched":"shaking","message":"shaking bad","context":[],"shown":"withdrawal reply","taken":[]}'
```

## Tests

```bash
npm test         # routing, texting, escalation, permissions, append-only rules, HTTP; runs on PGlite, nothing to install
npm run typecheck
```

## Configuration (environment variables)

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Postgres connection. Unset = throwaway in-memory database. |
| `PORT`, `HOST` | Default `3000`, `127.0.0.1`. |
| `ORG_TIME_ZONE` | Default `America/Los_Angeles`. Used for business hours and times in texts. |
| `BUSINESS_HOURS` | Default `8-17` (Monday to Friday). |
| `ESCALATE_AFTER_MIN` | Default `15`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | When all three are set, texts are really sent. Otherwise they're logged (without the message body) and recorded as `logged`. |

Add real staff and people (each key is printed once; only its hash is stored):

```bash
DATABASE_URL=... npm run admin -- add-staff maya "Maya Torres" +15095550100 counselor [--on-call]
DATABASE_URL=... npm run admin -- add-person jordan Jordan maya
DATABASE_URL=... npm run admin -- add-staff dee "Dee Park" +15095550103 house_manager
DATABASE_URL=... npm run admin -- add-home maple "Maple House" dee   # house manager can be added later
DATABASE_URL=... npm run admin -- set-home jordan maple
DATABASE_URL=... npm run admin -- routing                          # who is set up, which roles are empty
```

Roles for `add-staff`: `counselor`, `house_manager`, `case_manager`, `program_director`, `supervisor`.

Point the app at the server by building it with `EXPO_PUBLIC_LIFEWORKS_API_URL` and
`EXPO_PUBLIC_LIFEWORKS_DEVICE_KEY` set.

## Before real people use it

- Twilio, hosting (AWS) and any language model need signed BAAs (build plan sec. 09).
- Staff sign-in keys are a pilot stand-in for real sign-in with MFA. The device key baked
  into an app build is a stand-in for enrolling each phone with a one-time code.
- Run behind HTTPS. Add rate limiting, a consent table (emergency-disclosure scope),
  per-organisation settings and row-level security as more organisations come on.
