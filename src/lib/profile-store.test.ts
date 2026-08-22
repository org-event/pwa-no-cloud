import { describe, expect, it } from 'vitest';
import { loadProfile, saveProfile } from './profile-store.ts';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
};

describe('profile store', () => {
  it('pins id and lets nick change', () => {
    const storage = memory();
    const first = loadProfile(storage);
    expect(first.id.length).toBeGreaterThanOrEqual(8);
    const saved = saveProfile(storage, { nick: 'Лена', avatar: '' });
    expect(saved.id).toBe(first.id);
    expect(saved.nick).toBe('Лена');
    expect(loadProfile(storage).nick).toBe('Лена');
  });
});
