import { describe, expect, it } from 'vitest';
import { decodeInvite, encodeInvite } from './invite.ts';
import { createManualPort } from './manual.ts';
import type { SignalMessage } from './port.ts';

const offer = (): SignalMessage => ({
  from: 'alice',
  to: '*',
  data: { type: 'offer', payload: { sdp: 'v=0\r\no=alice' } },
});

describe('invite encode', () => {
  it('round-trips a compressed offer', async () => {
    const encoded = await encodeInvite(offer());
    expect(encoded.startsWith('N1.') || encoded.startsWith('J1.')).toBe(true);
    const decoded = await decodeInvite(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.message.from).toBe('alice');
    expect(decoded.value.message.data.type).toBe('offer');
  });

  it('rejects empty and broken text', async () => {
    const empty = await decodeInvite('   ');
    const broken = await decodeInvite('N1.%%%');
    expect(empty.ok).toBe(false);
    expect(broken.ok).toBe(false);
  });

  it('embeds ice servers so the other side can use your TURN', async () => {
    const encoded = await encodeInvite(offer(), {
      signaling: { kind: 'manual' },
      iceServers: [
        {
          urls: 'turn:203.0.113.10:443?transport=tcp',
          username: 'u',
          credential: 'p',
        },
      ],
    });
    const decoded = await decodeInvite(encoded);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.servers?.iceServers[0]?.username).toBe('u');
  });
});

describe('manual signaling', () => {
  it('delivers an accepted invite to subscribers', async () => {
    const alice = createManualPort();
    const bob = createManualPort();
    await alice.connect({ roomId: 'manual', clientId: 'alice' });
    await bob.connect({ roomId: 'manual', clientId: 'bob' });
    await alice.send(offer());
    const received: { message: SignalMessage | null } = { message: null };
    bob.subscribe((message) => {
      received.message = message;
    });
    const accepted = await bob.accept(alice.outgoing());
    expect(accepted.ok).toBe(true);
    expect(received.message?.from).toBe('alice');
  });

  it('refuses accepting your own invite', async () => {
    const port = createManualPort();
    await port.connect({ roomId: 'manual', clientId: 'alice' });
    await port.send(offer());
    const accepted = await port.accept(port.outgoing());
    expect(accepted.ok).toBe(false);
    if (accepted.ok) return;
    expect(accepted.code).toBe('invite-self');
  });
});
