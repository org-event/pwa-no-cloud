import {
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
import { PeerSession } from './lib/peer-session.ts';
import { inviteToQr } from './lib/qr.ts';
import { createManualPort } from './lib/signaling/manual.ts';
import { mountApp } from './ui/app.ts';
import type { InboxState } from './ui/inbox.ts';
import type { InviteState } from './ui/invite.ts';
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

const inboxState = (): InboxState => ({
  items: inboxItems,
  selected,
  preview,
  error: inboxError,
  ready: store !== null,
});

const inviteState = (): InviteState => ({
  role: inviteRole,
  outgoing,
  qrUrl,
  error: inviteError || (peer?.error ?? ''),
  connected: peer?.state === 'connected',
  lastPongMs: peer?.lastPongMs ?? null,
  ice: peer ? formatIceReport(peer.ice) : '',
});

const currentState = () => ({
  session: peer?.session ?? createIdleSession(),
  settings,
  resolved: resolveServers(settings, origin),
  online: app.online,
  canInstall: app.canInstall,
  inbox: inboxState(),
  invite: inviteState(),
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
    signaling: createManualPort(),
  });
  next.on('state', () => view.sync(currentState()));
  next.on('invite', () => {
    void refreshOutgoing();
  });
  next.on('channel-open', () => view.sync(currentState()));
  next.on('ice', () => view.sync(currentState()));
  next.on('pong', () => view.sync(currentState()));
  next.on('error', () => view.sync(currentState()));
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
  onCreateInvite: () => {
    void (async () => {
      inviteError = '';
      inviteRole = 'caller';
      const next = startPeer();
      if (!next) return;
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
  await refreshInbox();
} else {
  inboxError = opened.message;
}
redraw();
