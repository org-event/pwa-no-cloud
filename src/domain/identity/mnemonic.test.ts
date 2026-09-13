import { describe, expect, it } from 'vitest';
import { fingerprintOf } from './encoding.ts';
import {
  createMnemonic,
  isValidMnemonic,
  keyPairFromMnemonic,
  normalizeMnemonic,
} from './mnemonic.ts';

describe('identity mnemonic', () => {
  it('creates a valid 12-word mnemonic and stable keypair', async () => {
    const mnemonic = createMnemonic(128);
    expect(mnemonic.split(' ')).toHaveLength(12);
    expect(isValidMnemonic(mnemonic)).toBe(true);

    const first = await keyPairFromMnemonic(mnemonic);
    const second = await keyPairFromMnemonic(`  ${mnemonic.toUpperCase()}  `);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.secretKey).toEqual(second.value.secretKey);
    expect(fingerprintOf(first.value.publicKey)).toBe(
      fingerprintOf(second.value.publicKey),
    );
  });

  it('rejects invalid mnemonics', async () => {
    expect(isValidMnemonic('not a real phrase at all forever')).toBe(false);
    const result = await keyPairFromMnemonic('abandon abandon abandon');
    expect(result.ok).toBe(false);
  });

  it('normalizes whitespace', () => {
    expect(normalizeMnemonic('  Alpha   Beta  ')).toBe('alpha beta');
  });
});
