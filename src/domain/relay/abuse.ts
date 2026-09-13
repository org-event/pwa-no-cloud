/**
 * Anti-abuse slot for relays (S3.6).
 * M1: rate-limit only. PoW / captcha plug in later via the same interface.
 */

export type AbuseDecision =
  | { ok: true }
  | { ok: false; code: string; retryAfterMs?: number; message?: string };

export type AbuseCheckInput = {
  /** Client IP, fingerprint, or other bucket key. */
  key: string;
  /** Optional cost hint for future PoW (ignored by rate-limit). */
  cost?: number;
};

/**
 * Pluggable gate before expensive relay work (challenge, TURN, heavy signaling).
 * Implementations must be side-effect free except for their own counters.
 */
export type AbuseGuard = {
  readonly kind: 'rate-limit' | 'pow' | 'noop';
  check(input: AbuseCheckInput): AbuseDecision | Promise<AbuseDecision>;
};

export type RateLimitOptions = {
  max?: number;
  windowMs?: number;
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

/** Placeholder until PoW is designed — always allows. */
export const createNoopAbuseGuard = (): AbuseGuard => ({
  kind: 'noop',
  check() {
    return { ok: true };
  },
});
