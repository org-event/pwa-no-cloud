import { SETTINGS_STORAGE_KEY } from './defaults.ts';
import { createUserSettings } from './merge.ts';
import { getPreset } from './servers.ts';
import type {
  CustomServerDraft,
  IceServerConfig,
  SignalingKind,
  UserSettings,
} from './types.ts';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const isKind = (value: unknown): value is SignalingKind => {
  return value === 'manual' || value === 'http-poll' || value === 'websocket';
};

const readIceServers = (value: unknown): IceServerConfig[] | null => {
  if (!Array.isArray(value)) return null;
  const servers: IceServerConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    const urls = record.urls;
    const urlsOk =
      typeof urls === 'string' ||
      (Array.isArray(urls) && urls.every((url) => typeof url === 'string'));
    if (!urlsOk) return null;
    const server: IceServerConfig = {
      urls: urls as string | string[],
    };
    if (typeof record.username === 'string') {
      server.username = record.username;
    }
    if (typeof record.credential === 'string') {
      server.credential = record.credential;
    }
    servers.push(server);
  }
  return servers;
};

const readCustom = (value: unknown): CustomServerDraft | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const signaling = record.signaling;
  if (!signaling || typeof signaling !== 'object') return null;
  const signal = signaling as Record<string, unknown>;
  if (!isKind(signal.kind)) return null;
  const iceServers = readIceServers(record.iceServers);
  if (!iceServers) return null;
  const draft: CustomServerDraft = {
    signaling: { kind: signal.kind },
    iceServers,
  };
  if (typeof signal.url === 'string') {
    draft.signaling.url = signal.url;
  }
  return draft;
};

const parseSettings = (raw: string): UserSettings | null => {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object') return null;
    const record = data as Record<string, unknown>;
    if (typeof record.presetId !== 'string') return null;
    if (!getPreset(record.presetId)) return null;
    const custom = readCustom(record.custom);
    if (!custom) return null;
    return { presetId: record.presetId, custom };
  } catch {
    return null;
  }
};

export const loadUserSettings = (storage: StorageLike): UserSettings => {
  const raw = storage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) return createUserSettings();
  return parseSettings(raw) ?? createUserSettings();
};

export const saveUserSettings = (
  settings: UserSettings,
  storage: StorageLike,
) => {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const browserStorage = (): StorageLike => {
  if (typeof localStorage === 'undefined') {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    };
  }
  return localStorage;
};
