import { describe, expect, it } from 'vitest';
import {
  openSecretForBiometricTest,
  sealSecretForBiometricTest,
  hasBiometricUnlock,
  clearBiometricUnlock,
  loadBiometricRecord,
  WEBAUTHN_STORAGE_KEY,
} from './webauthn-unlock.ts';
import type { VaultStorage } from './vault.ts';

const memoryStorage = (): VaultStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
};

describe('webauthn unlock seal helpers (S1.7)', () => {
  it('round-trips secret bytes with a wrap key', async () => {
    const secret = crypto.getRandomValues(new Uint8Array(32));
    const wrap = crypto.getRandomValues(new Uint8Array(32));
    const sealed = await sealSecretForBiometricTest(secret, wrap);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const opened = await openSecretForBiometricTest(sealed.value, wrap);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect([...opened.value]).toEqual([...secret]);
  });

  it('persists and clears biometric record metadata', () => {
    const storage = memoryStorage();
    expect(hasBiometricUnlock(storage)).toBe(false);
    storage.setItem(
      WEBAUTHN_STORAGE_KEY,
      JSON.stringify({
        v: 1,
        credentialId: 'abc',
        iv: 'dGVzdA',
        ciphertext: 'dGVzdA',
        mode: 'local-wrap',
        wrapKey: 'dGVzdA',
      }),
    );
    expect(hasBiometricUnlock(storage)).toBe(true);
    expect(loadBiometricRecord(storage).ok).toBe(true);
    clearBiometricUnlock(storage);
    expect(hasBiometricUnlock(storage)).toBe(false);
  });
});
