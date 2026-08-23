import { iceServersHaveTurn, resolveServers } from '@/config/index.ts';
import type { SignalingConfig } from '@/config/types.ts';
import { meetRoomId } from '@/domain/profile.ts';
import { APP_BASE } from '@/workers/sw.ts';
import type { DeepKind } from '@/lib/app-link.ts';
import { encodeHttpsLink } from '@/lib/app-link.ts';
import { formatIceReport } from '@/lib/ice.ts';
import {
  humanizeSignalingError,
  mixedContentBlocksSignaling,
} from '@/lib/signaling/mixed-content.ts';
import type { TransferViewState } from '@/ui/transfer-status.ts';
import type {
  ContactsState,
  InboxState,
  InviteState,
  LogsState,
} from '@/stores/types.ts';
import type { NocloudContext } from './context.ts';

export function logsState(ctx: NocloudContext): LogsState {
  const { state } = ctx;
  return {
    text: state.logText,
    error: state.logError,
  };
}

export function isManualSignaling(ctx: NocloudContext): boolean {
  const resolved = resolveServers(ctx.state.settings, ctx.origin);
  return !resolved.ok || resolved.value.signaling.kind === 'manual';
}

export function socketBlocked(ctx: NocloudContext): boolean {
  const resolved = resolveServers(ctx.state.settings, ctx.origin);
  if (!resolved.ok) return false;
  const url = resolved.value.signaling.url;
  if (!url || resolved.value.signaling.kind === 'manual') return false;
  return mixedContentBlocksSignaling(url);
}

export function usesRoomLink(ctx: NocloudContext): boolean {
  const resolved = resolveServers(ctx.state.settings, ctx.origin);
  if (!resolved.ok) return false;
  const sig = resolved.value.signaling;
  if (sig.kind === 'manual' || !sig.url) return false;
  return !mixedContentBlocksSignaling(sig.url);
}

export function peerSignaling(ctx: NocloudContext): SignalingConfig {
  const resolved = resolveServers(ctx.state.settings, ctx.origin);
  if (!resolved.ok || socketBlocked(ctx)) return { kind: 'manual' };
  return resolved.value.signaling;
}

export function shareUrlNow(ctx: NocloudContext): string {
  const { state } = ctx;
  if (usesRoomLink(ctx) && state.roomId) {
    return encodeHttpsLink(
      globalThis.location.origin,
      APP_BASE,
      'room',
      state.roomId,
    );
  }
  if (state.outgoing) {
    const kind: DeepKind = state.inviteRole === 'callee' ? 'answer' : 'join';
    return encodeHttpsLink(
      globalThis.location.origin,
      APP_BASE,
      kind,
      state.outgoing,
    );
  }
  return '';
}

export function peerIsLive(ctx: NocloudContext): boolean {
  const { state } = ctx;
  if (!state.peer) return false;
  return (
    state.peer.state !== 'idle' &&
    state.peer.state !== 'closed' &&
    state.peer.state !== 'failed'
  );
}

export function inboxState(ctx: NocloudContext): InboxState {
  const { state } = ctx;
  return {
    items: state.inboxItems,
    selected: state.selected,
    preview: state.preview,
    error: state.inboxError,
    ready: state.store !== null,
  };
}

export function inviteState(ctx: NocloudContext): InviteState {
  const { state } = ctx;
  return {
    role:
      state.peer?.role && state.peer.role !== 'idle'
        ? state.peer.role
        : state.inviteRole,
    mode: isManualSignaling(ctx) && !socketBlocked(ctx) ? 'manual' : 'room',
    open:
      state.inviteRole !== 'idle' ||
      Boolean(
        state.peer &&
        state.peer.state !== 'idle' &&
        state.peer.state !== 'closed',
      ),
    outgoing: state.outgoing,
    qrUrl: state.qrUrl,
    error: humanizeSignalingError(
      state.inviteError || (state.peer?.error ?? ''),
    ),
    connected: state.peer?.state === 'connected',
    lastPongMs: state.peer?.lastPongMs ?? null,
    ice: state.peer ? formatIceReport(state.peer.ice) : '',
    shareWithPeer: state.shareWithPeer,
    canShareServers: (() => {
      const resolved = resolveServers(state.settings, ctx.origin);
      return resolved.ok && iceServersHaveTurn(resolved.value.iceServers);
    })(),
  };
}

export function transferState(ctx: NocloudContext): TransferViewState {
  const { state } = ctx;
  const folder = state.queuedFolder;
  const folderBytes = folder
    ? folder.reduce((sum, item) => sum + item.file.size, 0)
    : 0;
  const fileBytes = state.queuedFiles.reduce((sum, file) => sum + file.size, 0);
  const folderName =
    state.queuedFolderLabel || folder?.[0]?.path.split('/')[0] || '';
  return {
    connected: state.peer?.state === 'connected',
    current: state.peer?.activeFile() ?? null,
    incoming: state.peer?.incomingFile() ?? null,
    folder: state.peer?.activeFolder() ?? null,
    incomingFolder: state.peer?.incomingFolder() ?? null,
    queuedNames: state.queuedFiles.map((file) => file.name),
    queuedItems: state.queuedFiles.map((file, index) => ({
      key: `file:${index}:${file.name}:${file.size}`,
      name: file.name,
      size: file.size,
    })),
    queuedFolderName: folderName,
    queuedFolderCount: folder?.length ?? 0,
    queuedFolderItems: (folder ?? []).map((item, index) => ({
      key: `folder:${index}:${item.path}`,
      name: item.path,
      size: item.file.size,
    })),
    queuedFolderBytes: folderBytes,
    queuedBytes: fileBytes + folderBytes,
    error: state.transferError,
  };
}

export function contactsState(ctx: NocloudContext): ContactsState {
  const { state } = ctx;
  return {
    me: state.me,
    book: state.book,
    pending: state.pending,
    notice: state.contactsNotice,
    cardText: state.cardText,
    waiting: peerIsLive(ctx) && state.roomId === meetRoomId(state.me.id),
    connected: state.peer?.state === 'connected',
    livePeerId: state.livePeerId,
    presenceAvailable: state.presenceAvailable,
    presenceOnlineIds: state.presenceOnlineIds,
  };
}
