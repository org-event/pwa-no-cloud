import { shellCopy } from '@/content/ru/shell.ts';
import type { AppSection } from '@/content/index.ts';

/** Primary bottom tabs in the side rail. */
export type ShellTabId = 'profile' | 'calls' | 'chats' | 'settings';

export type ShellTabItem = {
  id: ShellTabId;
  title: string;
};

export const SHELL_TABS: ShellTabItem[] = [
  { id: 'profile', title: shellCopy.tabProfile },
  { id: 'calls', title: shellCopy.tabCalls },
  { id: 'chats', title: shellCopy.tabChats },
  { id: 'settings', title: shellCopy.tabSettings },
];

export const DEFAULT_SHELL_TAB: ShellTabId = 'chats';

export type SettingsMenuId = 'logs' | 'help' | 'servers' | 'personal';

export type SettingsMenuItem = {
  id: SettingsMenuId;
  title: string;
  section: AppSection | 'personal';
};

/** Settings tab list (shown in the rail, content on the right). */
export const SETTINGS_MENU: SettingsMenuItem[] = [
  { id: 'logs', title: shellCopy.drawerLogs, section: 'logs' },
  { id: 'help', title: shellCopy.drawerHelp, section: 'help' },
  { id: 'servers', title: shellCopy.drawerServers, section: 'servers' },
  { id: 'personal', title: shellCopy.drawerPersonal, section: 'personal' },
];

/** @deprecated use SETTINGS_MENU */
export const DRAWER_MENU = SETTINGS_MENU;

export const tabForSection = (section: AppSection): ShellTabId | null => {
  if (section === 'calls') return 'calls';
  if (section === 'contacts') return 'profile';
  if (
    section === 'logs' ||
    section === 'help' ||
    section === 'servers' ||
    section === 'lan'
  ) {
    return 'settings';
  }
  return null;
};
