import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  constraintsForKind,
  isDisplayTrack,
  onScreenShareEnded,
  openCallMedia,
  stopStream,
} from './call-media.ts';

describe('call-media', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps call kinds to getUserMedia constraints', () => {
    expect(constraintsForKind('data')).toBeNull();
    expect(constraintsForKind('audio')).toEqual({
      audio: true,
      video: false,
    });
    expect(constraintsForKind('video')).toEqual({
      audio: true,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    expect(constraintsForKind('screen')).toBeNull();
  });

  it('stops all tracks on a stream', () => {
    const stops: string[] = [];
    const stream = {
      getTracks: () => [
        {
          id: 'a',
          stop: () => {
            stops.push('a');
          },
        },
        {
          id: 'v',
          stop: () => {
            stops.push('v');
          },
        },
      ],
    } as unknown as MediaStream;
    stopStream(stream);
    stopStream(null);
    expect(stops).toEqual(['a', 'v']);
  });

  it('routes screen kind through getDisplayMedia and stops display tracks', async () => {
    const displayTrack = {
      kind: 'video',
      id: 'display',
      stop: vi.fn(),
      getSettings: () => ({ displaySurface: 'monitor' }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const displayStream = {
      getTracks: () => [displayTrack],
      getVideoTracks: () => [displayTrack],
      getAudioTracks: () => [],
      addTrack: vi.fn(),
    };
    const getDisplayMedia = vi.fn(async () => displayStream);
    const getUserMedia = vi.fn(async () => {
      throw new Error('mic denied');
    });
    vi.stubGlobal('navigator', {
      mediaDevices: { getDisplayMedia, getUserMedia },
    });

    const stream = await openCallMedia('screen');
    expect(getDisplayMedia).toHaveBeenCalled();
    expect(isDisplayTrack(displayTrack as unknown as MediaStreamTrack)).toBe(
      true,
    );
    stopStream(stream as unknown as MediaStream);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it('fires when the browser ends the screen-share track', () => {
    const listeners = new Map<string, Array<() => void>>();
    const track = {
      kind: 'video',
      id: 'display',
      addEventListener: (name: string, fn: () => void) => {
        const list = listeners.get(name) ?? [];
        list.push(fn);
        listeners.set(name, list);
      },
      removeEventListener: (name: string, fn: () => void) => {
        const list = listeners.get(name) ?? [];
        listeners.set(
          name,
          list.filter((item) => item !== fn),
        );
      },
    };
    const stream = {
      getVideoTracks: () => [track],
    } as unknown as MediaStream;
    const ended = vi.fn();
    const unbind = onScreenShareEnded(stream, ended);
    for (const fn of listeners.get('ended') ?? []) fn();
    expect(ended).toHaveBeenCalledTimes(1);
    unbind();
    expect(listeners.get('ended')).toEqual([]);
  });
});
