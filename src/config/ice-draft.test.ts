import { describe, expect, it } from 'vitest';
import {
  draftIceServersFromText,
  parseIceServersJson,
  splitIceServers,
} from './ice-draft.ts';

describe('ice draft', () => {
  it('keeps several TURN URLs under one credential', () => {
    const iceServers = draftIceServersFromText({
      stun: 'stun:stun.l.google.com:19302\n',
      turn: [
        'turn:standard.relay.metered.ca:80',
        'turns:standard.relay.metered.ca:443?transport=tcp',
      ].join('\n'),
      username: 'user',
      credential: 'secret',
    });
    expect(iceServers).toEqual([
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: [
          'turns:standard.relay.metered.ca:443?transport=tcp',
          'turn:standard.relay.metered.ca:80',
        ],
        username: 'user',
        credential: 'secret',
      },
    ]);
    const split = splitIceServers(iceServers);
    expect(split.turn).toHaveLength(2);
    expect(split.username).toBe('user');
  });

  it('reads a Metered-style iceServers array', () => {
    const result = parseIceServersJson(
      JSON.stringify([
        { urls: 'stun:stun.relay.metered.ca:80' },
        {
          urls: 'turn:standard.relay.metered.ca:80',
          username: 'u',
          credential: 'p',
        },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[1]?.username).toBe('u');
  });
});
