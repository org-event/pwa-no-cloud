import { APP_SECTIONS, type AppSection } from '@/content/index.ts';
import { shellCopy } from '@/content/ru/shell.ts';

/** Synthetic list rows for empty Telegram-like stubs (S5.1). */
export type ShellStubId = 'stub-chats' | 'stub-empty';

export type ShellContactId = `contact:${string}`;

export type ShellNavId = AppSection | ShellStubId | ShellContactId;

export type ShellNavItem = {
  id: ShellNavId;
  title: string;
  detail: string;
  kind: 'section' | 'stub' | 'contact';
  peerId?: string;
  online?: boolean;
  avatar?: string;
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

export const shellContactId = (peerId: string): ShellContactId =>
  `contact:${peerId}`;

export const parseShellContactId = (id: ShellNavId): string | null => {
  if (typeof id !== 'string' || !id.startsWith('contact:')) return null;
  const peerId = id.slice('contact:'.length);
  return peerId || null;
};

export const isShellStub = (id: ShellNavId): id is ShellStubId =>
  id === 'stub-chats' || id === 'stub-empty';

export const isShellContact = (id: ShellNavId): id is ShellContactId =>
  parseShellContactId(id) !== null;

export const shellNavTitle = (id: ShellNavId, contactNick?: string): string => {
  const peerId = parseShellContactId(id);
  if (peerId) return contactNick || peerId.slice(0, 12);
  if (isShellStub(id)) {
    for (const item of SHELL_STUBS) {
      if (item.id === id) return item.title;
    }
  }
  for (const section of APP_SECTIONS) {
    if (section.id === id) return section.title;
  }
  return shellCopy.listTitle;
};
