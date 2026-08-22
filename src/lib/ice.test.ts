import { describe, expect, it } from 'vitest';
import {
  classifyCandidate,
  formatIceReport,
  pairFromStats,
  pathsFromSdp,
  type IceReport,
  type IceStat,
} from './ice.ts';

const host =
  'candidate:0 1 udp 2122260223 192.168.1.5 54321 typ host generation 0';
const srflx =
  'candidate:1 1 udp 1686052607 203.0.113.9 3478 typ srflx raddr 192.168.1.5 rport 54321';
const relay =
  'candidate:2 1 udp 41885439 198.51.100.2 3478 typ relay raddr 0.0.0.0 rport 0';

describe('classifyCandidate', () => {
  it('reads host, srflx and relay from a candidate line', () => {
    expect(classifyCandidate(host)).toBe('host');
    expect(classifyCandidate(srflx)).toBe('srflx');
    expect(classifyCandidate(relay)).toBe('relay');
    expect(classifyCandidate('candidate:9 1 udp 1 10.0.0.1 9')).toBe('unknown');
  });
});

describe('pathsFromSdp', () => {
  it('collects unique types from a=candidate lines', () => {
    const sdp = [
      'v=0',
      `a=${host}`,
      `a=${host}`,
      `a=${srflx}`,
      'a=end-of-candidates',
    ].join('\r\n');
    expect(pathsFromSdp(sdp)).toEqual(['host', 'srflx']);
  });
});

describe('pairFromStats', () => {
  it('picks the nominated succeeded pair', () => {
    const stats: IceStat[] = [
      {
        type: 'candidate-pair',
        id: 'p1',
        state: 'failed',
        localCandidateId: 'l1',
        remoteCandidateId: 'r1',
      },
      {
        type: 'candidate-pair',
        id: 'p2',
        state: 'succeeded',
        nominated: true,
        localCandidateId: 'l2',
        remoteCandidateId: 'r2',
      },
      { type: 'local-candidate', id: 'l2', candidateType: 'host' },
      { type: 'remote-candidate', id: 'r2', candidateType: 'srflx' },
    ];
    expect(pairFromStats(stats)).toEqual({ local: 'host', remote: 'srflx' });
  });

  it('returns null without a selected pair', () => {
    expect(pairFromStats([{ type: 'local-candidate', id: 'l1' }])).toBe(null);
  });
});

describe('formatIceReport', () => {
  it('shows the selected path when known', () => {
    const report: IceReport = {
      connectionState: 'connected',
      gatheringState: 'complete',
      local: ['host', 'srflx'],
      remote: ['host'],
      selected: { local: 'host', remote: 'host' },
    };
    expect(formatIceReport(report)).toBe('ICE host → host · connected');
  });

  it('falls back to gathered types', () => {
    const report: IceReport = {
      connectionState: 'checking',
      gatheringState: 'gathering',
      local: ['host'],
      remote: [],
      selected: null,
    };
    expect(formatIceReport(report)).toBe(
      'ICE local host · remote — · checking',
    );
  });
});
