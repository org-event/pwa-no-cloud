export type ProfileCard = {
  id: string;
  nick: string;
  avatar: string;
};

export const MAX_NICK_LENGTH = 32;
export const MAX_AVATAR_CHARS = 48_000;

const NICK_RE = /^[\p{L}\p{N} ._-]{1,32}$/u;

export const isProfileId = (value: string): boolean => {
  return /^[a-z0-9]{8,24}$/i.test(value);
};

export const sanitizeNick = (raw: string): string => {
  const nick = raw.trim().replace(/\s+/g, ' ');
  if (!nick || nick.length > MAX_NICK_LENGTH) return '';
  if (!NICK_RE.test(nick)) return '';
  return nick;
};

export const defaultNick = (id: string): string => {
  const tail = id.slice(-4) || 'user';
  return `гость-${tail}`;
};

export const isSafeAvatar = (value: string): boolean => {
  if (!value) return true;
  if (value.length > MAX_AVATAR_CHARS) return false;
  return (
    value.startsWith('data:image/png;base64,') ||
    value.startsWith('data:image/jpeg;base64,') ||
    value.startsWith('data:image/webp;base64,') ||
    value.startsWith('data:image/svg+xml')
  );
};

export const parseProfileCard = (raw: unknown): ProfileCard | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as {
    id?: unknown;
    nick?: unknown;
    avatar?: unknown;
  };
  if (typeof record.id !== 'string' || !isProfileId(record.id)) return null;
  const nick = typeof record.nick === 'string' ? sanitizeNick(record.nick) : '';
  if (!nick) return null;
  const avatar = typeof record.avatar === 'string' ? record.avatar : '';
  if (!isSafeAvatar(avatar)) {
    return { id: record.id, nick, avatar: '' };
  }
  return { id: record.id, nick, avatar };
};

export type Contact = ProfileCard & {
  addedAt: number;
  updatedAt: number;
};

export type ContactGroup = {
  id: string;
  name: string;
  memberIds: string[];
};

export type AddressBook = {
  contacts: Contact[];
  groups: ContactGroup[];
};

export const EMPTY_BOOK: AddressBook = { contacts: [], groups: [] };

export const upsertContact = (
  book: AddressBook,
  card: ProfileCard,
  now = Date.now(),
): AddressBook => {
  const next = book.contacts.filter((item) => item.id !== card.id);
  const previous = book.contacts.find((item) => item.id === card.id);
  next.push({
    ...card,
    addedAt: previous?.addedAt ?? now,
    updatedAt: now,
  });
  next.sort((left, right) => left.nick.localeCompare(right.nick, 'ru'));
  return { ...book, contacts: next };
};

export const removeContact = (book: AddressBook, id: string): AddressBook => {
  return {
    contacts: book.contacts.filter((item) => item.id !== id),
    groups: book.groups.map((group) => ({
      ...group,
      memberIds: group.memberIds.filter((member) => member !== id),
    })),
  };
};

export const findContact = (book: AddressBook, id: string): Contact | null => {
  for (const item of book.contacts) {
    if (item.id === id) return item;
  }
  return null;
};

export const expandRecipients = (
  book: AddressBook,
  contactIds: string[],
  groupIds: string[],
): ProfileCard[] => {
  const seen = new Set<string>();
  const cards: ProfileCard[] = [];
  const add = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const found = findContact(book, id);
    if (found) cards.push(found);
  };
  for (const id of contactIds) add(id);
  for (const groupId of groupIds) {
    const group = book.groups.find((item) => item.id === groupId);
    if (!group) continue;
    for (const id of group.memberIds) add(id);
  }
  return cards;
};
