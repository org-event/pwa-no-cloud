/**
 * Encrypted identity backup file export/import (S1.5).
 */

import { getPublicKeyAsync } from '@noble/ed25519';
import { fingerprintOf } from './encoding.ts';
import type { CryptoResult, IdentityId, KeyPair, SecretKeyBytes } from './types.ts';
import {
  openSecretKey,
  sealSecretKey,
  type VaultRecord,
} from './vault.ts';

export const BACKUP_PREFIX = 'nb1.';
export const BACKUP_VERSION = 1 as const;

export type IdentityBackup = {
  v: typeof BACKUP_VERSION;
  kind: 'nocloud-identity-backup';
  fingerprint: IdentityId;
  vault: VaultRecord;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): CryptoResult<Uint8Array> => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, code: 'bad-base64', message: 'invalid base64url' };
  }
};

export const createIdentityBackup = async (
  secretKey: SecretKeyBytes,
  passphrase: string,
): Promise<CryptoResult<IdentityBackup>> => {
  const sealed = await sealSecretKey(secretKey, passphrase);
  if (!sealed.ok) return sealed;
  try {
    const publicKey = await getPublicKeyAsync(secretKey);
    return {
      ok: true,
      value: {
        v: BACKUP_VERSION,
        kind: 'nocloud-identity-backup',
        fingerprint: fingerprintOf(publicKey),
        vault: sealed.value,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'backup-failed',
      message: error instanceof Error ? error.message : 'backup failed',
    };
  }
};

export const encodeIdentityBackup = (backup: IdentityBackup): string => {
  return BACKUP_PREFIX + toBase64Url(enc.encode(JSON.stringify(backup)));
};

export const decodeIdentityBackup = (
  text: string,
): CryptoResult<IdentityBackup> => {
  const raw = text.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!raw.startsWith(BACKUP_PREFIX)) {
    return { ok: false, code: 'bad-prefix', message: 'expected nb1. backup' };
  }
  const body = fromBase64Url(raw.slice(BACKUP_PREFIX.length));
  if (!body.ok) return body;
  try {
    const parsed = JSON.parse(dec.decode(body.value)) as IdentityBackup;
    if (
      parsed?.v !== BACKUP_VERSION ||
      parsed.kind !== 'nocloud-identity-backup' ||
      typeof parsed.fingerprint !== 'string' ||
      !parsed.vault
    ) {
      return { ok: false, code: 'bad-shape', message: 'invalid backup payload' };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid backup json' };
  }
};

export const restoreKeyPairFromBackup = async (
  text: string,
  passphrase: string,
): Promise<CryptoResult<KeyPair>> => {
  const decoded = decodeIdentityBackup(text);
  if (!decoded.ok) return decoded;
  const opened = await openSecretKey(decoded.value.vault, passphrase);
  if (!opened.ok) return opened;
  const publicKey = await getPublicKeyAsync(opened.value);
  if (fingerprintOf(publicKey) !== decoded.value.fingerprint) {
    return {
      ok: false,
      code: 'fingerprint-mismatch',
      message: 'backup fingerprint does not match key',
    };
  }
  return { ok: true, value: { secretKey: opened.value, publicKey } };
};

export const backupFileName = (fingerprint: IdentityId): string => {
  return `nocloud-identity-${fingerprint}.nb1.txt`;
};
