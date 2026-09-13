import { describe, expect, it } from 'vitest';
import { addRelayUrl, emptyRelayBundle } from '@/domain/discovery/index.ts';
import {
  loadRelayBundle,
  RELAY_BUNDLE_KEY,
  saveRelayBundle,
} from './relay-bundle-store.ts';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe('relay bundle store', () => {
  it('round-trips the active relay list', () => {
    const storage = memory();
    expect(loadRelayBundle(storage)).toEqual(emptyRelayBundle());
    const bundle = addRelayUrl(
      emptyRelayBundle(),
      'wss://relay.example/ws',
      10,
    );
    saveRelayBundle(storage, bundle);
    expect(storage.getItem(RELAY_BUNDLE_KEY)).toContain('relay.example');
    expect(loadRelayBundle(storage)).toEqual(bundle);
  });
});
