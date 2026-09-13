import { describe, expect, it } from 'vitest';
import { generateKeyPair } from './identity/index.ts';
import {
  parseSignedProfile,
  signProfile,
  verifySignedProfile,
} from './signed-profile.ts';

describe('signed profile', () => {
  it('signs and verifies a foreign profile', async () => {
    const alice = await generateKeyPair();
    const signed = await signProfile(
      { nick: 'Алиса', avatar: '', updatedAt: 1_700_000_000_000 },
      alice.secretKey,
      alice.publicKey,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    const verified = await verifySignedProfile(signed.value);
    expect(verified).toEqual({ ok: true, value: true });

    const parsed = parseSignedProfile(JSON.parse(JSON.stringify(signed.value)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(await verifySignedProfile(parsed.value)).toEqual({
      ok: true,
      value: true,
    });
  });

  it('rejects tampered nick and foreign key', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const signed = await signProfile(
      { nick: 'Алиса', avatar: '', updatedAt: 42 },
      alice.secretKey,
      alice.publicKey,
    );
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;

    const tampered = { ...signed.value, nick: 'Хакер' };
    const badNick = await verifySignedProfile(tampered);
    expect(badNick.ok).toBe(false);
    if (!badNick.ok) expect(badNick.code).toBe('bad-signature');

    const foreign = await signProfile(
      { nick: 'Боб', avatar: '', updatedAt: 42 },
      bob.secretKey,
      alice.publicKey,
    );
    expect(foreign.ok).toBe(true);
    if (!foreign.ok) return;
    const mismatch = await verifySignedProfile(foreign.value);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe('bad-signature');
  });
});
