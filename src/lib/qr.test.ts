import { describe, expect, it } from 'vitest';
import { inviteToQr, QR_MAX_CHARS } from './qr.ts';

describe('invite QR', () => {
  it('skips empty and oversized text', async () => {
    expect(await inviteToQr('')).toBe(null);
    expect(await inviteToQr('x'.repeat(QR_MAX_CHARS + 1))).toBe(null);
  });
});
