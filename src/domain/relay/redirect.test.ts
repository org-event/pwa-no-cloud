import { describe, expect, it } from 'vitest';
import { generateKeyPair } from '../identity/index.ts';
import {
  REDIRECT_NOTE_PREFIX,
  createRelayRedirectNote,
  parseAndVerifyRelayRedirectNote,
  parseRelayRedirectNote,
} from './redirect.ts';

describe('relay redirect note (T4.1)', () => {
  it('creates R1. note signed by owner and verifies', async () => {
    const alice = await generateKeyPair();
    const encoded = await createRelayRedirectNote(
      {
        relays: ['wss://new.example/ws', 'https://spare.example'],
        issuedAt: 1_000,
        expiresAt: 2_000,
      },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.startsWith(REDIRECT_NOTE_PREFIX)).toBe(true);

    const verified = await parseAndVerifyRelayRedirectNote(
      encoded.value,
      1_500,
    );
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.relays).toEqual([
      'wss://new.example/ws',
      'https://spare.example',
    ]);
  });

  it('rejects expired and tampered notes', async () => {
    const alice = await generateKeyPair();
    const encoded = await createRelayRedirectNote(
      {
        relays: ['wss://new.example/ws'],
        issuedAt: 1_000,
        expiresAt: 2_000,
      },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    const expired = await parseAndVerifyRelayRedirectNote(encoded.value, 3_000);
    expect(expired.ok).toBe(false);
    if (expired.ok) return;
    expect(expired.code).toBe('expired');

    const tampered = encoded.value.replace(
      'wss://new.example/ws',
      'wss://evil.example/ws',
    );
    const parsed = parseRelayRedirectNote(tampered);
    expect(parsed.ok).toBe(true);
    const bad = await parseAndVerifyRelayRedirectNote(tampered, 1_500);
    expect(bad.ok).toBe(false);
  });

  it('rejects empty relay list', async () => {
    const alice = await generateKeyPair();
    const encoded = await createRelayRedirectNote(
      { relays: ['ftp://x'] },
      alice,
    );
    expect(encoded.ok).toBe(false);
  });
});
