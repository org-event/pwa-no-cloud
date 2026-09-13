import { describe, expect, it } from 'vitest';
import type { Call, KeyPair } from './index.ts';
import { emptyRelayBundle } from './discovery/index.ts';

describe('domain module barrels', () => {
  it('exposes identity and call type shapes', () => {
    const pair: KeyPair = {
      publicKey: new Uint8Array(32),
      secretKey: new Uint8Array(64),
    };
    expect(pair.publicKey).toHaveLength(32);

    const call: Call = { id: 'c1', legs: [] };
    expect(call.legs).toEqual([]);
  });

  it('builds an empty relay bundle', () => {
    const bundle = emptyRelayBundle();
    expect(bundle.active).toEqual([]);
    expect(bundle.cached).toEqual([]);
  });
});
