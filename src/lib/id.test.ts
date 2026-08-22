import { describe, expect, it } from 'vitest';
import { generateId, getClientId } from './id.ts';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe('client id', () => {
  it('reuses a stored value', () => {
    const storage = memory();
    const first = getClientId(storage);
    const second = getClientId(storage);
    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(7);
  });

  it('creates unique ids', () => {
    expect(generateId()).not.toBe(generateId());
  });
});
