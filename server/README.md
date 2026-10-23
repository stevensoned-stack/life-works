# Life Works server

First slice of the backend in build plan sec. 09: TypeScript, Fastify, PostgreSQL 16.
It does five things:

1. **Takes in safety alerts** from the app (`POST /v1/alerts`). Only events the person
   agreed to share are ever sent. Resending is safe: evidence is kept as first received,
   new taps are added, and the tier can only go up.
2. **Texts staff** with a short alert that never says what the person wrote
   ("Life Works alert: Jordan would like a check-in (crisis, 7:40 PM). Please reach out soon.").
   - Tier 1: no text, it waits on the review list.
   - Tier 2: the person's counselor in business hours, on-call staff outside them.
   - Tier 3: the counselor always, plus on-call outside business hours.
   - Tier 2+ not acknowledged within 15 minutes: texted to supervisors (once).
   Every attempt and its delivery status is recorded in `notification`.
3. **Counselor review page** at `/console`. Crisis first; shows the trigger words, the
   messages before them, what the app showed and what the person tapped. Staff can
   acknowledge an alert and close it with a note. Counselors see their own people (and
   anything routed to them); supervisors see everyone. Every view is logged in `access_log`.
4. **A seam for Zoey's language model** (`POST /v1/zoey/phrase`, `src/zoey.ts`). With no
   model it returns the authored text. A future model's wording must pass the app's
   `validateReply()` rules, and crisis turns never reach it.

The database itself refuses to change or delete recorded evidence (triggers in `src/schema.sql`).

5. **Chat** with the person's LifeCircle (`POST /v1/messages`, `GET /v1/messages?after=`).
   - To their counselor: kept on the server; the counselor reads and replies under
     **Messages** on `/console` and gets one content-free text ("Life Works: Jordan sent
     you a message.") per batch of unread messages. Supervisors can cover.
   - To anyone else (sponsor, sister): texted from the Life Works number, and their text
     replies come back through `POST /v1/sms/inbound` (Twilio webhook, signature checked).
     Staff never see these conversations.
   - Messages can't be edited or deleted. Messages that trip the app's crisis screen are
     outlined in red for the counselor.

## Try it locally

```bash
npm install
npm run demo        # in-memory database, demo staff (Maya, Sam) and Jordan; prints sign-in keys
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
| `PUBLIC_URL` | This server's public https address. With `TWILIO_AUTH_TOKEN`, turns on `/v1/sms/inbound` for texts back from LifeCircle members (set the same URL as the Twilio number's incoming-message webhook). |

Add real staff and people (each key is printed once; only its hash is stored):

```bash
DATABASE_URL=... npm run admin -- add-staff maya "Maya Torres" +15095550100 counselor [--on-call]
DATABASE_URL=... npm run admin -- add-person jordan Jordan maya
```

Point the app at the server by building it with `EXPO_PUBLIC_LIFEWORKS_API_URL` and
`EXPO_PUBLIC_LIFEWORKS_DEVICE_KEY` set.

## Before real people use it

- Twilio, hosting (AWS) and any language model need signed BAAs (build plan sec. 09).
- Staff sign-in keys are a pilot stand-in for real sign-in with MFA. The device key baked
  into an app build is a stand-in for enrolling each phone with a one-time code.
- Run behind HTTPS. Add rate limiting, a consent table (emergency-disclosure scope),
  per-organisation settings and row-level security as more organisations come on.
