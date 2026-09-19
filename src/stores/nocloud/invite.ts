import { inviteCopy, notes } from '@/content/index.ts';
import { APP_NAME } from '@/config/index.ts';
import {
  cleanLocation,
  encodeHttpsLink,
  encodeProtocolLink,
  parseDeepLink,
  shareMessage,
  type DeepKind,
} from '@/lib/app-link.ts';
import type { Link } from '@/lib/link.ts';
import {
  createInviteSession,
  type InviteSessionState,
} from '@/lib/invite-session.ts';
import { inviteToQr } from '@/lib/qr.ts';
import { generateId } from '@/lib/id.ts';
import { APP_BASE } from '@/workers/sw.ts';
import type { NocloudContext } from './context.ts';
import {
  peerIsLive,
  shareUrlNow,
  socketBlocked,
  usesRoomLink,
} from './views.ts';

export type InviteDeps = {
  startPeer: () => Link | null;
};

export function createInviteSlice(ctx: NocloudContext, deps: InviteDeps) {
  const { state, touch, note } = ctx;

  const syncUi = (next: InviteSessionState) => {
    state.inviteRole = next.inviteRole;
    state.inviteError = next.inviteError;
    state.roomId = next.roomId;
    state.openedFromLink = next.openedFromLink;
    state.hostNotice = next.hostNotice;
    touch();
  };

  const refreshOutgoing = async () => {
    state.outgoing = state.peer?.outgoing() ?? '';
    state.qrUrl = await inviteToQr(state.outgoing);
    touch();
  };

  const session = createInviteSession({
    startPeer: deps.startPeer,
    getPeer: () => state.peer,
    usesRoomLink: () => usesRoomLink(ctx),
    socketBlocked: () => socketBlocked(ctx),
    peerIsLive: () => peerIsLive(ctx),
    getOutgoing: () => state.outgoing,
    generateRoomId: () => generateId(),
    pullShared: () => ({
      inviteRole: state.inviteRole,
      inviteError: state.inviteError,
      roomId: state.roomId,
      openedFromLink: state.openedFromLink,
      hostNotice: state.hostNotice,
    }),
    applyShareDraft: (draft, notice) => {
      ctx.ports.servers.applyShareDraft?.(draft, notice);
    },
    refreshOutgoing,
    note,
    onChange: syncUi,
  });

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

  const consumeDeepLink = () => {
    const link = parseDeepLink(
      globalThis.location.hash,
      globalThis.location.search,
    );
    if (link.kind === 'section') return;
    history.replaceState(null, '', cleanLocation(location.href, link.section));
    void session.applyDeepLink(link);
  };

  function onCreateInvite() {
    void session.createInvite();
  }

  function onJoin() {
    session.join();
  }

  function onApplyPaste(text: string) {
    void session.applyIncoming(text);
  }

  function onShareLink() {
    const target = session.shareLinkTarget();
    if (!target) return;
    void shareDeepLink(target.kind, target.payload);
  }

  function onShareRoom() {
    void (async () => {
      const target = await session.prepareShareRoom();
      if (!target) return;
      await shareDeepLink(target.kind, target.payload);
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
    session.pasteLink(text);
  }

  function onCopy() {
    void (async () => {
      if (!state.outgoing || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(state.outgoing);
      } catch {
        session.setInviteError(inviteCopy.copyFailed);
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
    applyIncoming: session.applyIncoming,
    applyDeepLink: session.applyDeepLink,
    consumeDeepLink,
    resumeMeetRoom: session.resumeMeetRoom,
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
