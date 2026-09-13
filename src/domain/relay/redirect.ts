/**
 * Signed relay redirect note (M2 T4.1 / FR-RL-05).
 * Owner announces new relay URLs after moving; prefix R1.
 */

import { normalizeRelayUrl } from '../discovery/index.ts';
import {
  bytesToHex,
  decodePublicKey,
  encodePublicKey,
  hexToBytes,
  signText,
  verifyText,
  type CryptoResult,
  type KeyPair,
} from '../identity/index.ts';

export const REDIRECT_NOTE_PREFIX = 'R1.';
export const REDIRECT_NOTE_VERSION = 1 as const;
export const REDIRECT_NOTE_MAX_RELAYS = 16;
/** Default TTL when draft omits expiresAt: 30 days. */
export const REDIRECT_NOTE_DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RelayRedirectNote = {
  v: typeof REDIRECT_NOTE_VERSION;
  /** Owner wire pubkey `pk1.…`. */
  pk: string;
  /** Preferred new relay signaling URLs. */
  relays: string[];
  issuedAt: number;
  expiresAt: number;
  sig: string;
};

export type RelayRedirectDraft = {
  relays: string[];
  issuedAt?: number;
  expiresAt?: number;
  ttlMs?: number;
};

const stripNoise = (text: string): string =>
  text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const extractPayload = (text: string): string | null => {
  const raw = stripNoise(text);
  if (!raw) return null;
  const packed = raw.match(/R1\.\s*(\{[\s\S]*\})/i);
  if (packed?.[1]) return packed[1];
  if (raw.startsWith('{')) return raw;
  return null;
};

const normalizeRelayList = (raw: readonly string[]): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const url = normalizeRelayUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= REDIRECT_NOTE_MAX_RELAYS) break;
  }
  return urls;
};

export const canonicalRelayRedirect = (
  pk: string,
  relays: string[],
  issuedAt: number,
  expiresAt: number,
): string => {
  const sorted = [...relays].sort();
  return `nocloud.redirect.v${REDIRECT_NOTE_VERSION}|${pk}|${sorted.join(',')}|${issuedAt}|${expiresAt}`;
};

export const createRelayRedirectNote = async (
  draft: RelayRedirectDraft,
  owner: KeyPair,
): Promise<CryptoResult<string>> => {
  const relays = normalizeRelayList(draft.relays);
  if (relays.length === 0) {
    return { ok: false, code: 'no-relays', message: 'need at least one relay' };
  }
  const issuedAt =
    typeof draft.issuedAt === 'number' && Number.isFinite(draft.issuedAt)
      ? Math.trunc(draft.issuedAt)
      : Date.now();
  let expiresAt: number;
  if (typeof draft.expiresAt === 'number' && Number.isFinite(draft.expiresAt)) {
    expiresAt = Math.trunc(draft.expiresAt);
  } else {
    const ttl =
      typeof draft.ttlMs === 'number' && Number.isFinite(draft.ttlMs)
        ? Math.max(0, Math.trunc(draft.ttlMs))
        : REDIRECT_NOTE_DEFAULT_TTL_MS;
    expiresAt = issuedAt + ttl;
  }
  if (expiresAt < issuedAt) {
    return {
      ok: false,
      code: 'bad-expiry',
      message: 'expiresAt before issuedAt',
    };
  }
  const pk = encodePublicKey(owner.publicKey);
  const message = canonicalRelayRedirect(pk, relays, issuedAt, expiresAt);
  try {
    const signature = await signText(message, owner.secretKey);
    const note: RelayRedirectNote = {
      v: REDIRECT_NOTE_VERSION,
      pk,
      relays,
      issuedAt,
      expiresAt,
      sig: bytesToHex(signature),
    };
    return { ok: true, value: REDIRECT_NOTE_PREFIX + JSON.stringify(note) };
  } catch (error) {
    return {
      ok: false,
      code: 'sign-failed',
      message: error instanceof Error ? error.message : 'sign failed',
    };
  }
};

export const parseRelayRedirectNote = (
  text: string,
): CryptoResult<RelayRedirectNote> => {
  const payload = extractPayload(text);
  if (!payload) {
    return { ok: false, code: 'not-found', message: 'no R1. redirect note' };
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid redirect JSON' };
  }
  if (!json || typeof json !== 'object') {
    return { ok: false, code: 'bad-shape', message: 'redirect not an object' };
  }
  const raw = json as Record<string, unknown>;
  if (raw.v !== REDIRECT_NOTE_VERSION) {
    return {
      ok: false,
      code: 'bad-version',
      message: 'unsupported redirect version',
    };
  }
  if (typeof raw.pk !== 'string' || typeof raw.sig !== 'string') {
    return { ok: false, code: 'bad-shape', message: 'missing pk/sig' };
  }
  if (
    typeof raw.issuedAt !== 'number' ||
    !Number.isFinite(raw.issuedAt) ||
    typeof raw.expiresAt !== 'number' ||
    !Number.isFinite(raw.expiresAt)
  ) {
    return { ok: false, code: 'bad-shape', message: 'bad issuedAt/expiresAt' };
  }
  if (!Array.isArray(raw.relays)) {
    return { ok: false, code: 'bad-shape', message: 'missing relays' };
  }
  const relays = normalizeRelayList(
    raw.relays.filter((item): item is string => typeof item === 'string'),
  );
  if (relays.length === 0) {
    return { ok: false, code: 'no-relays', message: 'no usable relay URLs' };
  }
  return {
    ok: true,
    value: {
      v: REDIRECT_NOTE_VERSION,
      pk: raw.pk,
      relays,
      issuedAt: Math.trunc(raw.issuedAt),
      expiresAt: Math.trunc(raw.expiresAt),
      sig: raw.sig,
    },
  };
};

export const verifyRelayRedirectNote = async (
  note: RelayRedirectNote,
  now = Date.now(),
): Promise<CryptoResult<true>> => {
  if (now > note.expiresAt) {
    return { ok: false, code: 'expired', message: 'redirect note expired' };
  }
  if (note.expiresAt < note.issuedAt) {
    return {
      ok: false,
      code: 'bad-expiry',
      message: 'expiresAt before issuedAt',
    };
  }
  const key = decodePublicKey(note.pk);
  if (!key.ok) return key;
  const sig = hexToBytes(note.sig);
  if (!sig.ok) return sig;
  if (sig.value.byteLength !== 64) {
    return {
      ok: false,
      code: 'bad-sig-length',
      message: 'signature must be 64 bytes',
    };
  }
  const message = canonicalRelayRedirect(
    note.pk,
    note.relays,
    note.issuedAt,
    note.expiresAt,
  );
  const ok = await verifyText(sig.value, message, key.value);
  if (!ok) {
    return {
      ok: false,
      code: 'bad-sig',
      message: 'redirect signature invalid',
    };
  }
  return { ok: true, value: true };
};

export const parseAndVerifyRelayRedirectNote = async (
  text: string,
  now = Date.now(),
): Promise<CryptoResult<RelayRedirectNote>> => {
  const parsed = parseRelayRedirectNote(text);
  if (!parsed.ok) return parsed;
  const verified = await verifyRelayRedirectNote(parsed.value, now);
  if (!verified.ok) return verified;
  return parsed;
};
