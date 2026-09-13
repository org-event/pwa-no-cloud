/**
 * Client adapter: relay challenge login → session (S3.3).
 */

import type { CryptoResult, KeyPair } from '@/domain/identity/index.ts';
import {
  bytesToHex,
  encodePublicKey,
  signText,
} from '@/domain/identity/index.ts';
import {
  canonicalRelayChallenge,
  parseRelayChallengeOffer,
  type RelayChallenge,
  type RelayChallengeResponse,
} from '@/domain/relay/index.ts';
import { healthUrlFromSignaling } from './probe-signaling.ts';

export const challengeUrlFromSignaling = (raw: string): string | null => {
  const base = healthUrlFromSignaling(raw);
  if (!base) return null;
  try {
    const url = new URL(base);
    url.pathname = '/challenge';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
};

export const buildChallengeResponse = async (
  challenge: RelayChallenge,
  keyPair: KeyPair,
): Promise<CryptoResult<RelayChallengeResponse>> => {
  try {
    const message = canonicalRelayChallenge(
      challenge.nonce,
      challenge.issuedAt,
    );
    const signature = await signText(message, keyPair.secretKey);
    return {
      ok: true,
      value: {
        publicKey: encodePublicKey(keyPair.publicKey),
        signature: bytesToHex(signature),
        nonce: challenge.nonce,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'sign-failed',
      message: error instanceof Error ? error.message : 'sign failed',
    };
  }
};

export type RelaySession = {
  sessionId: string;
  publicKey: string;
};

export const loginRelayChallenge = async (input: {
  signalingUrl: string;
  keyPair: KeyPair;
  fetchImpl?: typeof fetch;
}): Promise<CryptoResult<RelaySession>> => {
  const fetchImpl = input.fetchImpl ?? fetch;
  const challengeUrl = challengeUrlFromSignaling(input.signalingUrl);
  if (!challengeUrl) {
    return {
      ok: false,
      code: 'bad-url',
      message: 'invalid signaling url for challenge',
    };
  }
  let offerRaw: unknown;
  try {
    const offerRes = await fetchImpl(challengeUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!offerRes.ok) {
      return {
        ok: false,
        code: 'offer-http',
        message: `challenge GET HTTP ${offerRes.status}`,
      };
    }
    offerRaw = await offerRes.json();
  } catch (error) {
    return {
      ok: false,
      code: 'offer-failed',
      message: error instanceof Error ? error.message : 'challenge GET failed',
    };
  }
  const offer = parseRelayChallengeOffer(offerRaw);
  if (!offer) {
    return {
      ok: false,
      code: 'bad-offer',
      message: 'relay did not return a challenge offer',
    };
  }
  const signed = await buildChallengeResponse(offer.challenge, input.keyPair);
  if (!signed.ok) return signed;

  try {
    const answerRes = await fetchImpl(challengeUrl, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        op: 'challenge-response',
        response: signed.value,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await answerRes.json()) as {
      ok?: unknown;
      sessionId?: unknown;
      publicKey?: unknown;
      error?: unknown;
      message?: unknown;
    };
    if (!answerRes.ok || body.ok !== true) {
      return {
        ok: false,
        code: typeof body.error === 'string' ? body.error : 'auth-rejected',
        message:
          typeof body.message === 'string'
            ? body.message
            : `challenge POST HTTP ${answerRes.status}`,
      };
    }
    if (typeof body.sessionId !== 'string' || !body.sessionId) {
      return {
        ok: false,
        code: 'bad-session',
        message: 'relay did not return sessionId',
      };
    }
    return {
      ok: true,
      value: {
        sessionId: body.sessionId,
        publicKey:
          typeof body.publicKey === 'string'
            ? body.publicKey
            : signed.value.publicKey,
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'answer-failed',
      message: error instanceof Error ? error.message : 'challenge POST failed',
    };
  }
};
