import {
  emptyRelayBundle,
  type RelayBundle,
} from '@/domain/discovery/index.ts';

export const RELAY_BUNDLE_KEY = 'nocloud.relayBundle.v1';

export type RelayBundleStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const loadRelayBundle = (storage: RelayBundleStorage): RelayBundle => {
  const raw = storage.getItem(RELAY_BUNDLE_KEY);
  if (!raw) return emptyRelayBundle();
  try {
    const parsed = JSON.parse(raw) as Partial<RelayBundle>;
    const urls = Array.isArray(parsed.urls)
      ? parsed.urls.filter((item): item is string => typeof item === 'string')
      : [];
    const activeUrl =
      typeof parsed.activeUrl === 'string' && urls.includes(parsed.activeUrl)
        ? parsed.activeUrl
        : (urls[0] ?? null);
    return {
      urls,
      activeUrl,
      updatedAt:
        typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return emptyRelayBundle();
  }
};

export const saveRelayBundle = (
  storage: RelayBundleStorage,
  bundle: RelayBundle,
): void => {
  storage.setItem(RELAY_BUNDLE_KEY, JSON.stringify(bundle));
};
