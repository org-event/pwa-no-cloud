import type { Plugin } from 'vite-plus';
import { collectShellAssets, createWorkerSource } from './cache.ts';

export const shellWorker = (version = 'unknown'): Plugin => {
  let base = '/';
  return {
    name: 'nocloud-shell-worker',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version }),
      });
      const assets = collectShellAssets(Object.keys(bundle), base).filter(
        (path) => !path.endsWith('/version.json') && !path.endsWith('/sw.js'),
      );
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: createWorkerSource(assets, base),
      });
    },
  };
};
