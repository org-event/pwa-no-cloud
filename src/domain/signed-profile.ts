/**
 * Signed profile payload (S2.1): nick + avatar + updatedAt, Ed25519 over canonical bytes.
 * Receiver verifies with the embedded pk1. public key; tampered fields fail.
 */

import {
  decodePublicKey,
  encodePublicKey,
  hexToBytes,
  bytesToHex,
  signText,
  verifyText,
  type CryptoResult,
  type PublicKeyBytes,
  type SecretKeyBytes,
} from './identity/index.ts';
import { isSafeAvatar, sanitizeNick } from './profile.ts';

export const SIGNED_PROFILE_VERSION = 1 as const;

export type SignedProfile = {
  v: typeof SIGNED_PROFILE_VERSION;
  /** Wire pubkey `pk1.…` — identity of the signer. */
  pk: string;
  nick: string;
  avatar: string;
  updatedAt: number;
  /** Ed25519 signature, hex. */
  sig: string;
};

export type SignedProfileDraft = {
  nick: string;
  avatar?: string;
  updatedAt?: number;
};

/** Canonical string covered by the signature (order fixed; no sig field). */
export const canonicalSignedProfile = (
  pk: string,
  nick: string,
  avatar: string,
  updatedAt: number,
): string => {
  return `nocloud.profile.v${SIGNED_PROFILE_VERSION}|${pk}|${updatedAt}|${nick}|${avatar}`;
};

export const signProfile = async (
  draft: SignedProfileDraft,
  secretKey: SecretKeyBytes,
  publicKey: PublicKeyBytes,
): Promise<CryptoResult<SignedProfile>> => {
  const nick = sanitizeNick(draft.nick);
  if (!nick) {
    return { ok: false, code: 'bad-nick', message: 'invalid nick' };
  }
  const avatar = draft.avatar || '';
  if (!isSafeAvatar(avatar)) {
    return { ok: false, code: 'bad-avatar', message: 'unsafe avatar' };
  }
  const updatedAt =
    typeof draft.updatedAt === 'number' && Number.isFinite(draft.updatedAt)
      ? Math.trunc(draft.updatedAt)
      : Date.now();
  const pk = encodePublicKey(publicKey);
  const message = canonicalSignedProfile(pk, nick, avatar, updatedAt);
  try {
    const signature = await signText(message, secretKey);
    return {
      ok: true,
      value: {
        v: SIGNED_PROFILE_VERSION,
        pk,
        nick,
        avatar,
        updatedAt,
        sig: bytesToHex(signature),
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

export const verifySignedProfile = async (
  profile: SignedProfile,
): Promise<CryptoResult<true>> => {
  if (profile.v !== SIGNED_PROFILE_VERSION) {
    return {
      ok: false,
      code: 'bad-version',
      message: 'unsupported signed profile version',
    };
  }
  const nick = sanitizeNick(profile.nick);
  if (!nick || nick !== profile.nick) {
    return { ok: false, code: 'bad-nick', message: 'invalid nick' };
  }
  if (!isSafeAvatar(profile.avatar)) {
    return { ok: false, code: 'bad-avatar', message: 'unsafe avatar' };
  }
  if (
    typeof profile.updatedAt !== 'number' ||
    !Number.isFinite(profile.updatedAt)
  ) {
    return { ok: false, code: 'bad-updatedAt', message: 'invalid updatedAt' };
  }
  const pk = decodePublicKey(profile.pk);
  if (!pk.ok) return pk;
  const sig = hexToBytes(profile.sig);
  if (!sig.ok) return sig;
  if (sig.value.byteLength !== 64) {
    return {
      ok: false,
      code: 'bad-sig-length',
      message: 'signature must be 64 bytes',
    };
  }
  const message = canonicalSignedProfile(
    profile.pk,
    profile.nick,
    profile.avatar,
    profile.updatedAt,
  );
  const ok = await verifyText(sig.value, message, pk.value);
  if (!ok) {
    return {
      ok: false,
      code: 'bad-signature',
      message: 'profile signature invalid',
    };
  }
  return { ok: true, value: true };
};

/** Parse unknown JSON into a SignedProfile shape (no verify). */
export const parseSignedProfile = (
  raw: unknown,
): CryptoResult<SignedProfile> => {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, code: 'bad-shape', message: 'expected object' };
  }
  const row = raw as Record<string, unknown>;
  if (row.v !== SIGNED_PROFILE_VERSION) {
    return { ok: false, code: 'bad-version', message: 'bad version' };
  }
  if (typeof row.pk !== 'string' || typeof row.nick !== 'string') {
    return { ok: false, code: 'bad-shape', message: 'pk/nick required' };
  }
  if (typeof row.avatar !== 'string' || typeof row.sig !== 'string') {
    return { ok: false, code: 'bad-shape', message: 'avatar/sig required' };
  }
  if (typeof row.updatedAt !== 'number' || !Number.isFinite(row.updatedAt)) {
    return { ok: false, code: 'bad-updatedAt', message: 'invalid updatedAt' };
  }
  return {
    ok: true,
    value: {
      v: SIGNED_PROFILE_VERSION,
      pk: row.pk,
      nick: row.nick,
      avatar: row.avatar,
      updatedAt: row.updatedAt,
      sig: row.sig,
    },
  };
};
