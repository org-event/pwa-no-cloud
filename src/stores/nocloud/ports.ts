import type { CustomServerDraft } from '@/config/types.ts';
import type { KeyPair } from '@/domain/identity/index.ts';
import type { ProfileCard } from '@/domain/profile.ts';
import type { Link } from '@/lib/link.ts';

/** CallController hooks consumed by Link / presence. */
export type CallPort = {
  onRemoteTrack: (stream: MediaStream) => void;
  onIncomingCall: (peerId: string) => boolean;
  onCallPeerError: (message: string) => void;
};

/** Signed chat wire from the control channel. */
export type ChatPort = {
  onIncomingChatWire: (wire: string) => void | Promise<void>;
};

/** Link lifecycle + invite/deep-link session actions. */
export type SessionPort = {
  startPeer: () => Link | null;
  refreshOutgoing: () => Promise<void>;
  applyIncoming: (text: string) => Promise<void>;
  resumeMeetRoom: () => void;
  consumeDeepLink: () => void;
  copyText: (text: string) => Promise<boolean>;
};

/**
 * Store-side TransferSession hooks (queue / inbox refresh).
 * Distinct from {@link TransferPort} on an open Link.
 */
export type TransferStorePort = {
  flushQueue: () => void;
  queueFile: (file: File) => void;
  refreshInbox: () => Promise<void>;
};

/** Address book + knock + identity key access for signed frames. */
export type ContactsPort = {
  applyPeerProfile: (card: ProfileCard) => void;
  ensureLivePeerInBook: () => void;
  knockOn: (ownerId: string, asHost: boolean) => Promise<void>;
  seedDemoContacts: () => void | Promise<void>;
  getIdentityKeyPair: () => KeyPair | null;
};

export type PresencePort = {
  startPresence: (options?: { quiet?: boolean }) => Promise<boolean>;
  syncPresenceContacts: () => void;
  ensurePresenceActive: () => Promise<void>;
  resumePresence: () => Promise<void>;
};

export type ServersPort = {
  applyShareDraft: (draft: CustomServerDraft, notice: string) => void;
  probeAndMark: (serverId: string) => Promise<void>;
  refreshRelayBundleFrom: (signalingUrl: string) => Promise<boolean>;
  failoverRelay: (failedUrl: string) => boolean;
};

/** Fully wired cross-slice ports after store composition. */
export type NocloudPorts = {
  call: CallPort;
  chat: ChatPort;
  session: SessionPort;
  transfer: TransferStorePort;
  contacts: ContactsPort;
  presence: PresencePort;
  servers: ServersPort;
};

/**
 * Mutable bag filled during composition (expand–contract).
 * Call sites use optional chaining until bind completes.
 */
export type NocloudPortsBag = {
  call: Partial<CallPort>;
  chat: Partial<ChatPort>;
  session: Partial<SessionPort>;
  transfer: Partial<TransferStorePort>;
  contacts: Partial<ContactsPort>;
  presence: Partial<PresencePort>;
  servers: Partial<ServersPort>;
};

export function createNocloudPortsBag(): NocloudPortsBag {
  return {
    call: {},
    chat: {},
    session: {},
    transfer: {},
    contacts: {},
    presence: {},
    servers: {},
  };
}

/** Assign port facades once at store composition. Merges into the bag. */
export function bindNocloudPorts(
  bag: NocloudPortsBag,
  ports: {
    call: CallPort;
    chat: ChatPort;
    session: SessionPort;
    transfer: TransferStorePort;
    contacts: Omit<ContactsPort, 'getIdentityKeyPair'> &
      Partial<Pick<ContactsPort, 'getIdentityKeyPair'>>;
    presence: PresencePort;
    servers: ServersPort;
  },
): void {
  Object.assign(bag.call, ports.call);
  Object.assign(bag.chat, ports.chat);
  Object.assign(bag.session, ports.session);
  Object.assign(bag.transfer, ports.transfer);
  Object.assign(bag.contacts, ports.contacts);
  Object.assign(bag.presence, ports.presence);
  Object.assign(bag.servers, ports.servers);
}
