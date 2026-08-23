import { appLinkCopy } from '@/content/index.ts';
import type { AppSection } from '@/ui/sections.ts';

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
  const trimmed = body.replace(/^#/, '').replace(/^\/+/, '').trim();
  if (!trimmed) return { kind: 'section', section: 'contacts' };
  const deep = parseKindPayload(trimmed);
  if (deep) return deep;
  const id = trimmed.split('/')[0]?.toLowerCase() ?? '';
  if (
    id === 'servers' ||
    id === 'lan' ||
    id === 'contacts' ||
    id === 'calls' ||
    id === 'logs' ||
    id === 'help'
  ) {
    return { kind: 'section', section: id };
  }
  if (id === 'video') {
    return { kind: 'section', section: 'calls' };
  }
  if (id === 'my-server' || id === 'transfer') {
    return {
      kind: 'section',
      section: id === 'transfer' ? 'lan' : 'servers',
    };
  }
  return { kind: 'section', section: 'contacts' };
};

export const parseDeepLink = (hash: string, search = ''): DeepLink => {
  const query = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const nc = params.get('nc');
  if (nc) return parseBody(stripProtocol(decodePart(nc)));
  return parseBody(hash);
};

export const parsePastedShare = (raw: string): DeepLink => {
  const text = raw.trim();
  if (!text) return { kind: 'section', section: 'contacts' };
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const parsed = parseDeepLink(url.hash, url.search);
      if (parsed.kind !== 'section') return parsed;
    } catch {
      /* not a URL */
    }
  }
  const proto = stripProtocol(text);
  if (
    proto !== text.trim() ||
    text.toLowerCase().startsWith(`${APP_PROTOCOL}:`)
  ) {
    const parsed = parseDeepLink(proto.startsWith('#') ? proto : `#${proto}`);
    if (parsed.kind !== 'section') return parsed;
  }
  const asHash = text.startsWith('#')
    ? text
    : /^[jars]\//i.test(text)
      ? `#${text}`
      : '';
  if (asHash) {
    const parsed = parseDeepLink(asHash);
    if (parsed.kind !== 'section') return parsed;
  }
  if (/^S1\./i.test(text)) {
    return { kind: 'pack', section: 'servers', payload: text };
  }
  if (/^N1\./i.test(text)) {
    return { kind: 'join', section: 'lan', payload: text };
  }
  return { kind: 'section', section: 'contacts' };
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
  return appLinkCopy.shareMessage(httpsLink, protocolLink);
};
