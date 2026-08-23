import { describe, expect, it } from 'vitest';
import { parseSavedServers, upsertSavedServer } from './saved-servers-store.ts';

describe('saved servers store', () => {
  it('round-trips a saved server list', () => {
    const draft = {
      signaling: { kind: 'websocket' as const, url: 'https://a.example:8443' },
      iceServers: [{ urls: 'stun:a.example:3478' }],
    };
    const first = upsertSavedServer([], draft, 'Alpha');
    expect(first.list).toHaveLength(1);
    expect(first.server.title).toBe('Alpha');
    const raw = JSON.stringify({ servers: first.list });
    const parsed = parseSavedServers(raw);
    expect(parsed[0]?.address).toContain('a.example');
  });

  it('updates an existing server with the same signaling url', () => {
    const draft = {
      signaling: { kind: 'websocket' as const, url: 'https://a.example:8443' },
      iceServers: [{ urls: 'stun:a.example:3478' }],
    };
    const first = upsertSavedServer([], draft, 'Alpha');
    const second = upsertSavedServer(
      first.list,
      {
        ...draft,
        iceServers: [
          { urls: 'turn:a.example:3478', username: 'u', credential: 'p' },
        ],
      },
      'Alpha',
    );
    expect(second.list).toHaveLength(1);
    expect(second.server.draft.iceServers[0]?.username).toBe('u');
  });
});
