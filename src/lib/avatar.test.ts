import { describe, expect, it } from 'vitest';
import { avatarSrc, identiconSvg } from './avatar.ts';

describe('identicon', () => {
  it('is stable for the same id and different across ids', () => {
    const one = identiconSvg('abc123xyz9');
    expect(identiconSvg('abc123xyz9')).toBe(one);
    expect(identiconSvg('def456uvw8')).not.toBe(one);
    expect(avatarSrc('abc123xyz9', '')).toContain('image/svg+xml');
    expect(avatarSrc('abc123xyz9', 'data:image/jpeg;base64,xx')).toContain(
      'jpeg',
    );
  });
});
