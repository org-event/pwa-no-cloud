import { describe, expect, it } from 'vitest';
import {
  RELAY_BUNDLE_VERSION,
  createRelayBundleFactory,
  normalizeRelayUrl,
  parseRelayUrlList,
  selfUrlFromRequest,
} from './relay-bundle.js';

describe('server relay bundle (T2.2)', () => {
  it('parses RELAY_URLS list', () => {
    expect(
      parseRelayUrlList(
        'wss://a.example/ws, https://b.example, wss://a.example/ws',
      ),
    ).toEqual(['wss://a.example/ws', 'https://b.example']);
  });

  it('builds at least self when env empty', () => {
    const build = createRelayBundleFactory({
      envUrls: '',
      publicUrl: 'https://self.example',
    });
    const message = build();
    expect(message.op).toBe('relays');
    expect(message.v).toBe(RELAY_BUNDLE_VERSION);
    expect(message.relays).toEqual([
      {
        url: 'https://self.example',
        caps: { signaling: true, stun: true, challengeAuth: true },
      },
    ]);
  });

  it('merges self + env and dedupes', () => {
    const build = createRelayBundleFactory({
      envUrls: 'wss://a.example/ws,https://b.example',
      publicUrl: 'wss://a.example/ws',
    });
    const message = build({ selfUrl: 'https://req.example' });
    expect(message.relays.map((item) => item.url)).toEqual([
      'https://req.example',
      'wss://a.example/ws',
      'https://b.example',
    ]);
  });

  it('derives self from request host', () => {
    expect(
      selfUrlFromRequest({
        headers: { host: '10.0.0.2:8000', 'x-forwarded-proto': 'https' },
      }),
    ).toBe('https://10.0.0.2:8000');
    expect(normalizeRelayUrl('wss://x.example/ws/')).toBe('wss://x.example/ws');
  });
});
