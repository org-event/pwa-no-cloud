/**
 * Relay challenge auth contract (S3.1).
 * Server issues a nonce; client signs a canonical message with Ed25519.
 */

export type RelayChallenge = {
  /** Random opaque string from the relay (hex or base64url). */
  nonce: string;
  /** Unix ms when the relay minted the challenge. */
  issuedAt: number;
  /** Optional TTL hint in ms (client may ignore; server enforces). */
  ttlMs?: number;
};

export type RelayChallengeResponse = {
  /** Wire pubkey `pk1.…`. */
  publicKey: string;
  /** Hex Ed25519 signature over `canonicalRelayChallenge`. */
  signature: string;
  /** Echo of the challenge nonce. */
  nonce: string;
};

export type RelayCapabilities = {
  signaling: boolean;
  stun?: boolean;
  turn?: boolean;
  challengeAuth?: boolean;
};

/** Wire envelope: relay → client. */
export type RelayChallengeOffer = {
  op: 'challenge';
  challenge: RelayChallenge;
};

/** Wire envelope: client → relay. */
export type RelayChallengeAnswer = {
  op: 'challenge-response';
  response: RelayChallengeResponse;
};

export const RELAY_CHALLENGE_VERSION = 1 as const;

/** Bytes the client must sign (and the server must verify). */
export const canonicalRelayChallenge = (
  nonce: string,
  issuedAt: number,
): string => {
  return `nocloud.relay.challenge.v${RELAY_CHALLENGE_VERSION}|${nonce}|${issuedAt}`;
};

export const isRelayChallenge = (value: unknown): value is RelayChallenge => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.nonce === 'string' &&
    row.nonce.length >= 16 &&
    typeof row.issuedAt === 'number' &&
    Number.isFinite(row.issuedAt)
  );
};

export const isRelayChallengeResponse = (
  value: unknown,
): value is RelayChallengeResponse => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.publicKey === 'string' &&
    row.publicKey.startsWith('pk1.') &&
    typeof row.signature === 'string' &&
    row.signature.length >= 64 &&
    typeof row.nonce === 'string' &&
    row.nonce.length >= 16
  );
};

export const parseRelayChallengeOffer = (
  raw: unknown,
): RelayChallengeOffer | null => {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.op !== 'challenge' || !isRelayChallenge(row.challenge)) return null;
  return { op: 'challenge', challenge: row.challenge };
};

export const parseRelayChallengeAnswer = (
  raw: unknown,
): RelayChallengeAnswer | null => {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (
    row.op !== 'challenge-response' ||
    !isRelayChallengeResponse(row.response)
  ) {
    return null;
  }
  return { op: 'challenge-response', response: row.response };
};

export type {
  AbuseCheckInput,
  AbuseDecision,
  AbuseGuard,
  PowOptions,
  RateLimitOptions,
} from './abuse.ts';
export {
  createNoopAbuseGuard,
  createPowAbuseGuard,
  createRateLimitGuard,
  solvePowStub,
} from './abuse.ts';

export type { RelayBundleMessage, RelayHint, RelayHintCaps } from './bundle.ts';
export {
  RELAY_BUNDLE_MAX,
  RELAY_BUNDLE_VERSION,
  parseRelayBundleMessage,
  parseRelayHint,
  relayUrlsOf,
} from './bundle.ts';

export type { RelayRedirectDraft, RelayRedirectNote } from './redirect.ts';
export {
  REDIRECT_NOTE_DEFAULT_TTL_MS,
  REDIRECT_NOTE_MAX_RELAYS,
  REDIRECT_NOTE_PREFIX,
  REDIRECT_NOTE_VERSION,
  canonicalRelayRedirect,
  createRelayRedirectNote,
  parseAndVerifyRelayRedirectNote,
  parseRelayRedirectNote,
  verifyRelayRedirectNote,
} from './redirect.ts';
