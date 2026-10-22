# Life Works to-do

Items Ed has put off for later. Not started.

## Privacy (from the safety and privacy review, Oct 2026)

- [ ] **Encrypt health data on the phone.** Moods, check-ins, notes and saved
      questions sit in AsyncStorage as plain JSON. Move them to an encrypted
      store (key in the iOS Keychain / Android Keystore via expo-secure-store).
- [ ] **Keep health data out of cloud backups.** Exclude the app's data from
      iCloud and Android Auto Backup (`android:allowBackup="false"` or backup
      rules; iOS "do not back up" on the data file).
- [ ] App lock (PIN or Face ID) before showing check-ins or LifePath.
- [ ] Privacy wording: say plainly what stays on the phone and what doesn't.

## Safety follow-ups

- [ ] Clinician review of the crisis patterns in `src/zoey/safety.ts` and the
      urgent replies (withdrawal, abuse) in `src/zoey/answers.ts`.
- [ ] Server-side classifier from the build plan; the on-device patterns are
      only the offline floor.
- [ ] Whole-word mood tagging in check-ins (`extractTags`).
- [ ] Local log of crisis-screen events (no message text) for the care team.

## Server (first version in `server/`)

- [ ] Sign BAAs and set up Twilio, then hosting; add the real staff and people.
- [ ] Real staff sign-in (MFA) and per-phone enrollment codes instead of keys.
- [ ] Consent table with the emergency-disclosure scope; rate limiting; HTTPS.
