import {
  contactsCopy,
  knockAlreadyNotice,
  knockBlockedNotice,
  knockStartNotice,
  notes,
} from '@/content/index.ts';
import {
  createIdentityInvite,
  parseIdentityInvite,
} from '@/domain/identity-invite.ts';
import {
  createIntroduceCard,
  importIntroduceCard,
} from '@/domain/introduce.ts';
import { decodePublicKey, type KeyPair } from '@/domain/identity/index.ts';
import {
  contactDisplayName,
  contactTrustOf,
  defaultNick,
  encodeContactCard,
  findContact,
  meetRoomId,
  parseContactCard,
  removeContact,
  sanitizeNick,
  setContactAlias,
  setContactTrust,
  upsertContact,
  type AddressBook,
  type ContactTrust,
  type ProfileCard,
} from '@/domain/profile.ts';
import { fileToAvatarDataUrl } from '@/lib/avatar.ts';
import { createGroup, saveAddressBook } from '@/lib/contacts-store.ts';
import type { IdStorage } from '@/lib/id.ts';
import type { Link } from '@/lib/link.ts';
import type { OpfsStore } from '@/lib/opfs.ts';
import { OwnedSecret, withBorrowedKeyPair } from '@/lib/owned-secret.ts';
import { bindIdentityProfile, saveProfile } from '@/lib/profile-store.ts';
import { inviteToQr } from '@/lib/qr.ts';

export type ContactsControllerState = {
  book: AddressBook;
  pending: ProfileCard | null;
  notice: string;
  me: ProfileCard;
  cardText: string;
  identityQrUrl: string | null;
  selectedContactIds: string[];
  selectedGroupIds: string[];
};

export type ContactsControllerDeps = {
  storage: IdStorage;
  getOpfsStore: () => OpfsStore | null;
  skippedPeers: Set<string>;
  copyText: (text: string) => Promise<boolean | undefined>;
  note: (line: string) => void;
  syncPresenceContacts: () => void;
  startPresence: () => Promise<unknown>;
  setPeerProfile: (me: ProfileCard) => void;
  setLivePeer: (id: string, nick: string) => void;
  getLivePeerId: () => string | null;
  getPeerNick: () => string;
  usesRoomLink: () => boolean;
  socketBlocked: () => boolean;
  peerIsLive: () => boolean;
  getRoomId: () => string;
  /**
   * Sets inviteRole/roomId/openedFromLink and starts peer.
   * Controller then calls `enterRoom` on the returned Link.
   */
  beginKnock: (roomId: string) => Link | null;
  onIdentityKeyPairChange: (
    fn: <T>(op: (keyPair: KeyPair) => T | Promise<T>) => Promise<T | null>,
  ) => void;
  onChange: (state: ContactsControllerState) => void;
  /** Seed from Pinia / boot state. */
  initial?: Partial<ContactsControllerState>;
};

/**
 * Deep module for Contacts product behaviour: address book, pending
 * accept/skip, introduce cards, identity bind/lock, knock, profile/card UX.
 * The Pinia contacts slice is a thin Vue adapter.
 */
