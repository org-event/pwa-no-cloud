import { execSync } from 'node:child_process';
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
  define: {
    'import.meta.env.VITE_GIT_DESCRIBE': JSON.stringify(gitDescribe()),
  },
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
      'vite.config.ts',
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
