import { MIXED_CONTENT_SIGNALING } from './mixed-content.ts';
import { parseInvite } from './invite.ts';
import type { SignalingPort, SignalMessage } from './port.ts';

type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  addEventListener(name: string, fn: (event: { data?: unknown }) => void): void;
};

type WebSocketPortOptions = {
  socket?: SocketLike;
  open?: (url: string) => SocketLike;
};

const OPEN = 1;

export const toWebSocketUrl = (url: string): string => {
  if (url.startsWith('ws://') || url.startsWith('wss://')) {
    if (url.endsWith('/ws')) return url;
    return url.replace(/\/$/, '') + '/ws';
  }
  const parsed = new URL(url);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '/ws';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
};

export const createWebSocketPort = (
  url: string,
  options: WebSocketPortOptions = {},
): SignalingPort => {
  const target = toWebSocketUrl(url);
  let socket: SocketLike | null = options.socket ?? null;
  let roomId = '';
  let clientId = '';
  let peers: string[] = [];
  const listeners = new Set<(message: SignalMessage) => void | Promise<void>>();

  const notify = (message: SignalMessage) => {
    for (const listener of listeners) void listener(message);
  };

  const onPayload = (raw: string) => {
    let body: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object') {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return;
    }
    if (body.op === 'peers' && Array.isArray(body.peers)) {
      const next: string[] = [];
      for (const peer of body.peers) {
        if (typeof peer === 'string') next.push(peer);
      }
      peers = next;
      return;
    }
    if (body.op === 'signal') {
      const parsed = parseInvite(body);
      if (parsed.ok) notify(parsed.value);
    }
  };

  const bind = (next: SocketLike) => {
    next.addEventListener('message', (event) => {
      onPayload(typeof event.data === 'string' ? event.data : '');
    });
  };

  return {
    async connect(input) {
      roomId = input.roomId;
      clientId = input.clientId;
      if (!socket) {
        const open = options.open ?? ((href: string) => new WebSocket(href));
        try {
          socket = open(target);
        } catch (error) {
          const raw = error instanceof Error ? error.message : '';
          throw new Error(
            /insecure WebSocket|Mixed Content/i.test(raw)
              ? MIXED_CONTENT_SIGNALING
              : raw || 'WebSocket не открылся',
          );
        }
      }
      bind(socket);
      if (socket.readyState !== OPEN) {
        const current = socket;
        await new Promise<void>((resolve, reject) => {
          current.addEventListener('open', () => resolve());
          current.addEventListener('error', () => {
            reject(new Error('WebSocket не открылся'));
          });
        });
      }
      socket.send(JSON.stringify({ op: 'join', roomId, clientId }));
    },
    async send(message) {
      socket?.send(JSON.stringify({ op: 'signal', ...message }));
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    async listPeers() {
      socket?.send(JSON.stringify({ op: 'peers' }));
      return peers;
    },
    close() {
      socket?.close();
      socket = null;
      peers = [];
      listeners.clear();
    },
  };
};
