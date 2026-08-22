import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SECTION,
  parseSectionHash,
  sectionHash,
  sectionTitle,
} from './sections.ts';

describe('app sections', () => {
  it('defaults empty hash to contacts', () => {
    expect(parseSectionHash('')).toBe(DEFAULT_SECTION);
    expect(parseSectionHash('#')).toBe('contacts');
  });

  it('maps aliases and known ids', () => {
    expect(parseSectionHash('#servers')).toBe('servers');
    expect(parseSectionHash('#my-server')).toBe('servers');
    expect(parseSectionHash('#transfer')).toBe('lan');
    expect(parseSectionHash('#video')).toBe('video');
    expect(parseSectionHash('#help')).toBe('help');
    expect(parseSectionHash('#j/N1.x')).toBe('lan');
  });

  it('builds a hash and title', () => {
    expect(sectionHash('logs')).toBe('#logs');
    expect(sectionTitle('contacts')).toBe('Контакты');
  });
});
