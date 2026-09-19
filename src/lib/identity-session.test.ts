import { describe, expect, it } from 'vitest';
import {
  createIdentityWithMnemonic,
  exportBackupText,
  hasSealedVault,
  restoreIdentityFromBackupText,
  unlockIdentity,
} from './identity-session.ts';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
};

describe('identity session', () => {
  it('creates, unlocks, and restores from backup without KeyPair on the view', async () => {
    const storage = memoryStorage();
    expect(hasSealedVault(storage)).toBe(false);

    const created = await createIdentityWithMnemonic(storage, 'master-pass');
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.mnemonic?.split(' ')).toHaveLength(12);
    expect(hasSealedVault(storage)).toBe(true);
    expect(created.value.view).not.toHaveProperty('keyPair');
    expect(created.value.secret.state).toBe('owned');
    created.value.secret.dispose();

    const unlocked = await unlockIdentity(storage, 'master-pass');
    expect(unlocked.ok).toBe(true);
    if (!unlocked.ok) return;
    expect(unlocked.value.view.fingerprint).toBe(
      created.value.view.fingerprint,
    );
    expect(unlocked.value.view).not.toHaveProperty('keyPair');

    const backup = await exportBackupText(unlocked.value, 'master-pass');
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    unlocked.value.secret.dispose();

    const other = memoryStorage();
    const restored = await restoreIdentityFromBackupText(
      other,
      backup.text,
      'master-pass',
    );
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.view.fingerprint).toBe(
      created.value.view.fingerprint,
    );
    restored.value.secret.dispose();
  });
});
