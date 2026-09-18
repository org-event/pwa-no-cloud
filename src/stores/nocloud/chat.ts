import { shellCopy } from '@/content/index.ts';
import {
  appendChatMessage,
  createChatMessage,
  listThreadMessages,
  parseAndVerifyChatMessage,
  storedFromWire,
  threadPeerId,
  type ChatStoreState,
  type ChatStoredMessage,
} from '@/domain/chat/index.ts';
import {
  decodePublicKey,
  encodePublicKey,
  fingerprintOf,
} from '@/domain/identity/index.ts';
import { loadChatStore, saveChatStore } from '@/lib/chat-store.ts';
import { SELF_PEER_ID } from '@/ui/shell-nav.ts';
import type { NocloudContext } from './context.ts';

export function createChatSlice(ctx: NocloudContext) {
  const { state, storage, touch, note } = ctx;

  const persist = (next: ChatStoreState) => {
    state.chat = next;
    saveChatStore(storage, next);
    touch();
  };

  const reloadFromStorage = () => {
    state.chat = loadChatStore(storage);
    touch();
  };

  const listMessages = (peerId: string): ChatStoredMessage[] =>
    listThreadMessages(state.chat, peerId);

  async function onIncomingChatWire(wire: string) {
    const verified = await parseAndVerifyChatMessage(wire);
    if (!verified.ok) {
      note(`chat: ${verified.message}`);
      return;
    }
    const key = decodePublicKey(verified.value.fromPk);
    if (!key.ok) return;
    const fromFp = fingerprintOf(key.value);
    if (fromFp === state.me.id) return;
    if (verified.value.toId !== state.me.id) return;
    const peerId = threadPeerId(state.me.id, verified.value, fromFp);
    const entry = storedFromWire(verified.value, 'in', wire);
    persist(appendChatMessage(state.chat, peerId, entry));
    note(`chat ← ${peerId.slice(0, 8)}`);
  }

  async function onSendChat(peerId: string, text: string): Promise<boolean> {
    const body = text.trim();
    if (!body) return false;

    if (peerId === SELF_PEER_ID) {
      const keyPair = ctx.ports.contacts.getIdentityKeyPair?.();
      const entry: ChatStoredMessage = {
        id: crypto.randomUUID(),
        fromPk: keyPair ? encodePublicKey(keyPair.publicKey) : '',
        toId: state.me.id || SELF_PEER_ID,
        text: body,
        ts: Date.now(),
        direction: 'out',
      };
      persist(appendChatMessage(state.chat, SELF_PEER_ID, entry));
      return true;
    }

    const keyPair = ctx.ports.contacts.getIdentityKeyPair?.();
    if (!keyPair) {
      state.contactsNotice = shellCopy.chatNeedIdentity;
      touch();
      return false;
    }

    const created = await createChatMessage(
      { toId: peerId, text: body },
      keyPair,
    );
    if (!created.ok) {
      state.contactsNotice = created.message;
      touch();
      return false;
    }

    const verified = await parseAndVerifyChatMessage(created.value);
    if (!verified.ok) {
      state.contactsNotice = verified.message;
      touch();
      return false;
    }

    const entry = storedFromWire(verified.value, 'out', created.value);
    persist(appendChatMessage(state.chat, peerId, entry));

    const sent =
      state.livePeerId === peerId &&
      state.peer?.session.state === 'connected' &&
      Boolean(state.peer.sendChatWire(created.value));

    if (sent) {
      note(`chat → ${peerId.slice(0, 8)}`);
      return true;
    }

    void ctx.ports.contacts.knockOn?.(peerId, false);
    state.contactsNotice = shellCopy.chatQueuedLocal;
    touch();
    return true;
  }

  return {
    reloadFromStorage,
    listMessages,
    onSendChat,
    onIncomingChatWire,
  };
}
