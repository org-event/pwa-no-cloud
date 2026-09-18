import { describe, expect, it, vi } from 'vitest';
import { createLink } from './link.ts';
import type { SignalingHandle } from '@/packages/signaling/index.ts';

const fakeManualSignaling = (): SignalingHandle => {
  return {
    async connect() {},
    async send() {},
    subscribe(_next) {
      return () => {};
    },
    close() {},
    outgoing: () => 'invite-payload',
    accept: async () => ({
      ok: false as const,
      code: 'unused',
      message: 'unused',
    }),
    setShareServers: () => {},
  };
};

describe('Link', () => {
  it('createInvite goes through Link with a Signaling adapter', async () => {
    const signaling = fakeManualSignaling();
    const connect = vi.spyOn(signaling, 'connect');
    const link = createLink({
      iceServers: [{ urls: 'stun:stun.example:3478' }],
      signaling,
    });
    await link.createInvite();
    expect(connect).toHaveBeenCalledWith({
      roomId: 'manual',
      clientId: link.clientId,
    });
    expect(link.transfer).toBeNull();
    link.close();
  });
});
