import { describe, expect, it } from 'vitest';
import { createNoopAbuseGuard, createRateLimitGuard } from './abuse.ts';

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

  it('noop always allows (PoW slot reserved)', () => {
    const guard = createNoopAbuseGuard();
    expect(guard.kind).toBe('noop');
    expect(guard.check({ key: 'x', cost: 99 })).toEqual({ ok: true });
  });
});
