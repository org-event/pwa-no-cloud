import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import {
  createPresenceController,
  type PresenceControllerState,
  type PresenceHubPort,
} from './presence-controller.ts';
import type { SignalingConfig } from '@/config/types.ts';

const roomSignaling = (): SignalingConfig =>
  fromPartial({ kind: 'websocket', url: 'wss://relay.example/ws' });

const fakeHub = (
  overrides: Partial<PresenceHubPort> & {
    startOk?: boolean;
    onVisitorHold?: (fn: (peerId: string) => void) => void;
  } = {},
): PresenceHubPort => {
  let available = false;
  const hub: PresenceHubPort = {
    get available() {
      return available;
    },
    setContacts: vi.fn(),
    start: vi.fn(async () => {
      const ok = overrides.startOk !== false;
      available = ok;
      return ok;
    }),
    stop: vi.fn(() => {
      available = false;
    }),
    ...overrides,
  };
  return hub;
};

describe('PresenceController', () => {
  it('refuses start without identity', async () => {
    const states: PresenceControllerState[] = [];
    const ctrl = createPresenceController({
      selfId: () => 'not-a-fingerprint',
      contactIds: () => [],
      usesRoomLink: () => true,
      getSignaling: roomSignaling,
      relayUrlCount: () => 1,
      livePeerId: () => null,
      linkConnected: () => false,
      withKeyPair: async () => null,
      loginRelay: async () => ({ ok: false }),
      requestWakeLock: vi.fn(),
      releaseWakeLock: vi.fn(),
      resumeWakeLock: vi.fn(),
      isDocumentVisible: () => true,
      note: vi.fn(),
      onChange: (s) => states.push(s),
      createHub: () => fakeHub(),
      copy: {
        needS1: 'need-s1',
        needIdentity: 'need-identity',
        startFailed: 'start-failed',
        available: 'available',
        availableNote: 'note-available',
        unavailable: 'unavailable',
        incomingKnock: 'incoming',
        busyIncoming: (id) => `busy:${id}`,
        peerOffline: 'offline',
        mediaSoon: (k) => `soon:${k}`,
      },
    });

    expect(await ctrl.start()).toBe(false);
    expect(ctrl.getState().notice).toBe('need-identity');
  });

  it('starts hub, notes availability, and takes wake lock', async () => {
    const requestWakeLock = vi.fn();
    const note = vi.fn();
    const loginRelay = vi.fn(async () => ({
      ok: true as const,
      sessionId: 'sess',
    }));
    const keyPair = fromPartial({ publicKey: new Uint8Array(32) });
    let fireVisitor: (peerId: string) => void = () => {};

    const ctrl = createPresenceController({
      selfId: () => 'a'.repeat(16),
      contactIds: () => ['b'.repeat(16)],
      usesRoomLink: () => true,
      getSignaling: roomSignaling,
      relayUrlCount: () => 1,
      livePeerId: () => null,
      linkConnected: () => false,
      withKeyPair: async (op) => op(keyPair as never),
      loginRelay,
      requestWakeLock,
      releaseWakeLock: vi.fn(),
      resumeWakeLock: vi.fn(),
      isDocumentVisible: () => true,
      note,
      onChange: () => {},
      onIncomingCall: () => true,
      createHub: (opts) => {
        fireVisitor = opts.onVisitor;
        return fakeHub();
      },
      copy: {
        needS1: 'need-s1',
        needIdentity: 'need-identity',
        startFailed: 'start-failed',
        available: 'available',
        availableNote: 'note-available',
        unavailable: 'unavailable',
        incomingKnock: 'incoming',
        busyIncoming: (id) => `busy:${id}`,
        peerOffline: 'offline',
        mediaSoon: (k) => `soon:${k}`,
      },
    });

    expect(await ctrl.start()).toBe(true);
    expect(loginRelay).toHaveBeenCalled();
    expect(requestWakeLock).toHaveBeenCalled();
    expect(note).toHaveBeenCalledWith('note-available');
    expect(ctrl.getState().available).toBe(true);

    fireVisitor('c'.repeat(16));
    expect(ctrl.getState().notice).toBe('incoming');
  });

  it('marks visitor busy when already in a channel', async () => {
    let fireVisitor: (peerId: string) => void = () => {};
    const onIncomingCall = vi.fn(() => false);
    const ctrl = createPresenceController({
      selfId: () => 'a'.repeat(16),
      contactIds: () => [],
      usesRoomLink: () => true,
      getSignaling: roomSignaling,
      relayUrlCount: () => 1,
      livePeerId: () => null,
      linkConnected: () => true,
      withKeyPair: async () => null,
      loginRelay: async () => ({ ok: false }),
      requestWakeLock: vi.fn(),
      releaseWakeLock: vi.fn(),
      resumeWakeLock: vi.fn(),
      isDocumentVisible: () => true,
      note: vi.fn(),
      onChange: () => {},
      onIncomingCall,
      createHub: (opts) => {
        fireVisitor = opts.onVisitor;
        return fakeHub();
      },
      copy: {
        needS1: 'need-s1',
        needIdentity: 'need-identity',
        startFailed: 'start-failed',
        available: 'available',
        availableNote: 'note-available',
        unavailable: 'unavailable',
        incomingKnock: 'incoming',
        busyIncoming: (id) => `busy:${id.slice(0, 4)}`,
        peerOffline: 'offline',
        mediaSoon: (k) => `soon:${k}`,
      },
    });

    await ctrl.start();
    const peer = 'c'.repeat(16);
    fireVisitor(peer);
    expect(ctrl.getState().notice.startsWith('busy:')).toBe(true);
    // Short-circuit on linkConnected — CallPort not consulted.
    expect(onIncomingCall).not.toHaveBeenCalled();
  });

  it('knock starts presence then calls low-level knockOn', async () => {
    const knockOn = vi.fn(async () => {});
    const peer = 'b'.repeat(16);
    const notices: string[] = [];
    const ctrl = createPresenceController({
      selfId: () => 'a'.repeat(16),
      contactIds: () => [peer],
      usesRoomLink: () => true,
      getSignaling: roomSignaling,
      relayUrlCount: () => 1,
      livePeerId: () => null,
      linkConnected: () => false,
      withKeyPair: async () => null,
      loginRelay: async () => ({ ok: false }),
      knockOn,
      requestWakeLock: vi.fn(),
      releaseWakeLock: vi.fn(),
      resumeWakeLock: vi.fn(),
      isDocumentVisible: () => true,
      note: vi.fn(),
      onChange: (s) => notices.push(s.notice),
      createHub: () => fakeHub(),
      copy: {
        needS1: 'need-s1',
        needIdentity: 'need-identity',
        startFailed: 'start-failed',
        available: 'available',
        availableNote: 'note-available',
        unavailable: 'unavailable',
        incomingKnock: 'incoming',
        busyIncoming: (id) => `busy:${id}`,
        peerOffline: 'offline',
        mediaSoon: (k) => `soon:${k}`,
      },
    });

    await ctrl.knock(peer);
    expect(notices).toContain('offline');
    expect(knockOn).toHaveBeenCalledWith(peer, false);
  });

  it('failovers to next relay when hub start fails', async () => {
    const failoverRelay = vi.fn(() => true);
    let starts = 0;
    const ctrl = createPresenceController({
      selfId: () => 'a'.repeat(16),
      contactIds: () => [],
      usesRoomLink: () => true,
      getSignaling: roomSignaling,
      relayUrlCount: () => 2,
      livePeerId: () => null,
      linkConnected: () => false,
      withKeyPair: async () => null,
      loginRelay: async () => ({ ok: false }),
      failoverRelay,
      requestWakeLock: vi.fn(),
      releaseWakeLock: vi.fn(),
      resumeWakeLock: vi.fn(),
      isDocumentVisible: () => true,
      note: vi.fn(),
      onChange: () => {},
      createHub: () =>
        fakeHub({
          start: vi.fn(async () => {
            starts += 1;
            return starts >= 2;
          }),
        }),
      copy: {
        needS1: 'need-s1',
        needIdentity: 'need-identity',
        startFailed: 'start-failed',
        available: 'available',
        availableNote: 'note-available',
        unavailable: 'unavailable',
        incomingKnock: 'incoming',
        busyIncoming: (id) => `busy:${id}`,
        peerOffline: 'offline',
        mediaSoon: (k) => `soon:${k}`,
      },
    });

    expect(await ctrl.start()).toBe(true);
    expect(failoverRelay).toHaveBeenCalled();
    expect(starts).toBe(2);
  });
});
