import { defineConfig } from 'vite-plus';
import { shellWorker } from './src/workers/plugin.ts';

const readPagesBase = (): string => {
  const runtime = globalThis as {
    process?: { env?: { PAGES_BASE?: string } };
  };
  const value = runtime.process?.env?.PAGES_BASE;
  if (!value) return '/';
  return value.endsWith('/') ? value : `${value}/`;
};

export default defineConfig({
  base: readPagesBase(),
  plugins: [shellWorker()],
  fmt: {
    ignorePatterns: ['dist/**', 'docs/**', 'design-system/**', 'deploy/**'],
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
