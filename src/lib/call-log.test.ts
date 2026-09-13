import { describe, expect, it } from 'vitest';
import {
  appendCallLog,
  loadCallLog,
  saveCallLog,
  type CallLogStorage,
} from './call-log.ts';

const memory = (): CallLogStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
};

describe('call-log', () => {
  it('appends newest first and persists', () => {
    const storage = memory();
    let entries = appendCallLog([], {
      peerId: 'a',
      direction: 'out',
      outcome: 'ended',
      ts: 2,
    });
    entries = appendCallLog(entries, {
      peerId: 'b',
      direction: 'in',
      outcome: 'missed',
      ts: 3,
    });
    expect(entries[0]?.peerId).toBe('b');
    saveCallLog(storage, entries);
    expect(loadCallLog(storage)).toHaveLength(2);
  });
});
