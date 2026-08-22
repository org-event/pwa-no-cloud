import {
  DEFAULT_ROOM,
  browserStorage,
  loadUserSettings,
  resolveServers,
  saveUserSettings,
} from './config/index.ts';
import { createIdleSession } from './domain/index.ts';
import { Application } from './lib/application.ts';
import { formatIceReport } from './lib/ice.ts';
import type { InboxEntry, OpfsStore } from './lib/opfs.ts';
import {
  appendLog,
  listInbox,
  openStore,
  readInboxFile,
  removeInboxFile,
  writeFixture,
} from './lib/opfs.ts';
import { requestPersist } from './lib/quota.ts';
import { PeerSession } from './lib/peer-session.ts';
import { inviteToQr } from './lib/qr.ts';
import { createSignalingPort } from './lib/signaling/factory.ts';
import { mountApp } from './ui/app.ts';
import type { InboxState } from './ui/inbox.ts';
import type { InviteState } from './ui/invite.ts';
import type { PickedFile } from './lib/folder-walk.ts';
import type { TransferViewState } from './ui/transfer.ts';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('#app is missing');
}

const storage = browserStorage();
const app = new Application({ storage });
let settings = loadUserSettings(storage);
const origin = globalThis.location?.origin;
let store: OpfsStore | null = null;
let inboxItems: InboxEntry[] = [];
let selected: InboxEntry | null = null;
let preview = '';
let inboxError = '';
let peer: PeerSession | null = null;
let inviteRole: InviteState['role'] = 'idle';
let outgoing = '';
let qrUrl: string | null = null;
let inviteError = '';
let roomId = DEFAULT_ROOM;
let transferError = '';

const isManualSignaling = (): boolean => {
  const resolved = resolveServers(settings, origin);
  return !resolved.ok || resolved.value.signaling.kind === 'manual';
};

const inboxState = (): InboxState => ({
  items: inboxItems,
  selected,
  preview,
  error: inboxError,
  ready: store !== null,
});

const inviteState = (): InviteState => ({
  role: peer?.role && peer.role !== 'idle' ? peer.role : inviteRole,
  mode: isManualSignaling() ? 'manual' : 'room',
  open:
    inviteRole !== 'idle' ||
    Boolean(peer && peer.state !== 'idle' && peer.state !== 'closed'),
  outgoing,
  qrUrl,
  error: inviteError || (peer?.error ?? ''),
  connected: peer?.state === 'connected',
  lastPongMs: peer?.lastPongMs ?? null,
  ice: peer ? formatIceReport(peer.ice) : '',
});

const transferState = (): TransferViewState => ({
  connected: peer?.state === 'connected',
  current: peer?.activeFile() ?? null,
  incoming: peer?.incomingFile() ?? null,
  folder: peer?.activeFolder() ?? null,
  incomingFolder: peer?.incomingFolder() ?? null,
  error: transferError,
});

const currentState = () => ({
  session: peer?.session ?? createIdleSession(),
  settings,
  resolved: resolveServers(settings, origin),
  online: app.online,
  canInstall: app.canInstall,
  roomId,
  inbox: inboxState(),
  invite: inviteState(),
  transfer: transferState(),
});

const setInboxError = (message: string) => {
  inboxError = message;
  preview = '';
};

const refreshInbox = async () => {
  if (!store) return;
  const listed = await listInbox(store);
  if (!listed.ok) {
    setInboxError(listed.message);
    return;
  }
  inboxItems = listed.value;
  if (selected) {
    const key = `${selected.transferId}/${selected.name}`;
    let found: InboxEntry | null = null;
    for (const item of inboxItems) {
      if (`${item.transferId}/${item.name}` === key) found = item;
    }
    selected = found;
  }
};

const refreshOutgoing = async () => {
  outgoing = peer?.outgoing() ?? '';
  qrUrl = await inviteToQr(outgoing);
  view.sync(currentState());
};

const startPeer = (): PeerSession | null => {
  const resolved = resolveServers(settings, origin);
  if (!resolved.ok) {
    inviteError = resolved.message;
    view.sync(currentState());
    return null;
  }
  if (peer) peer.close();
  outgoing = '';
  qrUrl = null;
  inviteError = '';
  const next = new PeerSession({
    iceServers: resolved.value.iceServers,
    signaling: createSignalingPort(resolved.value.signaling),
  });
  next.on('state', () => view.sync(currentState()));
  next.on('invite', () => {
    void refreshOutgoing();
  });
  next.on('channel-open', () => view.sync(currentState()));
  next.on('ice', () => view.sync(currentState()));
  next.on('pong', () => view.sync(currentState()));
  next.on('error', (value) => {
    if (typeof value === 'string') transferError = value;
    view.sync(currentState());
  });
  next.on('transfer', () => view.sync(currentState()));
  next.on('file-offer', () => view.sync(currentState()));
  next.on('folder', () => view.sync(currentState()));
  next.on('folder-offer', () => view.sync(currentState()));
  next.on('file-received', () => {
    void (async () => {
      await refreshInbox();
      view.sync(currentState());
    })();
  });
  next.setStore(store);
  peer = next;
  return next;
};

