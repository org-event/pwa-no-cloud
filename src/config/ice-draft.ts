import { listIceUrls, sortIceUrls } from './ice-urls.ts';
import { isTurnUrl } from './merge.ts';
import type { IceServerConfig } from './types.ts';

export type IceDraft = {
  stun: string[];
  turn: string[];
  username: string;
  credential: string;
};

const readLines = (text: string): string[] => {
  const lines = text.split('\n');
  const values: string[] = [];
  for (const line of lines) {
    const value = line.trim();
    if (value) values.push(value);
  }
  return values;
};

export const splitIceServers = (servers: IceServerConfig[]): IceDraft => {
  const stun: string[] = [];
  const turn: string[] = [];
  let username = '';
  let credential = '';
  for (const server of servers) {
    const urls = listIceUrls(server.urls);
    for (const url of urls) {
      if (isTurnUrl(url)) {
        turn.push(url);
        if (server.username) username = server.username;
        if (server.credential) credential = server.credential;
        continue;
      }
      stun.push(url);
    }
  }
  return { stun, turn, username, credential };
};

export const draftIceServers = (draft: IceDraft): IceServerConfig[] => {
  const iceServers: IceServerConfig[] = [];
  for (const url of draft.stun) {
    iceServers.push({ urls: url });
  }
  if (draft.turn.length === 0) return iceServers;
  const turnUrls = sortIceUrls(draft.turn);
  iceServers.push({
    urls: turnUrls.length === 1 ? (turnUrls[0] as string) : turnUrls,
    username: draft.username,
    credential: draft.credential,
  });
  return iceServers;
};

export const draftIceServersFromText = (input: {
  stun: string;
  turn: string;
  username: string;
  credential: string;
}): IceServerConfig[] =>
  draftIceServers({
    stun: readLines(input.stun),
    turn: readLines(input.turn),
    username: input.username.trim(),
    credential: input.credential,
  });

const isIceServer = (value: unknown): value is IceServerConfig => {
  if (!value || typeof value !== 'object') return false;
  const record = value as IceServerConfig;
  if (typeof record.urls === 'string') return record.urls.length > 0;
  if (!Array.isArray(record.urls) || record.urls.length === 0) return false;
  for (const url of record.urls) {
    if (typeof url !== 'string' || url.length === 0) return false;
  }
  return true;
};

export const parseIceServersJson = (
  raw: string,
): { ok: true; value: IceServerConfig[] } | { ok: false; message: string } => {
  const text = raw.trim();
  if (!text) return { ok: true, value: [] };
  try {
    const data = JSON.parse(text) as unknown;
    let list: unknown = data;
    if (!Array.isArray(data) && data && typeof data === 'object') {
      const record = data as { iceServers?: unknown };
      list = record.iceServers;
    }
    if (!Array.isArray(list) || list.length === 0) {
      return {
        ok: false,
        message: 'iceServers JSON должен быть непустым массивом',
      };
    }
    const servers: IceServerConfig[] = [];
    for (const item of list) {
      if (!isIceServer(item)) {
        return {
          ok: false,
          message: 'В iceServers JSON есть некорректная запись',
        };
      }
      servers.push({
        urls: item.urls,
        username: item.username,
        credential: item.credential,
      });
    }
    return { ok: true, value: servers };
  } catch {
    return { ok: false, message: 'Не удалось прочитать iceServers JSON' };
  }
};
