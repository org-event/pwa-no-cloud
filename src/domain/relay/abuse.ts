/**
 * Anti-abuse slot for relays (S3.6 / U4.1).
 * Default: noop. Rate-limit and a simple sync PoW stub plug into the same interface.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '../identity/encoding.ts';

export type AbuseDecision =
  | { ok: true }
  | { ok: false; code: string; retryAfterMs?: number; message?: string };

export type AbuseCheckInput = {
  /** Client IP, fingerprint, or other bucket key. */
  key: string;
  /** Optional cost hint (rate-limit ignores; PoW may scale difficulty later). */
  cost?: number;
  /** PoW challenge seed from the relay (required for `kind: 'pow'`). */
  powSeed?: string;
  /** Client nonce that satisfies the hash prefix. */
  powNonce?: string;
};

/**
 * Pluggable gate before expensive relay work (challenge, TURN, heavy signaling).
 * Implementations must be side-effect free except for their own counters.
 * Sync for now; heavier async PoW can wrap this later.
 */
export type AbuseGuard = {
  readonly kind: 'rate-limit' | 'pow' | 'noop';
  check(input: AbuseCheckInput): AbuseDecision;
};

export type RateLimitOptions = {
  max?: number;
  windowMs?: number;
};

export type PowOptions = {
  /** Leading zero hex digits required in sha256(seed:nonce). Default 2. */
  difficulty?: number;
};

/** In-memory fixed-window counter (same shape as server/challenge rate limiter). */
export const createRateLimitGuard = (
  options: RateLimitOptions = {},
): AbuseGuard => {
  const max = options.max ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    kind: 'rate-limit',
    check(input) {
      const now = Date.now();
      let row = hits.get(input.key);
      if (!row || row.resetAt <= now) {
        row = { count: 0, resetAt: now + windowMs };
        hits.set(input.key, row);
      }
      row.count += 1;
      if (row.count > max) {
        return {
          ok: false,
          code: 'rate-limited',
          retryAfterMs: Math.max(0, row.resetAt - now),
          message: 'too many requests',
        };
      }
      return { ok: true };
    },
  };
};

/** Default production guard — always allows (PoW optional). */
export const createNoopAbuseGuard = (): AbuseGuard => ({
  kind: 'noop',
  check() {
    return { ok: true };
  },
});

const textEncoder = new TextEncoder();

const powDigestHex = (seed: string, nonce: string): string =>
  bytesToHex(sha256(textEncoder.encode(`${seed}:${nonce}`)));

/**
 * Sync hash-prefix PoW stub (U4.1). Not production-hard; proves the plug-in slot.
 */
export const createPowAbuseGuard = (options: PowOptions = {}): AbuseGuard => {
  const difficulty = Math.max(0, Math.trunc(options.difficulty ?? 2));
  const prefix = '0'.repeat(difficulty);

  return {
    kind: 'pow',
    check(input) {
      if (typeof input.powSeed !== 'string' || !input.powSeed) {
        return {
          ok: false,
          code: 'pow-required',
          message: 'powSeed required',
        };
      }
      if (typeof input.powNonce !== 'string') {
        return {
          ok: false,
          code: 'pow-required',
          message: 'powNonce required',
        };
      }
      const digest = powDigestHex(input.powSeed, input.powNonce);
      if (!digest.startsWith(prefix)) {
        return {
          ok: false,
          code: 'pow-failed',
          message: `need ${difficulty} leading zero hex digits`,
        };
      }
      return { ok: true };
    },
  };
};

/** Brute-force a nonce for tests / local stubs (difficulty 0–4). */
export const solvePowStub = (
  seed: string,
  difficulty = 2,
  maxTries = 1_000_000,
): string | null => {
  const prefix = '0'.repeat(Math.max(0, Math.trunc(difficulty)));
  for (let i = 0; i < maxTries; i++) {
    const nonce = String(i);
    if (powDigestHex(seed, nonce).startsWith(prefix)) return nonce;
  }
  return null;
};
