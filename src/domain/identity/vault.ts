/**
 * Encrypt identity secret key with a master passphrase (S1.3).
 * Web Crypto: PBKDF2-SHA-256 → AES-GCM. Plaintext key never written by this module.
 */

import type { CryptoResult, SecretKeyBytes } from './types.ts';

export const VAULT_VERSION = 1 as const;
export const VAULT_PREFIX = 'nv1.';

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const SECRET_BYTES = 32;

export type VaultRecord = {
  v: typeof VAULT_VERSION;
  salt: string;
  iv: string;
  ciphertext: string;
};

const enc = new TextEncoder();

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

const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
};

const deriveAesKey = async (
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const sealSecretKey = async (
  secretKey: SecretKeyBytes,
  passphrase: string,
): Promise<CryptoResult<VaultRecord>> => {
  if (secretKey.byteLength !== SECRET_BYTES) {
    return { ok: false, code: 'bad-secret', message: 'secret key must be 32 bytes' };
  }
  if (!passphrase) {
    return { ok: false, code: 'empty-passphrase', message: 'passphrase required' };
  }
  try {
    const salt = randomBytes(SALT_BYTES);
    const iv = randomBytes(IV_BYTES);
    const key = await deriveAesKey(passphrase, salt);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      secretKey,
    );
    return {
      ok: true,
      value: {
        v: VAULT_VERSION,
        salt: toBase64Url(salt),
        iv: toBase64Url(iv),
        ciphertext: toBase64Url(new Uint8Array(encrypted)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'seal-failed',
      message: error instanceof Error ? error.message : 'seal failed',
    };
  }
};

export const openSecretKey = async (
  record: VaultRecord,
  passphrase: string,
): Promise<CryptoResult<SecretKeyBytes>> => {
  if (!passphrase) {
    return { ok: false, code: 'empty-passphrase', message: 'passphrase required' };
  }
  if (record.v !== VAULT_VERSION) {
    return { ok: false, code: 'bad-version', message: 'unsupported vault version' };
  }
  const salt = fromBase64Url(record.salt);
  const iv = fromBase64Url(record.iv);
  const ciphertext = fromBase64Url(record.ciphertext);
  if (!salt.ok) return salt;
  if (!iv.ok) return iv;
  if (!ciphertext.ok) return ciphertext;
  try {
    const key = await deriveAesKey(passphrase, salt.value);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.value },
      key,
      ciphertext.value,
    );
    const secretKey = new Uint8Array(plain);
    if (secretKey.byteLength !== SECRET_BYTES) {
      return { ok: false, code: 'bad-secret', message: 'decrypted key length invalid' };
    }
    return { ok: true, value: secretKey };
  } catch {
    return { ok: false, code: 'open-failed', message: 'wrong passphrase or corrupt vault' };
  }
};

export const encodeVaultRecord = (record: VaultRecord): string => {
  return VAULT_PREFIX + toBase64Url(enc.encode(JSON.stringify(record)));
};

export const decodeVaultRecord = (text: string): CryptoResult<VaultRecord> => {
  const raw = text.trim();
  if (!raw.startsWith(VAULT_PREFIX)) {
    return { ok: false, code: 'bad-prefix', message: 'expected nv1. vault' };
  }
  const body = fromBase64Url(raw.slice(VAULT_PREFIX.length));
  if (!body.ok) return body;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(body.value)) as VaultRecord;
    if (
      parsed?.v !== VAULT_VERSION ||
      typeof parsed.salt !== 'string' ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.ciphertext !== 'string'
    ) {
      return { ok: false, code: 'bad-shape', message: 'invalid vault record' };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid vault json' };
  }
};

export type VaultStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const VAULT_STORAGE_KEY = 'nocloud.identity.vault';

/** Persist only ciphertext; never the raw secret. */
export const saveVaultToStorage = (
  storage: VaultStorage,
  record: VaultRecord,
): void => {
  storage.setItem(VAULT_STORAGE_KEY, encodeVaultRecord(record));
};

export const loadVaultFromStorage = (
  storage: VaultStorage,
): CryptoResult<VaultRecord> => {
  const raw = storage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return { ok: false, code: 'missing', message: 'no vault in storage' };
  return decodeVaultRecord(raw);
};

export const clearVaultStorage = (storage: VaultStorage): void => {
  storage.removeItem(VAULT_STORAGE_KEY);
};
