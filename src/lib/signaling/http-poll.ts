import { parseInvite } from './invite.ts';
import type { SignalingPort, SignalMessage } from './port.ts';

const POLL_MS = 800;

type HttpPollOptions = {
  intervalMs?: number;
  fetch?: typeof fetch;
};

const readJson = async (
  response: Response,
): Promise<Record<string, unknown>> => {
  try {
    const data = await response.json();
    if (data && typeof data === 'object')
      return data as Record<string, unknown>;
  } catch {
    return {};
  }
  return {};
};

const asMessages = (raw: unknown): SignalMessage[] => {
  if (!Array.isArray(raw)) return [];
  const messages: SignalMessage[] = [];
  for (const item of raw) {
    const parsed = parseInvite(item);
    if (parsed.ok) messages.push(parsed.value);
  }
  return messages;
};

export const createHttpPollPort = (
  baseUrl: string,
  options: HttpPollOptions = {},
): SignalingPort => {
  const root = baseUrl.replace(/\/$/, '');
  const intervalMs = options.intervalMs ?? POLL_MS;
  const request = options.fetch ?? fetch;
  let roomId = '';
  let clientId = '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  const listeners = new Set<(message: SignalMessage) => void | Promise<void>>();

  const notify = async (message: SignalMessage) => {
    for (const listener of listeners) await listener(message);
  };

  const poll = async () => {
    if (closed || !clientId) return;
    try {
      const query =
        `roomId=${encodeURIComponent(roomId)}` +
        `&clientId=${encodeURIComponent(clientId)}`;
      const response = await request(`${root}/signal?${query}`);
      const body = await readJson(response);
      const messages = asMessages(body.messages);
      for (const message of messages) await notify(message);
    } catch {
      // keep polling
    }
    if (!closed) timer = setTimeout(() => void poll(), intervalMs);
  };

  return {
    async connect(input) {
      closed = false;
      roomId = input.roomId;
      clientId = input.clientId;
      const response = await request(`${root}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, clientId }),
      });
      if (!response.ok) {
        throw new Error(`join HTTP ${response.status}`);
      }
      void poll();
    },
    async send(message) {
      await request(`${root}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, ...message }),
      });
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    async listPeers() {
      const query =
        `roomId=${encodeURIComponent(roomId)}` +
        `&clientId=${encodeURIComponent(clientId)}`;
      const response = await request(`${root}/peers?${query}`);
      const body = await readJson(response);
      if (!Array.isArray(body.peers)) return [];
      const peers: string[] = [];
      for (const peer of body.peers) {
        if (typeof peer === 'string') peers.push(peer);
      }
      return peers;
    },
    close() {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = null;
      listeners.clear();
    },
  };
};
