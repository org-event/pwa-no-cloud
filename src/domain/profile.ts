import { domainCopy } from '@/content/index.ts';

/**
 * Peer profile card. `id` is the identity fingerprint (16 hex), not a random short code.
 * Old C1. / alphanumeric client ids are hard-cut (see backlog S0.2).
 */

export type ProfileCard = {
  id: string;
  nick: string;
  avatar: string;
};

export const MAX_NICK_LENGTH = 32;
export const MAX_AVATAR_CHARS = 48_000;

/** Invite / paste card: fingerprint-based (replaces exploratory `C1.`). */
export const CONTACT_CARD_PREFIX = 'P1.';
/** Rejected exploratory prefix — parseContactCard returns null for these. */
export const LEGACY_CONTACT_CARD_PREFIX = 'C1.';

const NICK_RE = /^[\p{L}\p{N} ._-]{1,32}$/u;
const FINGERPRINT_RE = /^[0-9a-f]{16}$/i;

/** Canonical peer id = identity fingerprint (S1.2), not random clientId. */
export const isProfileId = (value: string): boolean => {
  return FINGERPRINT_RE.test(value);
};

export const sanitizeNick = (raw: string): string => {
  const nick = raw.trim().replace(/\s+/g, ' ');
  if (!nick || nick.length > MAX_NICK_LENGTH) return '';
  if (!NICK_RE.test(nick)) return '';
  return nick;
};

export const defaultNick = (id: string): string => {
  const tail = id.slice(-4) || 'user';
  return domainCopy.guestNick(tail);
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

export const encodeContactCard = (card: ProfileCard): string => {
  if (!isProfileId(card.id)) return '';
  return (
    CONTACT_CARD_PREFIX +
    JSON.stringify({ v: 2, id: card.id.toLowerCase(), nick: card.nick })
  );
};

export const meetRoomId = (ownerId: string): string => {
  const id = ownerId.toLowerCase();
  return `c-${id}`;
};

const stripCardNoise = (text: string): string => {
  return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
};

const cardFromRecord = (id: unknown, nick: unknown): ProfileCard | null => {
  if (typeof id !== 'string' || !isProfileId(id)) return null;
  const label = typeof nick === 'string' ? sanitizeNick(nick) : '';
  const normalized = id.toLowerCase();
  return { id: normalized, nick: label || defaultNick(normalized), avatar: '' };
};

export const parseContactCard = (text: string): ProfileCard | null => {
  const raw = stripCardNoise(text);
  if (!raw) return null;
  // Hard cut: exploratory C1. prefix only — not the substring inside nick/payload.
  if (raw.startsWith(LEGACY_CONTACT_CARD_PREFIX)) return null;
  const packed = raw.match(/P1\.\s*(\{[\s\S]*\})/i);
  if (packed?.[1]) {
    try {
      const parsed = JSON.parse(packed[1]) as {
        id?: unknown;
        nick?: unknown;
      };
      return cardFromRecord(parsed.id, parsed.nick);
    } catch {
      return null;
    }
  }
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { id?: unknown; nick?: unknown };
      const card = cardFromRecord(parsed.id, parsed.nick);
      if (card) return card;
    } catch {
      /* not JSON */
    }
  }
  if (isProfileId(raw)) {
    const id = raw.toLowerCase();
    return { id, nick: defaultNick(id), avatar: '' };
  }
  return null;
};

export const parseProfileCard = (raw: unknown): ProfileCard | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as {
    id?: unknown;
    nick?: unknown;
    avatar?: unknown;
  };
  if (typeof record.id !== 'string' || !isProfileId(record.id)) return null;
  const id = record.id.toLowerCase();
  const nick = typeof record.nick === 'string' ? sanitizeNick(record.nick) : '';
  if (!nick) return null;
  const avatar = typeof record.avatar === 'string' ? record.avatar : '';
  if (!isSafeAvatar(avatar)) {
    return { id, nick, avatar: '' };
  }
  return { id, nick, avatar };
};

