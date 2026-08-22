import { describe, expect, it } from 'vitest';
import { APP_VERSION } from './version.ts';

describe('app version', () => {
  it('is the git describe string from the build', () => {
    expect(APP_VERSION.length).toBeGreaterThan(0);
    expect(APP_VERSION).toMatch(/^[0-9A-Za-z._-]+$/);
  });
});
