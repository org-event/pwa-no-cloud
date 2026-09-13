import { describe, expect, it } from 'vitest';
import {
  bindIdentityProfile,
  IDENTITY_ID_KEY,
  loadProfile,
  saveProfile,
} from './profile-store.ts';

const memory = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

const FP = 'abcd1234ef567890';

describe('profile store', () => {
  it('stays empty until identity is bound', () => {
    const storage = memory();
    expect(loadProfile(storage).id).toBe('');
    expect(storage.getItem(IDENTITY_ID_KEY)).toBeNull();
  });

  it('binds fingerprint and persists nick', () => {
    const storage = memory();
    const bound = bindIdentityProfile(storage, FP);
    expect(bound.id).toBe(FP);
    expect(loadProfile(storage).id).toBe(FP);
    const saved = saveProfile(storage, { nick: 'Вася', avatar: '' });
    expect(saved).toEqual({ id: FP, nick: 'Вася', avatar: '' });
    expect(loadProfile(storage).nick).toBe('Вася');
  });

  it('rejects short legacy ids', () => {
    const storage = memory();
    expect(bindIdentityProfile(storage, 'abc123xyz9').id).toBe('');
  });
});
