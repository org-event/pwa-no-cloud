import { presenceCopy } from '@/content/index.ts';
import type { CallIntent } from '@/lib/call-intent.ts';
import { PresenceHub } from '@/lib/presence.ts';
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

  const publish = () => {
    touch();
  };

  const contactIds = (): string[] => state.book.contacts.map((item) => item.id);

  const ensureHub = (): PresenceHub | null => {
    if (!usesRoomLink(ctx)) return null;
    const signaling = peerSignaling(ctx);
    if (signaling.kind === 'manual' || !signaling.url) return null;
    if (hub) {
      hub.setContacts(contactIds());
      return hub;
    }
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
        if (state.peer?.state === 'connected') {
          state.contactsNotice = presenceCopy.busyIncoming(peerId);
          publish();
          return;
        }
        state.contactsNotice = presenceCopy.incomingKnock;
        publish();
        void ctx.refs.knockOn?.(state.me.id, true);
      },
    });
    hub.setContacts(contactIds());
    return hub;
  };

  const peerIsConnected = (): boolean => state.peer?.state === 'connected';

  async function startPresence() {
    if (!usesRoomLink(ctx)) {
      state.contactsNotice = presenceCopy.needS1;
      publish();
      return false;
    }
    const next = ensureHub();
    if (!next) {
      state.contactsNotice = presenceCopy.needS1;
      publish();
      return false;
    }
    next.setContacts(contactIds());
    const ok = await next.start();
    if (!ok) {
      state.contactsNotice = presenceCopy.startFailed;
      publish();
      return false;
    }
    state.presenceAvailable = true;
    state.contactsNotice = presenceCopy.available;
    note(presenceCopy.availableNote);
    void requestWakeLock();
    publish();
    return true;
  }

  function stopPresence() {
    hub?.stop();
    hub = null;
    state.presenceAvailable = false;
    state.presenceOnlineIds = [];
    state.contactsNotice = presenceCopy.unavailable;
    void releaseWakeLock();
    publish();
  }

  function syncPresenceContacts() {
    hub?.setContacts(contactIds());
  }

  async function resumePresence() {
    void resumeWakeLock();
    if (!state.presenceAvailable && !hub) return;
    const next = ensureHub();
    if (!next) return;
    next.setContacts(contactIds());
    await next.start();
    void resumeWakeLock();
    publish();
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
    resumePresence,
    onKnockContact,
    isPresenceOnline,
    isChannelOpen,
  };
}
