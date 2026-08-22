import { describe, expect, it } from 'vitest';
import { createMemoryRoot } from './opfs-memory.ts';
import { openStore } from './opfs.ts';
import { loadAddressBook, saveAddressBook } from './contacts-store.ts';

describe('contacts store', () => {
  it('round-trips a card and drops a broken id', async () => {
    const opened = await openStore(createMemoryRoot());
    if (!opened.ok) throw new Error(opened.message);
    const saved = await saveAddressBook(opened.value, {
      contacts: [
        {
          id: 'abc123xyz9',
          nick: 'Вася',
          avatar: '',
          addedAt: 1,
          updatedAt: 1,
        },
        {
          id: 'bad',
          nick: 'Нет',
          avatar: '',
          addedAt: 1,
          updatedAt: 1,
        },
      ],
      groups: [{ id: 'g1', name: 'дом', memberIds: ['abc123xyz9'] }],
    });
    expect(saved.ok).toBe(true);
    const loaded = await loadAddressBook(opened.value);
    expect(loaded.contacts).toHaveLength(1);
    expect(loaded.contacts[0]?.nick).toBe('Вася');
    expect(loaded.groups[0]?.name).toBe('дом');
  });
});
