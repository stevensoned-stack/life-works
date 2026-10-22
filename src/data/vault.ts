// Encrypted storage for everything the app saves (moods, check-ins, notes,
// questions, safety events). The data is sealed with AES-256-GCM; the key lives
// in the iOS Keychain / Android Keystore and never leaves this phone, so a copy
// of the stored data (a backup, a device transfer) can't be read anywhere else.
//
// No React Native imports here so the logic can be tested in Node; the real
// storage, keychain and cipher are wired up in deviceVault.ts.

export type KV = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Holds the one data key. get() resolves null when no key was ever made and
// throws when the keychain can't be reached right now.
export type Keychain = {
  get(): Promise<string | null>;
  set(key: string): Promise<void>;
};

export type Cipher = {
  newKey(): Promise<string>;
  seal(key: string, plaintext: Uint8Array): Promise<string>;
  open(key: string, sealed: string): Promise<Uint8Array>;
};

export const LEGACY_KEY = 'lifeworks:v1'; // plain JSON, before encryption
export const SEALED_KEY = 'lifeworks:v2';

export type Vault = {
  // The saved state, or null when there is none (or none this phone can read).
  load(): Promise<unknown | null>;
  // Queues a write. Writes run one at a time and only the newest waiting state
  // is written, so an older state never lands after a newer one.
  save(json: string): Promise<void>;
};

export function createVault(kv: KV, keychain: Keychain, cipher: Cipher): Vault {
  let key: string | null = null;
  let pending: string | null = null;
  let draining: Promise<void> | null = null;

  const write = async (json: string) => kv.setItem(SEALED_KEY, await cipher.seal(key!, utf8(json)));

  const drain = async () => {
    while (pending !== null) {
      const json = pending;
      pending = null;
      await write(json).catch(() => {});
    }
    draining = null;
  };

  return {
    async load() {
      // If the keychain is locked or broken, don't touch anything: making a
      // new key here would overwrite data we just couldn't read yet. save()
      // stays off until a later launch gets the key.
      let k: string | null;
      try {
        k = await keychain.get();
      } catch {
        return null;
      }

      const sealed = await kv.getItem(SEALED_KEY).catch(() => null);
      if (sealed && k) {
        try {
          const saved = JSON.parse(fromUtf8(await cipher.open(k, sealed)));
          key = k;
          // A plain copy left by a migration that stopped halfway.
          await kv.removeItem(LEGACY_KEY).catch(() => {});
          return saved;
        } catch {
          // Damaged, or sealed with a key this phone doesn't have (restored
          // from another phone). It can't be read; the next save replaces it.
        }
      }

      if (!k) {
        k = await cipher.newKey();
        await keychain.set(k);
      }
      key = k;

      // Data saved before encryption: seal it, then delete the plain copy.
      // If sealing fails the plain copy stays and we try again next launch.
      const legacy = await kv.getItem(LEGACY_KEY).catch(() => null);
      if (!legacy) return null;
      let saved: unknown = null;
      try {
        saved = JSON.parse(legacy);
      } catch {}
      try {
        if (saved !== null) await write(legacy);
        await kv.removeItem(LEGACY_KEY);
      } catch {}
      return saved;
    },

    save(json) {
      if (!key) return Promise.resolve();
      pending = json;
      return (draining ??= drain());
    },
  };
}

// For platforms without a keychain (the web preview): stores plain JSON as
// before. Nothing on the web build is health data from a real person.
export function createPlainVault(kv: KV): Vault {
  return {
    async load() {
      const raw = await kv.getItem(LEGACY_KEY).catch(() => null);
      return raw ? JSON.parse(raw) : null;
    },
    save: (json) => kv.setItem(LEGACY_KEY, json).catch(() => {}),
  };
}

// UTF-8 by hand: Hermes doesn't promise TextDecoder, and the AES API takes
// strings only as base64.
export function utf8(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d < 0xe000) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c >= 0xd800 && c < 0xe000) c = 0xfffd; // lone surrogate
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function fromUtf8(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i++];
    let c: number;
    if (x < 0x80) c = x;
    else if (x < 0xe0) c = ((x & 31) << 6) | (b[i++] & 63);
    else if (x < 0xf0) c = ((x & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else c = ((x & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(c);
  }
  return s;
}
