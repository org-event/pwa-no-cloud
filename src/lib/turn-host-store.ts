import type { TurnHostDraft } from '../domain/turn-host.ts';
import { EMPTY_TURN_HOST, validateTurnHost } from '../domain/turn-host.ts';
import type { OpfsResult, OpfsStore } from './opfs.ts';
import { readText, writeFile } from './opfs.ts';

export const TURN_HOST_FILE = 'turn-host.json';

const readSshUser = (data: Record<string, unknown>): string => {
  if (typeof data.sshUser === 'string' && data.sshUser) return data.sshUser;
  if (typeof data.username === 'string' && data.username) return data.username;
  return EMPTY_TURN_HOST.sshUser;
};

export const parseTurnHost = (raw: string): TurnHostDraft | null => {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (!data || typeof data !== 'object') return null;
    if (typeof data.host !== 'string') return null;
    const draft = { host: data.host, sshUser: readSshUser(data) };
    const checked = validateTurnHost(draft);
    if (!checked.ok) return draft;
    return checked.value;
  } catch {
    return null;
  }
};

export const loadTurnHost = async (
  store: OpfsStore,
): Promise<TurnHostDraft> => {
  const text = await readText(store.secrets, TURN_HOST_FILE);
  if (!text.ok) return { ...EMPTY_TURN_HOST };
  return parseTurnHost(text.value) ?? { ...EMPTY_TURN_HOST };
};

export const saveTurnHost = async (
  store: OpfsStore,
  draft: TurnHostDraft,
): Promise<OpfsResult<true>> => {
  return writeFile(store.secrets, TURN_HOST_FILE, JSON.stringify(draft));
};
