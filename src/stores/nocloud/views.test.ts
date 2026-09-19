import { createUserSettings } from '@/config/index.ts';
import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import type { NocloudContext } from './context.ts';
import type { NocloudState } from './state.ts';
import {
  isManualSignaling,
  peerIsLive,
  socketBlocked,
  usesRoomLink,
} from './views.ts';

function fakeCtx(
  state: Partial<NocloudState>,
  origin = 'https://example.test',
): NocloudContext {
  return fromPartial<NocloudContext>({
    state: fromPartial<NocloudState>({
      settings: createUserSettings('manual-only'),
      peer: null,
      roomId: '',
      inviteRole: 'idle',
      outgoing: '',
      ...state,
    }),
    app: fromPartial({}),
    storage: fromPartial({}),
    origin,
    skippedPeers: new Set<string>(),
    peerRevision: { value: 0 },
    touch: () => {},
    note: () => {},
    ports: {
      call: {},
      chat: {},
      session: {},
      transfer: {},
      contacts: {},
      presence: {},
      servers: {},
    },
  });
}

describe('nocloud views', () => {
  describe('peerIsLive', () => {
    it('is false without a peer', () => {
      expect(peerIsLive(fakeCtx({ peer: null }))).toBe(false);
    });

    it('is false for idle, closed, and failed', () => {
      for (const state of ['idle', 'closed', 'failed'] as const) {
        expect(
          peerIsLive(
            fakeCtx({
              peer: fromPartial({ state }),
            }),
          ),
        ).toBe(false);
      }
    });

    it('is true for active session states', () => {
      for (const state of ['signaling', 'connecting', 'connected'] as const) {
        expect(
          peerIsLive(
            fakeCtx({
              peer: fromPartial({ state }),
            }),
          ),
        ).toBe(true);
      }
    });
  });

  describe('isManualSignaling', () => {
    it('is true for manual-only preset', () => {
      expect(
        isManualSignaling(
          fakeCtx({ settings: createUserSettings('manual-only') }),
        ),
      ).toBe(true);
    });

    it('is false for websocket custom preset', () => {
      expect(
        isManualSignaling(
          fakeCtx({
            settings: createUserSettings('custom', {
              signaling: {
                kind: 'websocket',
                url: 'wss://signal.example/ws',
              },
              iceServers: [{ urls: 'stun:stun.example:3478' }],
            }),
          }),
        ),
      ).toBe(false);
    });
  });

  describe('usesRoomLink', () => {
    it('is false for manual signaling', () => {
      expect(
        usesRoomLink(fakeCtx({ settings: createUserSettings('manual-only') })),
      ).toBe(false);
    });

    it('is true for secure websocket on an https page', () => {
      vi.stubGlobal('location', { protocol: 'https:' });
      expect(
        usesRoomLink(
          fakeCtx({
            settings: createUserSettings('custom', {
              signaling: {
                kind: 'websocket',
                url: 'wss://signal.example/ws',
              },
              iceServers: [{ urls: 'stun:stun.example:3478' }],
            }),
          }),
        ),
      ).toBe(true);
      vi.unstubAllGlobals();
    });
  });

  describe('socketBlocked', () => {
    it('blocks insecure websocket on an https page', () => {
      vi.stubGlobal('location', { protocol: 'https:' });
      expect(
        socketBlocked(
          fakeCtx({
            settings: createUserSettings('custom', {
              signaling: {
                kind: 'websocket',
                url: 'ws://203.0.113.10:8443/ws',
              },
              iceServers: [{ urls: 'stun:stun.example:3478' }],
            }),
          }),
        ),
      ).toBe(true);
      vi.unstubAllGlobals();
    });

    it('does not block secure websocket on an https page', () => {
      vi.stubGlobal('location', { protocol: 'https:' });
      expect(
        socketBlocked(
          fakeCtx({
            settings: createUserSettings('custom', {
              signaling: {
                kind: 'websocket',
                url: 'wss://signal.example/ws',
              },
              iceServers: [{ urls: 'stun:stun.example:3478' }],
            }),
          }),
        ),
      ).toBe(false);
      vi.unstubAllGlobals();
    });

    it('is false for manual signaling', () => {
      expect(
        socketBlocked(fakeCtx({ settings: createUserSettings('manual-only') })),
      ).toBe(false);
    });
  });
});
