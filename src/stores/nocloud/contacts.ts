import {
  contactsCopy,
  knockAlreadyNotice,
  knockBlockedNotice,
  knockStartNotice,
  notes,
} from '@/content/index.ts';
import {
  defaultNick,
  encodeContactCard,
  findContact,
  meetRoomId,
  parseContactCard,
  removeContact,
  sanitizeNick,
  upsertContact,
  type ProfileCard,
} from '@/domain/profile.ts';
import { fileToAvatarDataUrl } from '@/lib/avatar.ts';
import { createGroup, saveAddressBook } from '@/lib/contacts-store.ts';
import { saveProfile } from '@/lib/profile-store.ts';
import type { NocloudContext } from './context.ts';
import { peerIsLive, socketBlocked, usesRoomLink } from './views.ts';

export function createContactsSlice(ctx: NocloudContext) {
  const { state, storage, skippedPeers, touch, note } = ctx;

  const persistBook = (): Promise<void> => {
    const opfs = state.store;
    if (!opfs) return Promise.resolve();
    return (async () => {
      const saved = await saveAddressBook(opfs, state.book);
      if (!saved.ok) {
        state.contactsNotice = saved.message;
        touch();
      }
    })();
  };

  const applyPeerProfile = (card: ProfileCard) => {
    if (card.id === state.me.id) return;
    state.peerNick = card.nick;
    state.livePeerId = card.id;
    // Skip was “not now” — a live channel / transfer re-opens the door.
    skippedPeers.delete(card.id);
    const known = findContact(state.book, card.id);
    state.book = upsertContact(state.book, card);
    state.pending = null;
    void persistBook();
    if (!known) {
      state.contactsNotice = contactsCopy.inBook(card.nick);
      note(notes.contact(card.nick));
    }
    touch();
    ctx.refs.syncPresenceContacts?.();
  };

  /** After delete mid-call, put the live peer back into the book. */
  const ensureLivePeerInBook = () => {
    const id = state.livePeerId;
    if (!id || id === state.me.id) return;
    skippedPeers.delete(id);
    const known = findContact(state.book, id);
    if (!known) {
      const card = {
        id,
        nick: state.peerNick || defaultNick(id),
        avatar: '',
      };
      state.book = upsertContact(state.book, card);
      void persistBook();
      state.contactsNotice = contactsCopy.inBook(card.nick);
      note(notes.contact(card.nick));
      ctx.refs.syncPresenceContacts?.();
    }
    if (state.selectedContactIds[0] !== id) {
      state.selectedContactIds = [id];
      state.selectedGroupIds = [];
    }
    touch();
  };

  const knockOn = async (ownerId: string, asHost: boolean) => {
    const known = findContact(state.book, ownerId);
    if (!usesRoomLink(ctx)) {
      state.contactsNotice = knockBlockedNotice(
        known?.nick,
        socketBlocked(ctx),
      );
      touch();
      return;
    }
    const target = meetRoomId(ownerId);
    if (peerIsLive(ctx) && state.roomId === target) {
      state.contactsNotice = knockAlreadyNotice(asHost, known?.nick);
      touch();
      return;
    }
    state.openedFromLink = false;
    state.roomId = target;
    state.inviteRole = 'caller';
    const next = ctx.refs.startPeer?.();
    if (!next) return;
    state.contactsNotice = knockStartNotice(asHost, known?.nick);
    touch();
    await next.enterRoom(target);
    touch();
  };

  function onAcceptPending() {
    if (!state.pending) return;
    state.book = upsertContact(state.book, state.pending);
    state.contactsNotice = contactsCopy.inBook(state.pending.nick);
    skippedPeers.delete(state.pending.id);
    state.pending = null;
    void persistBook();
    touch();
  }

  function onSkipPending() {
    if (state.pending) skippedPeers.add(state.pending.id);
    state.pending = null;
    touch();
  }

  function onToggleContact(id: string) {
    state.selectedContactIds = state.selectedContactIds.includes(id)
      ? state.selectedContactIds.filter((item) => item !== id)
      : [...state.selectedContactIds, id];
    touch();
  }

  function onSelectContact(id: string) {
    state.selectedContactIds = [id];
    state.selectedGroupIds = [];
    touch();
  }

  function onToggleGroup(id: string) {
    state.selectedGroupIds = state.selectedGroupIds.includes(id)
      ? state.selectedGroupIds.filter((item) => item !== id)
      : [...state.selectedGroupIds, id];
    touch();
  }

  function onSaveProfile(nick: string) {
    const nextNick = sanitizeNick(nick);
    if (!nextNick) {
      state.contactsNotice = contactsCopy.nickRules;
      touch();
      return;
    }
    state.me = saveProfile(storage, {
      nick: nextNick,
      avatar: state.me.avatar,
    });
    state.cardText = encodeContactCard(state.me);
    state.peer?.setProfile(state.me);
    state.contactsNotice = contactsCopy.nickSaved;
    touch();
  }

  function onPickAvatar(file: File) {
    void (async () => {
      try {
        const avatar = await fileToAvatarDataUrl(file);
        if (!avatar) {
          state.contactsNotice = contactsCopy.avatarUnreadable;
          touch();
          return;
        }
        state.me = saveProfile(storage, { nick: state.me.nick, avatar });
        state.cardText = encodeContactCard(state.me);
        state.peer?.setProfile(state.me);
        state.contactsNotice = contactsCopy.avatarSaved;
        touch();
      } catch {
        state.contactsNotice = contactsCopy.avatarUnreadable;
        touch();
      }
    })();
  }

  function onCopyCard() {
    void (async () => {
      state.cardText = encodeContactCard(state.me);
      const ok = await ctx.refs.copyText?.(state.cardText);
      state.contactsNotice = ok
        ? contactsCopy.cardCopied
        : contactsCopy.cardCopyFailed;
      note(ok ? notes.cardCopied : notes.cardCopyFailed);
      touch();
      // Publish lobby presence; keep waiting for WebRTC guests too.
      if (ok) {
        await ctx.refs.startPresence?.();
        await knockOn(state.me.id, true);
      }
    })();
  }

  function onAddContact(text: string) {
    const card = parseContactCard(text);
    if (!card) {
      state.contactsNotice = contactsCopy.pasteCard;
      touch();
      return false;
    }
    if (card.id === state.me.id) {
      state.contactsNotice = contactsCopy.ownCard;
      touch();
      return false;
    }
    state.book = upsertContact(state.book, card);
    void persistBook();
    state.contactsNotice = contactsCopy.inBook(card.nick);
    touch();
    ctx.refs.syncPresenceContacts?.();
    return true;
  }

  function onRemoveContact(id: string) {
    state.book = removeContact(state.book, id);
    state.selectedContactIds = state.selectedContactIds.filter(
      (item) => item !== id,
    );
    skippedPeers.delete(id);
    state.contactsNotice = contactsCopy.removed;
    void persistBook();
    touch();
    ctx.refs.syncPresenceContacts?.();
  }

  function onSaveGroup(name: string, memberIds: string[]) {
    const label = sanitizeNick(name);
    if (!label || memberIds.length === 0) {
      state.contactsNotice = contactsCopy.groupNeedMembers;
      touch();
      return;
    }
    state.book = {
      ...state.book,
      groups: [...state.book.groups, createGroup(label, memberIds)],
    };
    state.contactsNotice = contactsCopy.groupSaved(label);
    void persistBook();
    touch();
  }

  function onRemoveGroup(id: string) {
    state.book = {
      ...state.book,
      groups: state.book.groups.filter((group) => group.id !== id),
    };
    state.selectedGroupIds = state.selectedGroupIds.filter(
      (item) => item !== id,
    );
    state.contactsNotice = contactsCopy.groupRemoved;
    void persistBook();
    touch();
  }

  function onCopyId() {
    void (async () => {
      const ok = await ctx.refs.copyText?.(state.me.id);
      note(ok ? notes.idCopied : notes.idCopyFailed);
      touch();
    })();
  }

  async function seedDemoContacts() {
    if (!state.store) return;
    const demos: ProfileCard[] = [
      { id: 'demoanna01xx', nick: 'Анна', avatar: '' },
      { id: 'demoboris02y', nick: 'Борис', avatar: '' },
      { id: 'demovika03zz', nick: 'Вика', avatar: '' },
      { id: 'demodima04ww', nick: 'Дима', avatar: '' },
      { id: 'demolena05vv', nick: 'Лена', avatar: '' },
    ];
    let changed = false;
    for (const demo of demos) {
      if (demo.id === state.me.id) continue;
      if (findContact(state.book, demo.id)) continue;
      state.book = upsertContact(state.book, demo);
      changed = true;
    }
    if (!changed) return;
    await persistBook();
    touch();
  }

  return {
    persistBook,
    applyPeerProfile,
    ensureLivePeerInBook,
    knockOn,
    onAcceptPending,
    onSkipPending,
    onToggleContact,
    onSelectContact,
    onToggleGroup,
    onSaveProfile,
    onPickAvatar,
    onCopyCard,
    onAddContact,
    onRemoveContact,
    onSaveGroup,
    onRemoveGroup,
    onCopyId,
    seedDemoContacts,
  };
}
