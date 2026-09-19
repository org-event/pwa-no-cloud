import { inviteCopy, MIXED_CONTENT_SIGNALING, notes } from '@/content/index.ts';
import { decodeSharePack, DEFAULT_ROOM } from '@/config/index.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import {
  parsePastedShare,
  type DeepKind,
  type DeepLink,
} from '@/lib/app-link.ts';
import type { Link } from '@/lib/link.ts';
import { decodeInvite } from '@/packages/signaling/invite.ts';

export type InviteSessionRole = 'idle' | 'caller' | 'callee';

export type InviteSessionState = {
  inviteRole: InviteSessionRole;
  inviteError: string;
  roomId: string;
  openedFromLink: boolean;
  hostNotice: string;
};

export type InviteSessionCopy = {
  serversFromPackSaved: string;
  serversFromInviteSaved: string;
  serversFromLinkSaved: string;
  roomLinkNeedsSocket: string;
  notNoCloudLink: string;
  mixedContentSignaling: string;
};

export type InviteShareTarget = {
  kind: DeepKind;
  payload: string;
};

export type InviteSessionDeps = {
  startPeer: () => Link | null;
  getPeer: () => Link | null;
  usesRoomLink: () => boolean;
  socketBlocked: () => boolean;
  peerIsLive: () => boolean;
  getOutgoing: () => string;
  generateRoomId: () => string;
  /**
   * Pinia may update role/room outside InviteSession (e.g. contacts knock).
   * Adopt before each mutation so publish does not wipe those fields.
   */
  pullShared: () => Pick<
    InviteSessionState,
    'inviteRole' | 'roomId' | 'openedFromLink' | 'hostNotice' | 'inviteError'
  >;
  applyShareDraft: (draft: CustomServerDraft, notice: string) => void;
  refreshOutgoing: () => Promise<void>;
  note: (line: string) => void;
  onChange: (state: InviteSessionState) => void;
  copy?: InviteSessionCopy;
};

const defaultCopy = (): InviteSessionCopy => ({
  serversFromPackSaved: inviteCopy.serversFromPackSaved,
  serversFromInviteSaved: inviteCopy.serversFromInviteSaved,
  serversFromLinkSaved: inviteCopy.serversFromLinkSaved,
  roomLinkNeedsSocket: inviteCopy.roomLinkNeedsSocket,
  notNoCloudLink: inviteCopy.notNoCloudLink,
  mixedContentSignaling: MIXED_CONTENT_SIGNALING,
});

/**
 * Deep module for invite / deep-link product behaviour: create/join, apply
 * pack or invite text, room links, paste. Pinia invite slice is a thin Vue
 * adapter (clipboard, navigator.share, location).
 */
