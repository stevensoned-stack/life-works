# Life Works

Mobile app for people in recovery, by Edge Consulting. Built with Expo (SDK 58) and React Native, TypeScript.

Built so far:

- **Step 1**: app foundation, daily check-ins with Zoey, mood tracking (LifePath).
- **Step 2**: clean time and milestones, LifeCircle (sponsor and support people, one-tap call/text, quick messages), Calendar with reminders, meeting finder (sample listings), local notifications for check-ins, reminders and appointments.
- **Step 3**: AskZoey answers questions from an authored answer library (26 answers, 6 topics). Crisis words go to the 988 screen first, medication questions go to the prescriber, and anything unknown goes to the coordinator or is saved for the next appointment.
- **Safety update**: crisis detection rebuilt after the safety review. It catches overdose and ingestion, suicide and self-harm methods, passive wishes to die, harm to others, misspellings and stretched words, and Spanish. Abuse or assault and withdrawal or detox get a reply that leads with 911, hotlines and the coordinator. Being homeless or evicted (including typos and Spanish) gets a reply that leads with the coordinator and 211. Unmatched questions always show 988 / 911. Deferred privacy work is in `TODO.md`.
- **Local help**: a Local help screen (menu) with Spokane-area shelters, housing programs, eviction legal help, food and crisis lines, each checked against a public source on 2026-10-21. Zoey's housing replies link to it. Listings live in `src/data/resources.ts`; add a region there to launch somewhere else.
- **Safety alerts**: every time the safety screen fires, the app saves the trigger words, the message, the 6 messages before it, what was shown and what the person tapped (`src/safety/events.ts`, `state.safetyEvents`, append-only). With the person's consent (asked at onboarding, toggle in Settings) an alert to the coordinator is queued. Delivery: the person gets a "Text Maya to check on me" button (crisis screen and urgent replies) that opens their own messages app with a short alert that never quotes what they wrote (`alertText`). Automatic delivery needs the Life Works server, which isn't built.
- **Yes/no decision trees**: check-in questions answered with taps (Yes / No / I'm not sure), authored in one file, `src/zoey/trees.ts` (12 trees: feeling bad, sleep, cravings, feeling alone, housing, money, people, meds, work, morning meds, going well, meetings). Typed answers still pass the safety screen first; unsafe tapped answers raise the same help and safety alert as typed danger words. Tests walk every path. Settings → "See what Maya sees" previews the counselor's review list with mark-reviewed notes.

Data is stored on the device only. LifeEvent, LifeGoals, MyHome, Chat and Check In/Out still show as "coming soon".

## Run it

```bash
npm install
npx expo start          # scan the QR code with the Expo Go app on your phone
npx expo start --web    # or open in a browser
```

## Tests

```bash
npm test   # question routing and reply rules (tests/zoey.test.ts)
```

## Where things live

- `App.tsx` – navigation between screens
- `src/screens/` – Home, AskZoey (check-in), LifePath (mood history), Settings, onboarding, coming-soon
- `src/zoey/copy.ts` – everything Zoey says in the daily check-in (needs clinician review)
- `src/zoey/answers.ts` – Zoey's answer library (needs clinician review)
- `src/zoey/ask.ts` – question routing, plus the reply rules any future AI wording must pass
- `src/zoey/safety.ts` – crisis patterns that trigger the 988 / 911 screen and the urgent replies (abuse, withdrawal, housing, about to use, pregnant and using, worried about someone else) (needs crisis-clinician review)
- `src/data/` – types, demo data for "Jordan", and on-device storage
- `src/recovery/` – milestones, meeting listings (samples), call/text helpers, notification scheduling

## Rules carried over from the build plan

- Mood is only ever tapped by the person (−2 to +2); nothing is inferred.
- Zoey reflects and routes to people; she does not diagnose or give treatment advice.
- Crisis screen leads with 988 (call or text), 911 and Crisis Text Line. The old 1-800-273-8255 number is not used.
- Check-in text is versioned (`FLOW_VERSION`) and saved with each check-in.
