import { describe, expect, it } from 'vitest';
import { fingerprintOf, generateKeyPair } from './index.ts';
import {
  BACKUP_PREFIX,
  backupFileName,
  createIdentityBackup,
  encodeIdentityBackup,
  restoreKeyPairFromBackup,
} from './backup.ts';

describe('identity backup', () => {
  it('exports and restores the same fingerprint', async () => {
    const pair = await generateKeyPair();
    const backup = await createIdentityBackup(pair.secretKey, 'backup-phrase');
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(backup.value.fingerprint).toBe(fingerprintOf(pair.publicKey));

    const packed = encodeIdentityBackup(backup.value);
    expect(packed.startsWith(BACKUP_PREFIX)).toBe(true);

    const restored = await restoreKeyPairFromBackup(packed, 'backup-phrase');
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(fingerprintOf(restored.value.publicKey)).toBe(
      fingerprintOf(pair.publicKey),
    );
    expect(restored.value.secretKey).toEqual(pair.secretKey);
    expect(backupFileName(backup.value.fingerprint)).toContain(
      backup.value.fingerprint,
    );
  });

  it('fails on wrong passphrase', async () => {
    const pair = await generateKeyPair();
    const backup = await createIdentityBackup(pair.secretKey, 'right');
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    const packed = encodeIdentityBackup(backup.value);
    const restored = await restoreKeyPairFromBackup(packed, 'wrong');
    expect(restored.ok).toBe(false);
  });
});
