import type { AppSection } from '../ui/sections.ts';

export const APP_PROTOCOL = 'web+nocloud';

export type DeepKind = 'join' | 'answer' | 'pack' | 'room';

export type DeepLink =
  | { kind: 'section'; section: AppSection }
  | { kind: DeepKind; section: AppSection; payload: string };

const KIND_SECTION: Record<DeepKind, AppSection> = {
  join: 'lan',
  answer: 'lan',
  room: 'lan',
  pack: 'servers',
};

const KIND_ALIASES: Record<string, DeepKind> = {
  j: 'join',
  join: 'join',
  a: 'answer',
  answer: 'answer',
  s: 'pack',
  pack: 'pack',
  r: 'room',
  room: 'room',
};

const decodePart = (raw: string): string => {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const firstSlash = (value: string): number => {
  return value.indexOf('/');
};

const parseKindPayload = (body: string): DeepLink | null => {
  const cut = firstSlash(body);
  if (cut <= 0) return null;
  const kind = KIND_ALIASES[body.slice(0, cut).toLowerCase()];
  if (!kind) return null;
  const payload = decodePart(body.slice(cut + 1));
  if (!payload) return null;
  return { kind, section: KIND_SECTION[kind], payload };
};

const stripProtocol = (raw: string): string => {
  let text = raw.trim();
  const lower = text.toLowerCase();
  const full = `${APP_PROTOCOL}://`;
  const short = `${APP_PROTOCOL}:`;
  if (lower.startsWith(full)) text = text.slice(full.length);
  else if (lower.startsWith(short)) text = text.slice(short.length);
  if (text.startsWith('//')) text = text.slice(2);
  if (text.startsWith('#')) text = text.slice(1);
  return text;
};

const parseBody = (body: string): DeepLink => {
  const trimmed = body.replace(/^#/, '').trim();
  if (!trimmed) return { kind: 'section', section: 'lan' };
  const deep = parseKindPayload(trimmed);
  if (deep) return deep;
  const id = trimmed.split('/')[0]?.toLowerCase() ?? '';
  if (
    id === 'servers' ||
    id === 'lan' ||
    id === 'contacts' ||
    id === 'video' ||
    id === 'logs' ||
    id === 'help'
  ) {
    return { kind: 'section', section: id };
  }
  if (id === 'my-server' || id === 'transfer') {
    return {
      kind: 'section',
      section: id === 'transfer' ? 'lan' : 'servers',
    };
  }
  return { kind: 'section', section: 'lan' };
};

export const parseDeepLink = (hash: string, search = ''): DeepLink => {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const nc = params.get('nc');
  if (nc) return parseBody(stripProtocol(decodePart(nc)));
  return parseBody(hash);
};

export const encodeDeepHash = (kind: DeepKind, payload: string): string => {
  const token =
    kind === 'join'
      ? 'j'
      : kind === 'answer'
        ? 'a'
        : kind === 'pack'
          ? 's'
          : 'r';
  return `#${token}/${encodeURIComponent(payload)}`;
};

export const appPageUrl = (origin: string, base: string): string => {
  const root = base.endsWith('/') ? base : `${base}/`;
  const path = root.startsWith('/') ? root : `/${root}`;
  return `${origin.replace(/\/$/, '')}${path}`;
};

export const encodeHttpsLink = (
  origin: string,
  base: string,
  kind: DeepKind,
  payload: string,
): string => {
  return `${appPageUrl(origin, base)}${encodeDeepHash(kind, payload)}`;
};

export const encodeProtocolLink = (kind: DeepKind, payload: string): string => {
  const hash = encodeDeepHash(kind, payload);
  return `${APP_PROTOCOL}://${hash.slice(1)}`;
};

export const protocolHandlerUrl = (origin: string, base: string): string => {
  return `${appPageUrl(origin, base)}?nc=%s`;
};

export const cleanLocation = (href: string, section: AppSection): string => {
  const url = new URL(href);
  url.searchParams.delete('nc');
  url.hash = `#${section}`;
  return `${url.pathname}${url.search}${url.hash}`;
};

export const shareMessage = (
  httpsLink: string,
  protocolLink: string,
): string => {
  return (
    `NoCloud — открой ссылку в браузере или в установленном приложении:\n` +
    `${httpsLink}\n\n` +
    `Если PWA уже стоит (Chrome/Android): ${protocolLink}`
  );
};
