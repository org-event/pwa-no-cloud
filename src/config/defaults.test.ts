import { describe, expect, it } from 'vitest';
import { APP_NAME } from './defaults.ts';

describe('defaults', () => {
  it('keeps the product name stable', () => {
    expect(APP_NAME).toBe('NoCloud');
  });
});
