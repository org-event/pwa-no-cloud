/**
 * Introduce card (M2 T1.1): forward a contact (pubkey + nick + optional relay hints).
 * Signed by the introducer; subject profile may be embedded for verify.
 * Prefix I1. — distinct from P1. «это я».
 */

import {
  decodePublicKey,
  encodePublicKey,
  bytesToHex,
  hexToBytes,
  signText,
  verifyText,
  type CryptoResult,
  type KeyPair,
  type PublicKeyBytes,
} from './identity/index.ts';
import { sanitizeNick } from './profile.ts';
import {
  parseSignedProfile,
  verifySignedProfile,
  type SignedProfile,
} from './signed-profile.ts';

export const INTRODUCE_CARD_PREFIX = 'I1.';
export const INTRODUCE_CARD_VERSION = 1 as const;

export type IntroduceSubject = {
  pk: string;
  nick: string;
  /** Optional signed profile of the subject (verified separately). */
  profile?: SignedProfile;
};

export type IntroduceCard = {
  v: typeof INTRODUCE_CARD_VERSION;
  /** Introducer wire pubkey `pk1.…`. */
  fromPk: string;
  subject: IntroduceSubject;
  /** Optional relay URLs / S1 hints the introducer shares. */
  relayHints: string[];
  updatedAt: number;
  sig: string;
};

export type IntroduceCardDraft = {
  subjectPk: PublicKeyBytes;
  subjectNick: string;
  subjectProfile?: SignedProfile;
  relayHints?: string[];
  updatedAt?: number;
};

const stripNoise = (text: string): string =>
  text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const extractPayload = (text: string): string | null => {
  const raw = stripNoise(text);
  if (!raw) return null;
  const packed = raw.match(/I1\.\s*(\{[\s\S]*\})/i);
  if (packed?.[1]) return packed[1];
  if (raw.startsWith('{')) return raw;
  return null;
};

export const canonicalIntroduceCard = (
  fromPk: string,
  subjectPk: string,
  subjectNick: string,
  relayHints: string[],
  updatedAt: number,
): string => {
  const hints = [...relayHints].map((item) => item.trim()).filter(Boolean);
  hints.sort();
  return `nocloud.introduce.v${INTRODUCE_CARD_VERSION}|${fromPk}|${subjectPk}|${subjectNick}|${updatedAt}|${hints.join(',')}`;
};

