import { describe, expect, it } from 'vitest';
import { meetRoomId } from '@/domain/profile.ts';
import { isPresencePeerId, isWatchClient, watchClientId } from './presence.ts';

const FP = 'abcd1234ef567890';

describe('presence ids', () => {
  it('marks watch probes', () => {
    expect(isWatchClient(watchClientId(FP))).toBe(true);
    expect(isWatchClient(FP)).toBe(false);
  });

  it('accepts fingerprint peer ids for lobby seats', () => {
    expect(isPresencePeerId(FP)).toBe(true);
    expect(isPresencePeerId('abc123xyz9')).toBe(false);
    expect(meetRoomId(FP)).toBe(`c-${FP}`);
    expect(watchClientId(FP)).toBe(`watch:${FP}`);
  });
});
