import { describe, expect, it } from 'vitest';
import { greet } from '../index.ts';

describe('example', () => {
  it('greets through the entry point', () => {
    expect(greet('world')).toBe('hello, world');
  });
});
