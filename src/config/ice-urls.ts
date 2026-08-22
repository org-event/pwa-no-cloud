import type { IceServerConfig } from './types.ts';

export const listIceUrls = (urls: string | string[]): string[] => {
  if (Array.isArray(urls)) return urls;
  return [urls];
};

const turnScore = (url: string): number => {
  const tcp = url.startsWith('turns:') || url.includes('transport=tcp');
  const port443 = /:443(\?|$)/.test(url);
  const port80 = /:80(\?|$)/.test(url);
  if (tcp && port443) return 0;
  if (url.startsWith('turns:')) return 1;
  if (tcp && port80) return 2;
  if (tcp) return 3;
  if (port443) return 4;
  return 5;
};

export const sortIceUrls = (urls: string[]): string[] => {
  const stun: string[] = [];
  const turn: string[] = [];
  const other: string[] = [];
  for (const url of urls) {
    if (url.startsWith('stun:') || url.startsWith('stuns:')) stun.push(url);
    else if (url.startsWith('turn:') || url.startsWith('turns:'))
      turn.push(url);
    else other.push(url);
  }
  turn.sort((left, right) => turnScore(left) - turnScore(right));
  return [...stun, ...turn, ...other];
};

export const orderIceServersForBrowser = (
  iceServers: IceServerConfig[],
): IceServerConfig[] => {
  const ordered: IceServerConfig[] = [];
  for (const server of iceServers) {
    const urls = sortIceUrls(listIceUrls(server.urls));
    if (urls.length === 0) continue;
    ordered.push({
      ...server,
      urls: urls.length === 1 ? (urls[0] as string) : urls,
    });
  }
  return ordered;
};
