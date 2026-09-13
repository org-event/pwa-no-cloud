import { describe, expect, it, vi } from 'vitest';
import {
  attachLocalMediaTracks,
  detachLocalMediaTracks,
} from './peer-media.ts';

const fakeTrack = (kind: 'audio' | 'video', id: string): MediaStreamTrack =>
  ({ kind, id, stop: vi.fn() }) as unknown as MediaStreamTrack;

const fakeStream = (tracks: MediaStreamTrack[]): MediaStream =>
  ({
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
    getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
  }) as unknown as MediaStream;

describe('peer-media attach/detach', () => {
  it('adds only missing tracks to an existing PC', () => {
    const audio = fakeTrack('audio', 'a1');
    const stream = fakeStream([audio]);
    const senders: Array<{ track: MediaStreamTrack | null }> = [];
    const pc = {
      getSenders: () => senders as RTCRtpSender[],
      addTrack: vi.fn((track: MediaStreamTrack) => {
        const sender = { track };
        senders.push(sender);
        return sender as RTCRtpSender;
      }),
      removeTrack: vi.fn(),
    };

    expect(attachLocalMediaTracks(pc, stream)).toBe(1);
    expect(attachLocalMediaTracks(pc, stream)).toBe(0);
    expect(pc.addTrack).toHaveBeenCalledTimes(1);
  });

  it('detaches audio/video senders without needing data-channel APIs', () => {
    const audio = fakeTrack('audio', 'a1');
    const stream = fakeStream([audio]);
    const mediaSender = { track: audio };
    const senders = [mediaSender];
    const pc = {
      getSenders: () => senders as RTCRtpSender[],
      addTrack: vi.fn(),
      removeTrack: vi.fn((sender: RTCRtpSender) => {
        const index = senders.findIndex((item) => item === sender);
        if (index >= 0) senders.splice(index, 1);
      }),
    };

    expect(detachLocalMediaTracks(pc, stream)).toBe(1);
    expect(pc.removeTrack).toHaveBeenCalledWith(mediaSender);
    expect(senders).toEqual([]);
  });

  it('detaches all A/V senders when stream is null (hangup) and ignores empty senders', () => {
    const display = fakeTrack('video', 'screen');
    const mediaSender = { track: display };
    const emptySender = { track: null };
    const senders = [mediaSender, emptySender];
    const pc = {
      getSenders: () => senders as RTCRtpSender[],
      addTrack: vi.fn(),
      removeTrack: vi.fn((sender: RTCRtpSender) => {
        const index = senders.findIndex((item) => item === sender);
        if (index >= 0) senders.splice(index, 1);
      }),
    };

    expect(detachLocalMediaTracks(pc, null)).toBe(1);
    expect(pc.removeTrack).toHaveBeenCalledWith(mediaSender);
    expect(senders).toEqual([emptySender]);
  });
});
