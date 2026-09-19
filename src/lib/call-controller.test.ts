import { fromAny } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import {
  createCallController,
  type CallControllerState,
  type MediaCallKind,
} from './call-controller.ts';
import { primaryCallLeg } from '@/domain/call/index.ts';

const fakeStream = (
  kinds: Array<'audio' | 'video'> = ['audio'],
): MediaStream => {
  const tracks = kinds.map((kind) => ({
    kind,
    enabled: true,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  return fromAny({
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  });
};

const copy = {
  inCall: 'busy',
  calling: 'calling',
  active: 'active',
  needPermission: 'need-permission',
};

describe('CallController', () => {
  it('dials, attaches local media to peer, then marks remote ringing', async () => {
    const states: CallControllerState[] = [];
    const peer = {
      setLocalStream: vi.fn(),
      clearLocalStream: vi.fn(),
    };
    const stream = fakeStream(['audio']);
    const recordCall = vi.fn();
    const knockOn = vi.fn(async () => {});
    const openMedia = vi.fn(async (_kind: MediaCallKind) => stream);

    const ctrl = createCallController({
      openMedia,
      getPeer: () => peer,
      knockOn,
      selfId: () => 'me',
      recordCall,
      onChange: (s) => states.push(s),
      copy,
    });

    await ctrl.dial('peer-1', 'audio');

    expect(openMedia).toHaveBeenCalledWith('audio');
    expect(peer.setLocalStream).toHaveBeenCalledWith(stream);
    expect(knockOn).toHaveBeenCalledWith('peer-1', false);
    expect(recordCall).toHaveBeenCalledWith('peer-1', 'out', 'started');
    const last = states.at(-1)!;
    expect(last.callPeerId).toBe('peer-1');
    expect(last.callKind).toBe('audio');
    expect(last.localMedia).toBe(stream);
    expect(last.notice).toContain('calling');
    expect(primaryCallLeg(last.session)?.state).toBe('ringing');
  });

  it('rejects dial when already busy', async () => {
    const peer = {
      setLocalStream: vi.fn(),
      clearLocalStream: vi.fn(),
    };
    const openMedia = vi.fn(async () => fakeStream());
    const ctrl = createCallController({
      openMedia,
      getPeer: () => peer,
      selfId: () => 'me',
      recordCall: vi.fn(),
      onChange: () => {},
      copy,
    });

    await ctrl.dial('a', 'audio');
    await ctrl.dial('b', 'audio');

    expect(openMedia).toHaveBeenCalledTimes(1);
    expect(ctrl.getState().callError).toBe('busy');
    expect(ctrl.getState().notice).toBe('busy');
  });

  it('accepts incoming call and knocks as host', async () => {
    const peer = {
      setLocalStream: vi.fn(),
      clearLocalStream: vi.fn(),
    };
    const stream = fakeStream(['audio', 'video']);
    const knockOn = vi.fn(async () => {});
    const recordCall = vi.fn();
    const ctrl = createCallController({
      openMedia: async () => stream,
      getPeer: () => peer,
      knockOn,
      selfId: () => 'me',
      recordCall,
      onChange: () => {},
      copy,
    });

    expect(ctrl.incoming('caller')).toBe(true);
    expect(recordCall).toHaveBeenCalledWith('caller', 'in', 'started');
    await ctrl.accept('video');

    expect(peer.setLocalStream).toHaveBeenCalledWith(stream);
    expect(knockOn).toHaveBeenCalledWith('me', true);
    expect(recordCall).toHaveBeenCalledWith('caller', 'in', 'answered');
    const leg = primaryCallLeg(ctrl.getState().session);
    expect(leg?.state).toBe('active');
    expect(ctrl.getState().callKind).toBe('video');
  });

  it('rejects incoming and clears media', () => {
    const peer = {
      setLocalStream: vi.fn(),
      clearLocalStream: vi.fn(),
    };
    const recordCall = vi.fn();
    const ctrl = createCallController({
      openMedia: async () => fakeStream(),
      getPeer: () => peer,
      selfId: () => 'me',
      recordCall,
      onChange: () => {},
      copy,
    });

    ctrl.incoming('caller');
    ctrl.reject();

    expect(recordCall).toHaveBeenCalledWith('caller', 'in', 'rejected');
    expect(peer.clearLocalStream).toHaveBeenCalled();
    expect(ctrl.getState().localMedia).toBeNull();
    expect(primaryCallLeg(ctrl.getState().session)?.state).toBe('rejected');
  });

  it('records permission failure on dial without opening a leg when media fails before dial', async () => {
    const recordCall = vi.fn();
    const ctrl = createCallController({
      openMedia: async () => {
        throw new Error('denied');
      },
      getPeer: () => null,
      selfId: () => 'me',
      recordCall,
      onChange: () => {},
      copy,
    });

    await ctrl.dial('peer-1', 'audio');

    expect(recordCall).toHaveBeenCalledWith('peer-1', 'out', 'failed');
    expect(ctrl.getState().callError).toBe('need-permission');
  });

  it('marks leg active on remote track and hangs up cleanly', async () => {
    const peer = {
      setLocalStream: vi.fn(),
      clearLocalStream: vi.fn(),
    };
    const local = fakeStream(['audio']);
    const remote = fakeStream(['audio']);
    const recordCall = vi.fn();
    const ctrl = createCallController({
      openMedia: async () => local,
      getPeer: () => peer,
      knockOn: async () => {},
      selfId: () => 'me',
      recordCall,
      onChange: () => {},
      copy,
    });

    await ctrl.dial('peer-1', 'audio');
    ctrl.remoteTrack(remote);

    expect(primaryCallLeg(ctrl.getState().session)?.state).toBe('active');
    expect(ctrl.getState().remoteMedia).toBe(remote);

    ctrl.hangUp();
    expect(recordCall).toHaveBeenCalledWith('peer-1', 'out', 'ended');
    expect(peer.clearLocalStream).toHaveBeenCalled();
    expect(ctrl.getState().localMedia).toBeNull();
  });

  it('toggles mute on local audio tracks', async () => {
    const stream = fakeStream(['audio']);
    const ctrl = createCallController({
      openMedia: async () => stream,
      getPeer: () => ({
        setLocalStream: () => {},
        clearLocalStream: () => {},
      }),
      knockOn: async () => {},
      selfId: () => 'me',
      recordCall: () => {},
      onChange: () => {},
      copy,
    });

    await ctrl.dial('peer-1', 'audio');
    expect(ctrl.getState().micOn).toBe(true);
    ctrl.toggleMute();
    expect(ctrl.getState().micOn).toBe(false);
    expect(stream.getTracks()[0]?.enabled).toBe(false);
  });
});
