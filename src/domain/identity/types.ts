/**
 * Shared identity value types (no runtime deps).
 */

export type PublicKeyBytes = Uint8Array;
export type SecretKeyBytes = Uint8Array;
export type SignatureBytes = Uint8Array;

export type KeyPair = {
  publicKey: PublicKeyBytes;
  secretKey: SecretKeyBytes;
};

/** Short hex fingerprint derived from pubkey (see encoding.ts). */
export type IdentityId = string;

export type CryptoOk<T> = { ok: true; value: T };
export type CryptoErr = { ok: false; code: string; message: string };
export type CryptoResult<T> = CryptoOk<T> | CryptoErr;
