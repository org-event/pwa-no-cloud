/**
 * Discovery domain — relay bundle, bootstrap, redirects (DHT later).
 */

export type RelayUrl = string;

export type RelayBundle = {
  active: RelayUrl[];
  cached: RelayUrl[];
  updatedAt: number;
};

export const emptyRelayBundle = (): RelayBundle => ({
  active: [],
  cached: [],
  updatedAt: 0,
});
