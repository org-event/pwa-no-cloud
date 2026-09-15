import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  classifyFirstScreenPaste,
  type FirstScreenPasteKind,
} from './first-screen-paste.ts';
import { parseContactCard, sanitizeNick } from '@/domain/profile.ts';
import { parseRelayRedirectNote } from '@/domain/relay/redirect.ts';

/**
 * Property-based fuzzing (Scorecard Fuzzing check via fast-check).
 * Parsers that touch paste/QR/network text must never throw on arbitrary input.
 */

describe('property fuzz: untrusted text parsers', () => {
  it('sanitizeNick never throws and returns empty or valid nick', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 200 }), (raw) => {
        const nick = sanitizeNick(raw);
        expect(typeof nick).toBe('string');
        if (nick) {
          expect(nick.length).toBeGreaterThan(0);
          expect(nick.length).toBeLessThanOrEqual(32);
          expect(nick).toBe(nick.trim());
        }
      }),
      { numRuns: 200 },
    );
  });

  it('parseContactCard never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (raw) => {
        const card = parseContactCard(raw);
        if (card === null) return;
        expect(card.id).toMatch(/^[0-9a-f]{16}$/);
        expect(typeof card.nick).toBe('string');
        expect(card.avatar).toBe('');
      }),
      { numRuns: 200 },
    );
  });

  it('classifyFirstScreenPaste never throws and stays in known kinds', () => {
    const kinds = new Set<FirstScreenPasteKind>([
      'backup',
      'mnemonic',
      'share-pack',
      'redirect',
      'contact-card',
      'introduce',
      'unknown',
    ]);
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (raw) => {
        const hit = classifyFirstScreenPaste(raw);
        expect(kinds.has(hit.kind)).toBe(true);
        expect(typeof hit.text).toBe('string');
      }),
      { numRuns: 200 },
    );
  });

  it('parseRelayRedirectNote never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400 }), (raw) => {
        const parsed = parseRelayRedirectNote(raw);
        expect(typeof parsed.ok).toBe('boolean');
        if (!parsed.ok) {
          expect(typeof parsed.code).toBe('string');
          return;
        }
        expect(parsed.value.v).toBe(1);
        expect(Array.isArray(parsed.value.relays)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
