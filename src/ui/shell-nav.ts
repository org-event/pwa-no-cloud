import { APP_SECTIONS, type AppSection } from '@/content/index.ts';
import { shellCopy } from '@/content/ru/shell.ts';

/** Local notebook / chat-with-self (never sent over the wire). */
export const SELF_PEER_ID = 'self';

export type ShellContactId = `contact:${string}`;

export type ShellNavId = AppSection | 'personal' | ShellContactId;

export const shellSelfId = (): ShellContactId => `contact:${SELF_PEER_ID}`;

export const isSelfPeer = (peerId: string | null | undefined): boolean =>
  peerId === SELF_PEER_ID;

export const isSelfChat = (id: ShellNavId): boolean =>
  parseShellContactId(id) === SELF_PEER_ID;

export type ShellNavItem = {
  id: ShellNavId;
  title: string;
  detail: string;
  kind: 'section' | 'contact';
  peerId?: string;
  online?: boolean;
  avatar?: string;
};

export const shellContactId = (peerId: string): ShellContactId =>
  `contact:${peerId}`;

export const parseShellContactId = (id: ShellNavId): string | null => {
  if (typeof id !== 'string' || !id.startsWith('contact:')) return null;
  const peerId = id.slice('contact:'.length);
  return peerId || null;
};

export const isShellContact = (id: ShellNavId): id is ShellContactId =>
  parseShellContactId(id) !== null;

export const shellNavTitle = (id: ShellNavId, contactNick?: string): string => {
  const peerId = parseShellContactId(id);
  if (peerId === SELF_PEER_ID) return shellCopy.selfChatTitle;
  if (peerId) return contactNick || peerId.slice(0, 12);
  if (id === 'personal') return shellCopy.personalTitle;
  for (const section of APP_SECTIONS) {
    if (section.id === id) return section.title;
  }
  return shellCopy.contactsTitle;
};
