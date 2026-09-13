/**
 * Live relay URL bundle (M2 T2.2).
 * Wire shape matches src/domain/relay/bundle.ts (`op: 'relays'`).
 */

export const RELAY_BUNDLE_VERSION = 1;
export const RELAY_BUNDLE_MAX = 32;

const stripNoise = (raw) =>
  String(raw ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

/** Lenient normalize for env / request hosts (server-side twin of discovery). */
export const normalizeRelayUrl = (raw) => {
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
    if (parsed.pathname === '/') parsed.pathname = '';
    return parsed.toString().replace(/\/$/, '') || parsed.origin;
  } catch {
    return null;
  }
};

export const parseRelayUrlList = (raw) => {
  const text = stripNoise(raw);
  if (!text) return [];
  const urls = [];
  const seen = new Set();
  for (const part of text.split(/[\s,]+/)) {
    const url = normalizeRelayUrl(part);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= RELAY_BUNDLE_MAX) break;
  }
  return urls;
};

export const selfUrlFromRequest = (req) => {
  const host = req?.headers?.host;
  if (typeof host !== 'string' || !host.trim()) return null;
  const forwarded = req.headers['x-forwarded-proto'];
  const proto =
    typeof forwarded === 'string' && forwarded.split(',')[0]?.trim() === 'https'
      ? 'https'
      : 'http';
  return normalizeRelayUrl(`${proto}://${host.trim()}`);
};

/**
 * @param {{
 *   envUrls?: string,
 *   publicUrl?: string,
 *   caps?: { signaling: boolean, stun?: boolean, turn?: boolean, challengeAuth?: boolean },
 * }} [options]
 */
export const createRelayBundleFactory = (options = {}) => {
  const envList = parseRelayUrlList(
    options.envUrls ?? process.env.RELAY_URLS ?? '',
  );
  const publicUrl = normalizeRelayUrl(
    options.publicUrl ?? process.env.RELAY_PUBLIC_URL ?? '',
  );
  const caps = options.caps ?? {
    signaling: true,
    stun: true,
    challengeAuth: true,
  };

  /**
   * @param {{ selfUrl?: string | null }} [request]
   */
  return (request = {}) => {
    const seen = new Set();
    const relays = [];
    const push = (url, withCaps) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      relays.push(withCaps ? { url, caps } : { url });
    };

    const selfUrl = normalizeRelayUrl(request.selfUrl ?? '') || publicUrl;
    push(selfUrl, true);
    for (const url of envList) push(url, url === selfUrl);

    if (relays.length === 0 && selfUrl) push(selfUrl, true);

    return {
      op: 'relays',
      v: RELAY_BUNDLE_VERSION,
      issuedAt: Date.now(),
      relays,
    };
  };
};
