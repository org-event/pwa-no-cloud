import { loadUserSettings } from '@/config/index.ts';
import type { UserSettings } from '@/config/types.ts';
import { EMPTY_TURN_HOST, type TurnHostDraft } from '@/domain/index.ts';
import type { SavedServer, ServerReach } from '@/domain/saved-server.ts';
import {
  EMPTY_BOOK,
  encodeContactCard,
  type AddressBook,
  type ProfileCard,
} from '@/domain/profile.ts';
import type { InboxEntry, OpfsStore } from '@/lib/opfs.ts';
import { appendLog } from '@/lib/opfs.ts';
import type { PickedFile } from '@/lib/folder-walk.ts';
import { loadProfile } from '@/lib/profile-store.ts';
import { PeerSession } from '@/lib/peer-session.ts';
import type { StorageLike } from '@/config/storage.ts';
import type { InviteRole } from '@/stores/types.ts';
import { reactive } from 'vue';

export type NocloudState = {
  settings: UserSettings;
  store: OpfsStore | null;
  inboxItems: InboxEntry[];
  selected: InboxEntry | null;
  preview: string;
  inboxError: string;
  peer: PeerSession | null;
  inviteRole: InviteRole;
  outgoing: string;
  qrUrl: string | null;
  inviteError: string;
  roomId: string;
  transferError: string;
  hostDraft: TurnHostDraft;
  hostNotice: string;
  savedServers: SavedServer[];
  activeServerId: string | null;
  manualReach: ServerReach;
  shareWithPeer: boolean;
  queuedFiles: File[];
  queuedFolder: PickedFile[] | null;
  queuedFolderLabel: string;
  openedFromLink: boolean;
  logText: string;
  logError: string;
  lastLoggedState: string;
  me: ProfileCard;
  book: AddressBook;
  pending: ProfileCard | null;
  contactsNotice: string;
  selectedContactIds: string[];
  selectedGroupIds: string[];
  peerNick: string;
  livePeerId: string | null;
  presenceAvailable: boolean;
  presenceOnlineIds: string[];
  cardText: string;
  updateChecking: boolean;
  updateNotice: string;
};

export const LOG_CAP = 80_000;

export function createNocloudState(storage: StorageLike) {
  const me = loadProfile(storage);
  return reactive({
    settings: loadUserSettings(storage),
    store: null as OpfsStore | null,
    inboxItems: [] as InboxEntry[],
    selected: null as InboxEntry | null,
    preview: '',
    inboxError: '',
    peer: null as PeerSession | null,
    inviteRole: 'idle' as InviteRole,
    outgoing: '',
    qrUrl: null as string | null,
    inviteError: '',
    roomId: '',
    transferError: '',
    hostDraft: { ...EMPTY_TURN_HOST },
    hostNotice: '',
    savedServers: [] as SavedServer[],
    activeServerId: null as string | null,
    manualReach: 'unknown' as ServerReach,
    shareWithPeer: true,
    queuedFiles: [] as File[],
    queuedFolder: null as PickedFile[] | null,
    queuedFolderLabel: '',
    openedFromLink: false,
    logText: '',
    logError: '',
    lastLoggedState: '',
    me,
    book: { ...EMPTY_BOOK } as AddressBook,
    pending: null as ProfileCard | null,
    contactsNotice: '',
    selectedContactIds: [] as string[],
    selectedGroupIds: [] as string[],
    peerNick: '',
    livePeerId: null as string | null,
    presenceAvailable: false,
    presenceOnlineIds: [] as string[],
    cardText: encodeContactCard(me),
    updateChecking: false,
    updateNotice: '',
  }) as NocloudState;
}

export function createNote(state: NocloudState) {
  return (line: string) => {
    const stamp = new Date().toISOString().slice(11, 19);
    const row = `${stamp} ${line}`;
    state.logText = state.logText ? `${state.logText}${row}\n` : `${row}\n`;
    if (state.logText.length > LOG_CAP) {
      state.logText = state.logText.slice(state.logText.length - LOG_CAP);
    }
    if (state.store) void appendLog(state.store, row);
  };
}
