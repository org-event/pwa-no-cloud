import {
  APP_NAME,
  APP_VERSION,
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
import type { CustomServerDraft, SignalingConfig } from './config/types.ts';
import {
  EMPTY_TURN_HOST,
  createIdleSession,
  type TurnHostDraft,
} from './domain/index.ts';
import {
  EMPTY_BOOK,
  encodeContactCard,
  findContact,
  meetRoomId,
  parseContactCard,
  removeContact,
  sanitizeNick,
  upsertContact,
  type AddressBook,
  type ProfileCard,
} from './domain/profile.ts';
import { Application } from './lib/application.ts';
import {
  cleanLocation,
  encodeHttpsLink,
  encodeProtocolLink,
  parseDeepLink,
  parsePastedShare,
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
} from './lib/opfs.ts';
import { notifyFileReceived, requestNotifyPermission } from './lib/notify.ts';
import { requestPersist } from './lib/quota.ts';
import { filesFromShare } from './lib/share.ts';
import { loadTurnHost, saveTurnHost } from './lib/turn-host-store.ts';
import { generateId } from './lib/id.ts';
import { fileToAvatarDataUrl } from './lib/avatar.ts';
import {
  createGroup,
  loadAddressBook,
  saveAddressBook,
} from './lib/contacts-store.ts';
import { loadProfile, saveProfile } from './lib/profile-store.ts';
import { PeerSession } from './lib/peer-session.ts';
import { inviteToQr } from './lib/qr.ts';
import { canScanQr, decodeQrFromFile } from './lib/scan-qr.ts';
import { createSignalingPort } from './lib/signaling/factory.ts';
import {
  humanizeSignalingError,
  MIXED_CONTENT_SIGNALING,
  mixedContentBlocksSignaling,
} from './lib/signaling/mixed-content.ts';
import { decodeInvite } from './lib/signaling/invite.ts';
import { APP_BASE } from './workers/sw.ts';
import { mountApp } from './ui/app.ts';
import type { InboxState } from './ui/inbox.ts';
import type { InviteState } from './ui/invite.ts';
import type { LogsState } from './ui/logs.ts';
import type { ContactsState } from './ui/contacts.ts';
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
let roomId = '';
let transferError = '';
let hostDraft: TurnHostDraft = { ...EMPTY_TURN_HOST };
let hostNotice = '';
let shareWithPeer = true;
let queuedFiles: File[] = [];
let openedFromLink = false;
let logText = '';
let logError = '';
let lastLoggedState = '';
let me = loadProfile(storage);
let book: AddressBook = { ...EMPTY_BOOK };
let pending: ProfileCard | null = null;
let contactsNotice = '';
let selectedContactIds: string[] = [];
let selectedGroupIds: string[] = [];
let peerNick = '';
let livePeerId: string | null = null;
let cardText = '';
let updateChecking = false;
let updateNotice = '';
const skippedPeers = new Set<string>();

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

const socketBlocked = (): boolean => {
  const resolved = resolveServers(settings, origin);
  if (!resolved.ok) return false;
  const url = resolved.value.signaling.url;
  if (!url || resolved.value.signaling.kind === 'manual') return false;
  return mixedContentBlocksSignaling(url);
};

const usesRoomLink = (): boolean => {
  const resolved = resolveServers(settings, origin);
  if (!resolved.ok) return false;
  const sig = resolved.value.signaling;
  if (sig.kind === 'manual' || !sig.url) return false;
  return !mixedContentBlocksSignaling(sig.url);
};

const peerSignaling = (): SignalingConfig => {
  const resolved = resolveServers(settings, origin);
  if (!resolved.ok || socketBlocked()) return { kind: 'manual' };
  return resolved.value.signaling;
};

const shareUrlNow = (): string => {
  if (usesRoomLink() && roomId) {
    return encodeHttpsLink(
      globalThis.location.origin,
      APP_BASE,
      'room',
      roomId,
    );
  }
  if (outgoing) {
    const kind: DeepKind = inviteRole === 'callee' ? 'answer' : 'join';
    return encodeHttpsLink(
      globalThis.location.origin,
      APP_BASE,
      kind,
      outgoing,
    );
  }
  return '';
};

const peerIsLive = (): boolean => {
  if (!peer) return false;
  return (
    peer.state !== 'idle' && peer.state !== 'closed' && peer.state !== 'failed'
  );
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
  mode: isManualSignaling() && !socketBlocked() ? 'manual' : 'room',
  open:
    inviteRole !== 'idle' ||
    Boolean(peer && peer.state !== 'idle' && peer.state !== 'closed'),
  outgoing,
  qrUrl,
  error: humanizeSignalingError(inviteError || (peer?.error ?? '')),
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

const contactsState = (): ContactsState => ({
  me,
  book,
  pending,
  notice: contactsNotice,
  cardText,
  waiting: peerIsLive() && roomId === meetRoomId(me.id),
  connected: peer?.state === 'connected',
  livePeerId,
});

const currentState = () => ({
  session: peer?.session ?? createIdleSession(),
  settings,
  resolved: resolveServers(settings, origin),
  online: app.online,
  canInstall: app.canInstall,
  clientId: app.clientId,
  roomId,
  shareUrl: shareUrlNow(),
  inbox: inboxState(),
  invite: inviteState(),
  transfer: transferState(),
  host: hostDraft,
  hostNotice,
  logs: logsState(),
  fromLink: openedFromLink,
  contacts: contactsState(),
  selectedContactIds,
  selectedGroupIds,
  peerNick,
  updateChecking,
  updateNotice,
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

const persistBook = () => {
  if (!store) return;
  void (async () => {
    const saved = await saveAddressBook(store, book);
    if (!saved.ok) {
      contactsNotice = saved.message;
      view.sync(currentState());
    }
  })();
};

const applyPeerProfile = (card: ProfileCard) => {
  if (card.id === me.id) return;
  peerNick = card.nick;
  livePeerId = card.id;
  if (skippedPeers.has(card.id)) {
    view.sync(currentState());
    return;
  }
  book = upsertContact(book, card);
  pending = null;
  persistBook();
  contactsNotice = `В книге: ${card.nick}`;
  note(`контакт ${card.nick}`);
  view.sync(currentState());
};

const knockOn = async (ownerId: string, asHost: boolean) => {
  const known = findContact(book, ownerId);
  if (!usesRoomLink()) {
    contactsNotice = known
      ? `${known.nick} в списке. Чтобы быть в сети, нужен сокет из S1.`
      : socketBlocked()
        ? MIXED_CONTENT_SIGNALING
        : 'Нужен сокет из S1. Вставьте пакет в «Настройки сервера».';
    view.sync(currentState());
    return;
  }
  const target = meetRoomId(ownerId);
  if (peerIsLive() && roomId === target) {
    contactsNotice = asHost
      ? 'Уже ждём, кто вставит карточку.'
      : known
        ? `${known.nick} в списке. Уже стучимся.`
        : 'Уже стучимся.';
    view.sync(currentState());
    return;
  }
  openedFromLink = false;
  roomId = target;
  inviteRole = 'caller';
  const next = startPeer();
  if (!next) return;
  contactsNotice = asHost
    ? 'Карточка готова. Копируйте и не закрывайте окно.'
    : known
      ? `${known.nick} в списке. Стучимся…`
      : 'Стучимся…';
  view.sync(currentState());
  await next.enterRoom(target);
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
  peerNick = '';
  livePeerId = null;
  const next = new PeerSession({
    iceServers: resolved.value.iceServers,
    signaling: createSignalingPort(peerSignaling()),
    shareServers: shareDraftForInvite(),
    profile: me,
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
    if (next.peerId && next.peerId !== me.id) {
      livePeerId = next.peerId;
    }
    note('канал открыт');
    flushQueue();
    view.sync(currentState());
  });
  next.on('profile', (value) => {
    const card = value as ProfileCard;
    applyPeerProfile(card);
  });
  next.on('ice', () => view.sync(currentState()));
  next.on('pong', () => view.sync(currentState()));
  next.on('error', (value) => {
    if (typeof value === 'string') {
      transferError = humanizeSignalingError(value);
      note(`ошибка ${transferError}`);
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
    openedFromLink = true;
    roomId = link.payload;
    if (!usesRoomLink()) {
      inviteError = socketBlocked()
        ? MIXED_CONTENT_SIGNALING
        : 'Короткая ссылка на комнату нужна с сокетом. Попросите «Получить ссылку» ещё раз.';
      view.sync(currentState());
      return;
    }
    inviteRole = 'caller';
    const next = startPeer();
    if (next) await next.enterRoom(roomId.trim() || DEFAULT_ROOM);
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
  onCheckUpdate: () => {
    void (async () => {
      updateChecking = true;
      updateNotice = 'Проверяем…';
      view.sync(currentState());
      const decision = await app.checkForUpdate(APP_VERSION);
      updateChecking = false;
      if (decision === 'reload') {
        updateNotice = 'Есть новая сборка, перезагрузка…';
        view.sync(currentState());
        await app.refreshShell();
        return;
      }
      const wipe = globalThis.confirm(
        decision === 'current'
          ? 'Сборка уже эта. Сбросить кэш PWA и перезагрузить? На iPhone так подхватывается релиз без удаления.'
          : 'Не удалось проверить версию. Сбросить кэш и перезагрузить?',
      );
      if (wipe) {
        updateNotice = 'Сбрасываем кэш…';
        view.sync(currentState());
        await app.refreshShell();
        return;
      }
      updateNotice =
        decision === 'current' ? 'Сборка актуальная' : 'Проверка не удалась';
      view.sync(currentState());
    })();
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
    void (async () => {
      inviteError = '';
      if (usesRoomLink()) {
        if (!peerIsLive()) {
          openedFromLink = false;
          roomId = generateId();
          inviteRole = 'caller';
          const next = startPeer();
          if (!next) return;
          void next.enterRoom(roomId);
        }
        await shareDeepLink('room', roomId);
        view.sync(currentState());
        return;
      }
      openedFromLink = false;
      inviteRole = 'caller';
      const next = startPeer();
      if (!next) return;
      await next.createInvite();
      await refreshOutgoing();
      if (outgoing) await shareDeepLink('join', outgoing);
      view.sync(currentState());
    })();
  },
  onCopyShareUrl: () => {
    void (async () => {
      const url = shareUrlNow();
      if (!url) return;
      const ok = await copyText(url);
      note(ok ? 'ссылка скопирована' : 'не удалось скопировать ссылку');
      view.sync(currentState());
    })();
  },
  onPasteLink: (text) => {
    const link = parsePastedShare(text);
    if (link.kind === 'section') {
      inviteError =
        'Не похоже на ссылку NoCloud. Вставьте https://…/#r/… или текст приглашения.';
      view.sync(currentState());
      return;
    }
    inviteError = '';
    void applyDeepLink(link);
  },
  onCopyId: () => {
    void (async () => {
      const ok = await copyText(me.id);
      note(ok ? 'id скопирован' : 'не удалось скопировать id');
      view.sync(currentState());
    })();
  },
  onAcceptPending: () => {
    if (!pending) return;
    book = upsertContact(book, pending);
    contactsNotice = `В книге: ${pending.nick}`;
    skippedPeers.delete(pending.id);
    pending = null;
    persistBook();
    view.sync(currentState());
  },
  onSkipPending: () => {
    if (pending) skippedPeers.add(pending.id);
    pending = null;
    view.sync(currentState());
  },
  onToggleContact: (id) => {
    selectedContactIds = selectedContactIds.includes(id)
      ? selectedContactIds.filter((item) => item !== id)
      : [...selectedContactIds, id];
    view.sync(currentState());
  },
  onToggleGroup: (id) => {
    selectedGroupIds = selectedGroupIds.includes(id)
      ? selectedGroupIds.filter((item) => item !== id)
      : [...selectedGroupIds, id];
    view.sync(currentState());
  },
  onSaveProfile: (nick) => {
    const nextNick = sanitizeNick(nick);
    if (!nextNick) {
      contactsNotice = 'Ник: буквы, цифры, пробел, . _ - до 32 знаков.';
      view.sync(currentState());
      return;
    }
    me = saveProfile(storage, { nick: nextNick, avatar: me.avatar });
    if (cardText) cardText = encodeContactCard(me);
    peer?.setProfile(me);
    contactsNotice = 'Ник сохранён.';
    view.sync(currentState());
  },
  onPickAvatar: (file) => {
    void (async () => {
      try {
        const avatar = await fileToAvatarDataUrl(file);
        if (!avatar) {
          contactsNotice = 'Не удалось прочитать фото.';
          view.sync(currentState());
          return;
        }
        me = saveProfile(storage, { nick: me.nick, avatar });
        peer?.setProfile(me);
        contactsNotice = 'Фото сохранено. Второй получит карточку по каналу.';
        view.sync(currentState());
      } catch {
        contactsNotice = 'Не удалось прочитать фото.';
        view.sync(currentState());
      }
    })();
  },
  onClearAvatar: () => {
    me = saveProfile(storage, { nick: me.nick, avatar: '' });
    peer?.setProfile(me);
    contactsNotice = 'Лого сгенерировано из id.';
    view.sync(currentState());
  },
  onGenerateCard: () => {
    cardText = encodeContactCard(me);
    void knockOn(me.id, true);
  },
  onCopyCard: () => {
    void (async () => {
      if (!cardText) {
        cardText = encodeContactCard(me);
        void knockOn(me.id, true);
      }
      const ok = await copyText(cardText);
      contactsNotice = ok
        ? 'Карточка скопирована. Отправьте её.'
        : 'Не удалось скопировать.';
      note(ok ? 'карточка скопирована' : 'не удалось скопировать карточку');
      view.sync(currentState());
    })();
  },
  onAddContact: (text) => {
    const card = parseContactCard(text);
    if (!card) {
      contactsNotice = 'Вставьте карточку C1. которую прислали.';
      view.sync(currentState());
      return false;
    }
    if (card.id === me.id) {
      contactsNotice = 'Это ваша карточка.';
      view.sync(currentState());
      return false;
    }
    book = upsertContact(book, card);
    persistBook();
    contactsNotice = `В книге: ${card.nick}`;
    view.sync(currentState());
    void knockOn(card.id, false);
    return true;
  },
  onRemoveContact: (id) => {
    book = removeContact(book, id);
    selectedContactIds = selectedContactIds.filter((item) => item !== id);
    contactsNotice = 'Удалено.';
    persistBook();
    view.sync(currentState());
  },
  onSaveGroup: (name, memberIds) => {
    const label = sanitizeNick(name);
    if (!label || memberIds.length === 0) {
      contactsNotice = 'Нужны название и хотя бы один человек.';
      view.sync(currentState());
      return;
    }
    book = {
      ...book,
      groups: [...book.groups, createGroup(label, memberIds)],
    };
    contactsNotice = `Группа «${label}». Канал всё равно 1:1.`;
    persistBook();
    view.sync(currentState());
  },
  onRemoveGroup: (id) => {
    book = {
      ...book,
      groups: book.groups.filter((group) => group.id !== id),
    };
    selectedGroupIds = selectedGroupIds.filter((item) => item !== id);
    contactsNotice = 'Группа удалена.';
    persistBook();
    view.sync(currentState());
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
app.watchUpdates(APP_VERSION);
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
  book = await loadAddressBook(store);
} else {
  inboxError = opened.message;
  logError = opened.message;
}
redraw();
consumeDeepLink();
globalThis.addEventListener('hashchange', () => consumeDeepLink());
