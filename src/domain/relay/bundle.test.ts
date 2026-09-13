import { describe, expect, it } from 'vitest';
import {
  RELAY_BUNDLE_VERSION,
  parseRelayBundleMessage,
  parseRelayHint,
  relayUrlsOf,
} from './bundle.ts';
import relaysBundle from './fixtures/relays-bundle.json';

describe('relay bundle contract (T2.1)', () => {
  it('parses fixture with object and string hints', () => {
    const message = parseRelayBundleMessage(relaysBundle);
    expect(message?.op).toBe('relays');
    expect(message?.v).toBe(RELAY_BUNDLE_VERSION);
    expect(message?.issuedAt).toBe(1720000000000);
    expect(relayUrlsOf(message!)).toEqual([
      'wss://relay-a.example/ws',
      'https://relay-b.example',
      'wss://relay-c.example/signal',
    ]);
    expect(message!.relays[0]?.caps?.challengeAuth).toBe(true);
    expect(message!.relays[1]?.caps).toBeUndefined();
  });

  it('accepts bare URL strings as hints', () => {
    expect(parseRelayHint('wss://x.example/ws')).toEqual({
      url: 'wss://x.example/ws',
    });
    expect(parseRelayHint('')).toBeNull();
    expect(parseRelayHint('ftp://bad.example')).toBeNull();
  });

  it('rejects malformed envelopes', () => {
    expect(parseRelayBundleMessage({ op: 'relays' })).toBeNull();
    expect(
      parseRelayBundleMessage({
        op: 'relays',
        v: 1,
        issuedAt: 1,
        relays: [],
      }),
    ).toBeNull();
    expect(
      parseRelayBundleMessage({
        op: 'peers',
        peers: ['abc'],
      }),
    ).toBeNull();
    expect(
      parseRelayBundleMessage({
        op: 'relays',
        v: 99,
        issuedAt: 1,
        relays: ['wss://a.example'],
      }),
    ).toBeNull();
  });

  it('dedupes URLs and keeps first order', () => {
    const message = parseRelayBundleMessage({
      op: 'relays',
      v: 1,
      issuedAt: 42,
      relays: [
        'wss://a.example/ws',
        'wss://a.example/ws/',
        { url: 'https://b.example', caps: { signaling: true } },
      ],
    });
    expect(relayUrlsOf(message!)).toEqual([
      'wss://a.example/ws',
      'https://b.example',
    ]);
  });
});
