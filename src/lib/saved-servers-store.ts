import type { CustomServerDraft } from '@/config/types.ts';
import {
  createSavedServer,
  type SavedServer,
  type ServerReach,
} from '@/domain/saved-server.ts';
import type { OpfsResult, OpfsStore } from './opfs.ts';
import { readText, writeFile } from './opfs.ts';

export const SAVED_SERVERS_FILE = 'saved-servers.json';

const isReach = (value: unknown): value is ServerReach =>
  value === 'unknown' ||
  value === 'up' ||
  value === 'down' ||
  value === 'checking';

const parseDraft = (raw: unknown): CustomServerDraft | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as {
    signaling?: { kind?: unknown; url?: unknown };
    iceServers?: unknown;
  };
  const kind = record.signaling?.kind;
  if (kind !== 'manual' && kind !== 'http-poll' && kind !== 'websocket') {
    return null;
  }
  if (!Array.isArray(record.iceServers)) return null;
  const iceServers = [];
  for (const item of record.iceServers) {
    if (!item || typeof item !== 'object') continue;
    const row = item as {
      urls?: unknown;
      username?: unknown;
      credential?: unknown;
    };
    if (typeof row.urls !== 'string' && !Array.isArray(row.urls)) continue;
    iceServers.push({
      urls: row.urls as string | string[],
      username: typeof row.username === 'string' ? row.username : undefined,
      credential:
        typeof row.credential === 'string' ? row.credential : undefined,
    });
  }
  if (iceServers.length === 0 && kind !== 'manual') return null;
  const url =
    typeof record.signaling?.url === 'string'
      ? record.signaling.url
      : undefined;
  if (kind === 'manual') return { signaling: { kind }, iceServers };
  if (!url) return null;
  return { signaling: { kind, url }, iceServers };
};

export const parseSavedServers = (raw: string): SavedServer[] => {
  try {
    const data = JSON.parse(raw) as { servers?: unknown };
    if (!data || !Array.isArray(data.servers)) return [];
    const servers: SavedServer[] = [];
    for (const item of data.servers) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      if (typeof row.id !== 'string' || typeof row.title !== 'string') continue;
      const draft = parseDraft(row.draft);
      if (!draft) continue;
      servers.push({
        id: row.id,
        title: row.title,
        address:
          typeof row.address === 'string'
            ? row.address
            : (draft.signaling.url ?? ''),
        draft,
        createdAt: typeof row.createdAt === 'number' ? row.createdAt : 0,
        updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
        reach: isReach(row.reach) ? row.reach : 'unknown',
      });
    }
    return servers;
  } catch {
    return [];
  }
};

export const loadSavedServers = async (
  store: OpfsStore,
): Promise<SavedServer[]> => {
  const text = await readText(store.secrets, SAVED_SERVERS_FILE);
  if (!text.ok) return [];
  return parseSavedServers(text.value);
};

export const saveSavedServers = async (
  store: OpfsStore,
  servers: SavedServer[],
): Promise<OpfsResult<true>> => {
  return writeFile(
    store.secrets,
    SAVED_SERVERS_FILE,
    JSON.stringify({ servers }),
  );
};

export const upsertSavedServer = (
  list: SavedServer[],
  draft: CustomServerDraft,
  title?: string,
): { list: SavedServer[]; server: SavedServer } => {
  const match = list.find(
    (item) =>
      item.draft.signaling.kind === draft.signaling.kind &&
      (item.draft.signaling.url ?? '') === (draft.signaling.url ?? ''),
  );
  if (match) {
    const next: SavedServer = {
      ...match,
      title: title?.trim() || match.title,
      address: draft.signaling.url?.trim() || match.address,
      draft: {
        signaling: { ...draft.signaling },
        iceServers: draft.iceServers.map((server) => ({ ...server })),
      },
      updatedAt: Date.now(),
      reach: 'unknown',
    };
    return {
      list: list.map((item) => (item.id === match.id ? next : item)),
      server: next,
    };
  }
  const server = createSavedServer(draft, title);
  return { list: [server, ...list], server };
};
