/**
 * Live relay bundle wire contract (M2 T2.1).
 * Relay advertises known signaling URLs; client caches / failovers later (T2.3–T2.4).
 * Distinct from room `{ op: 'peers' }` (lobby fingerprints).
 */

import { normalizeRelayUrl, type RelayUrl } from '../discovery/index.ts';

/** Same shape as RelayCapabilities; kept local to avoid cycle with index.ts. */
export type RelayHintCaps = {
  signaling: boolean;
  stun?: boolean;
  turn?: boolean;
  challengeAuth?: boolean;
};

export const RELAY_BUNDLE_VERSION = 1 as const;
export const RELAY_BUNDLE_MAX = 32;

export type RelayHint = {
  /** Signaling base URL (ws/wss/http/https). */
  url: RelayUrl;
  caps?: RelayHintCaps;
};

export type RelayBundleMessage = {
  op: 'relays';
  v: typeof RELAY_BUNDLE_VERSION;
  /** Preferred order: healthier / closer first. */
  relays: RelayHint[];
  /** Unix ms when the relay minted this snapshot. */
  issuedAt: number;
};

const isCaps = (value: unknown): value is RelayHintCaps => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (typeof row.signaling !== 'boolean') return false;
  for (const key of ['stun', 'turn', 'challengeAuth'] as const) {
    if (row[key] !== undefined && typeof row[key] !== 'boolean') return false;
  }
  return true;
};

export const parseRelayHint = (value: unknown): RelayHint | null => {
  if (typeof value === 'string') {
    const url = normalizeRelayUrl(value);
    return url ? { url } : null;
  }
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.url !== 'string') return null;
  const url = normalizeRelayUrl(row.url);
  if (!url) return null;
  if (row.caps !== undefined && !isCaps(row.caps)) return null;
  return row.caps ? { url, caps: row.caps } : { url };
};

export const parseRelayBundleMessage = (
  raw: unknown,
): RelayBundleMessage | null => {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (row.op !== 'relays') return null;
  if (row.v !== RELAY_BUNDLE_VERSION) return null;
  if (typeof row.issuedAt !== 'number' || !Number.isFinite(row.issuedAt)) {
    return null;
  }
  if (!Array.isArray(row.relays) || row.relays.length === 0) return null;
  const relays: RelayHint[] = [];
  const seen = new Set<string>();
  for (const item of row.relays) {
    const hint = parseRelayHint(item);
    if (!hint) return null;
    if (seen.has(hint.url)) continue;
    seen.add(hint.url);
    relays.push(hint);
    if (relays.length >= RELAY_BUNDLE_MAX) break;
  }
  if (relays.length === 0) return null;
  return {
    op: 'relays',
    v: RELAY_BUNDLE_VERSION,
    relays,
    issuedAt: Math.trunc(row.issuedAt),
  };
};

/** URLs only, stable order from the wire message. */
export const relayUrlsOf = (message: RelayBundleMessage): RelayUrl[] =>
  message.relays.map((item) => item.url);
