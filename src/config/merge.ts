import { DEFAULT_SIGNALING, EMPTY_CUSTOM } from './defaults.ts';
import { listIceUrls } from './ice-urls.ts';
import { createLanPreset, getDefaultPreset, getPreset } from './servers.ts';
import type {
  IceServerConfig,
  ResolveResult,
  SignalingConfig,
  UserSettings,
} from './types.ts';

export const isTurnUrl = (url: string): boolean => {
  return url.startsWith('turn:') || url.startsWith('turns:');
};

export const isStunUrl = (url: string): boolean => {
  return url.startsWith('stun:') || url.startsWith('stuns:');
};

const iceHasKind = (
  server: IceServerConfig,
  match: (url: string) => boolean,
): boolean => {
  const urls = listIceUrls(server.urls);
  for (const url of urls) {
    if (match(url)) return true;
  }
  return false;
};

export const iceServersHaveTurn = (iceServers: IceServerConfig[]): boolean => {
  for (const server of iceServers) {
    if (iceHasKind(server, isTurnUrl)) return true;
  }
  return false;
};

export const iceServersHaveStun = (iceServers: IceServerConfig[]): boolean => {
  for (const server of iceServers) {
    if (iceHasKind(server, isStunUrl)) return true;
  }
  return false;
};

const hasSecret = (value: string | undefined): boolean => {
  return typeof value === 'string' && value.length > 0;
};

export const validateIceServers = (
  iceServers: IceServerConfig[],
): ResolveResult | null => {
  for (const server of iceServers) {
    if (!iceHasKind(server, isTurnUrl)) continue;
    if (hasSecret(server.username) && hasSecret(server.credential)) {
      continue;
    }
    return {
      ok: false,
      code: 'turn-credentials-required',
      message: 'TURN нужен логин и пароль. Чужой TURN в пресеты не кладём.',
    };
  }
  return null;
};

const mergeSignaling = (
  preset: SignalingConfig,
  overlay?: SignalingConfig,
): SignalingConfig => {
  const source = overlay ?? preset;
  const kind = source.kind ?? preset.kind ?? DEFAULT_SIGNALING.kind;
  const url = source.url ?? preset.url;
  if (kind === 'manual') return { kind };
  return { kind, url };
};

export const resolveServers = (
  settings: UserSettings,
  origin?: string,
): ResolveResult => {
  const selected = getPreset(settings.presetId) ?? getDefaultPreset();
  const preset =
    selected.id === 'lan' && origin ? createLanPreset(origin) : selected;
  const overlay = selected.id === 'custom' ? settings.custom : undefined;
  const signaling = mergeSignaling(preset.signaling, overlay?.signaling);
  const iceServers = overlay?.iceServers ?? preset.iceServers;
  const iceError = validateIceServers(iceServers);
  if (iceError) return iceError;
  if (signaling.kind !== 'manual' && !signaling.url) {
    return {
      ok: false,
      code: 'signaling-url-required',
      message: 'Для http-poll и websocket нужен URL signaling-сервера.',
    };
  }
  return {
    ok: true,
    value: {
      presetId: preset.id,
      title: preset.title,
      signaling,
      iceServers,
      hasTurn: iceServersHaveTurn(iceServers),
      hasStun: iceServersHaveStun(iceServers),
    },
  };
};

export const createUserSettings = (
  presetId = getDefaultPreset().id,
  custom = EMPTY_CUSTOM,
): UserSettings => ({
  presetId,
  custom: {
    signaling: { ...custom.signaling },
    iceServers: custom.iceServers.map((server) => ({ ...server })),
  },
});
