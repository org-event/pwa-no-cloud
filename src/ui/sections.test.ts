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
    expect(parseSectionHash('#calls')).toBe('calls');
    expect(parseSectionHash('#video')).toBe('calls');
    expect(parseSectionHash('#help')).toBe('help');
    expect(sectionTitle('calls')).toBe('Звонки');
    expect(parseSectionHash('#j/N1.x')).toBe('lan');
  });

  it('builds a hash and title', () => {
    expect(sectionHash('logs')).toBe('#logs');
    expect(sectionTitle('contacts')).toBe('Контакты');
  });
});
