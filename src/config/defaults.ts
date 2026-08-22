import type { CustomServerDraft, SignalingConfig } from './types.ts';

export const APP_NAME = 'NoCloud';

export const APP_TAGLINE = 'обмен файлами без облака';

export const DEFAULT_PRESET_ID = 'manual-only';

export const LOCAL_SIGNALING_PORT = 8000;

export const LOCAL_STUN_PORT = 3478;

export const DEFAULT_ROOM = 'nocloud';

export const SETTINGS_STORAGE_KEY = 'nocloud.servers.v1';

export const DATA_CHANNELS = {
  control: 'control',
  bytes: 'bytes',
} as const;

export const CHUNK_SIZE_BYTES = 64 * 1024;

export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

export const CHANNEL_BUFFER_HIGH = 256 * 1024;

export const DEFAULT_SIGNALING: SignalingConfig = {
  kind: 'manual',
};

export const EMPTY_CUSTOM: CustomServerDraft = {
  signaling: { kind: 'websocket', url: '' },
  iceServers: [],
};

export const GOOGLE_STUN = 'stun:stun.l.google.com:19302';

export const GOOGLE_STUN_BACKUP = 'stun:stun1.l.google.com:19302';
