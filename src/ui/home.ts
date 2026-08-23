import {
  expandRecipients,
  type AddressBook,
  type ProfileCard,
} from '@/domain/profile.ts';
import { homeCopy } from '@/content/index.ts';

export type HomeState = {
  manual: boolean;
  hasTurn: boolean;
  me: ProfileCard;
  book: AddressBook;
  pending: ProfileCard | null;
  selectedContactIds: string[];
  selectedGroupIds: string[];
  peerNick: string;
  roomId: string;
  shareUrl: string;
  waiting: boolean;
  connected: boolean;
  queuedCount: number;
  role: 'idle' | 'caller' | 'callee';
  fromLink: boolean;
  error: string;
  socketBlocked: boolean;
};

export const formatHomeLead = (state: {
  manual: boolean;
  hasTurn: boolean;
  socketBlocked?: boolean;
}): string => {
  if (state.socketBlocked) return homeCopy.socketBlocked;
  if (state.manual) return homeCopy.manualMode;
  if (state.hasTurn) return homeCopy.hasTurn;
  return homeCopy.noTurn;
};

export const formatHomeWait = (state: {
  connected: boolean;
  waiting: boolean;
  queuedCount: number;
  role: 'idle' | 'caller' | 'callee';
  fromLink: boolean;
  peerNick?: string;
  shareUrl?: string;
}): string => {
  const withWho = state.peerNick ? homeCopy.withPeer(state.peerNick) : '';
  if (state.connected) {
    return state.queuedCount > 0
      ? homeCopy.connectedQueued(withWho)
      : homeCopy.connectedIdle(withWho);
  }
  if (state.waiting && state.fromLink) return homeCopy.openedFromLink;
  if (state.waiting && state.shareUrl) return homeCopy.shareUrlReady;
  if (state.waiting) return homeCopy.waitingPeer;
  if (state.queuedCount > 0) return homeCopy.fileQueued;
  return homeCopy.exchangeCards;
};

export const formatShareButton = (state: {
  contacts: { nick: string }[];
  groups: { name: string }[];
}): string => {
  if (state.contacts.length === 1 && state.groups.length === 0) {
    const nick = state.contacts[0]?.nick;
    return nick ? homeCopy.shareLinkFor(nick) : homeCopy.shareLink;
  }
  if (state.groups.length === 1 && state.contacts.length === 0) {
    const name = state.groups[0]?.name;
    return name ? homeCopy.shareLinkForGroup(name) : homeCopy.shareLink;
  }
  if (state.contacts.length + state.groups.length > 1) {
    return homeCopy.shareLinkForSelected;
  }
  return homeCopy.shareLink;
};

export const formatRecipientHint = (people: number): string => {
  if (people <= 1) return homeCopy.recipientHintSingle;
  return homeCopy.recipientHintMulti(people);
};

export { expandRecipients };
