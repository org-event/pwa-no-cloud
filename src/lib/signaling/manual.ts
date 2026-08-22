import { decodeInvite, encodeInvite } from './invite.ts';
import type { CustomServerDraft } from '../../config/types.ts';
import type { SignalingPort, SignalMessage, SignalResult } from './port.ts';

export type ManualPort = SignalingPort & {
  outgoing(): string;
  accept(text: string): Promise<SignalResult<SignalMessage>>;
  setShareServers(servers: CustomServerDraft | null): void;
};

export const createManualPort = (): ManualPort => {
  let clientId = '';
  let encoded = '';
  let shareServers: CustomServerDraft | null = null;
  const listeners = new Set<(message: SignalMessage) => void | Promise<void>>();

  return {
    setShareServers(servers) {
      shareServers = servers;
    },
    async connect(input) {
      clientId = input.clientId;
    },
    async send(message) {
      encoded = await encodeInvite(message, shareServers ?? undefined);
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    close() {
      encoded = '';
      listeners.clear();
    },
    outgoing() {
      return encoded;
    },
    async accept(text) {
      const parsed = await decodeInvite(text);
      if (!parsed.ok) return parsed;
      if (parsed.value.message.from === clientId) {
        return {
          ok: false,
          code: 'invite-self',
          message: 'Это своё приглашение, нужен ответ второго окна',
        };
      }
      for (const listener of listeners) await listener(parsed.value.message);
      return { ok: true, value: parsed.value.message };
    },
  };
};
