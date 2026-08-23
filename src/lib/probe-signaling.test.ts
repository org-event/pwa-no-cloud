import { describe, expect, it, vi } from 'vitest';
import { healthUrlFromSignaling, probeSignaling } from './probe-signaling.ts';

describe('probe signaling', () => {
  it('maps wss signaling to https health root', () => {
    expect(healthUrlFromSignaling('wss://wss-1-2-3-4.sslip.io:8443/ws')).toBe(
      'https://wss-1-2-3-4.sslip.io:8443/',
    );
  });

  it('treats ok:true as reachable', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, service: 'nocloud-signal' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    await expect(
      probeSignaling(
        'https://example.test:8443',
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toEqual({ ok: true });
  });
});
