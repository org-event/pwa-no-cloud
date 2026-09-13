import { describe, expect, it } from 'vitest';
import {
  encodePublicKey,
  fingerprintOf,
  generateKeyPair,
} from '../identity/index.ts';
import {
  CHAT_MESSAGE_PREFIX,
  createChatMessage,
  parseAndVerifyChatMessage,
  parseChatMessage,
} from './message.ts';

describe('chat message (U1.1)', () => {
  it('creates H1. message signed by sender and verifies', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const toId = fingerprintOf(bob.publicKey);
    const encoded = await createChatMessage(
      { toId, text: 'привет', ts: 1000 },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.startsWith(CHAT_MESSAGE_PREFIX)).toBe(true);

    const verified = await parseAndVerifyChatMessage(encoded.value);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.text).toBe('привет');
    expect(verified.value.toId).toBe(toId);
    expect(verified.value.fromPk).toBe(encodePublicKey(alice.publicKey));
  });

  it('rejects tampered text', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const encoded = await createChatMessage(
      { toId: fingerprintOf(bob.publicKey), text: 'ok', ts: 1 },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const tampered = encoded.value.replace('"ok"', '"evil"');
    expect(parseChatMessage(tampered).ok).toBe(true);
    const verified = await parseAndVerifyChatMessage(tampered);
    expect(verified.ok).toBe(false);
  });

  it('rejects empty text', async () => {
    const alice = await generateKeyPair();
    const encoded = await createChatMessage(
      { toId: 'abcdefghijklmnop', text: '   ' },
      alice,
    );
    expect(encoded.ok).toBe(false);
  });
});
