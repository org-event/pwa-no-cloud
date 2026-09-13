/**
 * Identity invite card «это я» (S2.3): P1. + signed profile, QR-friendly (no avatar).
 * Two clients can paste/scan without a relay; signature is verified on import.
 */

import {
  decodePublicKey,
  fingerprintOf,
  type CryptoResult,
  type KeyPair,
} from './identity/index.ts';
import { CONTACT_CARD_PREFIX } from './profile.ts';
import {
  parseSignedProfile,
  signProfile,
  verifySignedProfile,
  type SignedProfile,
  type SignedProfileDraft,
} from './signed-profile.ts';

export const IDENTITY_INVITE_VERSION = 3 as const;

export type IdentityInvite = {
  id: string;
  nick: string;
  publicKey: string;
  profile: SignedProfile;
};

const stripNoise = (text: string): string =>
  text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const extractPayload = (text: string): string | null => {
  const raw = stripNoise(text);
  if (!raw) return null;
  const packed = raw.match(/P1\.\s*(\{[\s\S]*\})/i);
  if (packed?.[1]) return packed[1];
  if (raw.startsWith('{')) return raw;
  return null;
};

/** Compact signed «это я» card (avatar stripped for QR size). */
export const encodeIdentityInvite = (profile: SignedProfile): string => {
  const compact: SignedProfile = {
    ...profile,
    avatar: '',
  };
  return CONTACT_CARD_PREFIX + JSON.stringify(compact);
};

export const createIdentityInvite = async (
  draft: SignedProfileDraft,
  keyPair: KeyPair,
): Promise<CryptoResult<string>> => {
  const signed = await signProfile(
    { ...draft, avatar: '' },
    keyPair.secretKey,
    keyPair.publicKey,
  );
  if (!signed.ok) return signed;
  return { ok: true, value: encodeIdentityInvite(signed.value) };
};

export const parseIdentityInvite = async (
  text: string,
): Promise<CryptoResult<IdentityInvite>> => {
  const payload = extractPayload(text);
  if (!payload) {
    return { ok: false, code: 'not-found', message: 'no P1. identity invite' };
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid invite JSON' };
  }
  const parsed = parseSignedProfile(json);
  if (!parsed.ok) return parsed;
  const verified = await verifySignedProfile(parsed.value);
  if (!verified.ok) return verified;
  const pk = decodePublicKey(parsed.value.pk);
  if (!pk.ok) return pk;
  const id = fingerprintOf(pk.value);
  return {
    ok: true,
    value: {
      id,
      nick: parsed.value.nick,
      publicKey: parsed.value.pk,
      profile: parsed.value,
    },
  };
};
