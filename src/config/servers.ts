import {
  DEFAULT_PRESET_ID,
  EMPTY_CUSTOM,
  GOOGLE_STUN,
  GOOGLE_STUN_BACKUP,
  LOCAL_SIGNALING_PORT,
  LOCAL_STUN_PORT,
} from './defaults.ts';
import type { ServerPreset } from './types.ts';

const localHttp = `http://127.0.0.1:${LOCAL_SIGNALING_PORT}`;
const localStun = `stun:127.0.0.1:${LOCAL_STUN_PORT}`;

export const SERVER_PRESETS: ServerPreset[] = [
  {
    id: 'manual-only',
    title: 'Вручную + STUN Google',
    signaling: { kind: 'manual' },
    iceServers: [{ urls: GOOGLE_STUN }],
  },
  {
    id: 'local-dev',
    title: 'Локальный dev',
    signaling: { kind: 'http-poll', url: localHttp },
    iceServers: [{ urls: localStun }],
  },
  {
    id: 'lan',
    title: 'Локальная сеть',
    signaling: { kind: 'http-poll', url: localHttp },
    iceServers: [{ urls: localStun }],
  },
  {
    id: 'google-stun',
    title: 'Интернет: STUN Google (без TURN)',
    signaling: { kind: 'manual' },
    iceServers: [{ urls: [GOOGLE_STUN, GOOGLE_STUN_BACKUP] }],
  },
  {
    id: 'custom',
    title: 'Свой сервер',
    signaling: EMPTY_CUSTOM.signaling,
    iceServers: [],
  },
];

export const getPreset = (id: string): ServerPreset | null => {
  for (const preset of SERVER_PRESETS) {
    if (preset.id === id) return preset;
  }
  return null;
};

export const getDefaultPreset = (): ServerPreset => {
  const preset = getPreset(DEFAULT_PRESET_ID);
  if (!preset) {
    throw new Error('default preset is missing');
  }
  return preset;
};

const hostFromOrigin = (origin: string): string => {
  try {
    return new URL(origin).hostname;
  } catch {
    return '127.0.0.1';
  }
};

export const createLanPreset = (origin: string): ServerPreset => {
  const host = hostFromOrigin(origin);
  const stunUrl = `stun:${host}:${LOCAL_STUN_PORT}`;
  return {
    id: 'lan',
    title: 'Локальная сеть',
    signaling: { kind: 'http-poll', url: origin },
    iceServers: [{ urls: stunUrl }],
  };
};
