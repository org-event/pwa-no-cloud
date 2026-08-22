import {
  APP_NAME,
  DEFAULT_ROOM,
  browserStorage,
  createUserSettings,
  decodeSharePack,
  iceOnlyShare,
  iceServersHaveTurn,
  loadUserSettings,
  resolveServers,
  saveUserSettings,
} from './config/index.ts';
import type { CustomServerDraft } from './config/types.ts';
import {
  EMPTY_TURN_HOST,
  createIdleSession,
  type TurnHostDraft,
} from './domain/index.ts';
import { Application } from './lib/application.ts';
import {
  cleanLocation,
  encodeHttpsLink,
  encodeProtocolLink,
  parseDeepLink,
  shareMessage,
  type DeepKind,
  type DeepLink,
} from './lib/app-link.ts';
import { formatIceReport } from './lib/ice.ts';
import type { InboxEntry, OpfsStore } from './lib/opfs.ts';
import {
  appendLog,
  listInbox,
  openStore,
  readAppLog,
  readInboxFile,
  removeInboxFile,
  writeFixture,
} from './lib/opfs.ts';
import { notifyFileReceived, requestNotifyPermission } from './lib/notify.ts';
import { requestPersist } from './lib/quota.ts';
import { filesFromShare } from './lib/share.ts';
import { loadTurnHost, saveTurnHost } from './lib/turn-host-store.ts';
import { PeerSession } from './lib/peer-session.ts';
import { inviteToQr } from './lib/qr.ts';
import { canScanQr, decodeQrFromFile } from './lib/scan-qr.ts';
import { createSignalingPort } from './lib/signaling/factory.ts';
import { decodeInvite } from './lib/signaling/invite.ts';
import { APP_BASE } from './workers/sw.ts';
import { mountApp } from './ui/app.ts';
import type { InboxState } from './ui/inbox.ts';
import type { InviteState } from './ui/invite.ts';
import type { LogsState } from './ui/logs.ts';
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
let hostDraft: TurnHostDraft = { ...EMPTY_TURN_HOST };
let hostNotice = '';
let shareWithPeer = true;
let queuedFiles: File[] = [];
let logText = '';
let logError = '';
let lastLoggedState = '';

const LOG_CAP = 80_000;

const note = (line: string) => {
  const stamp = new Date().toISOString().slice(11, 19);
  const row = `${stamp} ${line}`;
  logText = logText ? `${logText}${row}\n` : `${row}\n`;
  if (logText.length > LOG_CAP) {
    logText = logText.slice(logText.length - LOG_CAP);
  }
  if (store) void appendLog(store, row);
};

const logsState = (): LogsState => ({
  text: logText,
  error: logError,
});

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
  shareWithPeer,
  canShareServers: (() => {
    const resolved = resolveServers(settings, origin);
    return resolved.ok && iceServersHaveTurn(resolved.value.iceServers);
  })(),
});

