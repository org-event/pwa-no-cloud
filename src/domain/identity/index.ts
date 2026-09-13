/**
 * Identity domain — Ed25519 keygen / sign / verify (S1.1) + encoding (S1.2).
 * Algorithm is behind this module so it can be swapped later.
 */

import * as ed from '@noble/ed25519';
import type {
  CryptoResult,
  KeyPair,
  PublicKeyBytes,
  SecretKeyBytes,
  SignatureBytes,
} from './types.ts';

export type {
  CryptoErr,
  CryptoOk,
  CryptoResult,
  IdentityId,
  KeyPair,
  PublicKeyBytes,
  SecretKeyBytes,
  SignatureBytes,
} from './types.ts';

export {
  PUBLIC_KEY_PREFIX,
  bytesToHex,
  decodePublicKey,
  encodePublicKey,
  fingerprintOf,
  formatFingerprint,
  hexToBytes,
  meetRoomIdFromFingerprint,
  parsePublicKey,
} from './encoding.ts';

export {
  VAULT_PREFIX,
  VAULT_STORAGE_KEY,
  VAULT_VERSION,
  clearVaultStorage,
  decodeVaultRecord,
  encodeVaultRecord,
  loadVaultFromStorage,
  openSecretKey,
  saveVaultToStorage,
  sealSecretKey,
} from './vault.ts';
export type { VaultRecord, VaultStorage } from './vault.ts';

export {
  createMnemonic,
  isValidMnemonic,
  keyPairFromMnemonic,
  normalizeMnemonic,
} from './mnemonic.ts';
export type { MnemonicStrength } from './mnemonic.ts';

export {
  BACKUP_PREFIX,
  BACKUP_VERSION,
  backupFileName,
  createIdentityBackup,
  decodeIdentityBackup,
  encodeIdentityBackup,
  restoreKeyPairFromBackup,
} from './backup.ts';
export type { IdentityBackup } from './backup.ts';

const enc = new TextEncoder();

export const generateKeyPair = async (): Promise<KeyPair> => {
  const { secretKey, publicKey } = await ed.keygenAsync();
  return { secretKey, publicKey };
};

export const publicKeyFromSecret = async (
  secretKey: SecretKeyBytes,
): Promise<PublicKeyBytes> => {
  return ed.getPublicKeyAsync(secretKey);
};

export const signBytes = async (
  message: Uint8Array,
  secretKey: SecretKeyBytes,
): Promise<SignatureBytes> => {
  return ed.signAsync(message, secretKey);
};

export const signText = async (
  text: string,
  secretKey: SecretKeyBytes,
): Promise<SignatureBytes> => {
  return signBytes(enc.encode(text), secretKey);
};

export const verifyBytes = async (
  signature: SignatureBytes,
  message: Uint8Array,
  publicKey: PublicKeyBytes,
): Promise<boolean> => {
  try {
    return await ed.verifyAsync(signature, message, publicKey);
  } catch {
    return false;
  }
};

export const verifyText = async (
  signature: SignatureBytes,
  text: string,
  publicKey: PublicKeyBytes,
): Promise<boolean> => {
  return verifyBytes(signature, enc.encode(text), publicKey);
};

export const signPayload = async (
  message: Uint8Array,
  secretKey: SecretKeyBytes,
): Promise<CryptoResult<SignatureBytes>> => {
  try {
    const value = await signBytes(message, secretKey);
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      code: 'sign-failed',
      message: error instanceof Error ? error.message : 'sign failed',
    };
  }
};
