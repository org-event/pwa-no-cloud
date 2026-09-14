import { describe, expect, it } from 'vitest';
import {
  createNoopAbuseGuard,
  createPowAbuseGuard,
  createRateLimitGuard,
  solvePowStub,
} from './abuse.ts';

describe('abuse guard', () => {
  it('rate-limits after the window max', () => {
    const guard = createRateLimitGuard({ max: 2, windowMs: 60_000 });
    expect(guard.check({ key: 'a' })).toEqual({ ok: true });
    expect(guard.check({ key: 'a' })).toEqual({ ok: true });
    const blocked = guard.check({ key: 'a' });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe('rate-limited');
    expect(guard.check({ key: 'b' })).toEqual({ ok: true });
  });

  it('noop always allows (default PoW slot off)', () => {
    const guard = createNoopAbuseGuard();
    expect(guard.kind).toBe('noop');
    expect(guard.check({ key: 'x', cost: 99 })).toEqual({ ok: true });
  });

  it('pow stub accepts a solved nonce and rejects a bad one', () => {
    const guard = createPowAbuseGuard({ difficulty: 2 });
    expect(guard.kind).toBe('pow');
    expect(guard.check({ key: 'a' }).ok).toBe(false);

    const seed = 'relay-challenge-seed';
    const nonce = solvePowStub(seed, 2);
    expect(nonce).not.toBeNull();
    expect(guard.check({ key: 'a', powSeed: seed, powNonce: nonce! })).toEqual({
      ok: true,
    });
    const bad = guard.check({ key: 'a', powSeed: seed, powNonce: 'nope' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe('pow-failed');
  });
});
