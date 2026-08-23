import type { InboxEntry } from '@/lib/opfs.ts';
import type { AddressBook, ProfileCard } from '@/domain/profile.ts';

export type InviteRole = 'idle' | 'caller' | 'callee';

export type InboxState = {
  items: InboxEntry[];
  selected: InboxEntry | null;
  preview: string;
  error: string;
  ready: boolean;
};

export type InviteState = {
  role: InviteRole;
  mode: 'manual' | 'room';
  open: boolean;
  outgoing: string;
  qrUrl: string | null;
  error: string;
  connected: boolean;
  lastPongMs: number | null;
  ice: string;
  shareWithPeer: boolean;
  canShareServers: boolean;
};

export type LogsState = {
  text: string;
  error: string;
};

export type ContactsState = {
  me: ProfileCard;
  book: AddressBook;
  pending: ProfileCard | null;
  notice: string;
  cardText: string;
  waiting: boolean;
  connected: boolean;
  livePeerId: string | null;
  presenceAvailable: boolean;
  presenceOnlineIds: string[];
};
