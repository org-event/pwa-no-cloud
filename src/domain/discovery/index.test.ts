import { describe, expect, it } from 'vitest';
import {
  activeRelayOf,
  addRelayUrl,
  emptyRelayBundle,
  mergeRemoteRelays,
  normalizeRelayUrl,
  removeRelayUrl,
  setActiveRelay,
} from './index.ts';

describe('relay bundle', () => {
  it('normalizes and selects a single active relay', () => {
    expect(normalizeRelayUrl('wss://a.example/ws')).toBe('wss://a.example/ws');
    expect(normalizeRelayUrl('not a url')).toBeNull();

    let bundle = emptyRelayBundle();
    bundle = addRelayUrl(bundle, 'wss://a.example/ws', 1);
    bundle = addRelayUrl(bundle, 'https://b.example', 2);
    expect(bundle.urls).toHaveLength(2);
    expect(bundle.activeUrl).toBe('wss://a.example/ws');

    bundle = setActiveRelay(bundle, 'https://b.example', 3);
    expect(activeRelayOf(bundle)).toBe('https://b.example');

    bundle = removeRelayUrl(bundle, 'https://b.example', 4);
    expect(bundle.urls).toEqual(['wss://a.example/ws']);
    expect(activeRelayOf(bundle)).toBe('wss://a.example/ws');
  });

  it('merges remote URLs without stealing active', () => {
    let bundle = addRelayUrl(emptyRelayBundle(), 'wss://home.example/ws', 1);
    bundle = mergeRemoteRelays(
      bundle,
      ['wss://home.example/ws', 'https://spare.example', 'ftp://bad'],
      2,
    );
    expect(bundle.urls).toEqual([
      'wss://home.example/ws',
      'https://spare.example',
    ]);
    expect(bundle.activeUrl).toBe('wss://home.example/ws');
    expect(bundle.updatedAt).toBe(2);
  });
});
