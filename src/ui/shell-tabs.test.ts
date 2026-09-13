import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHELL_TAB,
  SETTINGS_MENU,
  SHELL_TABS,
  tabForSection,
} from './shell-tabs.ts';

describe('shell-tabs', () => {
  it('defaults to chats with four view tabs', () => {
    expect(DEFAULT_SHELL_TAB).toBe('chats');
    expect(SHELL_TABS.map((t) => t.id)).toEqual([
      'profile',
      'calls',
      'chats',
      'settings',
    ]);
  });

  it('maps settings entries and section→tab shortcuts', () => {
    expect(SETTINGS_MENU.map((item) => item.id)).toEqual([
      'logs',
      'help',
      'servers',
      'personal',
    ]);
    expect(tabForSection('calls')).toBe('calls');
    expect(tabForSection('contacts')).toBe('profile');
    expect(tabForSection('logs')).toBe('settings');
    expect(tabForSection('help')).toBe('settings');
  });
});
