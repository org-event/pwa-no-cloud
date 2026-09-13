import {
  emptyChatStore,
  type ChatStoreState,
  type ChatStoredMessage,
} from '@/domain/chat/thread.ts';

export const CHAT_STORE_KEY = 'nocloud.chat.v1';

export type ChatStoreStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const isStoredMessage = (value: unknown): value is ChatStoredMessage => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.fromPk === 'string' &&
    typeof row.toId === 'string' &&
    typeof row.text === 'string' &&
    typeof row.ts === 'number' &&
    (row.direction === 'out' || row.direction === 'in')
  );
};

export const loadChatStore = (storage: ChatStoreStorage): ChatStoreState => {
  const raw = storage.getItem(CHAT_STORE_KEY);
  if (!raw) return emptyChatStore();
  try {
    const parsed = JSON.parse(raw) as { threads?: unknown };
    if (!parsed?.threads || typeof parsed.threads !== 'object') {
      return emptyChatStore();
    }
    const threads: ChatStoreState['threads'] = {};
    for (const [peerId, list] of Object.entries(
      parsed.threads as Record<string, unknown>,
    )) {
      if (!Array.isArray(list)) continue;
      const messages: ChatStoredMessage[] = [];
      for (const item of list) {
        if (isStoredMessage(item)) messages.push(item);
      }
      if (messages.length > 0) threads[peerId] = messages;
    }
    return { threads };
  } catch {
    return emptyChatStore();
  }
};

export const saveChatStore = (
  storage: ChatStoreStorage,
  store: ChatStoreState,
): void => {
  storage.setItem(CHAT_STORE_KEY, JSON.stringify(store));
};
