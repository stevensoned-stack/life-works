// Run with: npm test
// Checks the encrypted store: nothing readable is written, old plain data is
// moved over and deleted, and a missing or locked key never destroys data.
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { Cipher, createVault, fromUtf8, Keychain, KV, LEGACY_KEY, SEALED_KEY, utf8 } from '../src/data/vault';

let passed = 0;
const test = async (name: string, fn: () => Promise<void> | void) => {
  try {
    await fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n  ${(e as Error).message}`);
    process.exitCode = 1;
  }
};

const memoryKV = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  const kv: KV & { data: Map<string, string> } = {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
  };
  return kv;
};

const memoryKeychain = (key: string | null = null) => {
  const kc: Keychain & { key: string | null } = {
    key,
    get: async () => kc.key,
    set: async (k) => void (kc.key = k),
  };
  return kc;
};

// Same AES-256-GCM as expo-crypto, from Node's WebCrypto.
const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
const imp = (k: string) => webcrypto.subtle.importKey('raw', unb64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
const cipher: Cipher = {
  newKey: async () => b64(webcrypto.getRandomValues(new Uint8Array(32))),
  async seal(k, plaintext) {
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, await imp(k), plaintext));
    return b64(new Uint8Array([...iv, ...ct]));
  },
  async open(k, sealed) {
    const all = unb64(sealed);
    return new Uint8Array(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await imp(k), all.slice(12)));
  },
};

const state = { moods: [{ id: 'a', value: 2, note: 'rough day, craving after work 😣' }], checkins: [] };
const json = JSON.stringify(state);

(async () => {
  await test('utf8 round-trips accents, emoji and Spanish', () => {
    for (const s of ['', 'plain', 'ñandú, ¿qué tal?', 'feeling 😣🙏🏽 today', '中文', '\u{1F600}x']) {
      assert.equal(fromUtf8(utf8(s)), s);
      assert.deepEqual(utf8(s), new TextEncoder().encode(s));
    }
  });

  await test('fresh install: makes a key, saves only ciphertext, reads it back', async () => {
    const kv = memoryKV();
    const kc = memoryKeychain();
    const v = createVault(kv, kc, cipher);
    assert.equal(await v.load(), null);
    assert.ok(kc.key, 'key created');
    await v.save(json);
    const stored = kv.data.get(SEALED_KEY)!;
    assert.ok(stored);
    assert.ok(!stored.includes('craving') && !Buffer.from(stored, 'base64').toString().includes('craving'));
    assert.equal(kv.data.has(LEGACY_KEY), false);
    assert.deepEqual(await createVault(kv, kc, cipher).load(), state);
  });

  await test('plain data from before encryption is sealed and the plain copy deleted', async () => {
    const kv = memoryKV({ [LEGACY_KEY]: json });
    const kc = memoryKeychain();
    assert.deepEqual(await createVault(kv, kc, cipher).load(), state);
    assert.equal(kv.data.has(LEGACY_KEY), false);
    assert.deepEqual(await createVault(kv, kc, cipher).load(), state);
  });

  await test('a migration that stopped halfway still removes the plain copy', async () => {
    const kv = memoryKV();
    const kc = memoryKeychain();
    const v = createVault(kv, kc, cipher);
    await v.load();
    await v.save(json);
    kv.data.set(LEGACY_KEY, json);
    assert.deepEqual(await createVault(kv, kc, cipher).load(), state);
    assert.equal(kv.data.has(LEGACY_KEY), false);
  });

  await test('if sealing fails during migration, the plain copy is kept for next time', async () => {
    const kv = memoryKV({ [LEGACY_KEY]: json });
    const broken: Cipher = { ...cipher, seal: async () => Promise.reject(new Error('no')) };
    assert.deepEqual(await createVault(kv, memoryKeychain(), broken).load(), state);
    assert.equal(kv.data.get(LEGACY_KEY), json);
  });

  await test('locked keychain: loads nothing, makes no key, writes nothing', async () => {
    const kv = memoryKV({ [LEGACY_KEY]: json });
    let made = false;
    const locked: Keychain = { get: () => Promise.reject(new Error('locked')), set: async () => void (made = true) };
    const v = createVault(kv, locked, cipher);
    assert.equal(await v.load(), null);
    await v.save('{"moods":[]}');
    assert.equal(made, false);
    assert.equal(kv.data.get(LEGACY_KEY), json);
    assert.equal(kv.data.has(SEALED_KEY), false);
  });

  await test("data restored from another phone (key didn't come along) can't be read and gets replaced", async () => {
    const kv = memoryKV();
    const old = memoryKeychain();
    const v1 = createVault(kv, old, cipher);
    await v1.load();
    await v1.save(json);
    const kc = memoryKeychain(); // new phone, empty keychain
    const v2 = createVault(kv, kc, cipher);
    assert.equal(await v2.load(), null);
    await v2.save('{"moods":[]}');
    assert.deepEqual(await createVault(kv, kc, cipher).load(), { moods: [] });
  });

  await test('fast saves: the newest state is the one that sticks', async () => {
    const kv = memoryKV();
    const kc = memoryKeychain();
    let n = 0;
    // Earlier writes finish later, as they might on a busy phone.
    const slow: Cipher = {
      ...cipher,
      seal: async (k, p) => {
        const s = await cipher.seal(k, p);
        await new Promise((r) => setTimeout(r, 20 - 5 * n++));
        return s;
      },
    };
    const v = createVault(kv, kc, slow);
    await v.load();
    const writes = [1, 2, 3, 4].map((i) => v.save(JSON.stringify({ i })));
    await Promise.all(writes);
    assert.deepEqual(await createVault(kv, kc, cipher).load(), { i: 4 });
  });

  console.log(`${passed} vault checks passed`);
})();
