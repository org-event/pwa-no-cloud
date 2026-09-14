import { describe, expect, it } from 'vitest';
import {
  CONTACT_CARD_PREFIX,
  defaultNick,
  encodeContactCard,
  expandRecipients,
  LEGACY_CONTACT_CARD_PREFIX,
  meetRoomId,
  parseContactCard,
  parseProfileCard,
  sanitizeNick,
  setContactAlias,
  setContactTrust,
  contactTrustOf,
  toNetworkProfile,
  upsertContact,
  type AddressBook,
} from './profile.ts';

const FP_A = 'abcd1234ef567890';
const FP_B = 'def4567890abcdef';

describe('profile card', () => {
  it('keeps a fingerprint id and a sanitized nick', () => {
    expect(sanitizeNick('  Вася  ')).toBe('Вася');
    expect(defaultNick(FP_A)).toBe('гость-7890');
    const card = parseProfileCard({
      id: FP_A,
      nick: 'Вася',
      avatar: '',
    });
    expect(card?.id).toBe(FP_A);
    expect(parseProfileCard({ id: 'abc123xyz9', nick: 'Вася' })).toBeNull();
    expect(parseProfileCard({ id: 'bad', nick: 'Вася' })).toBeNull();
  });

  it('upserts by fingerprint when nick changes', () => {
    let book: AddressBook = { contacts: [], groups: [] };
    book = upsertContact(book, { id: FP_A, nick: 'Вася', avatar: '' }, 1);
    book = upsertContact(book, { id: FP_A, nick: 'Василий', avatar: '' }, 2);
    expect(book.contacts).toHaveLength(1);
    expect(book.contacts[0]?.nick).toBe('Василий');
    expect(book.contacts[0]?.addedAt).toBe(1);
  });

  it('encodes P1. cards and hard-cuts C1. / short ids', () => {
    const packed = encodeContactCard({
      id: FP_A,
      nick: 'Вася',
      avatar: 'data:image/png;base64,xx',
    });
    expect(packed.startsWith(CONTACT_CARD_PREFIX)).toBe(true);
    expect(packed).not.toContain('avatar');
    const card = parseContactCard(packed);
    expect(card).toEqual({ id: FP_A, nick: 'Вася', avatar: '' });
    expect(parseContactCard(FP_A)?.id).toBe(FP_A);
    expect(parseContactCard(`вот ${packed} держи`)?.nick).toBe('Вася');
    expect(parseContactCard(`{"v":2,"id":"${FP_A}","nick":"Вася"}`)?.id).toBe(
      FP_A,
    );
    expect(parseContactCard('не то')).toBeNull();
    expect(parseContactCard('abc123xyz9')).toBeNull();
    expect(
      parseContactCard(
        `${LEGACY_CONTACT_CARD_PREFIX}{"v":1,"id":"abc123xyz9","nick":"Вася"}`,
      ),
    ).toBeNull();
    expect(
      parseContactCard(
        encodeContactCard({ id: FP_A, nick: 'C1.', avatar: '' }),
      ),
    ).toEqual({ id: FP_A, nick: 'C1.', avatar: '' });
    expect(encodeContactCard({ id: 'abc123xyz9', nick: 'x', avatar: '' })).toBe(
      '',
    );
    expect(meetRoomId(FP_A)).toBe(`c-${FP_A}`);
  });

  it('expands a group into unique members', () => {
    const book: AddressBook = {
      contacts: [
        { id: FP_A, nick: 'A', avatar: '', addedAt: 1, updatedAt: 1 },
        { id: FP_B, nick: 'B', avatar: '', addedAt: 1, updatedAt: 1 },
      ],
      groups: [{ id: 'g1', name: 'дом', memberIds: [FP_A, FP_B] }],
    };
    expect(expandRecipients(book, [], ['g1']).map((item) => item.nick)).toEqual(
      ['A', 'B'],
    );
  });

  it('keeps localAlias across upsert and omits it from network profile', () => {
    let book: AddressBook = { contacts: [], groups: [] };
    const pk = 'pk1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    book = upsertContact(
      book,
      { id: FP_A, nick: 'Вася', avatar: '', publicKey: pk },
      1,
    );
    book = setContactAlias(book, FP_A, 'Брат');
    expect(book.contacts[0]?.localAlias).toBe('Брат');
    book = upsertContact(book, { id: FP_A, nick: 'Василий', avatar: '' }, 2);
    expect(book.contacts[0]?.nick).toBe('Василий');
    expect(book.contacts[0]?.localAlias).toBe('Брат');
    expect(book.contacts[0]?.publicKey).toBe(pk);
    const wire = toNetworkProfile(book.contacts[0]!);
    expect(wire).toEqual({ id: FP_A, nick: 'Василий', avatar: '' });
    expect(JSON.stringify(wire)).not.toContain('localAlias');
    expect(JSON.stringify(wire)).not.toContain('Брат');
    expect(JSON.stringify(wire)).not.toContain('publicKey');
  });

  it('keeps trust across upsert and omits it from network profile', () => {
    let book: AddressBook = { contacts: [], groups: [] };
    book = upsertContact(book, { id: FP_A, nick: 'Вася', avatar: '' }, 1);
    expect(contactTrustOf(book.contacts[0]!)).toBe('unverified');
    book = setContactTrust(book, FP_A, 'met');
    expect(book.contacts[0]?.trust).toBe('met');
    book = upsertContact(book, { id: FP_A, nick: 'Василий', avatar: '' }, 2);
    expect(book.contacts[0]?.trust).toBe('met');
    const wire = toNetworkProfile(book.contacts[0]!);
    expect(JSON.stringify(wire)).not.toContain('trust');
    expect(JSON.stringify(wire)).not.toContain('met');
    book = setContactTrust(book, FP_A, 'unverified');
    expect(book.contacts[0]?.trust).toBeUndefined();
  });
});
