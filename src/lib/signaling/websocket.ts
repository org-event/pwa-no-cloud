import { signalingLibCopy } from '@/content/index.ts';
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
  /** Default: on, unless a fixed test socket is injected without `open`. */
  autoReconnect?: boolean;
};

const OPEN = 1;
const CONNECTING = 0;

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
  let intentionalClose = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let openWait: Promise<void> | null = null;
  const attached = new WeakSet<SocketLike>();
  const listeners = new Set<(message: SignalMessage) => void | Promise<void>>();
  const autoReconnect =
    options.autoReconnect ?? Boolean(options.open || !options.socket);

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

  const clearReconnect = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const sendJoin = (targetSocket: SocketLike) => {
    if (!roomId || !clientId) return;
    targetSocket.send(JSON.stringify({ op: 'join', roomId, clientId }));
  };

  const waitOpen = (current: SocketLike): Promise<void> => {
    if (current.readyState === OPEN) return Promise.resolve();
    if (current.readyState !== CONNECTING) {
      return Promise.reject(new Error(signalingLibCopy.websocketNotOpen));
    }
    return new Promise<void>((resolve, reject) => {
      current.addEventListener('open', () => resolve());
      current.addEventListener('error', () => {
        reject(new Error(signalingLibCopy.websocketNotOpen));
      });
    });
  };

  const scheduleReconnect = () => {
    if (!autoReconnect || intentionalClose || !roomId || !clientId) return;
    if (reconnectTimer || openWait) return;
    const delay = Math.min(8_000, 400 * 2 ** Math.min(reconnectAttempt, 4));
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void ensureSocket()
        .then((current) => {
          sendJoin(current);
        })
        .catch(() => {
          scheduleReconnect();
        });
    }, delay);
  };

  const bind = (next: SocketLike) => {
    if (attached.has(next)) return;
    attached.add(next);
    next.addEventListener('message', (event) => {
      onPayload(typeof event.data === 'string' ? event.data : '');
    });
    next.addEventListener('close', () => {
      if (socket === next) socket = null;
      peers = [];
      openWait = null;
      if (intentionalClose) return;
      scheduleReconnect();
    });
  };

  const createSocket = (): SocketLike => {
    const open = options.open ?? ((href: string) => new WebSocket(href));
    try {
      return open(target);
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      throw new Error(
        /insecure WebSocket|Mixed Content/i.test(raw)
          ? MIXED_CONTENT_SIGNALING
          : raw || signalingLibCopy.websocketNotOpen,
      );
    }
  };

  const ensureSocket = async (): Promise<SocketLike> => {
    if (intentionalClose) throw new Error(signalingLibCopy.websocketClosed);
    if (socket?.readyState === OPEN) return socket;
    if (openWait) {
      await openWait;
      if (socket?.readyState === OPEN) return socket;
    }
    if (!socket || socket.readyState > OPEN) {
      socket = createSocket();
    }
    bind(socket);
    const current = socket;
    openWait = waitOpen(current)
      .then(() => {
        reconnectAttempt = 0;
      })
      .finally(() => {
        openWait = null;
      });
    await openWait;
    return current;
  };

  return {
    async connect(input) {
      intentionalClose = false;
      roomId = input.roomId;
      clientId = input.clientId;
      peers = [];
      clearReconnect();
      if (options.socket) {
        socket = options.socket;
        bind(socket);
      }
      const current = await ensureSocket();
      sendJoin(current);
    },
    async send(message) {
      const current = await ensureSocket();
      current.send(JSON.stringify({ op: 'signal', ...message }));
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    async listPeers() {
      if (socket?.readyState === OPEN) {
        socket.send(JSON.stringify({ op: 'peers' }));
      }
      return peers;
    },
    close() {
      intentionalClose = true;
      clearReconnect();
      roomId = '';
      clientId = '';
      peers = [];
      openWait = null;
      const current = socket;
      socket = null;
      current?.close();
      listeners.clear();
    },
  };
};
