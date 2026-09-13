import { describe, expect, it } from 'vitest';
import { cycleTheme, resolveTheme } from './theme.ts';

describe('theme', () => {
  it('cycles light → dark → system → light', () => {
    expect(cycleTheme('light')).toBe('dark');
    expect(cycleTheme('dark')).toBe('system');
    expect(cycleTheme('system')).toBe('light');
  });

  it('resolves explicit modes without media', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });
});
