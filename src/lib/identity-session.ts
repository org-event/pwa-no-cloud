/**
 * In-memory unlocked identity + sealed vault helpers for onboarding UI (S1.6).
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
  type KeyPair,
  type VaultStorage,
} from '@/domain/identity/index.ts';

export type UnlockedIdentity = {
  keyPair: KeyPair;
  fingerprint: string;
  displayFingerprint: string;
};

export type IdentitySessionResult =
  | { ok: true; value: UnlockedIdentity }
  | { ok: false; code: string; message: string };

const toUnlocked = (keyPair: KeyPair): UnlockedIdentity => {
  const fingerprint = fingerprintOf(keyPair.publicKey);
  return {
    keyPair,
    fingerprint,
    displayFingerprint: formatFingerprint(fingerprint),
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
  return { ok: true, value: toUnlocked(derived.value), mnemonic };
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
  return { ok: true, value: toUnlocked(keyPair) };
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
  return {
    ok: true,
    value: toUnlocked({ secretKey: opened.value, publicKey }),
  };
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
  return { ok: true, value: toUnlocked(derived.value) };
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
  return { ok: true, value: toUnlocked(restored.value) };
};

export const exportBackupText = async (
  identity: UnlockedIdentity,
  passphrase: string,
): Promise<
  | { ok: true; text: string; fileName: string }
  | { ok: false; code: string; message: string }
> => {
  const backup = await createIdentityBackup(
    identity.keyPair.secretKey,
    passphrase,
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
  return {
    ok: true,
    value: toUnlocked({ secretKey: opened.value, publicKey }),
  };
};

export const enableBiometricUnlock = async (
  storage: VaultStorage,
  identity: UnlockedIdentity,
): Promise<IdentitySessionResult & { mode?: string }> => {
  const registered = await registerBiometricUnlock(
    storage,
    identity.keyPair.secretKey,
    {
      userId: identity.fingerprint,
      displayName: identity.displayFingerprint,
    },
  );
  if (!registered.ok) return registered;
  return { ok: true, value: identity, mode: registered.value.mode };
};
