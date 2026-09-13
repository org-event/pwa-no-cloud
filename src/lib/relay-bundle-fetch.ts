import { healthUrlFromSignaling } from '@/lib/probe-signaling.ts';
import {
  parseRelayBundleMessage,
  relayUrlsOf,
  type RelayBundleMessage,
} from '@/domain/relay/bundle.ts';

/** HTTP GET target for the live relay bundle. */
export const relaysUrlFromSignaling = (raw: string): string | null => {
  const health = healthUrlFromSignaling(raw);
  if (!health) return null;
  try {
    return new URL('relays', health).toString();
  } catch {
    return null;
  }
};

export type FetchRelayBundleResult =
  | { ok: true; value: RelayBundleMessage }
  | { ok: false; code: string; message: string };

export const fetchRelayBundle = async (
  signalingUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchRelayBundleResult> => {
  const url = relaysUrlFromSignaling(signalingUrl);
  if (!url) {
    return { ok: false, code: 'bad-url', message: 'no relays URL' };
  }
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) {
      return {
        ok: false,
        code: 'http',
        message: `relays HTTP ${response.status}`,
      };
    }
    const json: unknown = await response.json();
    const message = parseRelayBundleMessage(json);
    if (!message) {
      return { ok: false, code: 'bad-shape', message: 'invalid relays body' };
    }
    return { ok: true, value: message };
  } catch (error) {
    return {
      ok: false,
      code: 'network',
      message: error instanceof Error ? error.message : 'relays fetch failed',
    };
  }
};

export const remoteRelayUrls = (message: RelayBundleMessage): string[] =>
  relayUrlsOf(message);
