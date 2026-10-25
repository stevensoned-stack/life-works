# Life Works to-do

Items Ed has put off for later.

## Privacy (from the safety and privacy review, Oct 2026)

- [x] **Encrypt health data on the phone.** Done Oct 2026: everything the app
      saves is sealed with AES-256-GCM (`src/data/vault.ts`); the key is in the
      iOS Keychain / Android Keystore, this-device-only. Old plain data is
      moved over and deleted on first launch. The web preview is not encrypted.
- [x] **Keep health data out of cloud backups.** Done Oct 2026: Android
      `allowBackup: false`, iOS `RCTAsyncStorageExcludeFromBackup`. Android 12+
      can still copy the encrypted file in a phone-to-phone transfer, but the
      key doesn't go with it, so it can't be read there.
- [ ] App lock (PIN or Face ID) before showing check-ins or LifePath.
- [x] Privacy wording: say plainly what stays on the phone and what doesn't.
      Updated for encryption (Settings, LifePath, onboarding, Zoey's answer).
- [ ] Try encryption and the old-data move on a real iPhone and Android phone
      (Expo Go is enough for encryption; the backup settings only apply in a
      real build). So far only tested with Node's AES.

## Safety follow-ups

- [ ] Clinician review of the crisis patterns in `src/zoey/safety.ts` and the
      urgent replies (withdrawal, abuse) in `src/zoey/answers.ts`.
- [ ] Clinician review of the hopelessness follow-up (Oct 2026): "it's hopeless",
      "no hope", "nothing gives me hope" get "are you safe right now?" first;
      after "Yes, I'm safe" Zoey asks what inspires them (`hopeless` tree in
      `src/zoey/trees.ts`). Is that the right order, should these also alert
      the counselor, and is the wording okay? Same check for the faith and
      12-step trees (`faith`, `program`).
- [ ] Clinician review of the misspelling catches (Oct 2026, `normalize` and
      `CHECK` in `src/zoey/safety.ts`): "dyeing", "dieing", "dyin" and "I'm
      dying" now ask "I'm really worried about you. Are you safe right now?";
      "want to dye" and "want to be dead" go to crisis. The crisis and
      safety-check lines changed from "thank you for telling me" to "I'm really
      worried about you" (Ed's request). Is that wording okay?
      Also (Oct 25): "die" or "dye" anywhere (even "my dog might die") now asks
      "are you safe?"; only hair/clothes dye and idioms like "die of
      embarrassment" are let through. Too broad?
- [ ] Clinician review of the "remember danger words" check-ins (Oct 2026,
      `src/zoey/watch.ts`): after danger words, every later message gets "I'm
      still worried about you" plus a question and help. After "I'm safe" (or
      housing only) it's every third message, and it never turns off for that
      chat. Is that too often or not enough? Should "I'm fine" count as safe?
- [ ] Clinician review of the answers added in the Oct 2026 message review
      (`src/zoey/answers.ts`: self-worth, calm, shaky, fentanyl, party, grief,
      ua, relapse-what and the rest), and the new "tired of everything" safety
      check. Authored answers still miss a lot of open-ended talk; the real fix
      is the live model (needs a BAA).
- [ ] Server-side classifier from the build plan; the on-device patterns are
      only the offline floor.
- [ ] Whole-word mood tagging in check-ins (`extractTags`).
- [ ] Local log of crisis-screen events (no message text) for the care team.

## Server (first version in `server/`)

- [ ] Sign BAAs and set up Twilio, then hosting; add the real staff and people.
- [ ] Name the Life Works staff for each role (house manager per Life Works Home,
      case manager, program director, clinical supervisor, on-call) and add them
      with `npm run admin`. `npm run admin -- routing` shows which are still empty.
- [ ] Have a clinician confirm which reports go to which role (`REPORT_ROUTES` in
      `server/src/routing.ts`), especially abuse and the house manager.
- [ ] Real staff sign-in (MFA) and per-phone enrollment codes instead of keys.
- [ ] Consent table with the emergency-disclosure scope; rate limiting; HTTPS.
- [ ] Zoey's live AI answers (`server/src/zoeyLive.ts`, off by default). Before
      turning on for real residents: sign the AWS BAA, request Bedrock model
      access, and have the clinician review the prompt (`server/src/zoeyPrompt.ts`)
      and a set of sample replies. Then set `ZOEY_LIVE_AI=1` and
      `ZOEY_LIVE_AI_APPROVED`. Try the cheaper Haiku model side by side.

## Zoey's voice

- [ ] Listen to Zoey's voice on a real iPhone and Android phone and pick the
      voice by ear (`pickVoice` in `src/zoey/voice.ts`). iPhones sound much
      better with a downloaded Enhanced/Premium voice (Ava or Zoe).
- [ ] Optional: a cloud neural voice (Azure, Polly, ElevenLabs) for a more
      natural sound. Zoey's words can include health details, so this needs a
      BAA with the provider first.
