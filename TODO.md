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
      The admin setup page (`/admin`) has its own name-and-password sign-in; add MFA
      to it too before launch, and serve it only over HTTPS.
- [ ] Consent table with the emergency-disclosure scope; rate limiting; HTTPS.

## Zoey's voice

- [ ] Listen to Zoey's voice on a real iPhone and Android phone and pick the
      voice by ear (`pickVoice` in `src/zoey/voice.ts`). iPhones sound much
      better with a downloaded Enhanced/Premium voice (Ava or Zoe).
- [ ] Optional: a cloud neural voice (Azure, Polly, ElevenLabs) for a more
      natural sound. Zoey's words can include health details, so this needs a
      BAA with the provider first.
