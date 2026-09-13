import { describe, expect, it } from 'vitest';
import { constraintsForKind, stopStream } from './call-media.ts';

describe('call-media', () => {
  it('maps call kinds to getUserMedia constraints', () => {
    expect(constraintsForKind('data')).toBeNull();
    expect(constraintsForKind('audio')).toEqual({
      audio: true,
      video: false,
    });
    expect(constraintsForKind('video')).toEqual({
      audio: true,
      video: { facingMode: 'user' },
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
});
