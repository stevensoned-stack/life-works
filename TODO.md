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
