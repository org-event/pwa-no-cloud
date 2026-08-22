import { describe, expect, it } from 'vitest';
import {
  decodeSharePack,
  encodeSharePack,
  iceOnlyShare,
} from './share-pack.ts';

describe('share pack', () => {
  it('round-trips TURN ice servers for a QR payload', () => {
    const draft = iceOnlyShare([
      { urls: 'stun:203.0.113.10:80' },
      {
        urls: ['turn:203.0.113.10:80', 'turn:203.0.113.10:443?transport=tcp'],
        username: 'nocloud',
        credential: 'secret12',
      },
    ]);
    const packed = encodeSharePack(draft);
    expect(packed.startsWith('S1.')).toBe(true);
    const decoded = decodeSharePack(packed);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.signaling.kind).toBe('manual');
    expect(decoded.value.iceServers[1]?.username).toBe('nocloud');
  });
});
