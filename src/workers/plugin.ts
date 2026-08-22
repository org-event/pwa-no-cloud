import type { Plugin } from 'vite-plus';
import { collectShellAssets, createWorkerSource } from './cache.ts';

export const shellWorker = (): Plugin => ({
  name: 'nocloud-shell-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    const assets = collectShellAssets(Object.keys(bundle));
    this.emitFile({
      type: 'asset',
      fileName: 'sw.js',
      source: createWorkerSource(assets),
    });
  },
});
