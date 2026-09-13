import { describe, expect, it, vi } from 'vitest';
import {
  fetchRelayBundle,
  relaysUrlFromSignaling,
} from './relay-bundle-fetch.ts';

describe('relay bundle fetch (T2.3)', () => {
  it('maps signaling URL to /relays', () => {
    expect(relaysUrlFromSignaling('wss://relay.example/ws')).toBe(
      'https://relay.example/relays',
    );
    expect(relaysUrlFromSignaling('http://127.0.0.1:8000/ws')).toBe(
      'http://127.0.0.1:8000/relays',
    );
  });

  it('parses a live bundle response', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        op: 'relays',
        v: 1,
        issuedAt: 100,
        relays: ['wss://a.example/ws', 'https://b.example'],
      }),
    })) as unknown as typeof fetch;

    const result = await fetchRelayBundle('wss://a.example/ws', fetchImpl);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relays.map((item) => item.url)).toEqual([
      'wss://a.example/ws',
      'https://b.example',
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://a.example/relays',
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
