import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite-plus';
import { shellWorker } from './src/workers/plugin.ts';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const shellTemplate = readFileSync(
  path.join(rootDir, 'src/workers/shell-sw.js'),
  'utf8',
);

const readPagesBase = (): string => {
  const runtime = globalThis as {
    process?: { env?: { PAGES_BASE?: string } };
  };
  const value = runtime.process?.env?.PAGES_BASE;
  if (!value) return '/';
  return value.endsWith('/') ? value : `${value}/`;
};

const gitDescribe = (): string => {
  try {
    return execSync('git describe --tags --always --long', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
};

export default defineConfig({
  base: readPagesBase(),
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  define: {
    'import.meta.env.VITE_GIT_DESCRIBE': JSON.stringify(gitDescribe()),
  },
  plugins: [vue(), shellWorker(gitDescribe(), shellTemplate)],
  fmt: {
    ignorePatterns: [
      'dist/**',
      'docs/**',
      'design-system/**',
      'deploy/**',
      'src/workers/shell-sw.js',
    ],
    singleQuote: true,
    semi: true,
    printWidth: 80,
  },
  lint: {
    ignorePatterns: [
      'dist/**',
      'docs/**',
      'design-system/**',
      'server/**',
      'deploy/**',
      'vite.config.ts',
      'src/workers/shell-sw.js',
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
  staged: {
    '*': 'vp check --fix',
  },
});
