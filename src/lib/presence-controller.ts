import { presenceCopy } from '@/content/index.ts';
import type { SignalingConfig } from '@/config/types.ts';
import type { KeyPair } from '@/domain/identity/index.ts';
import { isProfileId } from '@/domain/profile.ts';
import type { CallIntent } from '@/lib/call-intent.ts';
import { PresenceHub, type PresenceSnapshot } from '@/lib/presence.ts';

export type PresenceControllerState = {
  available: boolean;
  onlineIds: string[];
  notice: string;
};

export type PresenceControllerCopy = {
  needS1: string;
  needIdentity: string;
  startFailed: string;
  available: string;
  availableNote: string;
  unavailable: string;
  incomingKnock: string;
  busyIncoming: (peerId: string) => string;
  peerOffline: string;
  mediaSoon: (kind: string) => string;
};

/** Minimal Hub surface used by the controller (real PresenceHub or fake). */
export type PresenceHubPort = {
  readonly available: boolean;
  setContacts(ids: string[]): void;
  start(): Promise<boolean>;
  stop(): void;
};

export type PresenceHubFactory = (options: {
  meId: string;
  signaling: SignalingConfig;
  onChange: (snapshot: PresenceSnapshot) => void;
  onVisitor: (peerId: string) => void;
}) => PresenceHubPort;

export type PresenceControllerDeps = {
  selfId: () => string;
  contactIds: () => string[];
  usesRoomLink: () => boolean;
  getSignaling: () => SignalingConfig;
  relayUrlCount: () => number;
  livePeerId: () => string | null;
  linkConnected: () => boolean;
  withKeyPair: <T>(
    op: (keyPair: KeyPair) => T | Promise<T>,
  ) => Promise<T | null>;
  loginRelay: (
    signalingUrl: string,
    keyPair: KeyPair,
  ) => Promise<{ ok: true; sessionId: string } | { ok: false }>;
  onIncomingCall?: (peerId: string) => boolean;
  knockOn?: (peerId: string, asHost: boolean) => Promise<void>;
  refreshRelayBundleFrom?: (url: string) => void | Promise<unknown>;
  failoverRelay?: (failedUrl: string) => boolean;
  requestWakeLock: () => void;
  releaseWakeLock: () => void;
  resumeWakeLock: () => void;
  isDocumentVisible: () => boolean;
  note: (line: string) => void;
  onChange: (state: PresenceControllerState) => void;
  createHub?: PresenceHubFactory;
  copy?: PresenceControllerCopy;
};

const defaultCopy = (): PresenceControllerCopy => ({
  needS1: presenceCopy.needS1,
  needIdentity: presenceCopy.needIdentity,
  startFailed: presenceCopy.startFailed,
  available: presenceCopy.available,
  availableNote: presenceCopy.availableNote,
  unavailable: presenceCopy.unavailable,
  incomingKnock: presenceCopy.incomingKnock,
  busyIncoming: presenceCopy.busyIncoming,
  peerOffline: presenceCopy.peerOffline,
  mediaSoon: presenceCopy.mediaSoon,
});

const defaultCreateHub: PresenceHubFactory = (options) =>
  new PresenceHub(options);

const signalingKey = (signaling: SignalingConfig): string =>
  `${signaling.kind}:${'url' in signaling ? (signaling.url ?? '') : ''}`;

/**
 * Deep module for Presence: hub lifecycle, wake lock, relay challenge/failover,
 * knock, and visitor → incoming Call. UI/store are thin adapters.
 */
