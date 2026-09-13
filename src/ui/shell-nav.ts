import { APP_SECTIONS, type AppSection } from '@/content/index.ts';
import { shellCopy } from '@/content/ru/shell.ts';

/** Synthetic list rows for empty Telegram-like stubs (S5.1). */
export type ShellStubId = 'stub-chats' | 'stub-empty';

export type ShellNavId = AppSection | ShellStubId;

export type ShellNavItem = {
  id: ShellNavId;
  title: string;
  detail: string;
  kind: 'section' | 'stub';
};

export const SHELL_STUBS: ShellNavItem[] = [
  {
    id: 'stub-chats',
    title: shellCopy.stubChatsTitle,
    detail: shellCopy.stubChatsHint,
    kind: 'stub',
  },
  {
    id: 'stub-empty',
    title: shellCopy.stubEmptyTitle,
    detail: shellCopy.stubEmptyText,
    kind: 'stub',
  },
];

export const shellSectionItems = (): ShellNavItem[] =>
  APP_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    detail: shellCopy.sectionHint,
    kind: 'section' as const,
  }));

export const allShellNavItems = (): ShellNavItem[] => [
  ...SHELL_STUBS,
  ...shellSectionItems(),
];

export const isShellStub = (id: ShellNavId): id is ShellStubId =>
  id === 'stub-chats' || id === 'stub-empty';

export const shellNavTitle = (id: ShellNavId): string => {
  for (const item of allShellNavItems()) {
    if (item.id === id) return item.title;
  }
  return shellCopy.listTitle;
};