export function createContactsController(deps: ContactsControllerDeps) {
  const seed = deps.initial ?? {};
  let book: AddressBook = seed.book ?? { contacts: [], groups: [] };
  let pending: ProfileCard | null = seed.pending ?? null;
  let notice = seed.notice ?? '';
  let me: ProfileCard = seed.me ?? {
    id: '',
    nick: defaultNick('user'),
    avatar: '',
  };
  let cardText = seed.cardText ?? encodeContactCard(me);
  let identityQrUrl: string | null = seed.identityQrUrl ?? null;
  let selectedContactIds = seed.selectedContactIds ?? [];
  let selectedGroupIds = seed.selectedGroupIds ?? [];

  let signingPublicKey: KeyPair['publicKey'] | null = null;
  let ownedSecret: OwnedSecret | null = null;

  const snapshot = (): ContactsControllerState => ({
    book,
    pending,
    notice,
    me,
    cardText,
    identityQrUrl,
    selectedContactIds,
    selectedGroupIds,
  });

  const publish = () => deps.onChange(snapshot());

  const clearOwnedSecret = () => {
    ownedSecret?.dispose();
    ownedSecret = null;
    signingPublicKey = null;
  };

  const withIdentityKeyPair = async <T>(
    op: (keyPair: KeyPair) => T | Promise<T>,
  ): Promise<T | null> => {
    if (!signingPublicKey || !ownedSecret) return null;
    return withBorrowedKeyPair(ownedSecret, signingPublicKey, op);
  };

  const refreshIdentityCard = async () => {
    const invite = await withIdentityKeyPair(async (keyPair) => {
      if (!me.id) return null;
      return createIdentityInvite(
        { nick: me.nick || defaultNick(me.id) },
        keyPair,
      );
    });
    if (invite?.ok) {
      cardText = invite.value;
      identityQrUrl = await inviteToQr(invite.value);
      publish();
      return;
    }
    cardText = encodeContactCard(me);
    identityQrUrl = cardText ? await inviteToQr(cardText) : null;
    publish();
  };

  const persistBook = (): Promise<void> => {
    const opfs = deps.getOpfsStore();
    if (!opfs) return Promise.resolve();
    return (async () => {
      const saved = await saveAddressBook(opfs, book);
      if (!saved.ok) {
        notice = saved.message;
        publish();
      }
    })();
  };

  const applyPeerProfile = (card: ProfileCard) => {
    if (card.id === me.id) return;
    deps.setLivePeer(card.id, card.nick);
    deps.skippedPeers.delete(card.id);
    const known = findContact(book, card.id);
    book = upsertContact(book, card);
    pending = null;
    void persistBook();
    if (!known) {
      notice = contactsCopy.inBook(card.nick);
      deps.note(notes.contact(card.nick));
    }
    publish();
    deps.syncPresenceContacts();
  };

  /** After delete mid-call, put the live peer back into the book. */
  const ensureLivePeerInBook = () => {
    const id = deps.getLivePeerId();
    if (!id || id === me.id) return;
    deps.skippedPeers.delete(id);
    const known = findContact(book, id);
    if (!known) {
      const card = {
        id,
        nick: deps.getPeerNick() || defaultNick(id),
        avatar: '',
      };
      book = upsertContact(book, card);
      void persistBook();
      notice = contactsCopy.inBook(card.nick);
      deps.note(notes.contact(card.nick));
      deps.syncPresenceContacts();
    }
    if (selectedContactIds[0] !== id) {
      selectedContactIds = [id];
      selectedGroupIds = [];
    }
    publish();
  };

  const knockOn = async (ownerId: string, asHost: boolean) => {
    const known = findContact(book, ownerId);
    if (!deps.usesRoomLink()) {
      notice = knockBlockedNotice(known?.nick, deps.socketBlocked());
      publish();
      return;
    }
    const target = meetRoomId(ownerId);
    if (deps.peerIsLive() && deps.getRoomId() === target) {
      notice = knockAlreadyNotice(asHost, known?.nick);
      publish();
      return;
    }
    const next = deps.beginKnock(target);
    if (!next) return;
    notice = knockStartNotice(asHost, known?.nick);
    publish();
    await next.enterRoom(target);
    publish();
  };

  const onAcceptPending = () => {
    if (!pending) return;
    book = upsertContact(book, pending);
    notice = contactsCopy.inBook(pending.nick);
    deps.skippedPeers.delete(pending.id);
    pending = null;
    void persistBook();
    publish();
  };

  const onSkipPending = () => {
    if (pending) deps.skippedPeers.add(pending.id);
    pending = null;
    publish();
  };

  const onToggleContact = (id: string) => {
    selectedContactIds = selectedContactIds.includes(id)
      ? selectedContactIds.filter((item) => item !== id)
      : [...selectedContactIds, id];
    publish();
  };

  const onSelectContact = (id: string) => {
    selectedContactIds = [id];
    selectedGroupIds = [];
    publish();
  };

  const onToggleGroup = (id: string) => {
    selectedGroupIds = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter((item) => item !== id)
      : [...selectedGroupIds, id];
    publish();
  };

  const onBindIdentity = (
    fingerprint: string,
    secret?: OwnedSecret,
    publicKey?: KeyPair['publicKey'],
  ) => {
    me = bindIdentityProfile(deps.storage, fingerprint);
    clearOwnedSecret();
    if (secret) {
      ownedSecret = secret;
      signingPublicKey = publicKey ?? null;
    }
    deps.onIdentityKeyPairChange(withIdentityKeyPair);
    deps.setPeerProfile(me);
    void refreshIdentityCard();
  };

  const onLockIdentity = () => {
    clearOwnedSecret();
    deps.onIdentityKeyPairChange(async () => null);
    publish();
  };

  const onSaveProfile = (nick: string) => {
    const nextNick = sanitizeNick(nick);
    if (!nextNick) {
      notice = contactsCopy.nickRules;
      publish();
      return;
    }
    me = saveProfile(deps.storage, {
      nick: nextNick,
      avatar: me.avatar,
    });
    deps.setPeerProfile(me);
    notice = contactsCopy.nickSaved;
    void refreshIdentityCard();
  };

  const onPickAvatar = (file: File) => {
    void (async () => {
      try {
        const avatar = await fileToAvatarDataUrl(file);
        if (!avatar) {
          notice = contactsCopy.avatarUnreadable;
          publish();
          return;
        }
        me = saveProfile(deps.storage, { nick: me.nick, avatar });
        deps.setPeerProfile(me);
        notice = contactsCopy.avatarSaved;
        void refreshIdentityCard();
      } catch {
        notice = contactsCopy.avatarUnreadable;
        publish();
      }
    })();
  };

  const onCopyCard = () => {
    void (async () => {
      await refreshIdentityCard();
      const ok = await deps.copyText(cardText);
      notice = ok ? contactsCopy.cardCopied : contactsCopy.cardCopyFailed;
      deps.note(ok ? notes.cardCopied : notes.cardCopyFailed);
      publish();
      if (ok) {
        await deps.startPresence();
        await knockOn(me.id, true);
      }
    })();
  };

  const onIntroduceContact = async (id: string): Promise<boolean> => {
    const contact = findContact(book, id);
    if (!contact) {
      notice = contactsCopy.introduceNotFound;
      publish();
      return false;
    }
    if (!contact.publicKey) {
      notice = contactsCopy.introduceNeedKey;
      publish();
      return false;
    }
    const subjectPk = decodePublicKey(contact.publicKey);
    if (!subjectPk.ok) {
      notice = contactsCopy.introduceFailed;
      publish();
      return false;
    }
    const encoded = await withIdentityKeyPair(async (keyPair) =>
      createIntroduceCard(
        {
          subjectPk: subjectPk.value,
          subjectNick: contact.nick || defaultNick(contact.id),
        },
        keyPair,
      ),
    );
    if (!encoded) {
      notice = contactsCopy.introduceNeedIdentity;
      publish();
      return false;
    }
    if (!encoded.ok) {
      notice = contactsCopy.introduceFailed;
      publish();
      return false;
    }
    const ok = await deps.copyText(encoded.value);
    notice = ok
      ? contactsCopy.introduceCopied(contactDisplayName(contact))
      : contactsCopy.cardCopyFailed;
    publish();
    return ok ?? false;
  };

  const onAddContact = async (text: string): Promise<boolean> => {
    const introduced = await importIntroduceCard(text);
    if (introduced.ok) {
      if (introduced.value.contact.id === me.id) {
        notice = contactsCopy.ownCard;
        publish();
        return false;
      }
      const id = introduced.value.contact.id;
      const previous = findContact(book, id);
      book = upsertContact(book, introduced.value.contact);
      if (!previous || contactTrustOf(previous) === 'unverified') {
        book = setContactTrust(book, id, 'introduced');
      }
      void persistBook();
      notice = contactsCopy.introduced(introduced.value.contact.nick);
      publish();
      deps.syncPresenceContacts();
      return true;
    }
    const invite = await parseIdentityInvite(text);
    if (invite.ok) {
      if (invite.value.id === me.id) {
        notice = contactsCopy.ownCard;
        publish();
        return false;
      }
      book = upsertContact(book, {
        id: invite.value.id,
        nick: invite.value.nick,
        avatar: '',
        publicKey: invite.value.publicKey,
      });
      void persistBook();
      notice = contactsCopy.inBook(invite.value.nick);
      publish();
      deps.syncPresenceContacts();
      return true;
    }
    const card = parseContactCard(text);
    if (!card) {
      notice = contactsCopy.pasteCard;
      publish();
      return false;
    }
    if (card.id === me.id) {
      notice = contactsCopy.ownCard;
      publish();
      return false;
    }
    book = upsertContact(book, card);
    void persistBook();
    notice = contactsCopy.inBook(card.nick);
    publish();
    deps.syncPresenceContacts();
    return true;
  };

  const onRenameAlias = (id: string, alias: string) => {
    book = setContactAlias(book, id, alias);
    void persistBook();
    notice = contactsCopy.aliasSaved;
    publish();
  };

  const onSetContactTrust = (id: string, trust: ContactTrust) => {
    book = setContactTrust(book, id, trust);
    void persistBook();
    notice =
      trust === 'met' ? contactsCopy.trustMetSaved : contactsCopy.trustCleared;
    publish();
  };

  const onRemoveContact = (id: string) => {
    book = removeContact(book, id);
    selectedContactIds = selectedContactIds.filter((item) => item !== id);
    deps.skippedPeers.delete(id);
    notice = contactsCopy.removed;
    void persistBook();
    publish();
    deps.syncPresenceContacts();
  };

  const onSaveGroup = (name: string, memberIds: string[]) => {
    const label = sanitizeNick(name);
    if (!label || memberIds.length === 0) {
      notice = contactsCopy.groupNeedMembers;
      publish();
      return;
    }
    book = {
      ...book,
      groups: [...book.groups, createGroup(label, memberIds)],
    };
    notice = contactsCopy.groupSaved(label);
    void persistBook();
    publish();
  };

  const onRemoveGroup = (id: string) => {
    book = {
      ...book,
      groups: book.groups.filter((group) => group.id !== id),
    };
    selectedGroupIds = selectedGroupIds.filter((item) => item !== id);
    notice = contactsCopy.groupRemoved;
    void persistBook();
    publish();
  };

  const onCopyId = () => {
    void (async () => {
      const ok = await deps.copyText(me.id);
      deps.note(ok ? notes.idCopied : notes.idCopyFailed);
      publish();
    })();
  };

  const seedDemoContacts = async () => {
    if (!deps.getOpfsStore()) return;
    const demos: ProfileCard[] = [
      { id: 'a11a11a11a11a11a', nick: 'Анна', avatar: '' },
      { id: 'b22b22b22b22b22b', nick: 'Борис', avatar: '' },
      { id: 'c33c33c33c33c33c', nick: 'Вика', avatar: '' },
      { id: 'd44d44d44d44d44d', nick: 'Дима', avatar: '' },
      { id: 'e55e55e55e55e55e', nick: 'Лена', avatar: '' },
    ];
    let changed = false;
    for (const demo of demos) {
      if (demo.id === me.id) continue;
      if (findContact(book, demo.id)) continue;
      book = upsertContact(book, demo);
      changed = true;
    }
    if (!changed) return;
    await persistBook();
    publish();
  };

  return {
    getState: snapshot,
    persistBook,
    applyPeerProfile,
    ensureLivePeerInBook,
    knockOn,
    onAcceptPending,
    onSkipPending,
    onToggleContact,
    onSelectContact,
    onToggleGroup,
    onBindIdentity,
    onLockIdentity,
    onSaveProfile,
    onPickAvatar,
    onCopyCard,
    onAddContact,
    onIntroduceContact,
    onRenameAlias,
    onSetContactTrust,
    onRemoveContact,
    onSaveGroup,
    onRemoveGroup,
    onCopyId,
    seedDemoContacts,
    withIdentityKeyPair,
  };
}

export type ContactsController = ReturnType<typeof createContactsController>;
