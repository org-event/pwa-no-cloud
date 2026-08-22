import { describe, expect, it, vi } from 'vitest';
import { createHttpPollPort } from './http-poll.ts';
import type { SignalMessage } from './port.ts';

const offer: SignalMessage = {
  from: 'alice',
  to: 'bob',
  data: { type: 'offer', payload: { sdp: 'v=0' } },
};

describe('http-poll signaling', () => {
  it('joins, sends, and delivers polled messages', async () => {
    const calls: string[] = [];
    const request = vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (url.includes('/join')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes('/signal') && (init?.method ?? 'GET') === 'GET') {
        return new Response(JSON.stringify({ messages: [offer] }), {
          status: 200,
        });
      }
      if (url.includes('/peers')) {
        return new Response(JSON.stringify({ peers: ['alice'] }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    const port = createHttpPollPort('http://127.0.0.1:8000', {
      fetch: request as unknown as typeof fetch,
      intervalMs: 20,
    });
    const received: SignalMessage[] = [];
    port.subscribe((message) => {
      received.push(message);
    });
    await port.connect({ roomId: 'nocloud', clientId: 'bob' });
    await port.send(offer);
    const peers = (await port.listPeers?.()) ?? [];
    await vi.waitFor(() => {
      expect(received[0]?.from).toBe('alice');
    });
    expect(peers).toEqual(['alice']);
    expect(calls.some((line) => line.startsWith('POST'))).toBe(true);
    port.close();
  });
});
