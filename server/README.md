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
4. **A seam for Zoey's language model** (`POST /v1/zoey/phrase`, `src/zoey.ts`). With no
   model it returns the authored text. A future model's wording must pass the app's
   `validateReply()` rules, and crisis turns never reach it.
5. **Zoey's live AI answers** (`GET /v1/zoey/live`, `POST /v1/zoey/chat`, `src/zoeyLive.ts`),
   **off by default**. When switched on, AskZoey answers ordinary conversation with
   Claude on Amazon Bedrock, in Zoey's voice (`src/zoeyPrompt.ts`). See below.

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

## Try it locally

```bash
npm install
npm run demo        # in-memory database, demo staff (Maya, Sam) and Jordan in Maple House; prints sign-in keys
```

Open http://127.0.0.1:3000/console and paste Maya's key. Send a test alert with Jordan's key:

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

| `ZOEY_LIVE_AI` | `1` turns on Zoey's live AI answers. Anything else = off (authored answers only). |
| `ZOEY_LIVE_AI_APPROVED` | Also required to turn it on: a note of who approved it and when, e.g. `AWS BAA signed 2026-11-03; clinician review by Dr. Lee 2026-11-10`. Printed at startup. |
| `ZOEY_PROVIDER` | Default `bedrock` (the only one so far; `ChatModel` in `src/zoeyLive.ts` is the seam for another). |
| `AWS_REGION` | Bedrock region, e.g. `us-west-2`. AWS credentials come from the server's IAM role. |
| `BEDROCK_MODEL_ID` | Default `anthropic.claude-opus-5-5`. `anthropic.claude-haiku-5-5` is much cheaper and faster, worth trying once the clinician has compared replies. |
| `ZOEY_LIVE_PER_HOUR` | Default `60`: most live answers one phone can get per hour (then authored answers). |

### Zoey's live AI answers

How a message flows when it's on:

1. **On the phone, first, every time:** the crisis screen, danger words and the
   "remember danger words" check-ins. These show the authored help and are never sent.
   Once a chat has had danger words, the rest of that chat stays authored. Medicine
   questions keep their fixed "ask your prescriber" reply.
2. Otherwise the phone sends the message, the recent chat (Zoey's crisis and safety lines
   left out), first name, clean days, coordinator's first name, whether there's a sponsor,
   and today's schedule only if they asked about today. Phone numbers, emails, addresses,
   links, long numbers and LifeCircle last names are taken out first
   (`src/zoey/liveRules.ts`), and the server does it again.
3. The server checks the words again, asks the model, and checks the reply: no crisis or
   988/911 wording, no hotlines or phone numbers, no links, no diagnosis or medicine
   directions, not claiming to be a professional, not too long. A reply that fails is
   dropped and the phone shows the authored answer. So does anything slow (8 seconds),
   offline, or an error.
4. Nothing anyone wrote is logged: the server logs only `ok` / `rejected` / `model error`
   and how long it took. Keep Bedrock's model invocation logging off.

To turn it on (only after the AWS BAA is signed and the clinician has reviewed it):
in the AWS console, open Amazon Bedrock, request access to the Anthropic Claude model in
your region, give the server's IAM role `bedrock` invoke permission, then set
`ZOEY_LIVE_AI=1`, `ZOEY_LIVE_AI_APPROVED=...` and `AWS_REGION` and restart.

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
