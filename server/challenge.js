/**
 * Relay challenge auth (S3.2): issue nonce, verify Ed25519 response, rate-limit stub.
 * Canonical message must match src/domain/relay (nocloud.relay.challenge.v1|…).
 * Abuse slot: rate-limit only in M1 (see src/domain/relay/abuse.ts for client-side twin).
 */

import { randomBytes } from 'node:crypto';
import * as ed from '@noble/ed25519';

export const RELAY_CHALLENGE_VERSION = 1;
export const DEFAULT_TTL_MS = 60_000;
export const PUBLIC_KEY_PREFIX = 'pk1.';

/** Keep in sync with src/domain/relay/index.ts */
export const canonicalRelayChallenge = (nonce, issuedAt) =>
  `nocloud.relay.challenge.v${RELAY_CHALLENGE_VERSION}|${nonce}|${issuedAt}`;

const fromBase64Url = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const pad =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    return { ok: true, value: Buffer.from(padded + pad, 'base64') };
  } catch {
    return { ok: false, code: 'bad-base64', message: 'invalid base64url' };
  }
};

export const decodePublicKeyWire = (text) => {
  const raw = String(text ?? '').trim();
  if (!raw.startsWith(PUBLIC_KEY_PREFIX)) {
    return {
      ok: false,
      code: 'bad-prefix',
      message: 'expected pk1. public key',
    };
  }
  const decoded = fromBase64Url(raw.slice(PUBLIC_KEY_PREFIX.length));
  if (!decoded.ok) return decoded;
  if (decoded.value.byteLength !== 32) {
    return {
      ok: false,
      code: 'bad-length',
      message: 'public key must be 32 bytes',
    };
  }
  return { ok: true, value: new Uint8Array(decoded.value) };
};

export const hexToBytes = (hex) => {
  const raw = String(hex ?? '')
    .trim()
    .toLowerCase()
    .replace(/^0x/, '');
  if (!raw || raw.length % 2 !== 0 || /[^0-9a-f]/.test(raw)) {
    return { ok: false, code: 'bad-hex', message: 'invalid hex' };
  }
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(raw.slice(i * 2, i * 2 + 2), 16);
  }
  return { ok: true, value: bytes };
};

/**
 * Simple sliding window counter. Stub for anti-abuse (PoW later).
 * @param {{ max?: number, windowMs?: number }} [opts]
 */
export const createRateLimiter = ({ max = 30, windowMs = 60_000 } = {}) => {
  const hits = new Map();
  return {
    allow(key) {
      const now = Date.now();
      let row = hits.get(key);
      if (!row || row.resetAt <= now) {
        row = { count: 0, resetAt: now + windowMs };
        hits.set(key, row);
      }
      row.count += 1;
      if (row.count > max) {
        return {
          ok: false,
          code: 'rate-limited',
          retryAfterMs: Math.max(0, row.resetAt - now),
        };
      }
      return { ok: true };
    },
    reset(key) {
      hits.delete(key);
    },
  };
};

/**
 * @param {{ ttlMs?: number, now?: () => number }} [opts]
 */
export const createChallengeAuth = ({
  ttlMs = DEFAULT_TTL_MS,
  now = () => Date.now(),
} = {}) => {
  /** @type {Map<string, { issuedAt: number, expiresAt: number }>} */
  const pending = new Map();

  const issue = () => {
    const nonce = randomBytes(16).toString('hex');
    const issuedAt = now();
    pending.set(nonce, { issuedAt, expiresAt: issuedAt + ttlMs });
    return { nonce, issuedAt, ttlMs };
  };

  /**
   * @param {{ publicKey: string, signature: string, nonce: string }} response
   */
  const verify = async (response) => {
    if (!response || typeof response !== 'object') {
      return { ok: false, code: 'bad-shape', message: 'response required' };
    }
    const { publicKey, signature, nonce } = response;
    if (
      typeof publicKey !== 'string' ||
      typeof signature !== 'string' ||
      typeof nonce !== 'string'
    ) {
      return { ok: false, code: 'bad-shape', message: 'pk/sig/nonce required' };
    }
    const stored = pending.get(nonce);
    if (!stored) {
      return {
        ok: false,
        code: 'unknown-nonce',
        message: 'challenge not found',
      };
    }
    if (stored.expiresAt <= now()) {
      pending.delete(nonce);
      return { ok: false, code: 'expired', message: 'challenge expired' };
    }
    const pk = decodePublicKeyWire(publicKey);
    if (!pk.ok) return pk;
    const sig = hexToBytes(signature);
    if (!sig.ok) return sig;
    if (sig.value.byteLength !== 64) {
      return {
        ok: false,
        code: 'bad-sig-length',
        message: 'signature must be 64 bytes',
      };
    }
    const message = new TextEncoder().encode(
      canonicalRelayChallenge(nonce, stored.issuedAt),
    );
    let valid = false;
    try {
      valid = await ed.verifyAsync(sig.value, message, pk.value);
    } catch {
      valid = false;
    }
    if (!valid) {
      return { ok: false, code: 'bad-signature', message: 'signature invalid' };
    }
    pending.delete(nonce);
    return {
      ok: true,
      value: {
        publicKey,
        sessionId: randomBytes(16).toString('hex'),
      },
    };
  };

  return {
    issue,
    verify,
    pendingCount: () => pending.size,
  };
};
