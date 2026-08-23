import {
  parseProfileCard,
  type AddressBook,
  type ContactGroup,
} from '@/domain/profile.ts';
import { generateId } from './id.ts';
import type { OpfsResult, OpfsStore } from './opfs.ts';
import { readText, writeFile } from './opfs.ts';

export const CONTACTS_FILE = 'contacts.json';

const parseBook = (raw: string): AddressBook => {
  try {
    const data = JSON.parse(raw) as {
      contacts?: unknown;
      groups?: unknown;
    };
    if (!data || !Array.isArray(data.contacts))
      return { contacts: [], groups: [] };
    const contacts = [];
    for (const item of data.contacts) {
      if (!item || typeof item !== 'object') continue;
      const row = item as {
        id?: unknown;
        nick?: unknown;
        avatar?: unknown;
        addedAt?: unknown;
        updatedAt?: unknown;
      };
      const card = parseProfileCard({
        id: row.id,
        nick: row.nick,
        avatar: row.avatar,
      });
      if (!card) continue;
      contacts.push({
        ...card,
        addedAt: typeof row.addedAt === 'number' ? row.addedAt : 0,
        updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
      });
    }
    const groups: ContactGroup[] = [];
    if (Array.isArray(data.groups)) {
      for (const item of data.groups) {
        if (!item || typeof item !== 'object') continue;
        const row = item as {
          id?: unknown;
          name?: unknown;
          memberIds?: unknown;
        };
        if (typeof row.id !== 'string' || typeof row.name !== 'string') {
          continue;
        }
        const memberIds: string[] = [];
        if (Array.isArray(row.memberIds)) {
          for (const id of row.memberIds) {
            if (typeof id === 'string') memberIds.push(id);
          }
        }
        groups.push({ id: row.id, name: row.name, memberIds });
      }
    }
    return { contacts, groups };
  } catch {
    return { contacts: [], groups: [] };
  }
};

export const loadAddressBook = async (
  store: OpfsStore,
): Promise<AddressBook> => {
  const text = await readText(store.secrets, CONTACTS_FILE);
  if (!text.ok) return { contacts: [], groups: [] };
  return parseBook(text.value);
};

export const saveAddressBook = async (
  store: OpfsStore,
  book: AddressBook,
): Promise<OpfsResult<true>> => {
  return writeFile(store.secrets, CONTACTS_FILE, JSON.stringify(book));
};

export const createGroup = (
  name: string,
  memberIds: string[],
): ContactGroup => ({
  id: generateId(),
  name,
  memberIds,
});
