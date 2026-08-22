import { describe, expect, it } from 'vitest';
import {
  defaultNick,
  expandRecipients,
  parseProfileCard,
  sanitizeNick,
  upsertContact,
  type AddressBook,
} from './profile.ts';

describe('profile card', () => {
  it('keeps a stable id and a sanitized nick', () => {
    expect(sanitizeNick('  Вася  ')).toBe('Вася');
    expect(defaultNick('abc123xyz9')).toBe('гость-xyz9');
    const card = parseProfileCard({
      id: 'abc123xyz9',
      nick: 'Вася',
      avatar: '',
    });
    expect(card?.id).toBe('abc123xyz9');
    expect(parseProfileCard({ id: 'bad', nick: 'Вася' })).toBeNull();
  });

  it('upserts by id when nick changes', () => {
    let book: AddressBook = { contacts: [], groups: [] };
    book = upsertContact(
      book,
      { id: 'abc123xyz9', nick: 'Вася', avatar: '' },
      1,
    );
    book = upsertContact(
      book,
      { id: 'abc123xyz9', nick: 'Василий', avatar: '' },
      2,
    );
    expect(book.contacts).toHaveLength(1);
    expect(book.contacts[0]?.nick).toBe('Василий');
    expect(book.contacts[0]?.addedAt).toBe(1);
  });

  it('expands a group into unique members', () => {
    const book: AddressBook = {
      contacts: [
        { id: 'abc123xyz9', nick: 'A', avatar: '', addedAt: 1, updatedAt: 1 },
        { id: 'def456uvw8', nick: 'B', avatar: '', addedAt: 1, updatedAt: 1 },
      ],
      groups: [
        { id: 'g1', name: 'дом', memberIds: ['abc123xyz9', 'def456uvw8'] },
      ],
    };
    expect(expandRecipients(book, [], ['g1']).map((item) => item.nick)).toEqual(
      ['A', 'B'],
    );
  });
});
