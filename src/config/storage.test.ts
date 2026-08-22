import { describe, expect, it } from 'vitest';
import { SETTINGS_STORAGE_KEY } from './defaults.ts';
import { createUserSettings } from './merge.ts';
import { loadUserSettings, saveUserSettings } from './storage.ts';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
};

describe('user settings storage', () => {
  it('round-trips a custom overlay', () => {
    const storage = memoryStorage();
    const settings = createUserSettings('google-stun');
    saveUserSettings(settings, storage);
    const loaded = loadUserSettings(storage);
    expect(loaded.presetId).toBe('google-stun');
  });

  it('falls back when JSON is broken', () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, '{');
    const loaded = loadUserSettings(storage);
    expect(loaded.presetId).toBe('manual-only');
  });
});
