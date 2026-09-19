import {
  createContactsController,
  type ContactsControllerState,
} from '@/lib/contacts-controller.ts';
import type { NocloudContext } from './context.ts';
import { peerIsLive, socketBlocked, usesRoomLink } from './views.ts';

export function createContactsSlice(ctx: NocloudContext) {
  const { state, storage, skippedPeers, touch, note } = ctx;

  const syncUi = (next: ContactsControllerState) => {
    state.book = next.book;
    state.pending = next.pending;
    state.contactsNotice = next.notice;
    state.me = next.me;
    state.cardText = next.cardText;
    state.identityQrUrl = next.identityQrUrl;
    state.selectedContactIds = next.selectedContactIds;
    state.selectedGroupIds = next.selectedGroupIds;
    touch();
  };

  const controller = createContactsController({
    storage,
    getOpfsStore: () => state.store,
    skippedPeers,
    copyText: async (text) => ctx.ports.session.copyText?.(text),
    note,
    syncPresenceContacts: () => {
      ctx.ports.presence.syncPresenceContacts?.();
    },
    startPresence: async () => {
      await ctx.ports.presence.startPresence?.();
    },
    setPeerProfile: (me) => {
      state.peer?.setProfile(me);
    },
    setLivePeer: (id, nick) => {
      state.livePeerId = id;
      state.peerNick = nick;
    },
    getLivePeerId: () => state.livePeerId,
    getPeerNick: () => state.peerNick,
    usesRoomLink: () => usesRoomLink(ctx),
    socketBlocked: () => socketBlocked(ctx),
    peerIsLive: () => peerIsLive(ctx),
    getRoomId: () => state.roomId,
    beginKnock: (roomId) => {
      state.openedFromLink = false;
      state.roomId = roomId;
      state.inviteRole = 'caller';
      return ctx.ports.session.startPeer?.() ?? null;
    },
    onIdentityKeyPairChange: (fn) => {
      ctx.ports.contacts.withIdentityKeyPair = fn;
    },
    onChange: syncUi,
    initial: {
      book: state.book,
      pending: state.pending,
      notice: state.contactsNotice,
      me: state.me,
      cardText: state.cardText,
      identityQrUrl: state.identityQrUrl,
      selectedContactIds: state.selectedContactIds,
      selectedGroupIds: state.selectedGroupIds,
    },
  });

  return {
    persistBook: controller.persistBook,
    applyPeerProfile: controller.applyPeerProfile,
    ensureLivePeerInBook: controller.ensureLivePeerInBook,
    knockOn: controller.knockOn,
    onAcceptPending: controller.onAcceptPending,
    onSkipPending: controller.onSkipPending,
    onToggleContact: controller.onToggleContact,
    onSelectContact: controller.onSelectContact,
    onToggleGroup: controller.onToggleGroup,
    onBindIdentity: controller.onBindIdentity,
    onLockIdentity: controller.onLockIdentity,
    onSaveProfile: controller.onSaveProfile,
    onPickAvatar: controller.onPickAvatar,
    onCopyCard: controller.onCopyCard,
    onAddContact: controller.onAddContact,
    onIntroduceContact: controller.onIntroduceContact,
    onRenameAlias: controller.onRenameAlias,
    onSetContactTrust: controller.onSetContactTrust,
    onRemoveContact: controller.onRemoveContact,
    onSaveGroup: controller.onSaveGroup,
    onRemoveGroup: controller.onRemoveGroup,
    onCopyId: controller.onCopyId,
    seedDemoContacts: controller.seedDemoContacts,
  };
}
