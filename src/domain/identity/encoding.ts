/**
 * Stable pubkey encoding and short fingerprints for UX / invite cards (S1.2).
 */

import type { CryptoResult, IdentityId, PublicKeyBytes } from './types.ts';

export const PUBLIC_KEY_PREFIX = 'pk1.';

const HEX = '0123456789abcdef';

export const bytesToHex = (bytes: Uint8Array): string => {
  let out = '';
  for (const byte of bytes) {
    out += HEX[byte >> 4];
    out += HEX[byte & 0x0f];
  }
  return out;
};

export const hexToBytes = (hex: string): CryptoResult<Uint8Array> => {
  const raw = hex.trim().toLowerCase().replace(/^0x/, '');
  if (!raw || raw.length % 2 !== 0 || /[^0-9a-f]/.test(raw)) {
    return { ok: false, code: 'bad-hex', message: 'invalid hex' };
  }
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  return { ok: true, value: bytes };
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (text: string): CryptoResult<Uint8Array> => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const pad =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, code: 'bad-base64', message: 'invalid base64url' };
  }
};

/** Wire form for cards / QR: `pk1.` + base64url(32-byte pubkey). */
export const encodePublicKey = (publicKey: PublicKeyBytes): string => {
  if (publicKey.byteLength !== 32) {
    throw new Error('public key must be 32 bytes');
  }
  return PUBLIC_KEY_PREFIX + toBase64Url(publicKey);
};

export const decodePublicKey = (text: string): CryptoResult<PublicKeyBytes> => {
  const raw = text.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!raw.startsWith(PUBLIC_KEY_PREFIX)) {
    return {
      ok: false,
      code: 'bad-prefix',
      message: 'expected pk1. public key',
    };
  }
  const actual = raw.slice(PUBLIC_KEY_PREFIX.length);
  const decoded = fromBase64Url(actual);
  if (!decoded.ok) return decoded;
  if (decoded.value.byteLength !== 32) {
    return {
      ok: false,
      code: 'bad-length',
      message: 'public key must be 32 bytes',
    };
  }
  return { ok: true, value: decoded.value };
};

/** Find `pk1.…` inside pasted text (invite / messenger). */
export const parsePublicKey = (text: string): CryptoResult<PublicKeyBytes> => {
  const raw = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  const match = raw.match(/pk1\.[A-Za-z0-9_-]+/);
  if (!match?.[0]) {
    return { ok: false, code: 'not-found', message: 'no pk1. key in text' };
  }
  return decodePublicKey(match[0]);
};

/**
 * Short stable id for UI / lobby labels (16 hex chars = 8 bytes of pubkey).
 * Not a secret; collisions are unlikely for personal address books.
 */
export const fingerprintOf = (publicKey: PublicKeyBytes): IdentityId => {
  if (publicKey.byteLength !== 32) {
    throw new Error('public key must be 32 bytes');
  }
  return bytesToHex(publicKey.subarray(0, 8));
};

/** `abcd1234ef567890` → `abcd-1234-ef56-7890` for reading aloud. */
export const formatFingerprint = (fingerprint: IdentityId): string => {
  const clean = fingerprint.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (clean.length !== 16) return fingerprint;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}`;
};

export const meetRoomIdFromFingerprint = (fingerprint: IdentityId): string => {
  const clean = fingerprint.toLowerCase().replace(/[^0-9a-f]/g, '');
  return `c-${clean || fingerprint}`;
};
