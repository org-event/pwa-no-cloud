import { sharePackCopy } from '@/content/index.ts';
import { parseIceServersJson } from './ice-draft.ts';
import type { CustomServerDraft, SignalingKind } from './types.ts';

export const SHARE_PACK_PREFIX = 'S1.';

const isKind = (value: unknown): value is SignalingKind => {
  return value === 'manual' || value === 'http-poll' || value === 'websocket';
};

export const parseShareDraft = (raw: unknown): CustomServerDraft | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as {
    signaling?: { kind?: unknown; url?: unknown };
    iceServers?: unknown;
  };
  const kind = record.signaling?.kind;
  if (!isKind(kind)) return null;
  const ice = parseIceServersJson(JSON.stringify(record.iceServers ?? []));
  if (!ice.ok || ice.value.length === 0) return null;
  const url =
    typeof record.signaling?.url === 'string'
      ? record.signaling.url
      : undefined;
  if (kind === 'manual') return { signaling: { kind }, iceServers: ice.value };
  if (!url) return null;
  return { signaling: { kind, url }, iceServers: ice.value };
};

export const encodeSharePack = (draft: CustomServerDraft): string => {
  return SHARE_PACK_PREFIX + JSON.stringify({ v: 1, ...draft });
};

export const decodeSharePack = (
  text: string,
): { ok: true; value: CustomServerDraft } | { ok: false; message: string } => {
  const raw = text.trim();
  if (!raw.startsWith(SHARE_PACK_PREFIX)) {
    return { ok: false, message: sharePackCopy.notPack };
  }
  try {
    const parsed = JSON.parse(raw.slice(SHARE_PACK_PREFIX.length)) as unknown;
    const draft = parseShareDraft(parsed);
    if (!draft) {
      return { ok: false, message: sharePackCopy.broken };
    }
    return { ok: true, value: draft };
  } catch {
    return { ok: false, message: sharePackCopy.unreadable };
  }
};

export const iceOnlyShare = (
  iceServers: CustomServerDraft['iceServers'],
): CustomServerDraft => ({
  signaling: { kind: 'manual' },
  iceServers,
});
