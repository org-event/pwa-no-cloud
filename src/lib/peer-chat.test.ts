import { describe, expect, it } from 'vitest';
import { isChatControlFrame } from './peer-chat.ts';

describe('isChatControlFrame', () => {
  it('accepts H1. wire and rejects ping/profile JSON', () => {
    expect(isChatControlFrame('H1.{"v":1}')).toBe(true);
    expect(isChatControlFrame('  H1. {"v":1}')).toBe(true);
    expect(isChatControlFrame(JSON.stringify({ type: 'ping', t: 1 }))).toBe(
      false,
    );
    expect(
      isChatControlFrame(JSON.stringify({ type: 'profile', id: 'x' })),
    ).toBe(false);
    expect(isChatControlFrame('')).toBe(false);
  });
});
