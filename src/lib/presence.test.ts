import { describe, expect, it } from 'vitest';
import { isWatchClient, watchClientId } from './presence.ts';

describe('presence ids', () => {
  it('marks watch probes', () => {
    expect(isWatchClient(watchClientId('abc'))).toBe(true);
    expect(isWatchClient('abc')).toBe(false);
  });
});
