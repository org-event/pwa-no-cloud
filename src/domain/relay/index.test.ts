import { describe, expect, it } from 'vitest';
import {
  canonicalRelayChallenge,
  parseRelayChallengeAnswer,
  parseRelayChallengeOffer,
} from './index.ts';
import challengeOffer from './fixtures/challenge-offer.json';
import challengeAnswer from './fixtures/challenge-answer.json';

describe('relay challenge contract', () => {
  it('parses offer and answer fixtures', () => {
    const offer = parseRelayChallengeOffer(challengeOffer);
    expect(offer?.op).toBe('challenge');
    expect(offer?.challenge.nonce).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');

    const answer = parseRelayChallengeAnswer(challengeAnswer);
    expect(answer?.op).toBe('challenge-response');
    expect(answer?.response.publicKey.startsWith('pk1.')).toBe(true);
    expect(answer?.response.nonce).toBe(offer?.challenge.nonce);
  });

  it('builds a stable canonical string for signing', () => {
    expect(canonicalRelayChallenge('abc', 100)).toBe(
      'nocloud.relay.challenge.v1|abc|100',
    );
  });

  it('rejects malformed envelopes', () => {
    expect(parseRelayChallengeOffer({ op: 'challenge' })).toBeNull();
    expect(
      parseRelayChallengeAnswer({
        op: 'challenge-response',
        response: { publicKey: 'nope', signature: 'x', nonce: 'short' },
      }),
    ).toBeNull();
  });
});
