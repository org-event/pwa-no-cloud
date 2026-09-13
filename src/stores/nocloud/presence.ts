import { presenceCopy } from '@/content/index.ts';
import { isProfileId } from '@/domain/profile.ts';
import type { CallIntent } from '@/lib/call-intent.ts';
import { PresenceHub } from '@/lib/presence.ts';
import { loginRelayChallenge } from '@/lib/relay-auth.ts';
import {
  releaseWakeLock,
  requestWakeLock,
  resumeWakeLock,
} from '@/lib/wake-lock.ts';
import type { NocloudContext } from './context.ts';
import { peerSignaling, usesRoomLink } from './views.ts';

export function createPresenceSlice(ctx: NocloudContext) {
  const { state, touch, note } = ctx;
  let hub: PresenceHub | null = null;
  let hubKey = '';
  let relaySessionId: string | null = null;

  const publish = () => {
    touch();
  };

  const contactIds = (): string[] =>
    state.book.contacts.map((item) => item.id).filter((id) => isProfileId(id));

  const signalingKey = (signaling: ReturnType<typeof peerSignaling>): string =>
    `${signaling.kind}:${'url' in signaling ? (signaling.url ?? '') : ''}`;

  const ensureHub = (): PresenceHub | null => {
    if (!usesRoomLink(ctx)) return null;
    if (!isProfileId(state.me.id)) return null;
    const signaling = peerSignaling(ctx);
    if (signaling.kind === 'manual' || !signaling.url) return null;
    const key = `${signalingKey(signaling)}:${state.me.id}`;
    if (hub && hubKey === key) {
      hub.setContacts(contactIds());
      return hub;
    }
    hub?.stop();
    hub = null;
    hubKey = key;
    hub = new PresenceHub({
      meId: state.me.id,
      signaling,
      onChange: (snapshot) => {
        state.presenceAvailable = snapshot.available;
        state.presenceOnlineIds = [...snapshot.onlineIds];
        publish();
      },
      onVisitor: (peerId) => {
        if (state.livePeerId === peerId && peerIsConnected()) return;
        if (
          state.peer?.state === 'connected' ||
          !ctx.refs.onIncomingCall?.(peerId)
        ) {
          state.contactsNotice = presenceCopy.busyIncoming(peerId);
          publish();
          return;
        }
        state.contactsNotice = presenceCopy.incomingKnock;
        publish();
      },
    });
    hub.setContacts(contactIds());
    return hub;
  };

  const peerIsConnected = (): boolean => state.peer?.state === 'connected';

  const ensureRelaySession = async (): Promise<void> => {
    if (relaySessionId) return;
    const signaling = peerSignaling(ctx);
    if (signaling.kind === 'manual' || !signaling.url) return;
    const keyPair = ctx.refs.getIdentityKeyPair?.();
    if (!keyPair) return;
    const session = await loginRelayChallenge({
      signalingUrl: signaling.url,
      keyPair,
    });
    if (session.ok) relaySessionId = session.value.sessionId;
  };

  async function startPresence(options?: { quiet?: boolean }) {
    const quiet = options?.quiet === true;
    if (!isProfileId(state.me.id)) {
      if (!quiet) {
        state.contactsNotice = presenceCopy.needIdentity;
        publish();
      }
      return false;
    }
    if (!usesRoomLink(ctx)) {
      if (!quiet) {
        state.contactsNotice = presenceCopy.needS1;
        publish();
      }
      return false;
    }

    const maxAttempts = Math.max(1, state.relayBundle.urls.length || 1);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await ensureRelaySession();
      const next = ensureHub();
      if (!next) {
        if (!quiet) {
          state.contactsNotice = presenceCopy.needS1;
          publish();
        }
        return false;
      }
      next.setContacts(contactIds());
      const wasAvailable = state.presenceAvailable && next.available;
      const ok = await next.start();
      if (ok) {
        const signaling = peerSignaling(ctx);
        if (signaling.kind !== 'manual' && signaling.url) {
          void ctx.refs.refreshRelayBundleFrom?.(signaling.url);
        }
        state.presenceAvailable = true;
        if (!quiet) {
          state.contactsNotice = presenceCopy.available;
          note(presenceCopy.availableNote);
        } else if (!wasAvailable) {
          state.contactsNotice = presenceCopy.available;
        }
        void requestWakeLock();
        publish();
        return true;
      }

      const signaling = peerSignaling(ctx);
      const failedUrl =
        signaling.kind !== 'manual' && signaling.url ? signaling.url : '';
      hub?.stop();
      hub = null;
      hubKey = '';
      relaySessionId = null;
      if (!failedUrl || !ctx.refs.failoverRelay?.(failedUrl)) {
        break;
      }
    }

    if (!quiet) {
      state.contactsNotice = presenceCopy.startFailed;
      publish();
    }
    return false;
  }

  function stopPresence() {
    hub?.stop();
    hub = null;
    hubKey = '';
    relaySessionId = null;
    state.presenceAvailable = false;
    state.presenceOnlineIds = [];
    state.contactsNotice = presenceCopy.unavailable;
    void releaseWakeLock();
    publish();
  }

  function syncPresenceContacts() {
    hub?.setContacts(contactIds());
  }

  /** Join lobby when the app is in the foreground and S1 is ready. */
  async function ensurePresenceActive() {
    if (
      typeof document !== 'undefined' &&
      document.visibilityState !== 'visible'
    ) {
      return;
    }
    await startPresence({ quiet: true });
  }

  async function resumePresence() {
    void resumeWakeLock();
    await ensurePresenceActive();
  }

  /**
   * Knock for data (files) now; later pass CallIntent.kind audio|video|screen.
   */
  async function onKnockContact(peerId: string, intent?: CallIntent) {
    const kind = intent?.kind ?? 'data';
    if (kind !== 'data') {
      state.contactsNotice = presenceCopy.mediaSoon(kind);
      publish();
    }
    if (!state.presenceOnlineIds.includes(peerId) && kind === 'data') {
      state.contactsNotice = presenceCopy.peerOffline;
      publish();
      // Still allow knock — peer may have just come online.
    }
    await startPresence();
    await ctx.refs.knockOn?.(peerId, false);
  }

  function isPresenceOnline(id: string): boolean {
    if (state.livePeerId === id && peerIsConnected()) return true;
    return state.presenceOnlineIds.includes(id);
  }

  function isChannelOpen(id: string): boolean {
    return Boolean(state.livePeerId === id && peerIsConnected());
  }

  return {
    startPresence,
    stopPresence,
    syncPresenceContacts,
    ensurePresenceActive,
    resumePresence,
    onKnockContact,
    isPresenceOnline,
    isChannelOpen,
  };
}
