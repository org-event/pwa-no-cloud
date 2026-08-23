import type { StorageLike } from '@/config/storage.ts';
import type { Application } from '@/lib/application.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import type { ProfileCard } from '@/domain/profile.ts';
import { PeerSession } from '@/lib/peer-session.ts';
import type { Ref } from 'vue';
import type { NocloudState } from './state.ts';

export type NocloudRefs = {
  startPeer?: () => PeerSession | null;
  applyPeerProfile?: (card: ProfileCard) => void;
  ensureLivePeerInBook?: () => void;
  applyShareDraft?: (draft: CustomServerDraft, notice: string) => void;
  probeAndMark?: (serverId: string) => Promise<void>;
  refreshInbox?: () => Promise<void>;
  refreshOutgoing?: () => Promise<void>;
  flushQueue?: () => void;
  applyIncoming?: (text: string) => Promise<void>;
  resumeMeetRoom?: () => void;
  consumeDeepLink?: () => void;
  queueFile?: (file: File) => void;
  knockOn?: (ownerId: string, asHost: boolean) => Promise<void>;
  startPresence?: (options?: { quiet?: boolean }) => Promise<boolean>;
  syncPresenceContacts?: () => void;
  ensurePresenceActive?: () => Promise<void>;
  resumePresence?: () => Promise<void>;
  copyText?: (text: string) => Promise<boolean>;
  seedDemoContacts?: () => void | Promise<void>;
  onRemoteTrack?: (stream: MediaStream) => void;
};

export type NocloudContext = {
  state: NocloudState;
  app: Application;
  storage: StorageLike;
  origin: string | undefined;
  skippedPeers: Set<string>;
  peerRevision: Ref<number>;
  touch: () => void;
  note: (line: string) => void;
  refs: NocloudRefs;
};

export function createNocloudContext(
  state: NocloudState,
  app: Application,
  storage: StorageLike,
  origin: string | undefined,
  skippedPeers: Set<string>,
  peerRevision: Ref<number>,
  touch: () => void,
  note: (line: string) => void,
): NocloudContext {
  return {
    state,
    app,
    storage,
    origin,
    skippedPeers,
    peerRevision,
    touch,
    note,
    refs: {},
  };
}
