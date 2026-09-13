/**
 * Local chat threads (M3 U1.2) — append/list only; persistence in lib/.
 */

import type { ChatMessage } from './message.ts';

export const CHAT_STORE_MAX_PER_THREAD = 500;

export type ChatDirection = 'out' | 'in';

export type ChatStoredMessage = {
  id: string;
  fromPk: string;
  toId: string;
  text: string;
  ts: number;
  direction: ChatDirection;
  /** Optional raw H1. for re-verify / resend. */
  wire?: string;
};

export type ChatStoreState = {
  /** peerId (contact fingerprint) → messages oldest→newest */
  threads: Record<string, ChatStoredMessage[]>;
};

export const emptyChatStore = (): ChatStoreState => ({ threads: {} });

const newMessageId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const threadPeerId = (
  meId: string,
  message: Pick<ChatMessage, 'toId'>,
  fromFingerprint: string,
): string => {
  // Peer is the other party: if we sent, peer = toId; if received, peer = sender fingerprint.
  if (message.toId === meId) return fromFingerprint;
  return message.toId;
};

export const storedFromWire = (
  message: ChatMessage,
  direction: ChatDirection,
  wire?: string,
): ChatStoredMessage => ({
  id: newMessageId(),
  fromPk: message.fromPk,
  toId: message.toId,
  text: message.text,
  ts: message.ts,
  direction,
  ...(wire ? { wire } : {}),
});

export const appendChatMessage = (
  store: ChatStoreState,
  peerId: string,
  entry: ChatStoredMessage,
): ChatStoreState => {
  const peer = peerId.trim();
  if (!peer) return store;
  const prev = store.threads[peer] ?? [];
  const next = [...prev, entry];
  const trimmed =
    next.length > CHAT_STORE_MAX_PER_THREAD
      ? next.slice(next.length - CHAT_STORE_MAX_PER_THREAD)
      : next;
  return {
    threads: {
      ...store.threads,
      [peer]: trimmed,
    },
  };
};

export const listThreadMessages = (
  store: ChatStoreState,
  peerId: string,
): ChatStoredMessage[] => store.threads[peerId.trim()] ?? [];

export type ChatThreadSummary = {
  peerId: string;
  last: ChatStoredMessage | null;
  count: number;
};

export const listThreadSummaries = (
  store: ChatStoreState,
): ChatThreadSummary[] => {
  const rows: ChatThreadSummary[] = [];
  for (const [peerId, messages] of Object.entries(store.threads)) {
    const last = messages[messages.length - 1] ?? null;
    rows.push({ peerId, last, count: messages.length });
  }
  rows.sort((a, b) => (b.last?.ts ?? 0) - (a.last?.ts ?? 0));
  return rows;
};
