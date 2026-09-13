/**
 * Relay contract types (client ↔ thin Node server).
 * Challenge auth and adapters land in S3.x.
 */

export type RelayChallenge = {
  nonce: string;
  issuedAt: number;
};

export type RelayChallengeResponse = {
  publicKey: string;
  signature: string;
  nonce: string;
};

export type RelayCapabilities = {
  signaling: boolean;
  stun?: boolean;
  turn?: boolean;
};
