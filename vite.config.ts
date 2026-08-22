import { defineConfig } from 'vite-plus';
import { shellWorker } from './src/workers/plugin.ts';

export default defineConfig({
  plugins: [shellWorker()],
  fmt: {
    ignorePatterns: ['dist/**', 'docs/**', 'design-system/**'],
    singleQuote: true,
    semi: true,
    printWidth: 80,
  },
  lint: {
    ignorePatterns: ['dist/**', 'docs/**', 'design-system/**', 'server/**'],
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
