import { describe, expect, it } from 'vitest';
import { CACHE_NAME, collectShellAssets, createWorkerSource } from './cache.ts';

describe('shell worker source', () => {
  it('includes hashed build assets and the cache name', () => {
    const assets = collectShellAssets(['assets/index-abc.js']);
    const source = createWorkerSource(assets);
    expect(assets).toContain('/assets/index-abc.js');
    expect(source).toContain(CACHE_NAME);
    expect(source).toContain('/manifest.webmanifest');
    expect(source).toContain('/assets/index-abc.js');
  });
});
