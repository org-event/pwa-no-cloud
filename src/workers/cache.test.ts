import { describe, expect, it } from 'vitest';
import {
  CACHE_NAME,
  collectShellAssets,
  createWorkerSource,
  joinBase,
} from './cache.ts';

describe('shell worker source', () => {
  it('includes hashed build assets and the cache name', () => {
    const assets = collectShellAssets(['assets/index-abc.js']);
    const source = createWorkerSource(assets);
    expect(assets).toContain('/assets/index-abc.js');
    expect(source).toContain(CACHE_NAME);
    expect(source).toContain('/manifest.webmanifest');
    expect(source).toContain('/assets/index-abc.js');
    expect(source).toContain('/share');
    expect(source).toContain('share-files');
    expect(source).toContain('notificationclick');
    expect(source).toContain('/version.json');
    expect(source).toContain("cache: 'no-store'");
  });

  it('prefixes cache and share paths with a project base', () => {
    const base = '/pwa-no-cloud/';
    const assets = collectShellAssets(['assets/index-abc.js'], base);
    const source = createWorkerSource(assets, base);
    expect(joinBase(base, 'share')).toBe('/pwa-no-cloud/share');
    expect(assets).toContain('/pwa-no-cloud/');
    expect(assets).toContain('/pwa-no-cloud/assets/index-abc.js');
    expect(source).toContain('/pwa-no-cloud/share');
    expect(source).toContain('/pwa-no-cloud/index.html');
    expect(source).not.toContain("const SHARE = '/share'");
  });
});
