import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AESEncryptionKey,
  AESKeySize,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Cipher, createPlainVault, createVault, Keychain, Vault } from './vault';

const KEY_NAME = 'lifeworks.datakey';

// THIS_DEVICE_ONLY keeps the key out of iCloud Keychain and encrypted backups,
// so the data can only ever be opened on this phone.
const keychainOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const keychain: Keychain = {
  get: () => SecureStore.getItemAsync(KEY_NAME, keychainOptions),
  set: (k) => SecureStore.setItemAsync(KEY_NAME, k, keychainOptions),
};

let imported: { raw: string; key: Promise<AESEncryptionKey> } | null = null;
const keyFor = (raw: string) => {
  if (imported?.raw !== raw) imported = { raw, key: AESEncryptionKey.import(raw, 'base64') };
  return imported.key;
};

const cipher: Cipher = {
  newKey: async () => (await AESEncryptionKey.generate(AESKeySize.AES256)).encoded('base64'),
  seal: async (raw, plaintext) => (await aesEncryptAsync(plaintext, await keyFor(raw))).combined('base64'),
  open: async (raw, sealed) => aesDecryptAsync(AESSealedData.fromCombined(sealed), await keyFor(raw)),
};

export const deviceVault: Vault =
  Platform.OS === 'web' ? createPlainVault(AsyncStorage) : createVault(AsyncStorage, keychain, cipher);
