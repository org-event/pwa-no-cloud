/**
 * Identity domain — Ed25519 keygen / sign / verify (S1.1).
 * Algorithm is behind this module so it can be swapped later.
 */

import * as ed from '@noble/ed25519';

export type PublicKeyBytes = Uint8Array;
export type SecretKeyBytes = Uint8Array;
export type SignatureBytes = Uint8Array;

export type KeyPair = {
  publicKey: PublicKeyBytes;
  secretKey: SecretKeyBytes;
};

export type IdentityId = string;

export type CryptoOk<T> = { ok: true; value: T };
export type CryptoErr = { ok: false; code: string; message: string };
export type CryptoResult<T> = CryptoOk<T> | CryptoErr;

const enc = new TextEncoder();

export const generateKeyPair = async (): Promise<KeyPair> => {
  const { secretKey, publicKey } = await ed.keygenAsync();
  return { secretKey, publicKey };
};

export const publicKeyFromSecret = async (
  secretKey: SecretKeyBytes,
): Promise<PublicKeyBytes> => {
  return ed.getPublicKeyAsync(secretKey);
};

export const signBytes = async (
  message: Uint8Array,
  secretKey: SecretKeyBytes,
): Promise<SignatureBytes> => {
  return ed.signAsync(message, secretKey);
};

export const signText = async (
  text: string,
  secretKey: SecretKeyBytes,
): Promise<SignatureBytes> => {
  return signBytes(enc.encode(text), secretKey);
};

export const verifyBytes = async (
  signature: SignatureBytes,
  message: Uint8Array,
  publicKey: PublicKeyBytes,
): Promise<boolean> => {
  try {
    return await ed.verifyAsync(signature, message, publicKey);
  } catch {
    return false;
  }
};

export const verifyText = async (
  signature: SignatureBytes,
  text: string,
  publicKey: PublicKeyBytes,
): Promise<boolean> => {
  return verifyBytes(signature, enc.encode(text), publicKey);
};

export const signPayload = async (
  message: Uint8Array,
  secretKey: SecretKeyBytes,
): Promise<CryptoResult<SignatureBytes>> => {
  try {
    const value = await signBytes(message, secretKey);
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      code: 'sign-failed',
      message: error instanceof Error ? error.message : 'sign failed',
    };
  }
};