/** Local-only trust; never on the wire (FR-PR-07). */
export type ContactTrust = 'unverified' | 'introduced' | 'met';

export type Contact = ProfileCard & {
  addedAt: number;
  updatedAt: number;
  /** Wire pubkey `pk1.…` when known (from signed profile / invite). */
  publicKey?: string;
  /** Local-only label; never sent on the wire (FR-PR-02). */
  localAlias?: string;
  /** Local-only trust mark (FR-PR-07). */
  trust?: ContactTrust;
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

export type UpsertContactInput = ProfileCard & {
  publicKey?: string;
};

/** Name shown in UI: local alias wins over network nick. */
export const contactDisplayName = (contact: Contact): string => {
  const alias = contact.localAlias?.trim();
  return alias || contact.nick;
};

/** Strip local-only fields before any network / invite payload. */
export const toNetworkProfile = (contact: Contact): ProfileCard => {
  return {
    id: contact.id,
    nick: contact.nick,
    avatar: contact.avatar,
  };
};

export const upsertContact = (
  book: AddressBook,
  card: UpsertContactInput,
  now = Date.now(),
): AddressBook => {
  const id = card.id.toLowerCase();
  const next = book.contacts.filter((item) => item.id !== id);
  const previous = book.contacts.find((item) => item.id === id);
  const publicKey = card.publicKey ?? previous?.publicKey;
  next.push({
    id,
    nick: card.nick,
    avatar: card.avatar,
    addedAt: previous?.addedAt ?? now,
    updatedAt: now,
    ...(publicKey ? { publicKey } : {}),
    ...(previous?.localAlias ? { localAlias: previous.localAlias } : {}),
    ...(previous?.trust ? { trust: previous.trust } : {}),
  });
  next.sort((left, right) =>
    contactDisplayName(left).localeCompare(contactDisplayName(right), 'ru'),
  );
  return { ...book, contacts: next };
};

export const parseContactTrust = (value: unknown): ContactTrust => {
  if (value === 'met' || value === 'introduced' || value === 'unverified') {
    return value;
  }
  return 'unverified';
};

export const contactTrustOf = (contact: Contact): ContactTrust =>
  contact.trust ?? 'unverified';

export const setContactTrust = (
  book: AddressBook,
  id: string,
  trust: ContactTrust,
): AddressBook => {
  const normalized = id.toLowerCase();
  return {
    ...book,
    contacts: book.contacts.map((item) => {
      if (item.id !== normalized) return item;
      if (trust === 'unverified') {
        const { trust: _removed, ...rest } = item;
        void _removed;
        return rest;
      }
      return { ...item, trust };
    }),
  };
};

export const setContactAlias = (
  book: AddressBook,
  id: string,
  alias: string,
): AddressBook => {
  const normalized = id.toLowerCase();
  const label = sanitizeNick(alias);
  return {
    ...book,
    contacts: book.contacts
      .map((item) => {
        if (item.id !== normalized) return item;
        if (!label) {
          const { localAlias: _removed, ...rest } = item;
          void _removed;
          return rest;
        }
        return { ...item, localAlias: label };
      })
      .sort((left, right) =>
        contactDisplayName(left).localeCompare(contactDisplayName(right), 'ru'),
      ),
  };
};

export const removeContact = (book: AddressBook, id: string): AddressBook => {
  const normalized = id.toLowerCase();
  return {
    contacts: book.contacts.filter((item) => item.id !== normalized),
    groups: book.groups.map((group) => ({
      ...group,
      memberIds: group.memberIds.filter(
        (member) => member.toLowerCase() !== normalized,
      ),
    })),
  };
};

export const findContact = (book: AddressBook, id: string): Contact | null => {
  const normalized = id.toLowerCase();
  for (const item of book.contacts) {
    if (item.id === normalized) return item;
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
    const normalized = id.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    const found = findContact(book, normalized);
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
