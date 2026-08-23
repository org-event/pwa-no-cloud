import type { CustomServerDraft, SignalingConfig } from '@/config/types.ts';
import { createHttpPollPort } from './http-poll.ts';
import { createManualPort, type ManualPort } from './manual.ts';
import type { SignalingPort, SignalMessage, SignalResult } from './port.ts';
import { createWebSocketPort } from './websocket.ts';

export type SignalingHandle = SignalingPort & {
  outgoing?(): string;
  accept?(text: string): Promise<SignalResult<SignalMessage>>;
  setShareServers?(servers: CustomServerDraft | null): void;
};

export const createSignalingPort = (
  signaling: SignalingConfig,
): SignalingHandle => {
  if (signaling.kind === 'http-poll' && signaling.url) {
    return createHttpPollPort(signaling.url);
  }
  if (signaling.kind === 'websocket' && signaling.url) {
    return createWebSocketPort(signaling.url);
  }
  return createManualPort();
};

export const isManualPort = (port: SignalingHandle): port is ManualPort => {
  return (
    typeof port.outgoing === 'function' && typeof port.accept === 'function'
  );
};
