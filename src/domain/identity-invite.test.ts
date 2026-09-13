import { describe, expect, it } from 'vitest';
import { fingerprintOf, generateKeyPair } from './identity/index.ts';
import {
  createIdentityInvite,
  parseIdentityInvite,
} from './identity-invite.ts';
import { CONTACT_CARD_PREFIX } from './profile.ts';

describe('identity invite', () => {
  it('lets two clients exchange a signed card without a relay', async () => {
    const alice = await generateKeyPair();
    const encoded = await createIdentityInvite(
      { nick: 'Алиса', avatar: 'data:image/png;base64,xx', updatedAt: 99 },
      alice,
    );
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(encoded.value.startsWith(CONTACT_CARD_PREFIX)).toBe(true);
    expect(encoded.value).not.toContain('data:image');

    const bobSees = await parseIdentityInvite(`держи ${encoded.value} плиз`);
    expect(bobSees.ok).toBe(true);
    if (!bobSees.ok) return;
    expect(bobSees.value.id).toBe(fingerprintOf(alice.publicKey));
    expect(bobSees.value.nick).toBe('Алиса');
    expect(bobSees.value.publicKey.startsWith('pk1.')).toBe(true);
  });

  it('rejects a tampered invite', async () => {
    const alice = await generateKeyPair();
    const encoded = await createIdentityInvite({ nick: 'Алиса' }, alice);
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    const broken = encoded.value.replace('"Алиса"', '"Хакер"');
    const parsed = await parseIdentityInvite(broken);
    expect(parsed.ok).toBe(false);
  });
});
