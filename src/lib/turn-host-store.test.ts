import { describe, expect, it } from 'vitest';
import { createMemoryRoot } from './opfs-memory.ts';
import { openStore } from './opfs.ts';
import { loadTurnHost, saveTurnHost } from './turn-host-store.ts';

describe('turn host store', () => {
  it('round-trips ssh login and host in OPFS secrets', async () => {
    const opened = await openStore(createMemoryRoot());
    if (!opened.ok) throw new Error(opened.message);
    const draft = { host: '203.0.113.10', sshUser: 'ubuntu' };
    const saved = await saveTurnHost(opened.value, draft);
    expect(saved.ok).toBe(true);
    const loaded = await loadTurnHost(opened.value);
    expect(loaded).toEqual(draft);
  });
});
