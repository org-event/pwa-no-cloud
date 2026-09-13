import { describe, expect, it } from 'vitest';
import { generateKeyPair } from './identity/index.ts';
import { signProfile } from './signed-profile.ts';
import {
  INTRODUCE_CARD_PREFIX,
  createIntroduceCard,
  parseAndVerifyIntroduceCard,
  parseIntroduceCard,
} from './introduce.ts';

describe('introduce card (T1.1)', () => {
  it('creates I1. card signed by introducer and verifies', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const encoded = await createIntroduceCard(
      {
        subjectPk: bob.publicKey,
        subjectNick: 'Боб',
        relayHints: ['wss://relay.example/s1'],
      },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.startsWith(INTRODUCE_CARD_PREFIX)).toBe(true);

    const verified = await parseAndVerifyIntroduceCard(encoded.value);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.subject.nick).toBe('Боб');
    expect(verified.value.relayHints).toEqual(['wss://relay.example/s1']);
  });

  it('rejects tampered nick', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const encoded = await createIntroduceCard(
      { subjectPk: bob.publicKey, subjectNick: 'Боб' },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const tampered = encoded.value.replace('"Боб"', '"Ева"');
    const parsed = parseIntroduceCard(tampered);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const verified = await parseAndVerifyIntroduceCard(tampered);
    expect(verified.ok).toBe(false);
  });

  it('verifies embedded subject profile when present', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const profile = await signProfile(
      { nick: 'Боб' },
      bob.secretKey,
      bob.publicKey,
    );
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;
    const encoded = await createIntroduceCard(
      {
        subjectPk: bob.publicKey,
        subjectNick: 'Боб',
        subjectProfile: profile.value,
      },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const verified = await parseAndVerifyIntroduceCard(encoded.value);
    expect(verified.ok).toBe(true);
  });
});
