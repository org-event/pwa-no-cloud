import { isProfileId } from '@/domain/profile.ts';
import type { CallIntent } from '@/lib/call-intent.ts';
import { loginRelayChallenge } from '@/lib/relay-auth.ts';
import {
  createPresenceController,
  type PresenceControllerState,
} from '@/lib/presence-controller.ts';
import {
  releaseWakeLock,
  requestWakeLock,
  resumeWakeLock,
} from '@/lib/wake-lock.ts';
import type { NocloudContext } from './context.ts';
import { peerSignaling, usesRoomLink } from './views.ts';

export function createPresenceSlice(ctx: NocloudContext) {
  const { state, touch, note } = ctx;

  const syncUi = (next: PresenceControllerState) => {
    state.presenceAvailable = next.available;
    state.presenceOnlineIds = next.onlineIds;
    if (next.notice) state.contactsNotice = next.notice;
    touch();
  };

  const controller = createPresenceController({
    selfId: () => state.me.id,
    contactIds: () =>
      state.book.contacts
        .map((item) => item.id)
        .filter((id) => isProfileId(id)),
    usesRoomLink: () => usesRoomLink(ctx),
    getSignaling: () => peerSignaling(ctx),
    relayUrlCount: () => state.relayBundle.urls.length,
    livePeerId: () => state.livePeerId,
    linkConnected: () => state.peer?.state === 'connected',
    withKeyPair: (op) =>
      ctx.ports.contacts.withIdentityKeyPair?.(op) ?? Promise.resolve(null),
    loginRelay: async (signalingUrl, keyPair) => {
      const session = await loginRelayChallenge({ signalingUrl, keyPair });
      if (session.ok) {
        return { ok: true as const, sessionId: session.value.sessionId };
      }
      return { ok: false as const };
    },
    onIncomingCall: (peerId) =>
      ctx.ports.call.onIncomingCall?.(peerId) ?? false,
    knockOn: async (peerId, asHost) => {
      await ctx.ports.contacts.knockOn?.(peerId, asHost);
    },
    refreshRelayBundleFrom: (url) =>
      ctx.ports.servers.refreshRelayBundleFrom?.(url),
    failoverRelay: (failedUrl) =>
      ctx.ports.servers.failoverRelay?.(failedUrl) ?? false,
    requestWakeLock: () => {
      void requestWakeLock();
    },
    releaseWakeLock: () => {
      void releaseWakeLock();
    },
    resumeWakeLock: () => {
      void resumeWakeLock();
    },
    isDocumentVisible: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible',
    note,
    onChange: syncUi,
  });

  return {
    startPresence: controller.start,
    stopPresence: controller.stop,
    syncPresenceContacts: controller.syncContacts,
    ensurePresenceActive: controller.ensureActive,
    resumePresence: controller.resume,
    onKnockContact: (peerId: string, intent?: CallIntent) =>
      controller.knock(peerId, intent),
    isPresenceOnline: controller.isOnline,
    isChannelOpen: controller.isChannelOpen,
  };
}
