import { describe, expect, it } from 'vitest';
import {
  APP_PROTOCOL,
  cleanLocation,
  encodeDeepHash,
  encodeHttpsLink,
  encodeProtocolLink,
  parseDeepLink,
  parsePastedShare,
  shareMessage,
} from './app-link.ts';

describe('app deep links', () => {
  it('parses join payload without lowercasing it', () => {
    const packed = 'N1.Ab+C/d=';
    const hash = encodeDeepHash('join', packed);
    const parsed = parseDeepLink(hash);
    expect(parsed.kind).toBe('join');
    if (parsed.kind !== 'join') return;
    expect(parsed.payload).toBe(packed);
    expect(parsed.section).toBe('lan');
  });

  it('parses protocol handler query', () => {
    const packed = 'S1.{"v":1}';
    const nc = encodeURIComponent(encodeProtocolLink('pack', packed));
    const parsed = parseDeepLink('', `?nc=${nc}`);
    expect(parsed.kind).toBe('pack');
    if (parsed.kind !== 'pack') return;
    expect(parsed.payload).toBe(packed);
    expect(parsed.section).toBe('servers');
  });

  it('parses a full Pages URL pasted by hand', () => {
    const pasted = parsePastedShare(
      'https://org-event.github.io/pwa-no-cloud/#r/1t6c6w3z2m6g',
    );
    expect(pasted.kind).toBe('room');
    if (pasted.kind === 'room') expect(pasted.payload).toBe('1t6c6w3z2m6g');
    expect(parsePastedShare('r/office').kind).toBe('room');
    expect(parsePastedShare('просто текст').kind).toBe('section');
  });

  it('parses room and section hashes', () => {
    const room = parseDeepLink('#r/office');
    expect(room.kind).toBe('room');
    if (room.kind === 'room') expect(room.payload).toBe('office');
    expect(parseDeepLink('#/r/office').kind).toBe('room');
    expect(parseDeepLink('#help').section).toBe('help');
    expect(parseDeepLink('#j/').kind).toBe('section');
  });

  it('builds https and web+nocloud links', () => {
    const https = encodeHttpsLink(
      'https://org-event.github.io',
      '/pwa-no-cloud/',
      'join',
      'N1.x',
    );
    expect(https).toBe('https://org-event.github.io/pwa-no-cloud/#j/N1.x');
    expect(encodeProtocolLink('join', 'N1.x')).toBe(`${APP_PROTOCOL}://j/N1.x`);
    expect(shareMessage(https, encodeProtocolLink('join', 'N1.x'))).toContain(
      https,
    );
  });

  it('strips handler query after consume', () => {
    const next = cleanLocation(
      'https://example.com/pwa-no-cloud/?nc=web%2Bnocloud%3Aj%2Fx#j/x',
      'lan',
    );
    expect(next).toBe('/pwa-no-cloud/#lan');
  });
});
