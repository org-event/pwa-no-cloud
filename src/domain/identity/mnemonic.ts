/**
 * BIP39 mnemonic ↔ Ed25519 keypair (S1.4).
 * Seed → secret via SHA-512[:32] for a stable app-specific derivation.
 */

import { sha512 } from '@noble/hashes/sha2.js';
import {
  generateMnemonic as scureGenerateMnemonic,
  mnemonicToSeed,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { getPublicKeyAsync } from '@noble/ed25519';
import type { CryptoResult, KeyPair } from './types.ts';

export type MnemonicStrength = 128 | 256;

export const createMnemonic = (
  strength: MnemonicStrength = 128,
): string => {
  return scureGenerateMnemonic(wordlist, strength);
};

export const isValidMnemonic = (mnemonic: string): boolean => {
  return validateMnemonic(normalizeMnemonic(mnemonic), wordlist);
};

export const normalizeMnemonic = (mnemonic: string): string => {
  return mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
};

export const keyPairFromMnemonic = async (
  mnemonic: string,
  passphrase = '',
): Promise<CryptoResult<KeyPair>> => {
  const normalized = normalizeMnemonic(mnemonic);
  if (!validateMnemonic(normalized, wordlist)) {
    return { ok: false, code: 'bad-mnemonic', message: 'invalid BIP39 mnemonic' };
  }
  try {
    const seed = await mnemonicToSeed(normalized, passphrase);
    const secretKey = sha512(seed).subarray(0, 32);
    const publicKey = await getPublicKeyAsync(secretKey);
    return { ok: true, value: { secretKey, publicKey } };
  } catch (error) {
    return {
      ok: false,
      code: 'mnemonic-derive-failed',
      message: error instanceof Error ? error.message : 'derive failed',
    };
  }
};
