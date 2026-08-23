import { inviteCopy, MIXED_CONTENT_SIGNALING, notes } from '@/content/index.ts';
import { APP_NAME, decodeSharePack, DEFAULT_ROOM } from '@/config/index.ts';
import {
  cleanLocation,
  encodeHttpsLink,
  encodeProtocolLink,
  parseDeepLink,
  parsePastedShare,
  shareMessage,
  type DeepKind,
  type DeepLink,
} from '@/lib/app-link.ts';
import { PeerSession } from '@/lib/peer-session.ts';
import { inviteToQr } from '@/lib/qr.ts';
import { decodeInvite } from '@/lib/signaling/invite.ts';
import { APP_BASE } from '@/workers/sw.ts';
import { generateId } from '@/lib/id.ts';
import type { NocloudContext } from './context.ts';
import {
  peerIsLive,
  shareUrlNow,
  socketBlocked,
  usesRoomLink,
} from './views.ts';

export type InviteDeps = {
  startPeer: () => PeerSession | null;
};

export function createInviteSlice(ctx: NocloudContext, deps: InviteDeps) {
  const { state, touch, note } = ctx;

  const refreshOutgoing = async () => {
    state.outgoing = state.peer?.outgoing() ?? '';
    state.qrUrl = await inviteToQr(state.outgoing);
    touch();
  };

  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (!navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  const shareDeepLink = async (kind: DeepKind, payload: string) => {
    const https = encodeHttpsLink(
      globalThis.location.origin,
      APP_BASE,
      kind,
      payload,
    );
    const proto = encodeProtocolLink(kind, payload);
    const text = shareMessage(https, proto);
    try {
      if (navigator.share) {
        if (https.length <= 1500) {
          await navigator.share({ title: APP_NAME, text, url: https });
        } else {
          await navigator.share({ title: APP_NAME, text });
        }
        note(notes.linkShared);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
    const ok = await copyText(https);
    note(ok ? notes.linkCopied : notes.linkShareFailed);
    touch();
  };

  const applyIncoming = async (text: string) => {
    state.inviteError = '';
    const packed = decodeSharePack(text);
    if (packed.ok) {
      ctx.refs.applyShareDraft?.(packed.value, inviteCopy.serversFromPackSaved);
      touch();
      return;
    }
    const decoded = await decodeInvite(text);
    if (decoded.ok && decoded.value.servers) {
      ctx.refs.applyShareDraft?.(
        decoded.value.servers,
        inviteCopy.serversFromInviteSaved,
      );
    }
    if (state.inviteRole !== 'caller') {
      if (!state.peer || (decoded.ok && decoded.value.servers)) {
        state.inviteRole = 'callee';
        if (!deps.startPeer()) return;
      }
    } else if (!state.peer) {
      if (!deps.startPeer()) return;
    }
    const current = state.peer;
    if (!current) return;
    if (state.inviteRole === 'callee') {
      const accepted = await current.acceptInvite(text);
      if (!accepted.ok) state.inviteError = accepted.message;
      await refreshOutgoing();
      return;
    }
    const accepted = await current.acceptAnswer(text);
    if (!accepted.ok) state.inviteError = accepted.message;
    touch();
  };

  const applyDeepLink = async (link: DeepLink) => {
    if (link.kind === 'section') return;
    note(notes.linkKind(link.kind));
    if (link.kind === 'pack') {
      const packed = decodeSharePack(link.payload);
      if (!packed.ok) {
        state.hostNotice = packed.message;
        touch();
        return;
      }
      ctx.refs.applyShareDraft?.(packed.value, inviteCopy.serversFromLinkSaved);
      touch();
      return;
    }
    if (link.kind === 'room') {
      state.openedFromLink = true;
      state.roomId = link.payload;
      if (!usesRoomLink(ctx)) {
        state.inviteError = socketBlocked(ctx)
          ? MIXED_CONTENT_SIGNALING
          : inviteCopy.roomLinkNeedsSocket;
        touch();
        return;
      }
      state.inviteRole = 'caller';
      const next = deps.startPeer();
      if (next) await next.enterRoom(state.roomId.trim() || DEFAULT_ROOM);
      touch();
      return;
    }
    if (link.kind === 'join') state.inviteRole = 'callee';
    await applyIncoming(link.payload);
  };

  const consumeDeepLink = () => {
    const link = parseDeepLink(
      globalThis.location.hash,
      globalThis.location.search,
    );
    if (link.kind === 'section') return;
    history.replaceState(null, '', cleanLocation(location.href, link.section));
    void applyDeepLink(link);
  };

  const resumeMeetRoom = () => {
    if (!usesRoomLink(ctx)) return;
    const room = state.roomId.trim();
    if (!room) return;
    const peer = state.peer;
    if (peer?.state === 'connected') return;
    if (peer?.keepRoom && peer.roomId === room) {
      peer.resumeRoom();
      touch();
      return;
    }
    const next = deps.startPeer();
    if (!next) return;
    void next.enterRoom(room);
    touch();
  };

  function onCreateInvite() {
    void (async () => {
      state.inviteError = '';
      state.inviteRole = 'caller';
      const next = deps.startPeer();
      if (!next) return;
      await next.createInvite();
      await refreshOutgoing();
    })();
  }

  function onJoin() {
    state.inviteRole = 'callee';
    deps.startPeer();
    touch();
  }

  function onApplyPaste(text: string) {
    void applyIncoming(text);
  }

  function onShareLink() {
    if (!state.outgoing) return;
    const kind: DeepKind = state.inviteRole === 'callee' ? 'answer' : 'join';
    void shareDeepLink(kind, state.outgoing);
  }

  function onShareRoom() {
    void (async () => {
      state.inviteError = '';
      if (usesRoomLink(ctx)) {
        if (!peerIsLive(ctx)) {
          state.openedFromLink = false;
          state.roomId = generateId();
          state.inviteRole = 'caller';
          const next = deps.startPeer();
          if (!next) return;
          void next.enterRoom(state.roomId);
        }
        await shareDeepLink('room', state.roomId);
        touch();
        return;
      }
      state.openedFromLink = false;
      state.inviteRole = 'caller';
      const next = deps.startPeer();
      if (!next) return;
      await next.createInvite();
      await refreshOutgoing();
      if (state.outgoing) await shareDeepLink('join', state.outgoing);
      touch();
    })();
  }

  function onCopyShareUrl() {
    void (async () => {
      const url = shareUrlNow(ctx);
      if (!url) return;
      const ok = await copyText(url);
      note(ok ? notes.linkCopied : notes.linkCopyFailed);
      touch();
    })();
  }

  function onPasteLink(text: string) {
    const link = parsePastedShare(text);
    if (link.kind === 'section') {
      state.inviteError = inviteCopy.notNoCloudLink;
      touch();
      return;
    }
    state.inviteError = '';
    void applyDeepLink(link);
  }

  function onCopy() {
    void (async () => {
      if (!state.outgoing || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(state.outgoing);
      } catch {
        state.inviteError = inviteCopy.copyFailed;
        touch();
      }
    })();
  }

  function onPing() {
    state.peer?.ping();
  }

  return {
    copyText,
    refreshOutgoing,
    shareDeepLink,
    applyIncoming,
    applyDeepLink,
    consumeDeepLink,
    resumeMeetRoom,
    onCreateInvite,
    onJoin,
    onApplyPaste,
    onShareLink,
    onShareRoom,
    onCopyShareUrl,
    onPasteLink,
    onCopy,
    onPing,
  };
}
