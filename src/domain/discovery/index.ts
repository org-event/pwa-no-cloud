/**
 * Discovery domain — relay bundle (S3.5 multi-relay seed; full mesh later).
 * One active relay URL at a time; manual switch only in M1.
 */

export type RelayUrl = string;

export type RelayBundle = {
  /** Known relay signaling URLs (ws/wss/http/https). */
  urls: RelayUrl[];
  /** Currently selected relay; must be in `urls` when set. */
  activeUrl: RelayUrl | null;
  updatedAt: number;
};

export const emptyRelayBundle = (): RelayBundle => ({
  urls: [],
  activeUrl: null,
  updatedAt: 0,
});

const stripNoise = (raw: string): string =>
  raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

/** Normalize a pasted relay base / signaling URL; returns null if unusable. */
export const normalizeRelayUrl = (raw: string): RelayUrl | null => {
  const text = stripNoise(raw);
  if (!text) return null;
  try {
    const withScheme = /^[a-z]+:\/\//i.test(text) ? text : `https://${text}`;
    const parsed = new URL(withScheme);
    if (
      parsed.protocol !== 'http:' &&
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'ws:' &&
      parsed.protocol !== 'wss:'
    ) {
      return null;
    }
    parsed.hash = '';
    // Drop trailing slash for stable compare; keep path if non-root.
    if (parsed.pathname === '/') parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '') || parsed.origin;
  } catch {
    return null;
  }
};

export const addRelayUrl = (
  bundle: RelayBundle,
  raw: string,
  now = Date.now(),
): RelayBundle => {
  const url = normalizeRelayUrl(raw);
  if (!url) return bundle;
  if (bundle.urls.includes(url)) {
    return bundle.activeUrl === url
      ? bundle
      : { ...bundle, activeUrl: url, updatedAt: now };
  }
  const urls = [...bundle.urls, url];
  return {
    urls,
    activeUrl: bundle.activeUrl ?? url,
    updatedAt: now,
  };
};

export const removeRelayUrl = (
  bundle: RelayBundle,
  raw: string,
  now = Date.now(),
): RelayBundle => {
  const url = normalizeRelayUrl(raw) ?? stripNoise(raw);
  const urls = bundle.urls.filter((item) => item !== url);
  const activeUrl =
    bundle.activeUrl === url ? (urls[0] ?? null) : bundle.activeUrl;
  return { urls, activeUrl, updatedAt: now };
};

export const setActiveRelay = (
  bundle: RelayBundle,
  raw: string,
  now = Date.now(),
): RelayBundle => {
  const url = normalizeRelayUrl(raw) ?? stripNoise(raw);
  if (!bundle.urls.includes(url)) return bundle;
  if (bundle.activeUrl === url) return bundle;
  return { ...bundle, activeUrl: url, updatedAt: now };
};

export const activeRelayOf = (bundle: RelayBundle): RelayUrl | null =>
  bundle.activeUrl && bundle.urls.includes(bundle.activeUrl)
    ? bundle.activeUrl
    : (bundle.urls[0] ?? null);
