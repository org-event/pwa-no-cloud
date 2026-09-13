import { describe, expect, it } from 'vitest';
import {
  fingerprintOf,
  generateKeyPair,
  publicKeyFromSecret,
} from './index.ts';
import {
  VAULT_PREFIX,
  VAULT_STORAGE_KEY,
  clearVaultStorage,
  decodeVaultRecord,
  encodeVaultRecord,
  loadVaultFromStorage,
  openSecretKey,
  saveVaultToStorage,
  sealSecretKey,
} from './vault.ts';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    raw: map,
  };
};

describe('identity vault', () => {
  it('round-trips a secret key with the master passphrase', async () => {
    const pair = await generateKeyPair();
    const sealed = await sealSecretKey(pair.secretKey, 'correct horse battery');
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const opened = await openSecretKey(sealed.value, 'correct horse battery');
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value).toEqual(pair.secretKey);

    const pub = await publicKeyFromSecret(opened.value);
    expect(fingerprintOf(pub)).toBe(fingerprintOf(pair.publicKey));
  });

  it('rejects a wrong passphrase', async () => {
    const pair = await generateKeyPair();
    const sealed = await sealSecretKey(pair.secretKey, 'right-phrase');
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const opened = await openSecretKey(sealed.value, 'wrong-phrase');
    expect(opened.ok).toBe(false);
  });

  it('stores only sealed payload in storage', async () => {
    const pair = await generateKeyPair();
    const sealed = await sealSecretKey(pair.secretKey, 'phrase');
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const storage = memoryStorage();
    saveVaultToStorage(storage, sealed.value);
    const packed = storage.getItem(VAULT_STORAGE_KEY) ?? '';
    expect(packed.startsWith(VAULT_PREFIX)).toBe(true);
    const { bytesToHex } = await import('./encoding.ts');
    expect(packed.includes(bytesToHex(pair.secretKey))).toBe(false);

    const loaded = loadVaultFromStorage(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const opened = await openSecretKey(loaded.value, 'phrase');
    expect(opened.ok).toBe(true);

    const roundTrip = decodeVaultRecord(encodeVaultRecord(sealed.value));
    expect(roundTrip.ok).toBe(true);

    clearVaultStorage(storage);
    expect(loadVaultFromStorage(storage).ok).toBe(false);
  });
});
