import type { CustomServerDraft } from '@/config/types.ts';
import type { NocloudContext } from './context.ts';
import { createInviteSlice } from './invite.ts';
import { createPeerSlice } from './peer.ts';
import { createTransferSlice } from './transfer.ts';

export function createSessionSlice(
  ctx: NocloudContext,
  shareDraftForInvite: () => CustomServerDraft | null,
) {
  const transfer = createTransferSlice(ctx);

  const peerDeps = {
    flushQueue: transfer.flushQueue,
    refreshInbox: transfer.refreshInbox,
    refreshOutgoing: async () => {},
  };

  const peer = createPeerSlice(ctx, shareDraftForInvite, peerDeps);
  const invite = createInviteSlice(ctx, { startPeer: peer.startPeer });

  peerDeps.refreshOutgoing = invite.refreshOutgoing;

  return {
    setInboxError: transfer.setInboxError,
    refreshInbox: transfer.refreshInbox,
    refreshOutgoing: invite.refreshOutgoing,
    startPeer: peer.startPeer,
    copyText: invite.copyText,
    flushQueue: transfer.flushQueue,
    queueFile: transfer.queueFile,
    shareDeepLink: invite.shareDeepLink,
    applyIncoming: invite.applyIncoming,
    applyDeepLink: invite.applyDeepLink,
    consumeDeepLink: invite.consumeDeepLink,
    resumeMeetRoom: invite.resumeMeetRoom,
    onCreateInvite: invite.onCreateInvite,
    onJoin: invite.onJoin,
    onApplyPaste: invite.onApplyPaste,
    onShareLink: invite.onShareLink,
    onShareRoom: invite.onShareRoom,
    onCopyShareUrl: invite.onCopyShareUrl,
    onPasteLink: invite.onPasteLink,
    onCopy: invite.onCopy,
    onPing: invite.onPing,
    onPickFile: transfer.onPickFile,
    onPickFiles: transfer.onPickFiles,
    onPickFolder: transfer.onPickFolder,
    onClearStaged: transfer.onClearStaged,
    onPickError: transfer.onPickError,
    onSendTransfer: transfer.onSendTransfer,
    onAcceptFile: transfer.onAcceptFile,
    onRejectFile: transfer.onRejectFile,
    onCancelFile: transfer.onCancelFile,
    onPauseFile: transfer.onPauseFile,
    onResumeFile: transfer.onResumeFile,
    onRead: transfer.onRead,
    onRemove: transfer.onRemove,
    onSelect: transfer.onSelect,
  };
}
