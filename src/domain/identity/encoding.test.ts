import { describe, expect, it } from 'vitest';
import { generateKeyPair } from './index.ts';
import {
  PUBLIC_KEY_PREFIX,
  decodePublicKey,
  encodePublicKey,
  fingerprintOf,
  formatFingerprint,
  hexToBytes,
  meetRoomIdFromFingerprint,
  parsePublicKey,
} from './encoding.ts';

describe('identity encoding', () => {
  it('round-trips pubkey pk1. encoding', async () => {
    const { publicKey } = await generateKeyPair();
    const encoded = encodePublicKey(publicKey);
    expect(encoded.startsWith(PUBLIC_KEY_PREFIX)).toBe(true);
    const decoded = decodePublicKey(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toEqual(publicKey);
  });

  it('parses pk1. from surrounding paste text', async () => {
    const { publicKey } = await generateKeyPair();
    const encoded = encodePublicKey(publicKey);
    const parsed = parsePublicKey(`вот ключ ${encoded} держи`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual(publicKey);
  });

  it('builds a stable fingerprint and display form', async () => {
    const { publicKey } = await generateKeyPair();
    const fp = fingerprintOf(publicKey);
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
    expect(fingerprintOf(publicKey)).toBe(fp);
    expect(formatFingerprint(fp)).toMatch(
      /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/,
    );
    expect(meetRoomIdFromFingerprint(fp)).toBe(`c-${fp}`);
  });

  it('rejects bad hex and wrong key length', () => {
    expect(hexToBytes('zz').ok).toBe(false);
    expect(decodePublicKey('pk1.AAAA').ok).toBe(false);
    expect(decodePublicKey('nope').ok).toBe(false);
    expect(parsePublicKey('нет ключа').ok).toBe(false);
  });
});
