import type { Plugin } from 'vite-plus';
import { collectShellAssets, fillWorkerSource } from './cache.ts';

export const shellWorker = (version = 'unknown', template: string): Plugin => {
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
        source: fillWorkerSource(template, assets, base),
      });
    },
  };
};
