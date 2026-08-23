import { browserStorage, resolveServers } from '@/config/index.ts';
import { createIdleSession } from '@/domain/index.ts';
import { meetRoomId } from '@/domain/profile.ts';
import { Application } from '@/lib/application.ts';
import { formatStatusLine, buildStatusLineView } from '@/ui/status-line.ts';
import type { TransferViewState } from '@/ui/transfer-status.ts';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { createNocloudContext } from './nocloud/context.ts';
import { createContactsSlice } from './nocloud/contacts.ts';
import { createServersSlice } from './nocloud/servers.ts';
import { createSessionSlice } from './nocloud/session.ts';
import { createShellSlice } from './nocloud/shell.ts';
import { createNocloudState, createNote } from './nocloud/state.ts';
import {
  contactsState,
  inboxState,
  inviteState,
  logsState,
  peerIsLive,
  shareUrlNow,
  transferState,
  usesRoomLink,
} from './nocloud/views.ts';
import type { ServerReachStatus } from '@/ui/status-line.ts';
import type {
  ContactsState,
  InboxState,
  InviteState,
  LogsState,
} from './types.ts';

export const useNocloudStore = defineStore('nocloud', () => {
  const storage = browserStorage();
  const app = new Application({ storage });
  const origin = globalThis.location?.origin;
  const skippedPeers = new Set<string>();
  const peerRevision = ref(0);
  const touch = () => {
    peerRevision.value++;
  };

  const state = createNocloudState(storage);
  const note = createNote(state);
  const ctx = createNocloudContext(
    state,
    app,
    storage,
    origin,
    skippedPeers,
    peerRevision,
    touch,
    note,
  );

  const servers = createServersSlice(ctx);
  const contacts = createContactsSlice(ctx);
  const session = createSessionSlice(ctx, servers.shareDraftForInvite);
  const shell = createShellSlice(ctx);

  ctx.refs.startPeer = session.startPeer;
  ctx.refs.applyPeerProfile = contacts.applyPeerProfile;
  ctx.refs.applyShareDraft = servers.applyShareDraft;
  ctx.refs.probeAndMark = servers.probeAndMark;
  ctx.refs.refreshInbox = session.refreshInbox;
  ctx.refs.refreshOutgoing = session.refreshOutgoing;
  ctx.refs.flushQueue = session.flushQueue;
  ctx.refs.applyIncoming = session.applyIncoming;
  ctx.refs.resumeMeetRoom = session.resumeMeetRoom;
  ctx.refs.consumeDeepLink = session.consumeDeepLink;
  ctx.refs.queueFile = session.queueFile;
  ctx.refs.knockOn = contacts.knockOn;
  ctx.refs.copyText = session.copyText;
  ctx.refs.seedDemoContacts = contacts.seedDemoContacts;

  const trackRevision = () => {
    void peerRevision.value;
  };

  const resolved = computed(() => {
    trackRevision();
    return resolveServers(state.settings, origin);
  });

  const sessionView = computed(() => {
    trackRevision();
    return state.peer?.session ?? createIdleSession();
  });

  const shareUrl = computed(() => {
    trackRevision();
    return shareUrlNow(ctx);
  });

  const inbox = computed((): InboxState => {
    trackRevision();
    return inboxState(ctx);
  });

  const invite = computed((): InviteState => {
    trackRevision();
    return inviteState(ctx);
  });

  const transfer = computed((): TransferViewState => {
    trackRevision();
    return transferState(ctx);
  });

  const contactsView = computed((): ContactsState => {
    trackRevision();
    return contactsState(ctx);
  });

  const logs = computed((): LogsState => {
    trackRevision();
    return logsState(ctx);
  });

  const contactsWaiting = computed(() => {
    trackRevision();
    return peerIsLive(ctx) && state.roomId === meetRoomId(state.me.id);
  });

  const hasSignalingSocket = computed(() => {
    trackRevision();
    return usesRoomLink(ctx);
  });

  const serverReach = computed((): ServerReachStatus => {
    trackRevision();
    if (!usesRoomLink(ctx)) return 'none';
    const active = state.savedServers.find(
      (item) => item.id === state.activeServerId,
    );
    if (active) return active.reach;
    return state.manualReach;
  });

  const statusLine = computed(() => {
    trackRevision();
    return formatStatusLine({
      online: app.online,
      session: sessionView.value.state,
      ice: invite.value.ice,
      pongMs: invite.value.lastPongMs,
      peerNick: state.peerNick,
      hasSocket: usesRoomLink(ctx),
      peerLive: peerIsLive(ctx),
      serverReach: serverReach.value,
    });
  });

  const status = computed(() => {
    trackRevision();
    return buildStatusLineView({
      online: app.online,
      session: sessionView.value.state,
      ice: invite.value.ice,
      pongMs: invite.value.lastPongMs,
      peerNick: state.peerNick,
      hasSocket: usesRoomLink(ctx),
      peerLive: peerIsLive(ctx),
      serverReach: serverReach.value,
    });
  });

  const online = computed(() => app.online);
  const canInstall = computed(() => app.canInstall);
  const clientId = computed(() => app.clientId);
  const peerNick = computed(() => {
    trackRevision();
    return state.peerNick;
  });

  return {
    peerRevision,
    state,
    resolved,
    session: sessionView,
    shareUrl,
    inbox,
    invite,
    transfer,
    contacts: contactsView,
    logs,
    contactsWaiting,
    hasSignalingSocket,
    statusLine,
    status,
    online,
    canInstall,
    clientId,
    peerNick,
    init: shell.init,
    onPreset: servers.onPreset,
    onSaveCustom: servers.onSaveCustom,
    onSaveCustomToList: servers.onSaveCustomToList,
    seedDemoServers: servers.seedDemoServers,
    onSelectSavedServer: servers.onSelectSavedServer,
    onRemoveSavedServer: servers.onRemoveSavedServer,
    onProbeSavedServer: servers.onProbeSavedServer,
    onProbeDraft: servers.onProbeDraft,
    onCopyText: servers.onCopyText,
    onInstall: shell.onInstall,
    onCheckUpdate: shell.onCheckUpdate,
    onClearLogs: shell.onClearLogs,
    onSaveHost: servers.onSaveHost,
    onCopyHostScript: servers.onCopyHostScript,
    onApplySharePack: servers.onApplySharePack,
    onScanSharePack: servers.onScanSharePack,
    onShareWithPeer: servers.onShareWithPeer,
    onCreateInvite: session.onCreateInvite,
    onJoin: session.onJoin,
    onApplyPaste: session.onApplyPaste,
    onShareLink: session.onShareLink,
    onShareRoom: session.onShareRoom,
    onCopyShareUrl: session.onCopyShareUrl,
    onPasteLink: session.onPasteLink,
    onCopyId: contacts.onCopyId,
    onAcceptPending: contacts.onAcceptPending,
    onSkipPending: contacts.onSkipPending,
    onToggleContact: contacts.onToggleContact,
    onSelectContact: contacts.onSelectContact,
    onToggleGroup: contacts.onToggleGroup,
    onSaveProfile: contacts.onSaveProfile,
    onPickAvatar: contacts.onPickAvatar,
    onCopyCard: contacts.onCopyCard,
    onAddContact: contacts.onAddContact,
    onRemoveContact: contacts.onRemoveContact,
    onSaveGroup: contacts.onSaveGroup,
    onRemoveGroup: contacts.onRemoveGroup,
    seedDemoContacts: contacts.seedDemoContacts,
    onCopy: session.onCopy,
    onPing: session.onPing,
    onPickFile: session.onPickFile,
    onPickFiles: session.onPickFiles,
    onPickFolder: session.onPickFolder,
    onClearStaged: session.onClearStaged,
    onPickError: session.onPickError,
    onSendTransfer: session.onSendTransfer,
    onAcceptFile: session.onAcceptFile,
    onRejectFile: session.onRejectFile,
    onCancelFile: session.onCancelFile,
    onPauseFile: session.onPauseFile,
    onResumeFile: session.onResumeFile,
    onRead: session.onRead,
    onRemove: session.onRemove,
    onSelect: session.onSelect,
  };
});
