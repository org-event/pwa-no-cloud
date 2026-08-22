export type SignalType = 'offer' | 'answer' | 'candidate';

export type SignalMessage = {
  from: string;
  to: string;
  data: { type: SignalType; payload: unknown };
};

export type SignalingPort = {
  connect(input: { roomId: string; clientId: string }): Promise<void>;
  send(message: SignalMessage): Promise<void>;
  subscribe(
    handler: (message: SignalMessage) => void | Promise<void>,
  ): () => void;
  listPeers?(): Promise<string[]>;
  close(): void;
};

export type SignalResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };
