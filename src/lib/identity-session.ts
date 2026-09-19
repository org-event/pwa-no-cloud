/**
 * In-memory unlocked identity + sealed vault helpers for onboarding UI (S1.6).
 * Public view never carries secretKey (ADR 0002); secret is an OwnedSecret handoff.
 */

import {
  backupFileName,
  createIdentityBackup,
  createMnemonic,
  encodeIdentityBackup,
  fingerprintOf,
  formatFingerprint,
  generateKeyPair,
  keyPairFromMnemonic,
  loadVaultFromStorage,
  openSecretKey,
  publicKeyFromSecret,
  registerBiometricUnlock,
  restoreKeyPairFromBackup,
  saveVaultToStorage,
  sealSecretKey,
  unlockSecretWithBiometrics,
  clearBiometricUnlock,
  type PublicKeyBytes,
  type VaultStorage,
} from '@/domain/identity/index.ts';
import { OwnedSecret, withBorrowedKeyPair } from '@/lib/owned-secret.ts';

/** Public identity fields safe to hold in Vue. */
export type UnlockedIdentity = {
  fingerprint: string;
  displayFingerprint: string;
};

/** Unlock handoff: public view + exclusive OwnedSecret (move into store). */
export type IdentityUnlock = {
  view: UnlockedIdentity;
  secret: OwnedSecret;
  publicKey: PublicKeyBytes;
};

export type IdentitySessionResult =
  | { ok: true; value: IdentityUnlock }
  | { ok: false; code: string; message: string };

const toUnlock = (
  secretKey: Uint8Array,
  publicKey: PublicKeyBytes,
): IdentityUnlock => {
  const fingerprint = fingerprintOf(publicKey);
  const secret = new OwnedSecret(secretKey);
  secretKey.fill(0);
  return {
    view: {
      fingerprint,
      displayFingerprint: formatFingerprint(fingerprint),
    },
    secret,
    publicKey,
  };
};

export const hasSealedVault = (storage: VaultStorage): boolean => {
  return loadVaultFromStorage(storage).ok;
};

export const createIdentityWithMnemonic = async (
  storage: VaultStorage,
  passphrase: string,
): Promise<IdentitySessionResult & { mnemonic?: string }> => {
  if (!passphrase) {
    return {
      ok: false,
      code: 'empty-passphrase',
      message: 'Нужна мастер-фраза',
    };
  }
  const mnemonic = createMnemonic(128);
  const derived = await keyPairFromMnemonic(mnemonic);
  if (!derived.ok) return derived;
  const sealed = await sealSecretKey(derived.value.secretKey, passphrase);
  if (!sealed.ok) return sealed;
  saveVaultToStorage(storage, sealed.value);
  const unlock = toUnlock(derived.value.secretKey, derived.value.publicKey);
  return { ok: true, value: unlock, mnemonic };
};

export const createIdentityRandom = async (
  storage: VaultStorage,
  passphrase: string,
): Promise<IdentitySessionResult> => {
  if (!passphrase) {
    return {
      ok: false,
      code: 'empty-passphrase',
      message: 'Нужна мастер-фраза',
    };
  }
  const keyPair = await generateKeyPair();
  const sealed = await sealSecretKey(keyPair.secretKey, passphrase);
  if (!sealed.ok) return sealed;
  saveVaultToStorage(storage, sealed.value);
  return { ok: true, value: toUnlock(keyPair.secretKey, keyPair.publicKey) };
};

export const unlockIdentity = async (
  storage: VaultStorage,
  passphrase: string,
): Promise<IdentitySessionResult> => {
  const vault = loadVaultFromStorage(storage);
  if (!vault.ok) return vault;
  const opened = await openSecretKey(vault.value, passphrase);
  if (!opened.ok) return opened;
  const publicKey = await publicKeyFromSecret(opened.value);
  return { ok: true, value: toUnlock(opened.value, publicKey) };
};

export const restoreIdentityFromMnemonic = async (
  storage: VaultStorage,
  mnemonic: string,
  passphrase: string,
): Promise<IdentitySessionResult> => {
  if (!passphrase) {
    return {
      ok: false,
      code: 'empty-passphrase',
      message: 'Нужна мастер-фраза',
    };
  }
  const derived = await keyPairFromMnemonic(mnemonic);
  if (!derived.ok) return derived;
  const sealed = await sealSecretKey(derived.value.secretKey, passphrase);
  if (!sealed.ok) return sealed;
  saveVaultToStorage(storage, sealed.value);
  clearBiometricUnlock(storage);
  return {
    ok: true,
    value: toUnlock(derived.value.secretKey, derived.value.publicKey),
  };
};

export const restoreIdentityFromBackupText = async (
  storage: VaultStorage,
  backupText: string,
  passphrase: string,
): Promise<IdentitySessionResult> => {
  const restored = await restoreKeyPairFromBackup(backupText, passphrase);
  if (!restored.ok) return restored;
  const sealed = await sealSecretKey(restored.value.secretKey, passphrase);
  if (!sealed.ok) return sealed;
  saveVaultToStorage(storage, sealed.value);
  clearBiometricUnlock(storage);
  return {
    ok: true,
    value: toUnlock(restored.value.secretKey, restored.value.publicKey),
  };
};

export const exportBackupText = async (
  unlock: IdentityUnlock,
  passphrase: string,
): Promise<
  | { ok: true; text: string; fileName: string }
  | { ok: false; code: string; message: string }
> => {
  const backup = await withBorrowedKeyPair(
    unlock.secret,
    unlock.publicKey,
    (keyPair) => createIdentityBackup(keyPair.secretKey, passphrase),
  );
  if (!backup.ok) return backup;
  return {
    ok: true,
    text: encodeIdentityBackup(backup.value),
    fileName: backupFileName(backup.value.fingerprint),
  };
};

export const unlockIdentityWithBiometrics = async (
  storage: VaultStorage,
): Promise<IdentitySessionResult> => {
  const opened = await unlockSecretWithBiometrics(storage);
  if (!opened.ok) return opened;
  const publicKey = await publicKeyFromSecret(opened.value);
  return { ok: true, value: toUnlock(opened.value, publicKey) };
};

export const enableBiometricUnlock = async (
  storage: VaultStorage,
  unlock: IdentityUnlock,
): Promise<
  | { ok: true; value: UnlockedIdentity; mode?: string }
  | { ok: false; code: string; message: string }
> => {
  const registered = await withBorrowedKeyPair(
    unlock.secret,
    unlock.publicKey,
    (keyPair) =>
      registerBiometricUnlock(storage, keyPair.secretKey, {
        userId: unlock.view.fingerprint,
        displayName: unlock.view.displayFingerprint,
      }),
  );
  if (!registered.ok) return registered;
  return { ok: true, value: unlock.view, mode: registered.value.mode };
};
