import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import { contactsCopy } from '@/content/index.ts';
import { encodeContactCard, type ProfileCard } from '@/domain/profile.ts';
import {
  createContactsController,
  type ContactsControllerDeps,
  type ContactsControllerState,
} from './contacts-controller.ts';

const ME_ID = 'aaaaaaaaaaaaaaaa';
const PEER_ID = 'bbbbbbbbbbbbbbbb';

const meCard = (): ProfileCard => ({
  id: ME_ID,
  nick: 'Me',
  avatar: '',
});

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
};

const baseDeps = (
  overrides: Partial<ContactsControllerDeps> = {},
): ContactsControllerDeps => {
  const skippedPeers = new Set<string>();
  return {
    storage: memoryStorage(),
    getOpfsStore: () => null,
    skippedPeers,
    copyText: vi.fn(async () => true),
    note: vi.fn(),
    syncPresenceContacts: vi.fn(),
    startPresence: vi.fn(async () => true),
    setPeerProfile: vi.fn(),
    setLivePeer: vi.fn(),
    getLivePeerId: () => null,
    getPeerNick: () => '',
    usesRoomLink: () => true,
    socketBlocked: () => false,
    peerIsLive: () => false,
    getRoomId: () => '',
    beginKnock: () => null,
    onIdentityKeyPairChange: vi.fn(),
    onChange: () => {},
    initial: {
      me: meCard(),
      book: { contacts: [], groups: [] },
      pending: null,
      notice: '',
      cardText: '',
      identityQrUrl: null,
      selectedContactIds: [],
      selectedGroupIds: [],
    },
    ...overrides,
  };
};

describe('ContactsController', () => {
  it('addContact rejects own P1 card', async () => {
    const states: ContactsControllerState[] = [];
    const controller = createContactsController(
      baseDeps({
        onChange: (state) => {
          states.push(state);
        },
      }),
    );

    const own = encodeContactCard(meCard());
    const ok = await controller.onAddContact(own);
    expect(ok).toBe(false);
    expect(states.at(-1)?.notice).toBe(contactsCopy.ownCard);
    expect(controller.getState().book.contacts).toHaveLength(0);
  });

  it('addContact upserts a P1 card and sets notice', async () => {
    const syncPresenceContacts = vi.fn();
    const states: ContactsControllerState[] = [];
    const controller = createContactsController(
      baseDeps({
        syncPresenceContacts,
        onChange: (state) => {
          states.push(state);
        },
      }),
    );

    const peer: ProfileCard = { id: PEER_ID, nick: 'Boris', avatar: '' };
    const ok = await controller.onAddContact(encodeContactCard(peer));
    expect(ok).toBe(true);
    expect(states.at(-1)?.notice).toBe(contactsCopy.inBook('Boris'));
    expect(states.at(-1)?.book.contacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: PEER_ID, nick: 'Boris' }),
      ]),
    );
    expect(syncPresenceContacts).toHaveBeenCalledOnce();
  });

  it('acceptPending upserts and clear; skipPending records skip', () => {
    const skippedPeers = new Set<string>();
    const pending: ProfileCard = {
      id: PEER_ID,
      nick: 'Vika',
      avatar: '',
    };
    const states: ContactsControllerState[] = [];
    const controller = createContactsController(
      baseDeps({
        skippedPeers,
        onChange: (state) => {
          states.push(state);
        },
        initial: fromPartial({
          me: meCard(),
          pending,
          book: { contacts: [], groups: [] },
        }),
      }),
    );

    controller.onAcceptPending();
    expect(states.at(-1)?.pending).toBeNull();
    expect(states.at(-1)?.notice).toBe(contactsCopy.inBook('Vika'));
    expect(states.at(-1)?.book.contacts.some((c) => c.id === PEER_ID)).toBe(
      true,
    );
    expect(skippedPeers.has(PEER_ID)).toBe(false);

    const skipStates: ContactsControllerState[] = [];
    const again = createContactsController(
      baseDeps({
        skippedPeers,
        onChange: (state) => {
          skipStates.push(state);
        },
        initial: fromPartial({
          me: meCard(),
          pending,
          book: { contacts: [], groups: [] },
        }),
      }),
    );
    again.onSkipPending();
    expect(skipStates.at(-1)?.pending).toBeNull();
    expect(skippedPeers.has(PEER_ID)).toBe(true);
    expect(again.getState().book.contacts).toHaveLength(0);
  });

  it('introduceContact returns false with introduceNeedKey when no publicKey', async () => {
    const states: ContactsControllerState[] = [];
    const controller = createContactsController(
      baseDeps({
        onChange: (state) => {
          states.push(state);
        },
        initial: fromPartial({
          me: meCard(),
          book: {
            contacts: [
              {
                id: PEER_ID,
                nick: 'NoKey',
                avatar: '',
                addedAt: 1,
                updatedAt: 1,
              },
            ],
            groups: [],
          },
        }),
      }),
    );

    const ok = await controller.onIntroduceContact(PEER_ID);
    expect(ok).toBe(false);
    expect(states.at(-1)?.notice).toBe(contactsCopy.introduceNeedKey);
  });
});
