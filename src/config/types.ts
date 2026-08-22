export type SignalingKind = 'manual' | 'http-poll' | 'websocket';

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type SignalingConfig = {
  kind: SignalingKind;
  url?: string;
};

export type ServerPreset = {
  id: string;
  title: string;
  signaling: SignalingConfig;
  iceServers: IceServerConfig[];
};

export type CustomServerDraft = {
  signaling: SignalingConfig;
  iceServers: IceServerConfig[];
};

export type UserSettings = {
  presetId: string;
  custom: CustomServerDraft;
};

export type ResolvedServerConfig = {
  presetId: string;
  title: string;
  signaling: SignalingConfig;
  iceServers: IceServerConfig[];
};

export type ConfigError = {
  ok: false;
  code: string;
  message: string;
};

export type ResolveResult =
  | { ok: true; value: ResolvedServerConfig }
  | ConfigError;