export const createIntroduceCard = async (
  draft: IntroduceCardDraft,
  introducer: KeyPair,
): Promise<CryptoResult<string>> => {
  const nick = sanitizeNick(draft.subjectNick);
  if (!nick) {
    return { ok: false, code: 'bad-nick', message: 'invalid subject nick' };
  }
  const fromPk = encodePublicKey(introducer.publicKey);
  const subjectPk = encodePublicKey(draft.subjectPk);
  if (draft.subjectProfile && draft.subjectProfile.pk !== subjectPk) {
    return {
      ok: false,
      code: 'pk-mismatch',
      message: 'subject profile pk does not match subject',
    };
  }
  const relayHints = (draft.relayHints ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const updatedAt =
    typeof draft.updatedAt === 'number' && Number.isFinite(draft.updatedAt)
      ? Math.trunc(draft.updatedAt)
      : Date.now();
  const message = canonicalIntroduceCard(
    fromPk,
    subjectPk,
    nick,
    relayHints,
    updatedAt,
  );
  try {
    const signature = await signText(message, introducer.secretKey);
    const card: IntroduceCard = {
      v: INTRODUCE_CARD_VERSION,
      fromPk,
      subject: {
        pk: subjectPk,
        nick,
        profile: draft.subjectProfile,
      },
      relayHints,
      updatedAt,
      sig: bytesToHex(signature),
    };
    return { ok: true, value: INTRODUCE_CARD_PREFIX + JSON.stringify(card) };
  } catch (error) {
    return {
      ok: false,
      code: 'sign-failed',
      message: error instanceof Error ? error.message : 'sign failed',
    };
  }
};

export const parseIntroduceCard = (
  text: string,
): CryptoResult<IntroduceCard> => {
  const payload = extractPayload(text);
  if (!payload) {
    return { ok: false, code: 'not-found', message: 'no I1. introduce card' };
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid introduce JSON' };
  }
  if (!json || typeof json !== 'object') {
    return { ok: false, code: 'bad-shape', message: 'introduce not an object' };
  }
  const raw = json as Record<string, unknown>;
  if (raw.v !== INTRODUCE_CARD_VERSION) {
    return {
      ok: false,
      code: 'bad-version',
      message: 'unsupported introduce version',
    };
  }
  if (typeof raw.fromPk !== 'string' || typeof raw.sig !== 'string') {
    return { ok: false, code: 'bad-shape', message: 'missing fromPk/sig' };
  }
  if (typeof raw.updatedAt !== 'number' || !Number.isFinite(raw.updatedAt)) {
    return { ok: false, code: 'bad-shape', message: 'bad updatedAt' };
  }
  const subjectRaw = raw.subject;
  if (!subjectRaw || typeof subjectRaw !== 'object') {
    return { ok: false, code: 'bad-shape', message: 'missing subject' };
  }
  const subjectObj = subjectRaw as Record<string, unknown>;
  if (
    typeof subjectObj.pk !== 'string' ||
    typeof subjectObj.nick !== 'string'
  ) {
    return { ok: false, code: 'bad-shape', message: 'bad subject pk/nick' };
  }
  const nick = sanitizeNick(subjectObj.nick);
  if (!nick || nick !== subjectObj.nick) {
    return { ok: false, code: 'bad-nick', message: 'invalid subject nick' };
  }
  let profile: SignedProfile | undefined;
  if (subjectObj.profile !== undefined) {
    const parsed = parseSignedProfile(subjectObj.profile);
    if (!parsed.ok) return parsed;
    profile = parsed.value;
  }
  const relayHints = Array.isArray(raw.relayHints)
    ? raw.relayHints.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    ok: true,
    value: {
      v: INTRODUCE_CARD_VERSION,
      fromPk: raw.fromPk,
      subject: { pk: subjectObj.pk, nick, profile },
      relayHints,
      updatedAt: Math.trunc(raw.updatedAt),
      sig: raw.sig,
    },
  };
};

export const verifyIntroduceCard = async (
  card: IntroduceCard,
): Promise<CryptoResult<true>> => {
  const fromKey = decodePublicKey(card.fromPk);
  if (!fromKey.ok) return fromKey;
  const subjectKey = decodePublicKey(card.subject.pk);
  if (!subjectKey.ok) return subjectKey;
  if (card.fromPk === card.subject.pk) {
    return {
      ok: false,
      code: 'self-introduce',
      message: 'introducer cannot equal subject',
    };
  }
  const sig = hexToBytes(card.sig);
  if (!sig.ok) return sig;
  if (sig.value.byteLength !== 64) {
    return {
      ok: false,
      code: 'bad-sig-length',
      message: 'signature must be 64 bytes',
    };
  }
  const message = canonicalIntroduceCard(
    card.fromPk,
    card.subject.pk,
    card.subject.nick,
    card.relayHints,
    card.updatedAt,
  );
  const ok = await verifyText(sig.value, message, fromKey.value);
  if (!ok) {
    return {
      ok: false,
      code: 'bad-sig',
      message: 'introduce signature invalid',
    };
  }
  if (card.subject.profile) {
    if (card.subject.profile.pk !== card.subject.pk) {
      return {
        ok: false,
        code: 'pk-mismatch',
        message: 'embedded profile pk mismatch',
      };
    }
    const profileOk = await verifySignedProfile(card.subject.profile);
    if (!profileOk.ok) return profileOk;
  }
  return { ok: true, value: true };
};

export const parseAndVerifyIntroduceCard = async (
  text: string,
): Promise<CryptoResult<IntroduceCard>> => {
  const parsed = parseIntroduceCard(text);
  if (!parsed.ok) return parsed;
  const verified = await verifyIntroduceCard(parsed.value);
  if (!verified.ok) return verified;
  return parsed;
};
