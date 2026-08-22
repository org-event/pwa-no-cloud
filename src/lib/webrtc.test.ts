import { describe, expect, it } from 'vitest';
import { sdpHasRelay, waitIceGathering } from './webrtc.ts';

const relaySdp = 'v=0\r\na=candidate:2 1 udp 1 198.51.100.2 3478 typ relay\r\n';

describe('sdpHasRelay', () => {
  it('sees a relay line in SDP', () => {
    expect(sdpHasRelay(relaySdp)).toBe(true);
    expect(
      sdpHasRelay('v=0\r\na=candidate:0 1 udp 1 10.0.0.1 9 typ host'),
    ).toBe(false);
  });
});

describe('waitIceGathering', () => {
  it('resolves immediately when a relay is already in local SDP', async () => {
    const listeners = new Map<string, Set<() => void>>();
    const pc = {
      iceGatheringState: 'gathering',
      localDescription: { sdp: relaySdp },
      addEventListener(name: string, fn: () => void) {
        const set = listeners.get(name) ?? new Set();
        set.add(fn);
        listeners.set(name, set);
      },
      removeEventListener(name: string, fn: () => void) {
        listeners.get(name)?.delete(fn);
      },
    };
    await waitIceGathering(pc as unknown as RTCPeerConnection, {
      wantRelay: true,
      timeoutMs: 50,
    });
  });
});
