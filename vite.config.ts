import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: ['dist/**', 'docs/**', 'design-system/**'],
    singleQuote: true,
    semi: true,
    printWidth: 80,
  },
  lint: {
    ignorePatterns: ['dist/**', 'docs/**', 'design-system/**'],
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
