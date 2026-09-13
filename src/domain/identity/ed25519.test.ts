import { describe, expect, it } from 'vitest';
import {
  generateKeyPair,
  publicKeyFromSecret,
  signText,
  verifyText,
} from './index.ts';

describe('identity ed25519', () => {
  it('generates a keypair and round-trips a signature', async () => {
    const pair = await generateKeyPair();
    expect(pair.publicKey.byteLength).toBe(32);
    expect(pair.secretKey.byteLength).toBe(32);

    const derived = await publicKeyFromSecret(pair.secretKey);
    expect(derived).toEqual(pair.publicKey);

    const message = 'nocloud-identity-s1.1';
    const signature = await signText(message, pair.secretKey);
    expect(signature.byteLength).toBe(64);
    expect(await verifyText(signature, message, pair.publicKey)).toBe(true);
    expect(await verifyText(signature, 'tampered', pair.publicKey)).toBe(false);
  });

  it('rejects signatures from another key', async () => {
    const a = await generateKeyPair();
    const b = await generateKeyPair();
    const signature = await signText('hello', a.secretKey);
    expect(await verifyText(signature, 'hello', b.publicKey)).toBe(false);
  });
});