export function createInviteSession(deps: InviteSessionDeps) {
  const copy = deps.copy ?? defaultCopy();
  let inviteRole: InviteSessionRole = 'idle';
  let inviteError = '';
  let roomId = '';
  let openedFromLink = false;
  let hostNotice = '';

  const snapshot = (): InviteSessionState => ({
    inviteRole,
    inviteError,
    roomId,
    openedFromLink,
    hostNotice,
  });

  const publish = () => deps.onChange(snapshot());

  const adoptShared = () => {
    const shared = deps.pullShared();
    inviteRole = shared.inviteRole;
    inviteError = shared.inviteError;
    roomId = shared.roomId;
    openedFromLink = shared.openedFromLink;
    hostNotice = shared.hostNotice;
  };

  const createInvite = async () => {
    adoptShared();
    inviteError = '';
    inviteRole = 'caller';
    publish();
    const next = deps.startPeer();
    if (!next) return;
    await next.createInvite();
    await deps.refreshOutgoing();
  };

  const join = () => {
    adoptShared();
    inviteRole = 'callee';
    publish();
    deps.startPeer();
  };

  const applyIncoming = async (text: string) => {
    adoptShared();
    inviteError = '';
    publish();
    const packed = decodeSharePack(text);
    if (packed.ok) {
      deps.applyShareDraft(packed.value, copy.serversFromPackSaved);
      publish();
      return;
    }
    const decoded = await decodeInvite(text);
    if (decoded.ok && decoded.value.servers) {
      deps.applyShareDraft(decoded.value.servers, copy.serversFromInviteSaved);
    }
    if (inviteRole !== 'caller') {
      if (!deps.getPeer() || (decoded.ok && decoded.value.servers)) {
        inviteRole = 'callee';
        publish();
        if (!deps.startPeer()) return;
      }
    } else if (!deps.getPeer()) {
      if (!deps.startPeer()) return;
    }
    const current = deps.getPeer();
    if (!current) return;
    if (inviteRole === 'callee') {
      const accepted = await current.acceptInvite(text);
      if (!accepted.ok) inviteError = accepted.message;
      publish();
      await deps.refreshOutgoing();
      return;
    }
    const accepted = await current.acceptAnswer(text);
    if (!accepted.ok) inviteError = accepted.message;
    publish();
  };

  const applyDeepLink = async (link: DeepLink) => {
    adoptShared();
    if (link.kind === 'section') return;
    deps.note(notes.linkKind(link.kind));
    if (link.kind === 'pack') {
      const packed = decodeSharePack(link.payload);
      if (!packed.ok) {
        hostNotice = packed.message;
        publish();
        return;
      }
      deps.applyShareDraft(packed.value, copy.serversFromLinkSaved);
      publish();
      return;
    }
    if (link.kind === 'room') {
      openedFromLink = true;
      roomId = link.payload;
      if (!deps.usesRoomLink()) {
        inviteError = deps.socketBlocked()
          ? copy.mixedContentSignaling
          : copy.roomLinkNeedsSocket;
        publish();
        return;
      }
      inviteRole = 'caller';
      publish();
      const next = deps.startPeer();
      if (next) await next.enterRoom(roomId.trim() || DEFAULT_ROOM);
      publish();
      return;
    }
    if (link.kind === 'join') {
      inviteRole = 'callee';
      publish();
    }
    await applyIncoming(link.payload);
  };

  const resumeMeetRoom = () => {
    adoptShared();
    if (!deps.usesRoomLink()) return;
    const room = roomId.trim();
    if (!room) return;
    const peer = deps.getPeer();
    if (peer?.state === 'connected') return;
    if (peer?.keepRoom && peer.roomId === room) {
      peer.resumeRoom();
      publish();
      return;
    }
    const next = deps.startPeer();
    if (!next) return;
    void next.enterRoom(room);
    publish();
  };

  const pasteLink = (text: string) => {
    adoptShared();
    const link = parsePastedShare(text);
    if (link.kind === 'section') {
      inviteError = copy.notNoCloudLink;
      publish();
      return;
    }
    inviteError = '';
    publish();
    void applyDeepLink(link);
  };

  const shareLinkTarget = (): InviteShareTarget | null => {
    adoptShared();
    const outgoing = deps.getOutgoing();
    if (!outgoing) return null;
    const kind: DeepKind = inviteRole === 'callee' ? 'answer' : 'join';
    return { kind, payload: outgoing };
  };

  const prepareShareRoom = async (): Promise<InviteShareTarget | null> => {
    adoptShared();
    inviteError = '';
    if (deps.usesRoomLink()) {
      if (!deps.peerIsLive()) {
        openedFromLink = false;
        roomId = deps.generateRoomId();
        inviteRole = 'caller';
        publish();
        const next = deps.startPeer();
        if (!next) return null;
        void next.enterRoom(roomId);
      }
      publish();
      return { kind: 'room', payload: roomId };
    }
    openedFromLink = false;
    inviteRole = 'caller';
    publish();
    const next = deps.startPeer();
    if (!next) return null;
    await next.createInvite();
    await deps.refreshOutgoing();
    const outgoing = deps.getOutgoing();
    publish();
    if (!outgoing) return null;
    return { kind: 'join', payload: outgoing };
  };

  const setInviteError = (message: string) => {
    adoptShared();
    inviteError = message;
    publish();
  };

  return {
    getState: snapshot,
    createInvite,
    join,
    applyIncoming,
    applyDeepLink,
    resumeMeetRoom,
    pasteLink,
    shareLinkTarget,
    prepareShareRoom,
    setInviteError,
  };
}

export type InviteSession = ReturnType<typeof createInviteSession>;
