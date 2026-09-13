import { describe, expect, it } from 'vitest';
import {
  appendChatMessage,
  emptyChatStore,
  listThreadMessages,
  listThreadSummaries,
  storedFromWire,
} from './thread.ts';
import type { ChatMessage } from './message.ts';

const msg = (text: string, ts: number): ChatMessage => ({
  v: 1,
  fromPk: 'pk1.alice',
  toId: 'bobfingerprintxx',
  text,
  ts,
  sig: '00',
});

describe('chat thread store (U1.2)', () => {
  it('appends and lists messages per peer', () => {
    let store = emptyChatStore();
    store = appendChatMessage(
      store,
      'bobfingerprintxx',
      storedFromWire(msg('hi', 1), 'out'),
    );
    store = appendChatMessage(
      store,
      'bobfingerprintxx',
      storedFromWire(msg('yo', 2), 'in'),
    );
    expect(listThreadMessages(store, 'bobfingerprintxx')).toHaveLength(2);
    expect(listThreadMessages(store, 'bobfingerprintxx')[1]?.text).toBe('yo');
    expect(listThreadSummaries(store)[0]?.peerId).toBe('bobfingerprintxx');
    expect(listThreadSummaries(store)[0]?.last?.ts).toBe(2);
  });

  it('trims oldest when over max', () => {
    let store = emptyChatStore();
    for (let i = 0; i < 505; i++) {
      store = appendChatMessage(
        store,
        'peer',
        storedFromWire(msg(`m${i}`, i), 'out'),
      );
    }
    const list = listThreadMessages(store, 'peer');
    expect(list).toHaveLength(500);
    expect(list[0]?.text).toBe('m5');
    expect(list[list.length - 1]?.text).toBe('m504');
  });
});
