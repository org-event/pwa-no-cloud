import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import {
  bindNocloudPorts,
  createNocloudPortsBag,
  type CallPort,
  type ChatPort,
  type ContactsPort,
  type PresencePort,
  type ServersPort,
  type SessionPort,
  type TransferStorePort,
} from './ports.ts';

describe('NocloudPorts', () => {
  it('bindNocloudPorts merges facades without wiping late identity key', () => {
    const bag = createNocloudPortsBag();
    const withIdentityKeyPair = vi.fn(async () => null);
    bag.contacts.withIdentityKeyPair = withIdentityKeyPair;

    const call: CallPort = {
      onRemoteTrack: vi.fn(),
      onIncomingCall: () => true,
      onCallPeerError: vi.fn(),
    };
    const chat: ChatPort = { onIncomingChatWire: vi.fn() };
    const session: SessionPort = fromPartial({
      startPeer: () => null,
      copyText: async () => true,
    });
    const transfer: TransferStorePort = {
      flushQueue: vi.fn(),
      queueFile: vi.fn(),
      refreshInbox: async () => {},
    };
    const contacts: Omit<ContactsPort, 'withIdentityKeyPair'> = {
      applyPeerProfile: vi.fn(),
      ensureLivePeerInBook: vi.fn(),
      knockOn: async () => {},
      seedDemoContacts: () => {},
    };
    const presence: PresencePort = {
      startPresence: async () => true,
      syncPresenceContacts: vi.fn(),
      ensurePresenceActive: async () => {},
      resumePresence: async () => {},
    };
    const servers: ServersPort = {
      applyShareDraft: vi.fn(),
      probeAndMark: async () => {},
      refreshRelayBundleFrom: async () => false,
      failoverRelay: () => false,
    };

    bindNocloudPorts(bag, {
      call,
      chat,
      session,
      transfer,
      contacts,
      presence,
      servers,
    });

    expect(bag.call.onRemoteTrack).toBe(call.onRemoteTrack);
    expect(bag.contacts.knockOn).toBe(contacts.knockOn);
    expect(bag.contacts.withIdentityKeyPair).toBe(withIdentityKeyPair);
    expect(bag.transfer.flushQueue).toBe(transfer.flushQueue);
  });
});
