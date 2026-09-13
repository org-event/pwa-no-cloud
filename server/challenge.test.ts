import { describe, expect, it } from 'vitest';
import * as ed from '@noble/ed25519';
import {
  canonicalRelayChallenge,
  createChallengeAuth,
  createRateLimiter,
} from './challenge.js';

const bytesToHex = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const toBase64Url = (bytes) =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const encodePk1 = (publicKey) => `pk1.${toBase64Url(publicKey)}`;

describe('server challenge auth', () => {
  it('issues a challenge and verifies a signed response (smoke)', async () => {
    const auth = createChallengeAuth({ ttlMs: 60_000 });
    const { secretKey, publicKey } = await ed.keygenAsync();
    const challenge = auth.issue();
    const message = new TextEncoder().encode(
      canonicalRelayChallenge(challenge.nonce, challenge.issuedAt),
    );
    const signature = await ed.signAsync(message, secretKey);
    const verified = await auth.verify({
      publicKey: encodePk1(publicKey),
      signature: bytesToHex(signature),
      nonce: challenge.nonce,
    });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.sessionId).toHaveLength(32);
    expect(auth.pendingCount()).toBe(0);

    const replay = await auth.verify({
      publicKey: encodePk1(publicKey),
      signature: bytesToHex(signature),
      nonce: challenge.nonce,
    });
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.code).toBe('unknown-nonce');
  });

  it('rejects a wrong signature', async () => {
    const auth = createChallengeAuth();
    const a = await ed.keygenAsync();
    const b = await ed.keygenAsync();
    const challenge = auth.issue();
    const message = new TextEncoder().encode(
      canonicalRelayChallenge(challenge.nonce, challenge.issuedAt),
    );
    const signature = await ed.signAsync(message, a.secretKey);
    const verified = await auth.verify({
      publicKey: encodePk1(b.publicKey),
      signature: bytesToHex(signature),
      nonce: challenge.nonce,
    });
    expect(verified.ok).toBe(false);
    if (!verified.ok) expect(verified.code).toBe('bad-signature');
  });

  it('rate-limits after the stub window max', () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000 });
    expect(limiter.allow('127.0.0.1').ok).toBe(true);
    expect(limiter.allow('127.0.0.1').ok).toBe(true);
    const blocked = limiter.allow('127.0.0.1');
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.code).toBe('rate-limited');
  });
});
