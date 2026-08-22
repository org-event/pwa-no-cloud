import { describe, expect, it } from 'vitest';
import { orderIceServersForBrowser, sortIceUrls } from './ice-urls.ts';

describe('sortIceUrls', () => {
  it('tries TCP 443 before UDP so mobile NAT can allocate a relay', () => {
    expect(
      sortIceUrls([
        'turn:203.0.113.10:80',
        'turn:203.0.113.10:80?transport=tcp',
        'turn:203.0.113.10:443',
        'turn:203.0.113.10:443?transport=tcp',
        'stun:203.0.113.10:80',
      ]),
    ).toEqual([
      'stun:203.0.113.10:80',
      'turn:203.0.113.10:443?transport=tcp',
      'turn:203.0.113.10:80?transport=tcp',
      'turn:203.0.113.10:443',
      'turn:203.0.113.10:80',
    ]);
  });
});

describe('orderIceServersForBrowser', () => {
  it('keeps credentials on the TURN object', () => {
    const ordered = orderIceServersForBrowser([
      { urls: 'stun:203.0.113.10:3478' },
      {
        urls: ['turn:203.0.113.10:3478', 'turn:203.0.113.10:443?transport=tcp'],
        username: 'nocloud',
        credential: 'secret12',
      },
    ]);
    expect(ordered[1]?.username).toBe('nocloud');
    expect(ordered[1]?.urls).toEqual([
      'turn:203.0.113.10:443?transport=tcp',
      'turn:203.0.113.10:3478',
    ]);
  });
});
