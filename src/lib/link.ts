import type { Session, SessionState } from '@/domain/session.ts';
import type { ProfileCard } from '@/domain/profile.ts';
import type { IceReport } from './ice.ts';
import type { OpfsStore } from './opfs.ts';
import {
  PeerSession,
  type PeerRole,
  type PeerSessionConfig,
} from './peer-session.ts';
import type { TransferPort } from './transfer-port.ts';
import type { PeerLinks } from './webrtc.ts';

export type { PeerRole, PeerSessionConfig as LinkConfig };
export type { TransferPort } from './transfer-port.ts';

/**
 * Deep module for a P2P PeerConnection: signaling, ICE, control, media.
 * Transfer rides {@link TransferPort} once channels are open.
 */
export type Link = {
  session: Session;
  readonly state: SessionState;
  role: PeerRole;
  peerId: string;
  clientId: string;
  error: string;
  ice: IceReport;
  lastPongMs: number | null;
  roomId: string;
  keepRoom: boolean;
  links: PeerLinks | null;
  readonly transfer: TransferPort | null;
  on(name: string, fn: (...args: unknown[]) => void): void;
  createInvite(): Promise<void>;
  enterRoom(roomId: string): Promise<void>;
  resumeRoom(): void;
  acceptInvite(
    text: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  acceptAnswer(
    text: string,
  ): Promise<{ ok: true } | { ok: false; message: string }>;
  outgoing(): string;
  setProfile(profile: ProfileCard | null): void;
  setLocalStream(stream: MediaStream | null): void;
  clearLocalStream(): void;
  setStore(store: OpfsStore | null): void;
  sendChatWire(wire: string): boolean;
  ping(): void;
  close(): void;
  reset(): void;
};

/** Expand–contract: PeerSession is the Link implementation. */
export const createLink = (config: PeerSessionConfig): Link =>
  new PeerSession(config);
