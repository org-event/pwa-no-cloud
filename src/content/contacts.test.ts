import { describe, expect, it } from 'vitest';
import {
  knockAlreadyNotice,
  knockBlockedNotice,
  knockStartNotice,
  MIXED_CONTENT_SIGNALING,
} from '@/content/index.ts';

describe('knockBlockedNotice', () => {
  it('explains S1 when contact is known', () => {
    expect(knockBlockedNotice('Анна', false)).toContain('Анна');
    expect(knockBlockedNotice('Анна', true)).toContain('S1.');
  });

  it('uses mixed-content copy when page blocks ws', () => {
    expect(knockBlockedNotice(undefined, true)).toBe(MIXED_CONTENT_SIGNALING);
  });

  it('asks for S1 when unknown and not mixed', () => {
    expect(knockBlockedNotice(undefined, false)).toContain('S1.');
  });
});

describe('knockAlreadyNotice / knockStartNotice', () => {
  it('picks host vs guest lines', () => {
    expect(knockAlreadyNotice(true, 'Анна')).toContain('ждём');
    expect(knockAlreadyNotice(false, 'Анна')).toContain('Анна');
    expect(knockAlreadyNotice(false, undefined)).toBe('Уже стучимся.');
    expect(knockStartNotice(true, undefined)).toContain('Карточка готова');
    expect(knockStartNotice(false, 'Анна')).toContain('Стучимся');
    expect(knockStartNotice(false, undefined)).toBe('Стучимся…');
  });
});
