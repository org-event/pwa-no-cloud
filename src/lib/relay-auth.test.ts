import { describe, expect, it } from 'vitest';
import {
  bytesToHex,
  encodePublicKey,
  generateKeyPair,
  signText,
  verifyText,
  hexToBytes,
  decodePublicKey,
} from '@/domain/identity/index.ts';
import {
  canonicalRelayChallenge,
  type RelayChallenge,
} from '@/domain/relay/index.ts';
import {
  buildChallengeResponse,
  challengeUrlFromSignaling,
  loginRelayChallenge,
} from './relay-auth.ts';

describe('relay auth client', () => {
  it('maps signaling url to /challenge', () => {
    expect(challengeUrlFromSignaling('wss://relay.example/ws')).toBe(
      'https://relay.example/challenge',
    );
    expect(challengeUrlFromSignaling('http://127.0.0.1:8000/')).toBe(
      'http://127.0.0.1:8000/challenge',
    );
  });

  it('logs in against a mock relay (smoke)', async () => {
    const pending = new Map<string, RelayChallenge>();
    const keyPair = await generateKeyPair();

    const fetchImpl: typeof fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      expect(url.endsWith('/challenge')).toBe(true);
      if ((init?.method ?? 'GET').toUpperCase() === 'GET') {
        const challenge: RelayChallenge = {
          nonce: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
          issuedAt: 1_700_000_000_000,
          ttlMs: 60_000,
        };
        pending.set(challenge.nonce, challenge);
        return new Response(JSON.stringify({ op: 'challenge', challenge }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const rawBody =
        typeof init?.body === 'string'
          ? init.body
          : JSON.stringify(init?.body ?? {});
      const body = JSON.parse(rawBody) as {
        response?: {
          publicKey: string;
          signature: string;
          nonce: string;
        };
      };
      const response = body.response;
      if (!response) {
        return new Response(JSON.stringify({ error: 'bad-shape' }), {
          status: 400,
        });
      }
      const challenge = pending.get(response.nonce);
      if (!challenge) {
        return new Response(JSON.stringify({ error: 'unknown-nonce' }), {
          status: 401,
        });
      }
      const pk = decodePublicKey(response.publicKey);
      const sig = hexToBytes(response.signature);
      if (!pk.ok || !sig.ok) {
        return new Response(JSON.stringify({ error: 'bad-key' }), {
          status: 401,
        });
      }
      const message = canonicalRelayChallenge(
        challenge.nonce,
        challenge.issuedAt,
      );
      const valid = await verifyText(sig.value, message, pk.value);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'bad-signature' }), {
          status: 401,
        });
      }
      pending.delete(response.nonce);
      return new Response(
        JSON.stringify({
          ok: true,
          sessionId: '0123456789abcdef0123456789abcdef',
          publicKey: response.publicKey,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const session = await loginRelayChallenge({
      signalingUrl: 'ws://127.0.0.1:8000/ws',
      keyPair,
      fetchImpl,
    });
    expect(session.ok).toBe(true);
    if (!session.ok) return;
    expect(session.value.sessionId).toHaveLength(32);
    expect(session.value.publicKey).toBe(encodePublicKey(keyPair.publicKey));

    const challenge: RelayChallenge = {
      nonce: 'ffffffffffffffffffffffffffffffff',
      issuedAt: 42,
    };
    const signed = await buildChallengeResponse(challenge, keyPair);
    expect(signed.ok).toBe(true);
    if (!signed.ok) return;
    const sig = hexToBytes(signed.value.signature);
    expect(sig.ok).toBe(true);
    if (!sig.ok) return;
    const message = canonicalRelayChallenge(
      challenge.nonce,
      challenge.issuedAt,
    );
    expect(await verifyText(sig.value, message, keyPair.publicKey)).toBe(true);
    expect(bytesToHex(await signText(message, keyPair.secretKey))).toBe(
      signed.value.signature,
    );
  });
});
