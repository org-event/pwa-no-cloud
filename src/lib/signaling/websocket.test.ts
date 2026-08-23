import { describe, expect, it } from 'vitest';
import { createWebSocketPort, toWebSocketUrl } from './websocket.ts';
import type { SignalMessage } from './port.ts';

class FakeSocket {
  readyState = 1;
  sent: string[] = [];
  handlers = new Map<string, Array<(event: { data?: unknown }) => void>>();

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.emit('close');
  }

  addEventListener(name: string, fn: (event: { data?: unknown }) => void) {
    const list = this.handlers.get(name) ?? [];
    list.push(fn);
    this.handlers.set(name, list);
  }

  emit(name: string, data?: unknown) {
    const list = this.handlers.get(name) ?? [];
    for (const fn of list) fn({ data });
  }
}

describe('websocket signaling', () => {
  it('maps http urls to the /ws endpoint', () => {
    expect(toWebSocketUrl('http://192.168.1.5:8000')).toBe(
      'ws://192.168.1.5:8000/ws',
    );
    expect(toWebSocketUrl('https://host/')).toBe('wss://host/ws');
    expect(toWebSocketUrl('https://203.0.113.10:8443')).toBe(
      'wss://203.0.113.10:8443/ws',
    );
  });

  it('joins and notifies on a signal frame', async () => {
    const socket = new FakeSocket();
    const port = createWebSocketPort('http://127.0.0.1:8000', { socket });
    const received: SignalMessage[] = [];
    port.subscribe((message) => {
      received.push(message);
    });
    await port.connect({ roomId: 'nocloud', clientId: 'bob' });
    expect(socket.sent[0]).toContain('"op":"join"');
    socket.emit(
      'message',
      JSON.stringify({
        op: 'signal',
        from: 'alice',
        to: 'bob',
        data: { type: 'offer', payload: { sdp: 'v=0' } },
      }),
    );
    expect(received[0]?.from).toBe('alice');
    socket.emit('message', JSON.stringify({ op: 'peers', peers: ['alice'] }));
    const peers = (await port.listPeers?.()) ?? [];
    expect(peers).toEqual(['alice']);
    port.close();
  });

  it('rejoins the room after the socket drops', async () => {
    const sockets: FakeSocket[] = [];
    const port = createWebSocketPort('http://127.0.0.1:8000', {
      autoReconnect: true,
      open: () => {
        const next = new FakeSocket();
        next.readyState = 0;
        sockets.push(next);
        queueMicrotask(() => {
          next.readyState = 1;
          next.emit('open');
        });
        return next;
      },
    });
    await port.connect({ roomId: 'meet', clientId: 'bob' });
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.sent[0]).toContain('"op":"join"');
    sockets[0]?.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(sockets.length).toBeGreaterThan(1);
    const rejoined = sockets.at(-1);
    expect(rejoined?.sent.some((line) => line.includes('"op":"join"'))).toBe(
      true,
    );
    port.close();
  });
});
