import type { Plugin } from 'vite-plus';
import { collectShellAssets, createWorkerSource } from './cache.ts';

export const shellWorker = (): Plugin => {
  let base = '/';
  return {
    name: 'nocloud-shell-worker',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      const assets = collectShellAssets(Object.keys(bundle), base);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: createWorkerSource(assets, base),
      });
    },
  };
};
