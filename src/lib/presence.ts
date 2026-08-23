import { meetRoomId } from '@/domain/profile.ts';
import {
  createSignalingPort,
  type SignalingHandle,
} from '@/lib/signaling/factory.ts';
import type { SignalingConfig } from '@/config/types.ts';

/** Probe / scout clients — ignored by WebRTC waitPeer. */
export const WATCH_PREFIX = 'watch:';

export const isWatchClient = (id: string): boolean =>
  id.startsWith(WATCH_PREFIX);

export const watchClientId = (meId: string): string => `${WATCH_PREFIX}${meId}`;

export type PresenceSnapshot = {
  available: boolean;
  onlineIds: ReadonlySet<string>;
};

type PresenceHubOptions = {
  meId: string;
  signaling: SignalingConfig;
  onChange: (snapshot: PresenceSnapshot) => void;
  /** Real peer entered our lobby (not a watch probe). */
  onVisitor: (peerId: string) => void;
  /** How often to re-probe contacts + lobby, ms. */
  intervalMs?: number;
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Keeps a signaling seat in own lobby and periodically probes contact lobbies.
 * Separate from PeerSession so you can stay “online” while in a 1:1 call.
 */
export class PresenceHub {
  private readonly meId: string;
  private readonly signaling: SignalingConfig;
  private readonly onChange: (snapshot: PresenceSnapshot) => void;
  private readonly onVisitor: (peerId: string) => void;
  private readonly intervalMs: number;
  private lobby: SignalingHandle | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private contactIds: string[] = [];
  private onlineIds = new Set<string>();
  private seenVisitors = new Set<string>();
  private running = false;
  private probing = false;

  constructor(options: PresenceHubOptions) {
    this.meId = options.meId;
    this.signaling = options.signaling;
    this.onChange = options.onChange;
    this.onVisitor = options.onVisitor;
    this.intervalMs = options.intervalMs ?? 8_000;
  }

  get available(): boolean {
    return this.running && Boolean(this.lobby);
  }

  getOnlineIds(): ReadonlySet<string> {
    return this.onlineIds;
  }

  setContacts(ids: string[]) {
    this.contactIds = [...new Set(ids.filter((id) => id && id !== this.meId))];
  }

  async start(): Promise<boolean> {
    if (this.signaling.kind === 'manual' || !this.signaling.url) return false;
    if (this.running) return true;
    this.running = true;
    this.lobby = createSignalingPort(this.signaling);
    try {
      await this.lobby.connect({
        roomId: meetRoomId(this.meId),
        clientId: this.meId,
      });
    } catch {
      this.lobby.close();
      this.lobby = null;
      this.running = false;
      return false;
    }
    this.emit();
    this.schedule(0);
    return true;
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.lobby?.close();
    this.lobby = null;
    this.onlineIds = new Set();
    this.seenVisitors = new Set();
    this.emit();
  }

  private emit() {
    this.onChange({
      available: this.available,
      onlineIds: this.onlineIds,
    });
  }

  private schedule(delayMs: number) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.tick();
    }, delayMs);
  }

  private async tick() {
    if (!this.running) return;
    await this.pollLobby();
    await this.probeContacts();
    this.schedule(this.intervalMs);
  }

  private async pollLobby() {
    if (!this.lobby?.listPeers) return;
    try {
      const peers = await this.lobby.listPeers();
      const live = new Set(peers.filter((id) => !isWatchClient(id)));
      for (const id of live) {
        if (this.seenVisitors.has(id)) continue;
        this.seenVisitors.add(id);
        this.onVisitor(id);
      }
      for (const id of this.seenVisitors) {
        if (!live.has(id)) this.seenVisitors.delete(id);
      }
    } catch {
      /* retry next tick */
    }
  }

  private async probeContacts() {
    if (this.probing || this.contactIds.length === 0) return;
    this.probing = true;
    const next = new Set<string>();
    try {
      for (const ownerId of this.contactIds) {
        if (!this.running) break;
        const online = await this.probeOne(ownerId);
        if (online) next.add(ownerId);
      }
    } finally {
      this.probing = false;
    }
    let changed = next.size !== this.onlineIds.size;
    if (!changed) {
      for (const id of next) {
        if (!this.onlineIds.has(id)) {
          changed = true;
          break;
        }
      }
    }
    this.onlineIds = next;
    if (changed) this.emit();
  }

  private async probeOne(ownerId: string): Promise<boolean> {
    if (this.signaling.kind === 'manual' || !this.signaling.url) return false;
    const port = createSignalingPort(this.signaling);
    try {
      await port.connect({
        roomId: meetRoomId(ownerId),
        clientId: watchClientId(this.meId),
      });
      // Allow WS peers push / HTTP membership to settle.
      await sleep(350);
      const peers = (await port.listPeers?.()) ?? [];
      return peers.includes(ownerId);
    } catch {
      return false;
    } finally {
      port.close();
    }
  }
}
