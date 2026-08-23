import { probeCopy } from '@/content/index.ts';

/** HTTPS/HTTP health URL from a signaling base or ws(s) URL. */
export const healthUrlFromSignaling = (raw: string): string | null => {
  const text = raw.trim();
  if (!text) return null;
  try {
    const withScheme = /^wss?:\/\//i.test(text)
      ? text.replace(/^ws/i, 'http')
      : text;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      return null;
    parsed.pathname = '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
};

export type ProbeResult = { ok: true } | { ok: false; message: string };

export const probeSignaling = async (
  signalingUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeResult> => {
  const health = healthUrlFromSignaling(signalingUrl);
  if (!health) {
    return { ok: false, message: probeCopy.noSocketUrl };
  }
  try {
    const response = await fetchImpl(health, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { ok?: unknown };
    if (body?.ok === true) return { ok: true };
    return { ok: false, message: probeCopy.noOkTrue };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : probeCopy.noResponse;
    return { ok: false, message };
  }
};