export function createPresenceController(deps: PresenceControllerDeps) {
  const copy = deps.copy ?? defaultCopy();
  const createHub = deps.createHub ?? defaultCreateHub;

  let available = false;
  let onlineIds: string[] = [];
  let notice = '';
  let hub: PresenceHubPort | null = null;
  let hubKey = '';
  let relaySessionId: string | null = null;

  const snapshot = (): PresenceControllerState => ({
    available,
    onlineIds,
    notice,
  });

  const publish = () => deps.onChange(snapshot());

  const setNotice = (text: string) => {
    notice = text;
  };

  const peerIsConnected = (): boolean => deps.linkConnected();

  const ensureHub = (): PresenceHubPort | null => {
    if (!deps.usesRoomLink()) return null;
    if (!isProfileId(deps.selfId())) return null;
    const signaling = deps.getSignaling();
    if (signaling.kind === 'manual' || !signaling.url) return null;
    const key = `${signalingKey(signaling)}:${deps.selfId()}`;
    if (hub && hubKey === key) {
      hub.setContacts(deps.contactIds());
      return hub;
    }
    hub?.stop();
    hub = null;
    hubKey = key;
    hub = createHub({
      meId: deps.selfId(),
      signaling,
      onChange: (snap) => {
        available = snap.available;
        onlineIds = [...snap.onlineIds];
        publish();
      },
      onVisitor: (peerId) => {
        if (deps.livePeerId() === peerId && peerIsConnected()) return;
        if (peerIsConnected() || !deps.onIncomingCall?.(peerId)) {
          setNotice(copy.busyIncoming(peerId));
          publish();
          return;
        }
        setNotice(copy.incomingKnock);
        publish();
      },
    });
    hub.setContacts(deps.contactIds());
    return hub;
  };

  const ensureRelaySession = async (): Promise<void> => {
    if (relaySessionId) return;
    const signaling = deps.getSignaling();
    if (signaling.kind === 'manual' || !signaling.url) return;
    const session = await deps.withKeyPair((keyPair) =>
      deps.loginRelay(signaling.url!, keyPair),
    );
    if (session?.ok) relaySessionId = session.sessionId;
  };

  const start = async (options?: { quiet?: boolean }): Promise<boolean> => {
    const quiet = options?.quiet === true;
    if (!isProfileId(deps.selfId())) {
      if (!quiet) {
        setNotice(copy.needIdentity);
        publish();
      }
      return false;
    }
    if (!deps.usesRoomLink()) {
      if (!quiet) {
        setNotice(copy.needS1);
        publish();
      }
      return false;
    }

    const maxAttempts = Math.max(1, deps.relayUrlCount() || 1);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await ensureRelaySession();
      const next = ensureHub();
      if (!next) {
        if (!quiet) {
          setNotice(copy.needS1);
          publish();
        }
        return false;
      }
      next.setContacts(deps.contactIds());
      const wasAvailable = available && next.available;
      const ok = await next.start();
      if (ok) {
        const signaling = deps.getSignaling();
        if (signaling.kind !== 'manual' && signaling.url) {
          void deps.refreshRelayBundleFrom?.(signaling.url);
        }
        available = true;
        if (!quiet) {
          setNotice(copy.available);
          deps.note(copy.availableNote);
        } else if (!wasAvailable) {
          setNotice(copy.available);
        }
        deps.requestWakeLock();
        publish();
        return true;
      }

      const signaling = deps.getSignaling();
      const failedUrl =
        signaling.kind !== 'manual' && signaling.url ? signaling.url : '';
      hub?.stop();
      hub = null;
      hubKey = '';
      relaySessionId = null;
      if (!failedUrl || !deps.failoverRelay?.(failedUrl)) {
        break;
      }
    }

    if (!quiet) {
      setNotice(copy.startFailed);
      publish();
    }
    return false;
  };

  const stop = () => {
    hub?.stop();
    hub = null;
    hubKey = '';
    relaySessionId = null;
    available = false;
    onlineIds = [];
    setNotice(copy.unavailable);
    deps.releaseWakeLock();
    publish();
  };

  const syncContacts = () => {
    hub?.setContacts(deps.contactIds());
  };

  const ensureActive = async () => {
    if (!deps.isDocumentVisible()) return;
    await start({ quiet: true });
  };

  const resume = async () => {
    deps.resumeWakeLock();
    await ensureActive();
  };

  const knock = async (peerId: string, intent?: CallIntent) => {
    const kind = intent?.kind ?? 'data';
    if (kind !== 'data') {
      setNotice(copy.mediaSoon(kind));
      publish();
    }
    if (!onlineIds.includes(peerId) && kind === 'data') {
      setNotice(copy.peerOffline);
      publish();
    }
    await start();
    await deps.knockOn?.(peerId, false);
  };

  const isOnline = (id: string): boolean => {
    if (deps.livePeerId() === id && peerIsConnected()) return true;
    return onlineIds.includes(id);
  };

  const isChannelOpen = (id: string): boolean =>
    Boolean(deps.livePeerId() === id && peerIsConnected());

  return {
    getState: snapshot,
    start,
    stop,
    syncContacts,
    ensureActive,
    resume,
    knock,
    isOnline,
    isChannelOpen,
  };
}

export type PresenceController = ReturnType<typeof createPresenceController>;
