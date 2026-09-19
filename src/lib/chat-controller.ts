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
  type KeyPair,
} from '@/domain/identity/index.ts';
import {
  loadChatStore,
  saveChatStore,
  type ChatStoreStorage,
} from '@/lib/chat-store.ts';

export type ChatControllerCopy = {
  needIdentity: string;
  queuedLocal: string;
};

export type ChatControllerState = {
  chat: ChatStoreState;
  notice: string;
};

export type ChatControllerDeps = {
  storage: ChatStoreStorage;
  meId: () => string;
  selfPeerId: string;
  getKeyPair: () => KeyPair | null;
  livePeerId: () => string | null;
  linkConnected: () => boolean;
  trySendWire: (wire: string) => boolean;
  knockOn?: (peerId: string, asHost: boolean) => Promise<void>;
  note: (line: string) => void;
  onChange: (state: ChatControllerState) => void;
  copy?: ChatControllerCopy;
};

const defaultCopy = (): ChatControllerCopy => ({
  needIdentity: shellCopy.chatNeedIdentity,
  queuedLocal: shellCopy.chatQueuedLocal,
});

/**
 * Deep module for Chat product behaviour: signed send/receive, self notes,
 * persist threads. Pinia chat slice is a thin Vue adapter.
 */
export function createChatController(deps: ChatControllerDeps) {
  const copy = deps.copy ?? defaultCopy();
  let chat = loadChatStore(deps.storage);
  let notice = '';

  const snapshot = (): ChatControllerState => ({ chat, notice });

  const publish = () => deps.onChange(snapshot());

  const persist = (next: ChatStoreState) => {
    chat = next;
    saveChatStore(deps.storage, next);
    publish();
  };

  const reload = () => {
    chat = loadChatStore(deps.storage);
    publish();
  };

  const listMessages = (peerId: string): ChatStoredMessage[] =>
    listThreadMessages(chat, peerId);

  const incoming = async (wire: string) => {
    const verified = await parseAndVerifyChatMessage(wire);
    if (!verified.ok) {
      deps.note(`chat: ${verified.message}`);
      return;
    }
    const key = decodePublicKey(verified.value.fromPk);
    if (!key.ok) return;
    const fromFp = fingerprintOf(key.value);
    const me = deps.meId();
    if (fromFp === me) return;
    if (verified.value.toId !== me) return;
    const peerId = threadPeerId(me, verified.value, fromFp);
    const entry = storedFromWire(verified.value, 'in', wire);
    persist(appendChatMessage(chat, peerId, entry));
    deps.note(`chat ← ${peerId.slice(0, 8)}`);
  };

  const send = async (peerId: string, text: string): Promise<boolean> => {
    const body = text.trim();
    if (!body) return false;

    if (peerId === deps.selfPeerId) {
      const keyPair = deps.getKeyPair();
      const entry: ChatStoredMessage = {
        id: crypto.randomUUID(),
        fromPk: keyPair ? encodePublicKey(keyPair.publicKey) : '',
        toId: deps.meId() || deps.selfPeerId,
        text: body,
        ts: Date.now(),
        direction: 'out',
      };
      notice = '';
      persist(appendChatMessage(chat, deps.selfPeerId, entry));
      return true;
    }

    const keyPair = deps.getKeyPair();
    if (!keyPair) {
      notice = copy.needIdentity;
      publish();
      return false;
    }

    const created = await createChatMessage(
      { toId: peerId, text: body },
      keyPair,
    );
    if (!created.ok) {
      notice = created.message;
      publish();
      return false;
    }

    const verified = await parseAndVerifyChatMessage(created.value);
    if (!verified.ok) {
      notice = verified.message;
      publish();
      return false;
    }

    const entry = storedFromWire(verified.value, 'out', created.value);
    persist(appendChatMessage(chat, peerId, entry));

    const sent =
      deps.livePeerId() === peerId &&
      deps.linkConnected() &&
      deps.trySendWire(created.value);

    if (sent) {
      notice = '';
      deps.note(`chat → ${peerId.slice(0, 8)}`);
      publish();
      return true;
    }

    void deps.knockOn?.(peerId, false);
    notice = copy.queuedLocal;
    publish();
    return true;
  };

  return {
    getState: snapshot,
    reload,
    listMessages,
    send,
    incoming,
  };
}

export type ChatController = ReturnType<typeof createChatController>;
