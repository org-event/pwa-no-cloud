import { describe, expect, it } from 'vitest';
import {
  appendChatMessage,
  emptyChatStore,
  storedFromWire,
} from '@/domain/chat/thread.ts';
import { loadChatStore, saveChatStore } from './chat-store.ts';
import type { ChatMessage } from '@/domain/chat/message.ts';

describe('chat-store persistence (U1.2)', () => {
  it('round-trips threads through storage', () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
    };
    const message: ChatMessage = {
      v: 1,
      fromPk: 'pk1.x',
      toId: 'peer1peer1peer1p',
      text: 'ping',
      ts: 42,
      sig: 'ab',
    };
    let store = emptyChatStore();
    store = appendChatMessage(
      store,
      'peer1peer1peer1p',
      storedFromWire(message, 'out', 'H1.{}'),
    );
    saveChatStore(storage, store);
    expect(loadChatStore(storage).threads['peer1peer1peer1p']?.[0]?.text).toBe(
      'ping',
    );
  });
});
