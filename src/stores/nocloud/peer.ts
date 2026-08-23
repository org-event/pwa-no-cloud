import { defaultFileLabel, notes, peerCopy } from '@/content/index.ts';
import { resolveServers } from '@/config/index.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import type { ProfileCard } from '@/domain/profile.ts';
import { PeerSession } from '@/lib/peer-session.ts';
import { createSignalingPort } from '@/lib/signaling/factory.ts';
import { humanizeSignalingError } from '@/lib/signaling/mixed-content.ts';
import { notifyFileReceived } from '@/lib/notify.ts';
import type { NocloudContext } from './context.ts';
import { peerSignaling } from './views.ts';

export type PeerDeps = {
  flushQueue: () => void;
  refreshInbox: () => Promise<void>;
  refreshOutgoing: () => Promise<void>;
};

export function createPeerSlice(
  ctx: NocloudContext,
  shareDraftForInvite: () => CustomServerDraft | null,
  deps: PeerDeps,
) {
  const { state, touch, note } = ctx;

  const startPeer = (): PeerSession | null => {
    const resolved = resolveServers(state.settings, ctx.origin);
    if (!resolved.ok) {
      state.inviteError = resolved.message;
      note(notes.serversResolved(resolved.message));
      touch();
      return null;
    }
    if (state.peer) state.peer.close();
    state.outgoing = '';
    state.qrUrl = null;
    state.inviteError = '';
    state.lastLoggedState = '';
    state.peerNick = '';
    state.livePeerId = null;
    const next = new PeerSession({
      iceServers: resolved.value.iceServers,
      signaling: createSignalingPort(peerSignaling(ctx)),
      shareServers: shareDraftForInvite(),
      profile: state.me,
    });
    next.on('state', () => {
      const label = next.session.state;
      if (label === 'closed' || label === 'failed' || label === 'idle') {
        state.livePeerId = null;
      }
      if (label !== state.lastLoggedState) {
        state.lastLoggedState = label;
        note(notes.session(label));
      }
      touch();
    });
    next.on('invite', () => {
      void deps.refreshOutgoing();
    });
    next.on('channel-open', () => {
      if (next.peerId && next.peerId !== state.me.id) {
        state.livePeerId = next.peerId;
      }
      note(notes.channelOpen);
      deps.flushQueue();
      touch();
    });
    next.on('recover', (value) => {
      note(notes.reconnect(String(value)));
      state.contactsNotice = peerCopy.reconnecting;
      touch();
    });
    next.on('profile', (value) => {
      const card = value as ProfileCard;
      ctx.refs.applyPeerProfile?.(card);
    });
    next.on('ice', () => touch());
    next.on('pong', () => touch());
    next.on('error', (value) => {
      if (typeof value === 'string') {
        state.transferError = humanizeSignalingError(value);
        note(notes.error(state.transferError));
      }
      touch();
    });
    next.on('transfer', () => {
      deps.flushQueue();
      touch();
    });
    next.on('file-offer', () => touch());
    next.on('folder', () => touch());
    next.on('folder-offer', () => touch());
    next.on('file-received', (value) => {
      const transfer = value as { name?: string; path?: string };
      const label = transfer.path || transfer.name || defaultFileLabel;
      void notifyFileReceived(label);
      note(notes.fileReceived(label));
      void (async () => {
        await deps.refreshInbox();
        touch();
      })();
    });
    next.setStore(state.store);
    state.peer = next;
    return next;
  };

  return { startPeer };
}
