import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import { encodeSharePack, iceOnlyShare } from '@/config/share-pack.ts';
import type { Link } from '@/lib/link.ts';
import {
  createInviteSession,
  type InviteSessionDeps,
  type InviteSessionState,
} from './invite-session.ts';

const packText = () =>
  encodeSharePack(
    iceOnlyShare([
      { urls: 'stun:203.0.113.10:80' },
      {
        urls: 'turn:203.0.113.10:80',
        username: 'nocloud',
        credential: 'secret12',
      },
    ]),
  );

const fakeLink = (overrides: Partial<Link> = {}): Link =>
  fromPartial({
    state: 'idle',
    role: 'idle',
    roomId: '',
    keepRoom: false,
    createInvite: vi.fn(async () => {}),
    enterRoom: vi.fn(async () => {}),
    resumeRoom: vi.fn(),
    acceptInvite: vi.fn(async () => ({ ok: true as const })),
    acceptAnswer: vi.fn(async () => ({ ok: true as const })),
    outgoing: () => '',
    ping: vi.fn(),
    ...overrides,
  });

const baseDeps = (
  overrides: Partial<InviteSessionDeps> = {},
): InviteSessionDeps => {
  let peer: Link | null = null;
  let shared: InviteSessionState = {
    inviteRole: 'idle',
    inviteError: '',
    roomId: '',
    openedFromLink: false,
    hostNotice: '',
  };
  return {
    startPeer: () => {
      peer = fakeLink();
      return peer;
    },
    getPeer: () => peer,
    usesRoomLink: () => false,
    socketBlocked: () => false,
    peerIsLive: () => false,
    getOutgoing: () => '',
    generateRoomId: () => 'room-1',
    pullShared: () => ({ ...shared }),
    applyShareDraft: vi.fn(),
    refreshOutgoing: vi.fn(async () => {}),
    note: vi.fn(),
    onChange: (next) => {
      shared = next;
    },
    copy: {
      serversFromPackSaved: 'pack-saved',
      serversFromInviteSaved: 'invite-saved',
      serversFromLinkSaved: 'link-saved',
      roomLinkNeedsSocket: 'need-socket',
      notNoCloudLink: 'not-nocloud',
      mixedContentSignaling: 'mixed',
    },
    ...overrides,
  };
};

describe('InviteSession', () => {
  it('createInvite sets caller and calls link.createInvite', async () => {
    const createInvite = vi.fn(async () => {});
    const refreshOutgoing = vi.fn(async () => {});
    const link = fakeLink({ createInvite });
    const session = createInviteSession(
      baseDeps({
        startPeer: () => link,
        getPeer: () => link,
        refreshOutgoing,
      }),
    );

    await session.createInvite();
    expect(session.getState().inviteRole).toBe('caller');
    expect(createInvite).toHaveBeenCalledOnce();
    expect(refreshOutgoing).toHaveBeenCalledOnce();
  });

  it('applyIncoming share pack calls applyShareDraft', async () => {
    const applyShareDraft = vi.fn();
    const session = createInviteSession(baseDeps({ applyShareDraft }));

    await session.applyIncoming(packText());
    expect(applyShareDraft).toHaveBeenCalledOnce();
    expect(applyShareDraft.mock.calls[0]?.[1]).toBe('pack-saved');
  });

  it('applyDeepLink room enters room when usesRoomLink', async () => {
    const enterRoom = vi.fn(async () => {});
    const link = fakeLink({ enterRoom });
    const session = createInviteSession(
      baseDeps({
        usesRoomLink: () => true,
        startPeer: () => link,
        getPeer: () => link,
      }),
    );

    await session.applyDeepLink({
      kind: 'room',
      section: 'lan',
      payload: 'office',
    });
    expect(session.getState().openedFromLink).toBe(true);
    expect(session.getState().roomId).toBe('office');
    expect(session.getState().inviteRole).toBe('caller');
    expect(enterRoom).toHaveBeenCalledWith('office');
  });

  it('pasteLink rejects section-only paste with notNoCloudLink', () => {
    const session = createInviteSession(baseDeps());
    session.pasteLink('просто текст');
    expect(session.getState().inviteError).toBe('not-nocloud');
  });
});
