import {
  createChatController,
  type ChatControllerState,
} from '@/lib/chat-controller.ts';
import { SELF_PEER_ID } from '@/ui/shell-nav.ts';
import type { NocloudContext } from './context.ts';

export function createChatSlice(ctx: NocloudContext) {
  const { state, storage, touch, note } = ctx;

  const syncUi = (next: ChatControllerState) => {
    state.chat = next.chat;
    if (next.notice) state.contactsNotice = next.notice;
    touch();
  };

  const controller = createChatController({
    storage,
    meId: () => state.me.id,
    selfPeerId: SELF_PEER_ID,
    getKeyPair: () => ctx.ports.contacts.getIdentityKeyPair?.() ?? null,
    livePeerId: () => state.livePeerId,
    linkConnected: () => state.peer?.session.state === 'connected',
    trySendWire: (wire) => Boolean(state.peer?.sendChatWire(wire)),
    knockOn: async (peerId, asHost) => {
      await ctx.ports.contacts.knockOn?.(peerId, asHost);
    },
    note,
    onChange: syncUi,
  });

  return {
    reloadFromStorage: controller.reload,
    listMessages: controller.listMessages,
    onSendChat: controller.send,
    onIncomingChatWire: controller.incoming,
  };
}
