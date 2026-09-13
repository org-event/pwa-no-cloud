/**
 * Identity domain — crypto identity (keypair, fingerprint, sign/verify).
 * Logic arrives in M1 stories S1.x; this barrel fixes the module boundary.
 */

export type PublicKeyBytes = Uint8Array;
export type SecretKeyBytes = Uint8Array;

export type KeyPair = {
  publicKey: PublicKeyBytes;
  secretKey: SecretKeyBytes;
};

export type IdentityId = string;
