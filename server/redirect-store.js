/**
 * In-memory R1. redirect note store keyed by owner pubkey (M3 U3.1 / FR-RL-05).
 * Verify logic mirrors src/domain/relay/redirect.ts (server cannot import @/domain).
 */

import * as ed from '@noble/ed25519';
import { decodePublicKeyWire, hexToBytes } from './challenge.js';
import { normalizeRelayUrl } from './relay-bundle.js';

export const REDIRECT_NOTE_PREFIX = 'R1.';
export const REDIRECT_NOTE_VERSION = 1;
export const REDIRECT_NOTE_MAX_RELAYS = 16;

export const canonicalRelayRedirect = (pk, relays, issuedAt, expiresAt) => {
  const sorted = [...relays].sort();
  return `nocloud.redirect.v${REDIRECT_NOTE_VERSION}|${pk}|${sorted.join(',')}|${issuedAt}|${expiresAt}`;
};

const stripNoise = (text) =>
  String(text ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

const extractPayload = (text) => {
  const raw = stripNoise(text);
  if (!raw) return null;
  const packed = raw.match(/R1\.\s*(\{[\s\S]*\})/i);
  if (packed?.[1]) return packed[1];
  if (raw.startsWith('{')) return raw;
  return null;
};

const normalizeRelayList = (raw) => {
  const urls = [];
  const seen = new Set();
  for (const item of raw) {
    const url = normalizeRelayUrl(item);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= REDIRECT_NOTE_MAX_RELAYS) break;
  }
  return urls;
};

/**
 * @param {string} text
 * @returns {{ ok: true, value: object } | { ok: false, code: string, message: string }}
 */
export const parseRelayRedirectNote = (text) => {
  const payload = extractPayload(text);
  if (!payload) {
    return { ok: false, code: 'not-found', message: 'no R1. redirect note' };
  }
  let json;
  try {
    json = JSON.parse(payload);
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid redirect JSON' };
  }
  if (!json || typeof json !== 'object') {
    return { ok: false, code: 'bad-shape', message: 'redirect not an object' };
  }
  const raw = /** @type {Record<string, unknown>} */ (json);
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
    raw.relays.filter((item) => typeof item === 'string'),
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

/**
 * @param {object} note
 * @param {number} [now]
 */
export const verifyRelayRedirectNote = async (note, now = Date.now()) => {
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
  const key = decodePublicKeyWire(note.pk);
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
  const message = new TextEncoder().encode(
    canonicalRelayRedirect(note.pk, note.relays, note.issuedAt, note.expiresAt),
  );
  const ok = await ed.verifyAsync(sig.value, message, key.value);
  if (!ok) {
    return {
      ok: false,
      code: 'bad-sig',
      message: 'redirect signature invalid',
    };
  }
  return { ok: true, value: true };
};

export const encodeRedirectWire = (note) =>
  REDIRECT_NOTE_PREFIX + JSON.stringify(note);

/**
 * @param {{ now?: () => number, maxEntries?: number }} [opts]
 */
export const createRedirectStore = ({
  now = () => Date.now(),
  maxEntries = 10_000,
} = {}) => {
  /** @type {Map<string, { wire: string, issuedAt: number, expiresAt: number }>} */
  const entries = new Map();

  const sweep = () => {
    const t = now();
    for (const [pk, row] of entries) {
      if (row.expiresAt <= t) entries.delete(pk);
    }
  };

  /**
   * @param {string} wire
   */
  const put = async (wire) => {
    const parsed = parseRelayRedirectNote(wire);
    if (!parsed.ok) return parsed;
    const verified = await verifyRelayRedirectNote(parsed.value, now());
    if (!verified.ok) return verified;

    const note = parsed.value;
    const existing = entries.get(note.pk);
    if (existing && existing.issuedAt > note.issuedAt) {
      return {
        ok: false,
        code: 'stale',
        message: 'older note than stored',
      };
    }

    sweep();
    if (!entries.has(note.pk) && entries.size >= maxEntries) {
      return {
        ok: false,
        code: 'full',
        message: 'redirect store full',
      };
    }

    const storedWire = encodeRedirectWire(note);
    entries.set(note.pk, {
      wire: storedWire,
      issuedAt: note.issuedAt,
      expiresAt: note.expiresAt,
    });
    return {
      ok: true,
      value: { pk: note.pk, expiresAt: note.expiresAt, wire: storedWire },
    };
  };

  /**
   * @param {string} pk
   */
  const get = (pk) => {
    const key = stripNoise(pk);
    if (!key) {
      return { ok: false, code: 'bad-pk', message: 'pk required' };
    }
    const row = entries.get(key);
    if (!row) {
      sweep();
      return { ok: false, code: 'not-found', message: 'no redirect for pk' };
    }
    if (row.expiresAt <= now()) {
      entries.delete(key);
      return { ok: false, code: 'expired', message: 'redirect note expired' };
    }
    return {
      ok: true,
      value: { pk: key, expiresAt: row.expiresAt, note: row.wire },
    };
  };

  return {
    put,
    get,
    size: () => {
      sweep();
      return entries.size;
    },
    clear: () => entries.clear(),
  };
};
