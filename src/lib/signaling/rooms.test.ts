// @ts-nocheck
import { describe, expect, it } from 'vitest';
import { createRooms } from '../../../server/rooms.js';
import { createStunBinding } from '../../../server/stun.js';

describe('signaling rooms', () => {
  it('queues for poll and lists the other peer', () => {
    const rooms = createRooms();
    rooms.join('lab', 'alice');
    rooms.join('lab', 'bob');
    const delivered = rooms.enqueue('lab', 'alice', 'bob', {
      type: 'offer',
      payload: { sdp: 'v=0' },
    });
    expect(delivered.sockets).toEqual([]);
    const inbox = rooms.drain('lab', 'bob');
    expect(inbox[0]?.from).toBe('alice');
    expect(rooms.drain('lab', 'bob')).toEqual([]);
    expect(rooms.peers('lab', 'alice')).toEqual(['bob']);
  });

  it('pushes to an attached socket instead of the inbox', () => {
    const rooms = createRooms();
    const socket = {
      readyState: 1,
      sent: [] as string[],
      send(data: string) {
        this.sent.push(data);
      },
    };
    rooms.join('lab', 'bob');
    rooms.attach('lab', 'bob', socket);
    const delivered = rooms.enqueue('lab', 'alice', 'bob', {
      type: 'answer',
      payload: { sdp: 'v=0' },
    });
    expect(delivered.sockets).toEqual([socket]);
    expect(rooms.drain('lab', 'bob')).toEqual([]);
  });

  it('broadcasts peer lists so the first joiner learns about the second', () => {
    const rooms = createRooms();
    const alice = {
      readyState: 1,
      sent: [] as string[],
      send(data: string) {
        this.sent.push(data);
      },
    };
    const bob = {
      readyState: 1,
      sent: [] as string[],
      send(data: string) {
        this.sent.push(data);
      },
    };
    rooms.join('lab', 'alice');
    rooms.attach('lab', 'alice', alice);
    rooms.broadcastPeers('lab');
    expect(JSON.parse(alice.sent.at(-1) ?? '{}').peers).toEqual([]);
    rooms.join('lab', 'bob');
    rooms.attach('lab', 'bob', bob);
    rooms.broadcastPeers('lab');
    expect(JSON.parse(alice.sent.at(-1) ?? '{}').peers).toEqual(['bob']);
    expect(JSON.parse(bob.sent.at(-1) ?? '{}').peers).toEqual(['alice']);
  });
});

describe('STUN binding', () => {
  it('answers a binding request with xor-mapped address', () => {
    const req = Buffer.alloc(20);
    req.writeUInt16BE(0x0001, 0);
    req.writeUInt16BE(0, 2);
    req.writeUInt32BE(0x2112a442, 4);
    req.write('tid-12chars', 8, 12);
    const response = createStunBinding(req, {
      address: '192.0.2.10',
      port: 54321,
      family: 'IPv4',
      size: 20,
    });
    expect(response).not.toBeNull();
    if (!response) return;
    expect(response.readUInt16BE(0)).toBe(0x0101);
    expect(response.readUInt32BE(4)).toBe(0x2112a442);
  });
});