const transferState = (): TransferViewState => ({
  connected: peer?.state === 'connected',
  current: peer?.activeFile() ?? null,
  incoming: peer?.incomingFile() ?? null,
  folder: peer?.activeFolder() ?? null,
  incomingFolder: peer?.incomingFolder() ?? null,
  queuedNames: queuedFiles.map((file) => file.name),
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
  host: hostDraft,
  hostNotice,
  logs: logsState(),
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

const applyShareDraft = (draft: CustomServerDraft, notice: string) => {
  settings = createUserSettings('custom', draft);
  saveUserSettings(settings, storage);
  hostNotice = notice;
};

const shareDraftForInvite = (): CustomServerDraft | null => {
  if (!shareWithPeer) return null;
  const resolved = resolveServers(settings, origin);
  if (!resolved.ok) return null;
  if (!iceServersHaveTurn(resolved.value.iceServers)) return null;
  return iceOnlyShare(resolved.value.iceServers);
};

const startPeer = (): PeerSession | null => {
  const resolved = resolveServers(settings, origin);
  if (!resolved.ok) {
    inviteError = resolved.message;
    note(`серверы: ${resolved.message}`);
    view.sync(currentState());
    return null;
  }
  if (peer) peer.close();
  outgoing = '';
  qrUrl = null;
  inviteError = '';
  lastLoggedState = '';
  const next = new PeerSession({
    iceServers: resolved.value.iceServers,
    signaling: createSignalingPort(resolved.value.signaling),
    shareServers: shareDraftForInvite(),
  });
  next.on('state', () => {
    const label = next.session.state;
    if (label !== lastLoggedState) {
      lastLoggedState = label;
      note(`сессия ${label}`);
    }
    view.sync(currentState());
  });
  next.on('invite', () => {
    void refreshOutgoing();
  });
  next.on('channel-open', () => {
    note('канал открыт');
    flushQueue();
    view.sync(currentState());
  });
  next.on('ice', () => view.sync(currentState()));
  next.on('pong', () => view.sync(currentState()));
  next.on('error', (value) => {
    if (typeof value === 'string') {
      transferError = value;
      note(`ошибка ${value}`);
    }
    view.sync(currentState());
  });
  next.on('transfer', () => {
    flushQueue();
    view.sync(currentState());
  });
  next.on('file-offer', () => view.sync(currentState()));
  next.on('folder', () => view.sync(currentState()));
  next.on('folder-offer', () => view.sync(currentState()));
  next.on('file-received', (value) => {
    const transfer = value as { name?: string; path?: string };
    void notifyFileReceived(transfer.path || transfer.name || 'файл');
    note(`получен ${transfer.path || transfer.name || 'файл'}`);
    void (async () => {
      await refreshInbox();
      view.sync(currentState());
    })();
  });
  next.setStore(store);
  peer = next;
  return next;
};

const copyText = async (text: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const flushQueue = () => {
  if (!peer || peer.state !== 'connected') return;
  if (peer.activeFile()) return;
  const next = queuedFiles[0];
  if (!next) return;
  queuedFiles = queuedFiles.slice(1);
  peer.sendFile(next);
};

const queueFile = (file: File) => {
  queuedFiles = [...queuedFiles, file];
  transferError = '';
  note(`в очереди ${file.name}`);
};

const shareDeepLink = async (kind: DeepKind, payload: string) => {
  const https = encodeHttpsLink(
    globalThis.location.origin,
    APP_BASE,
    kind,
    payload,
  );
  const proto = encodeProtocolLink(kind, payload);
  const text = shareMessage(https, proto);
  try {
    if (navigator.share) {
      if (https.length <= 1500) {
        await navigator.share({ title: APP_NAME, text, url: https });
      } else {
        await navigator.share({ title: APP_NAME, text });
      }
      note('ссылка отправлена в «Поделиться»');
      return;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
  }
  const ok = await copyText(https);
  note(ok ? 'ссылка скопирована' : 'не удалось поделиться ссылкой');
  view.sync(currentState());
};

const applyIncoming = async (text: string) => {
  inviteError = '';
  const packed = decodeSharePack(text);
  if (packed.ok) {
    applyShareDraft(
      packed.value,
      'Серверы из пакета сохранены на этом устройстве.',
    );
    view.sync(currentState());
    return;
  }
  const decoded = await decodeInvite(text);
  if (decoded.ok && decoded.value.servers) {
    applyShareDraft(
      decoded.value.servers,
      'В приглашении были серверы — сохранил их как «Свой сервер».',
    );
  }
  if (inviteRole !== 'caller') {
    if (!peer || (decoded.ok && decoded.value.servers)) {
      inviteRole = 'callee';
      if (!startPeer()) return;
    }
  } else if (!peer) {
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
};

const applyDeepLink = async (link: DeepLink) => {
  if (link.kind === 'section') return;
  note(`ссылка ${link.kind}`);
  if (link.kind === 'pack') {
    const packed = decodeSharePack(link.payload);
    if (!packed.ok) {
      hostNotice = packed.message;
      view.sync(currentState());
      return;
    }
    applyShareDraft(packed.value, 'Серверы из ссылки сохранены.');
    view.sync(currentState());
    return;
  }
  if (link.kind === 'room') {
    roomId = link.payload;
    if (!isManualSignaling()) {
      inviteRole = 'caller';
      const next = startPeer();
      if (next) await next.enterRoom(roomId.trim() || DEFAULT_ROOM);
    }
    view.sync(currentState());
    return;
  }
  if (link.kind === 'join') inviteRole = 'callee';
  await applyIncoming(link.payload);
};

const consumeDeepLink = () => {
  const link = parseDeepLink(
    globalThis.location.hash,
    globalThis.location.search,
  );
  if (link.kind === 'section') return;
  history.replaceState(null, '', cleanLocation(location.href, link.section));
  void applyDeepLink(link);
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
  onSaveHost: (draft) => {
    void (async () => {
      hostDraft = draft;
      if (store) {
        const saved = await saveTurnHost(store, draft);
        hostNotice = saved.ok
          ? 'Адрес сохранён. Скопируйте команды: сначала ssh, на сервере — curl.'
          : saved.message;
      } else {
        hostNotice = 'OPFS недоступен — команды всё равно можно скопировать.';
      }
      view.sync(currentState());
    })();
  },
  onCopyHostScript: (script) => {
    void (async () => {
      const ok = await copyText(script);
      hostNotice = ok
        ? 'Команды в буфере. 1) ssh  2) curl | sudo bash на VPS.'
        : 'Не удалось скопировать. Выделите команды вручную.';
      view.sync(currentState());
    })();
  },
  onApplySharePack: (text) => {
    const packed = decodeSharePack(text);
    if (!packed.ok) {
      hostNotice = packed.message;
      view.sync(currentState());
      return;
    }
    applyShareDraft(
      packed.value,
      'Серверы сохранены. Можно создавать приглашение.',
    );
    note('сохранён пакет S1.');
    view.sync(currentState());
  },
  onScanSharePack: (file) => {
    void (async () => {
      if (!canScanQr()) {
        hostNotice =
          'Камера не читает QR в этом браузере. Вставьте строку S1. текстом.';
        view.sync(currentState());
        return;
      }
      const raw = await decodeQrFromFile(file);
      if (!raw) {
        hostNotice = 'QR не распознан.';
        view.sync(currentState());
        return;
      }
      const packed = decodeSharePack(raw);
      if (!packed.ok) {
        hostNotice = packed.message;
        view.sync(currentState());
        return;
      }
      applyShareDraft(
        packed.value,
        'Серверы из QR сохранены. Можно создавать приглашение.',
      );
      note('серверы из QR сохранены');
      view.sync(currentState());
    })();
  },
  onShareWithPeer: (on) => {
    shareWithPeer = on;
    view.sync(currentState());
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
    void applyIncoming(text);
  },
  onShareLink: () => {
    if (!outgoing) return;
    const kind: DeepKind = inviteRole === 'callee' ? 'answer' : 'join';
    void shareDeepLink(kind, outgoing);
  },
  onShareRoom: () => {
    void shareDeepLink('room', roomId.trim() || DEFAULT_ROOM);
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
    if (!peer || peer.state !== 'connected') {
      queueFile(file);
      view.sync(currentState());
      return;
    }
    peer.sendFile(file);
    view.sync(currentState());
  },
  onPickFolder: (entries: PickedFile[]) => {
    transferError = '';
    if (!peer || peer.state !== 'connected') {
      transferError =
        'Папку отправьте после соединения. Файл можно выбрать заранее.';
      view.sync(currentState());
      return;
    }
    peer.sendFolder(entries);
    view.sync(currentState());
  },
  onPickError: (message) => {
    transferError = message;
    view.sync(currentState());
  },
  onAcceptFile: (transferId) => {
    transferError = '';
    void requestNotifyPermission();
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
app.on('share-files', (data) => {
  const files = filesFromShare(data);
  if (files.length === 0) return;
  transferError = '';
  for (const file of files) queueFile(file);
  flushQueue();
  view.sync(currentState());
});

const opened = await openStore();
if (opened.ok) {
  store = opened.value;
  void requestPersist();
  const existing = await readAppLog(store);
  if (existing.ok) logText = existing.value;
  else logError = existing.message;
  await refreshInbox();
  hostDraft = await loadTurnHost(store);
} else {
  inboxError = opened.message;
  logError = opened.message;
}
redraw();
consumeDeepLink();
globalThis.addEventListener('hashchange', () => consumeDeepLink());