const view = mountApp(root, {
  onPreset: (presetId) => {
    settings = { ...settings, presetId };
    saveUserSettings(settings, storage);
    view.sync(currentState());
  },
  onSaveCustom: (custom) => {
    settings = { presetId: 'custom', custom };
    saveUserSettings(settings, storage);
    view.sync(currentState());
  },
  onInstall: () => {
    void app.install();
  },
  onRoom: (value) => {
    roomId = value;
  },
  onCreateInvite: () => {
    void (async () => {
      inviteError = '';
      inviteRole = 'caller';
      const next = startPeer();
      if (!next) return;
      if (!isManualSignaling()) {
        await next.enterRoom(roomId.trim() || DEFAULT_ROOM);
        inviteRole = next.role;
        view.sync(currentState());
        return;
      }
      await next.createInvite();
      await refreshOutgoing();
    })();
  },
  onJoin: () => {
    inviteRole = 'callee';
    startPeer();
    view.sync(currentState());
  },
  onApplyPaste: (text) => {
    void (async () => {
      inviteError = '';
      if (!peer) {
        inviteRole = 'callee';
        if (!startPeer()) return;
      }
      const current = peer;
      if (!current) return;
      if (inviteRole === 'callee') {
        const accepted = await current.acceptInvite(text);
        if (!accepted.ok) inviteError = accepted.message;
        await refreshOutgoing();
        return;
      }
      const accepted = await current.acceptAnswer(text);
      if (!accepted.ok) inviteError = accepted.message;
      view.sync(currentState());
    })();
  },
  onCopy: () => {
    void (async () => {
      if (!outgoing || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(outgoing);
      } catch {
        inviteError = 'Не удалось скопировать';
        view.sync(currentState());
      }
    })();
  },
  onPing: () => {
    peer?.ping();
  },
  onPickFile: (file) => {
    transferError = '';
    peer?.sendFile(file);
    view.sync(currentState());
  },
  onPickFolder: (entries: PickedFile[]) => {
    transferError = '';
    peer?.sendFolder(entries);
    view.sync(currentState());
  },
  onPickError: (message) => {
    transferError = message;
    view.sync(currentState());
  },
  onAcceptFile: (transferId) => {
    transferError = '';
    peer?.acceptFile(transferId);
    view.sync(currentState());
  },
  onRejectFile: (transferId) => {
    peer?.rejectFile(transferId);
    view.sync(currentState());
  },
  onCancelFile: () => {
    peer?.cancelFile();
    view.sync(currentState());
  },
  onPauseFile: () => {
    peer?.pauseFile();
    view.sync(currentState());
  },
  onResumeFile: () => {
    peer?.resumeFile();
    view.sync(currentState());
  },
  onWriteFixture: () => {
    void (async () => {
      if (!store) return;
      const written = await writeFixture(store);
      if (!written.ok) {
        setInboxError(written.message);
        view.sync(currentState());
        return;
      }
      inboxError = '';
      selected = written.value;
      preview = '';
      await refreshInbox();
      view.sync(currentState());
    })();
  },
  onRead: (entry) => {
    void (async () => {
      if (!store) return;
      const text = await readInboxFile(store, entry.transferId, entry.name);
      if (!text.ok) {
        setInboxError(text.message);
        view.sync(currentState());
        return;
      }
      inboxError = '';
      preview = text.value;
      await appendLog(store, `read ${entry.transferId}/${entry.name}`);
      view.sync(currentState());
    })();
  },
  onRemove: (entry) => {
    void (async () => {
      if (!store) return;
      const removed = await removeInboxFile(
        store,
        entry.transferId,
        entry.name,
      );
      if (!removed.ok) {
        setInboxError(removed.message);
        view.sync(currentState());
        return;
      }
      inboxError = '';
      preview = '';
      await appendLog(store, `remove ${entry.transferId}/${entry.name}`);
      await refreshInbox();
      view.sync(currentState());
    })();
  },
  onSelect: (entry) => {
    selected = entry;
    preview = '';
    inboxError = '';
    view.sync(currentState());
  },
});

const redraw = () => view.sync(currentState());
app.on('network', redraw);
app.on('install', redraw);
app.on('installed', redraw);

const opened = await openStore();
if (opened.ok) {
  store = opened.value;
  void requestPersist();
  await refreshInbox();
} else {
  inboxError = opened.message;
}
redraw();
