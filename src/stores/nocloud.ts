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
} from '../config/index.ts';
import type { CustomServerDraft, SignalingConfig } from '../config/types.ts';
import {
  EMPTY_TURN_HOST,
  createIdleSession,
  type TurnHostDraft,
} from '../domain/index.ts';
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
} from '../domain/profile.ts';
import { Application } from '../lib/application.ts';
import {
  cleanLocation,
  encodeHttpsLink,
  encodeProtocolLink,
  parseDeepLink,
  parsePastedShare,
  shareMessage,
  type DeepKind,
  type DeepLink,
} from '../lib/app-link.ts';
import { formatIceReport } from '../lib/ice.ts';
import type { InboxEntry, OpfsStore } from '../lib/opfs.ts';
import {
  appendLog,
  listInbox,
  openStore,
  readAppLog,
  readInboxFile,
  removeInboxFile,
} from '../lib/opfs.ts';
import { notifyFileReceived, requestNotifyPermission } from '../lib/notify.ts';
import { requestPersist } from '../lib/quota.ts';
import { filesFromShare } from '../lib/share.ts';
import { loadTurnHost, saveTurnHost } from '../lib/turn-host-store.ts';
import { generateId } from '../lib/id.ts';
import { fileToAvatarDataUrl } from '../lib/avatar.ts';
import {
  createGroup,
  loadAddressBook,
  saveAddressBook,
} from '../lib/contacts-store.ts';
import { loadProfile, saveProfile } from '../lib/profile-store.ts';
import { PeerSession } from '../lib/peer-session.ts';
import { inviteToQr } from '../lib/qr.ts';
import { canScanQr, decodeQrFromFile } from '../lib/scan-qr.ts';
import { createSignalingPort } from '../lib/signaling/factory.ts';
import {
  humanizeSignalingError,
  MIXED_CONTENT_SIGNALING,
  mixedContentBlocksSignaling,
} from '../lib/signaling/mixed-content.ts';
import { decodeInvite } from '../lib/signaling/invite.ts';
import { APP_BASE } from '../workers/sw.ts';
import type { PickedFile } from '../lib/folder-walk.ts';
import type { TransferViewState } from '../ui/transfer-status.ts';
import { formatStatusLine } from '../ui/status-line.ts';
import { defineStore } from 'pinia';
import { computed, reactive, ref } from 'vue';

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
};

export const useNocloudStore = defineStore('nocloud', () => {
  const storage = browserStorage();
  const app = new Application({ storage });
  const origin = globalThis.location?.origin;
  const skippedPeers = new Set<string>();
  const peerRevision = ref(0);
  const touch = () => {
    peerRevision.value++;
  };

  const state = reactive({
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
    shareWithPeer: true,
    queuedFiles: [] as File[],
    openedFromLink: false,
    logText: '',
    logError: '',
    lastLoggedState: '',
    me: loadProfile(storage),
    book: { ...EMPTY_BOOK } as AddressBook,
    pending: null as ProfileCard | null,
    contactsNotice: '',
    selectedContactIds: [] as string[],
    selectedGroupIds: [] as string[],
    peerNick: '',
    livePeerId: null as string | null,
    cardText: '',
    updateChecking: false,
    updateNotice: '',
  });

  const LOG_CAP = 80_000;

  const note = (line: string) => {
    const stamp = new Date().toISOString().slice(11, 19);
    const row = `${stamp} ${line}`;
    state.logText = state.logText ? `${state.logText}${row}\n` : `${row}\n`;
    if (state.logText.length > LOG_CAP) {
      state.logText = state.logText.slice(state.logText.length - LOG_CAP);
    }
    if (state.store) void appendLog(state.store, row);
  };

  const logsState = (): LogsState => ({
    text: state.logText,
    error: state.logError,
  });

  const isManualSignaling = (): boolean => {
    const resolved = resolveServers(state.settings, origin);
    return !resolved.ok || resolved.value.signaling.kind === 'manual';
  };

  const socketBlocked = (): boolean => {
    const resolved = resolveServers(state.settings, origin);
    if (!resolved.ok) return false;
    const url = resolved.value.signaling.url;
    if (!url || resolved.value.signaling.kind === 'manual') return false;
    return mixedContentBlocksSignaling(url);
  };

  const usesRoomLink = (): boolean => {
    const resolved = resolveServers(state.settings, origin);
    if (!resolved.ok) return false;
    const sig = resolved.value.signaling;
    if (sig.kind === 'manual' || !sig.url) return false;
    return !mixedContentBlocksSignaling(sig.url);
  };

  const peerSignaling = (): SignalingConfig => {
    const resolved = resolveServers(state.settings, origin);
    if (!resolved.ok || socketBlocked()) return { kind: 'manual' };
    return resolved.value.signaling;
  };

  const shareUrlNow = (): string => {
    if (usesRoomLink() && state.roomId) {
      return encodeHttpsLink(
        globalThis.location.origin,
        APP_BASE,
        'room',
        state.roomId,
      );
    }
    if (state.outgoing) {
      const kind: DeepKind = state.inviteRole === 'callee' ? 'answer' : 'join';
      return encodeHttpsLink(
        globalThis.location.origin,
        APP_BASE,
        kind,
        state.outgoing,
      );
    }
    return '';
  };

  const peerIsLive = (): boolean => {
    if (!state.peer) return false;
    return (
      state.peer.state !== 'idle' &&
      state.peer.state !== 'closed' &&
      state.peer.state !== 'failed'
    );
  };

  const inboxState = (): InboxState => ({
    items: state.inboxItems,
    selected: state.selected,
    preview: state.preview,
    error: state.inboxError,
    ready: state.store !== null,
  });

  const inviteState = (): InviteState => ({
    role:
      state.peer?.role && state.peer.role !== 'idle'
        ? state.peer.role
        : state.inviteRole,
    mode: isManualSignaling() && !socketBlocked() ? 'manual' : 'room',
    open:
      state.inviteRole !== 'idle' ||
      Boolean(
        state.peer &&
        state.peer.state !== 'idle' &&
        state.peer.state !== 'closed',
      ),
    outgoing: state.outgoing,
    qrUrl: state.qrUrl,
    error: humanizeSignalingError(
      state.inviteError || (state.peer?.error ?? ''),
    ),
    connected: state.peer?.state === 'connected',
    lastPongMs: state.peer?.lastPongMs ?? null,
    ice: state.peer ? formatIceReport(state.peer.ice) : '',
    shareWithPeer: state.shareWithPeer,
    canShareServers: (() => {
      const resolved = resolveServers(state.settings, origin);
      return resolved.ok && iceServersHaveTurn(resolved.value.iceServers);
    })(),
  });

  const transferState = (): TransferViewState => ({
    connected: state.peer?.state === 'connected',
    current: state.peer?.activeFile() ?? null,
    incoming: state.peer?.incomingFile() ?? null,
    folder: state.peer?.activeFolder() ?? null,
    incomingFolder: state.peer?.incomingFolder() ?? null,
    queuedNames: state.queuedFiles.map((file) => file.name),
    error: state.transferError,
  });

  const contactsState = (): ContactsState => ({
    me: state.me,
    book: state.book,
    pending: state.pending,
    notice: state.contactsNotice,
    cardText: state.cardText,
    waiting: peerIsLive() && state.roomId === meetRoomId(state.me.id),
    connected: state.peer?.state === 'connected',
    livePeerId: state.livePeerId,
  });

  const setInboxError = (message: string) => {
    state.inboxError = message;
    state.preview = '';
  };

  const refreshInbox = async () => {
    if (!state.store) return;
    const listed = await listInbox(state.store);
    if (!listed.ok) {
      setInboxError(listed.message);
      return;
    }
    state.inboxItems = listed.value;
    if (state.selected) {
      const key = `${state.selected.transferId}/${state.selected.name}`;
      let found: InboxEntry | null = null;
      for (const item of state.inboxItems) {
        if (`${item.transferId}/${item.name}` === key) found = item;
      }
      state.selected = found;
    }
  };

  const refreshOutgoing = async () => {
    state.outgoing = state.peer?.outgoing() ?? '';
    state.qrUrl = await inviteToQr(state.outgoing);
    touch();
  };

  const persistBook = () => {
    const opfs = state.store;
    if (!opfs) return;
    void (async () => {
      const saved = await saveAddressBook(opfs, state.book);
      if (!saved.ok) {
        state.contactsNotice = saved.message;
        touch();
      }
    })();
  };

  const applyPeerProfile = (card: ProfileCard) => {
    if (card.id === state.me.id) return;
    state.peerNick = card.nick;
    state.livePeerId = card.id;
    if (skippedPeers.has(card.id)) {
      touch();
      return;
    }
    state.book = upsertContact(state.book, card);
    state.pending = null;
    persistBook();
    state.contactsNotice = `В книге: ${card.nick}`;
    note(`контакт ${card.nick}`);
    touch();
  };

  const knockOn = async (ownerId: string, asHost: boolean) => {
    const known = findContact(state.book, ownerId);
    if (!usesRoomLink()) {
      state.contactsNotice = known
        ? `${known.nick} в списке. Чтобы быть в сети, нужен сокет из S1.`
        : socketBlocked()
          ? MIXED_CONTENT_SIGNALING
          : 'Нужен сокет из S1. Вставьте пакет в «Настройки сервера».';
      touch();
      return;
    }
    const target = meetRoomId(ownerId);
    if (peerIsLive() && state.roomId === target) {
      state.contactsNotice = asHost
        ? 'Уже ждём, кто вставит карточку.'
        : known
          ? `${known.nick} в списке. Уже стучимся.`
          : 'Уже стучимся.';
      touch();
      return;
    }
    state.openedFromLink = false;
    state.roomId = target;
    state.inviteRole = 'caller';
    const next = startPeer();
    if (!next) return;
    state.contactsNotice = asHost
      ? 'Карточка готова. Копируйте и не закрывайте окно.'
      : known
        ? `${known.nick} в списке. Стучимся…`
        : 'Стучимся…';
    touch();
    await next.enterRoom(target);
    touch();
  };

  const applyShareDraft = (draft: CustomServerDraft, notice: string) => {
    state.settings = createUserSettings('custom', draft);
    saveUserSettings(state.settings, storage);
    state.hostNotice = notice;
  };

  const shareDraftForInvite = (): CustomServerDraft | null => {
    if (!state.shareWithPeer) return null;
    const resolved = resolveServers(state.settings, origin);
    if (!resolved.ok) return null;
    if (!iceServersHaveTurn(resolved.value.iceServers)) return null;
    return iceOnlyShare(resolved.value.iceServers);
  };

  const startPeer = (): PeerSession | null => {
    const resolved = resolveServers(state.settings, origin);
    if (!resolved.ok) {
      state.inviteError = resolved.message;
      note(`серверы: ${resolved.message}`);
      touch();
      return null;
    }
    if (state.peer) state.peer.close();
    state.outgoing = '';
    state.qrUrl = null;
    state.inviteError = '';
    state.lastLoggedState = '';
    state.peerNick = '';
    state.livePeerId = null;
    const next = new PeerSession({
      iceServers: resolved.value.iceServers,
      signaling: createSignalingPort(peerSignaling()),
      shareServers: shareDraftForInvite(),
      profile: state.me,
    });
    next.on('state', () => {
      const label = next.session.state;
      if (label !== state.lastLoggedState) {
        state.lastLoggedState = label;
        note(`сессия ${label}`);
      }
      touch();
    });
    next.on('invite', () => {
      void refreshOutgoing();
    });
    next.on('channel-open', () => {
      if (next.peerId && next.peerId !== state.me.id) {
        state.livePeerId = next.peerId;
      }
      note('канал открыт');
      flushQueue();
      touch();
    });
    next.on('profile', (value) => {
      const card = value as ProfileCard;
      applyPeerProfile(card);
    });
    next.on('ice', () => touch());
    next.on('pong', () => touch());
    next.on('error', (value) => {
      if (typeof value === 'string') {
        state.transferError = humanizeSignalingError(value);
        note(`ошибка ${state.transferError}`);
      }
      touch();
    });
    next.on('transfer', () => {
      flushQueue();
      touch();
    });
    next.on('file-offer', () => touch());
    next.on('folder', () => touch());
    next.on('folder-offer', () => touch());
    next.on('file-received', (value) => {
      const transfer = value as { name?: string; path?: string };
      void notifyFileReceived(transfer.path || transfer.name || 'файл');
      note(`получен ${transfer.path || transfer.name || 'файл'}`);
      void (async () => {
        await refreshInbox();
        touch();
      })();
    });
    next.setStore(state.store);
    state.peer = next;
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
    if (!state.peer || state.peer.state !== 'connected') return;
    if (state.peer.activeFile()) return;
    const next = state.queuedFiles[0];
    if (!next) return;
    state.queuedFiles = state.queuedFiles.slice(1);
    state.peer.sendFile(next);
  };

  const queueFile = (file: File) => {
    state.queuedFiles = [...state.queuedFiles, file];
    state.transferError = '';
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
    touch();
  };

  const applyIncoming = async (text: string) => {
    state.inviteError = '';
    const packed = decodeSharePack(text);
    if (packed.ok) {
      applyShareDraft(
        packed.value,
        'Серверы из пакета сохранены на этом устройстве.',
      );
      touch();
      return;
    }
    const decoded = await decodeInvite(text);
    if (decoded.ok && decoded.value.servers) {
      applyShareDraft(
        decoded.value.servers,
        'В приглашении были серверы — сохранил их как «Свой сервер».',
      );
    }
    if (state.inviteRole !== 'caller') {
      if (!state.peer || (decoded.ok && decoded.value.servers)) {
        state.inviteRole = 'callee';
        if (!startPeer()) return;
      }
    } else if (!state.peer) {
      if (!startPeer()) return;
    }
    const current = state.peer;
    if (!current) return;
    if (state.inviteRole === 'callee') {
      const accepted = await current.acceptInvite(text);
      if (!accepted.ok) state.inviteError = accepted.message;
      await refreshOutgoing();
      return;
    }
    const accepted = await current.acceptAnswer(text);
    if (!accepted.ok) state.inviteError = accepted.message;
    touch();
  };

  const applyDeepLink = async (link: DeepLink) => {
    if (link.kind === 'section') return;
    note(`ссылка ${link.kind}`);
    if (link.kind === 'pack') {
      const packed = decodeSharePack(link.payload);
      if (!packed.ok) {
        state.hostNotice = packed.message;
        touch();
        return;
      }
      applyShareDraft(packed.value, 'Серверы из ссылки сохранены.');
      touch();
      return;
    }
    if (link.kind === 'room') {
      state.openedFromLink = true;
      state.roomId = link.payload;
      if (!usesRoomLink()) {
        state.inviteError = socketBlocked()
          ? MIXED_CONTENT_SIGNALING
          : 'Короткая ссылка на комнату нужна с сокетом. Попросите «Получить ссылку» ещё раз.';
        touch();
        return;
      }
      state.inviteRole = 'caller';
      const next = startPeer();
      if (next) await next.enterRoom(state.roomId.trim() || DEFAULT_ROOM);
      touch();
      return;
    }
    if (link.kind === 'join') state.inviteRole = 'callee';
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

  function onPreset(presetId: string) {
    state.settings = { ...state.settings, presetId };
    saveUserSettings(state.settings, storage);
    touch();
  }

  function onSaveCustom(custom: CustomServerDraft) {
    state.settings = { presetId: 'custom', custom };
    saveUserSettings(state.settings, storage);
    touch();
  }

  function onInstall() {
    void app.install();
  }

  function onCheckUpdate() {
    void (async () => {
      state.updateChecking = true;
      state.updateNotice = 'Проверяем…';
      touch();
      const decision = await app.checkForUpdate(APP_VERSION);
      state.updateChecking = false;
      if (decision === 'reload') {
        state.updateNotice = 'Есть новая сборка, перезагрузка…';
        touch();
        await app.refreshShell();
        return;
      }
      const wipe = globalThis.confirm(
        decision === 'current'
          ? 'Сборка уже эта. Сбросить кэш PWA и перезагрузить? На iPhone так подхватывается релиз без удаления.'
          : 'Не удалось проверить версию. Сбросить кэш и перезагрузить?',
      );
      if (wipe) {
        state.updateNotice = 'Сбрасываем кэш…';
        touch();
        await app.refreshShell();
        return;
      }
      state.updateNotice =
        decision === 'current' ? 'Сборка актуальная' : 'Проверка не удалась';
      touch();
    })();
  }

  function onSaveHost(draft: TurnHostDraft) {
    void (async () => {
      state.hostDraft = draft;
      if (state.store) {
        const saved = await saveTurnHost(state.store, draft);
        state.hostNotice = saved.ok
          ? 'Адрес сохранён. Скопируйте команды: сначала ssh, на сервере — curl.'
          : saved.message;
      } else {
        state.hostNotice =
          'OPFS недоступен — команды всё равно можно скопировать.';
      }
      touch();
    })();
  }

  function onCopyHostScript(script: string) {
    void (async () => {
      const ok = await copyText(script);
      state.hostNotice = ok
        ? 'Команды в буфере. 1) ssh  2) curl | sudo bash на VPS.'
        : 'Не удалось скопировать. Выделите команды вручную.';
      touch();
    })();
  }

  function onApplySharePack(text: string) {
    const packed = decodeSharePack(text);
    if (!packed.ok) {
      state.hostNotice = packed.message;
      touch();
      return;
    }
    applyShareDraft(
      packed.value,
      'Серверы сохранены. Можно создавать приглашение.',
    );
    note('сохранён пакет S1.');
    touch();
  }

  function onScanSharePack(file: File) {
    void (async () => {
      if (!canScanQr()) {
        state.hostNotice =
          'Камера не читает QR в этом браузере. Вставьте строку S1. текстом.';
        touch();
        return;
      }
      const raw = await decodeQrFromFile(file);
      if (!raw) {
        state.hostNotice = 'QR не распознан.';
        touch();
        return;
      }
      const packed = decodeSharePack(raw);
      if (!packed.ok) {
        state.hostNotice = packed.message;
        touch();
        return;
      }
      applyShareDraft(
        packed.value,
        'Серверы из QR сохранены. Можно создавать приглашение.',
      );
      note('серверы из QR сохранены');
      touch();
    })();
  }

  function onShareWithPeer(on: boolean) {
    state.shareWithPeer = on;
    touch();
  }

  function onCreateInvite() {
    void (async () => {
      state.inviteError = '';
      state.inviteRole = 'caller';
      const next = startPeer();
      if (!next) return;
      await next.createInvite();
      await refreshOutgoing();
    })();
  }

  function onJoin() {
    state.inviteRole = 'callee';
    startPeer();
    touch();
  }

  function onApplyPaste(text: string) {
    void applyIncoming(text);
  }

  function onShareLink() {
    if (!state.outgoing) return;
    const kind: DeepKind = state.inviteRole === 'callee' ? 'answer' : 'join';
    void shareDeepLink(kind, state.outgoing);
  }

  function onShareRoom() {
    void (async () => {
      state.inviteError = '';
      if (usesRoomLink()) {
        if (!peerIsLive()) {
          state.openedFromLink = false;
          state.roomId = generateId();
          state.inviteRole = 'caller';
          const next = startPeer();
          if (!next) return;
          void next.enterRoom(state.roomId);
        }
        await shareDeepLink('room', state.roomId);
        touch();
        return;
      }
      state.openedFromLink = false;
      state.inviteRole = 'caller';
      const next = startPeer();
      if (!next) return;
      await next.createInvite();
      await refreshOutgoing();
      if (state.outgoing) await shareDeepLink('join', state.outgoing);
      touch();
    })();
  }

  function onCopyShareUrl() {
    void (async () => {
      const url = shareUrlNow();
      if (!url) return;
      const ok = await copyText(url);
      note(ok ? 'ссылка скопирована' : 'не удалось скопировать ссылку');
      touch();
    })();
  }

  function onPasteLink(text: string) {
    const link = parsePastedShare(text);
    if (link.kind === 'section') {
      state.inviteError =
        'Не похоже на ссылку NoCloud. Вставьте https://…/#r/… или текст приглашения.';
      touch();
      return;
    }
    state.inviteError = '';
    void applyDeepLink(link);
  }

  function onCopyId() {
    void (async () => {
      const ok = await copyText(state.me.id);
      note(ok ? 'id скопирован' : 'не удалось скопировать id');
      touch();
    })();
  }

  function onAcceptPending() {
    if (!state.pending) return;
    state.book = upsertContact(state.book, state.pending);
    state.contactsNotice = `В книге: ${state.pending.nick}`;
    skippedPeers.delete(state.pending.id);
    state.pending = null;
    persistBook();
    touch();
  }

  function onSkipPending() {
    if (state.pending) skippedPeers.add(state.pending.id);
    state.pending = null;
    touch();
  }

  function onToggleContact(id: string) {
    state.selectedContactIds = state.selectedContactIds.includes(id)
      ? state.selectedContactIds.filter((item) => item !== id)
      : [...state.selectedContactIds, id];
    touch();
  }

  function onToggleGroup(id: string) {
    state.selectedGroupIds = state.selectedGroupIds.includes(id)
      ? state.selectedGroupIds.filter((item) => item !== id)
      : [...state.selectedGroupIds, id];
    touch();
  }

  function onSaveProfile(nick: string) {
    const nextNick = sanitizeNick(nick);
    if (!nextNick) {
      state.contactsNotice = 'Ник: буквы, цифры, пробел, . _ - до 32 знаков.';
      touch();
      return;
    }
    state.me = saveProfile(storage, {
      nick: nextNick,
      avatar: state.me.avatar,
    });
    if (state.cardText) state.cardText = encodeContactCard(state.me);
    state.peer?.setProfile(state.me);
    state.contactsNotice = 'Ник сохранён.';
    touch();
  }

  function onPickAvatar(file: File) {
    void (async () => {
      try {
        const avatar = await fileToAvatarDataUrl(file);
        if (!avatar) {
          state.contactsNotice = 'Не удалось прочитать фото.';
          touch();
          return;
        }
        state.me = saveProfile(storage, { nick: state.me.nick, avatar });
        state.peer?.setProfile(state.me);
        state.contactsNotice =
          'Фото сохранено. Второй получит карточку по каналу.';
        touch();
      } catch {
        state.contactsNotice = 'Не удалось прочитать фото.';
        touch();
      }
    })();
  }

  function onClearAvatar() {
    state.me = saveProfile(storage, { nick: state.me.nick, avatar: '' });
    state.peer?.setProfile(state.me);
    state.contactsNotice = 'Лого сгенерировано из id.';
    touch();
  }

  function onGenerateCard() {
    state.cardText = encodeContactCard(state.me);
    void knockOn(state.me.id, true);
  }

  function onCopyCard() {
    void (async () => {
      if (!state.cardText) {
        state.cardText = encodeContactCard(state.me);
        void knockOn(state.me.id, true);
      }
      const ok = await copyText(state.cardText);
      state.contactsNotice = ok
        ? 'Карточка скопирована. Отправьте её.'
        : 'Не удалось скопировать.';
      note(ok ? 'карточка скопирована' : 'не удалось скопировать карточку');
      touch();
    })();
  }

  function onAddContact(text: string) {
    const card = parseContactCard(text);
    if (!card) {
      state.contactsNotice = 'Вставьте карточку C1. которую прислали.';
      touch();
      return false;
    }
    if (card.id === state.me.id) {
      state.contactsNotice = 'Это ваша карточка.';
      touch();
      return false;
    }
    state.book = upsertContact(state.book, card);
    persistBook();
    state.contactsNotice = `В книге: ${card.nick}`;
    touch();
    void knockOn(card.id, false);
    return true;
  }

  function onRemoveContact(id: string) {
    state.book = removeContact(state.book, id);
    state.selectedContactIds = state.selectedContactIds.filter(
      (item) => item !== id,
    );
    state.contactsNotice = 'Удалено.';
    persistBook();
    touch();
  }

  function onSaveGroup(name: string, memberIds: string[]) {
    const label = sanitizeNick(name);
    if (!label || memberIds.length === 0) {
      state.contactsNotice = 'Нужны название и хотя бы один человек.';
      touch();
      return;
    }
    state.book = {
      ...state.book,
      groups: [...state.book.groups, createGroup(label, memberIds)],
    };
    state.contactsNotice = `Группа «${label}». Канал всё равно 1:1.`;
    persistBook();
    touch();
  }

  function onRemoveGroup(id: string) {
    state.book = {
      ...state.book,
      groups: state.book.groups.filter((group) => group.id !== id),
    };
    state.selectedGroupIds = state.selectedGroupIds.filter(
      (item) => item !== id,
    );
    state.contactsNotice = 'Группа удалена.';
    persistBook();
    touch();
  }

  function onCopy() {
    void (async () => {
      if (!state.outgoing || !navigator.clipboard) return;
      try {
        await navigator.clipboard.writeText(state.outgoing);
      } catch {
        state.inviteError = 'Не удалось скопировать';
        touch();
      }
    })();
  }

  function onPing() {
    state.peer?.ping();
  }

  function onPickFile(file: File) {
    state.transferError = '';
    if (!state.peer || state.peer.state !== 'connected') {
      queueFile(file);
      touch();
      return;
    }
    state.peer.sendFile(file);
    touch();
  }

  function onPickFolder(entries: PickedFile[]) {
    state.transferError = '';
    if (!state.peer || state.peer.state !== 'connected') {
      state.transferError =
        'Папку отправьте после соединения. Файл можно выбрать заранее.';
      touch();
      return;
    }
    state.peer.sendFolder(entries);
    touch();
  }

  function onPickError(message: string) {
    state.transferError = message;
    touch();
  }

  function onAcceptFile(transferId: string) {
    state.transferError = '';
    void requestNotifyPermission();
    state.peer?.acceptFile(transferId);
    touch();
  }

  function onRejectFile(transferId: string) {
    state.peer?.rejectFile(transferId);
    touch();
  }

  function onCancelFile() {
    state.peer?.cancelFile();
    touch();
  }

  function onPauseFile() {
    state.peer?.pauseFile();
    touch();
  }

  function onResumeFile() {
    state.peer?.resumeFile();
    touch();
  }

  function onRead(entry: InboxEntry) {
    void (async () => {
      if (!state.store) return;
      const text = await readInboxFile(
        state.store,
        entry.transferId,
        entry.name,
      );
      if (!text.ok) {
        setInboxError(text.message);
        touch();
        return;
      }
      state.inboxError = '';
      state.preview = text.value;
      await appendLog(state.store, `read ${entry.transferId}/${entry.name}`);
      touch();
    })();
  }

  function onRemove(entry: InboxEntry) {
    void (async () => {
      if (!state.store) return;
      const removed = await removeInboxFile(
        state.store,
        entry.transferId,
        entry.name,
      );
      if (!removed.ok) {
        setInboxError(removed.message);
        touch();
        return;
      }
      state.inboxError = '';
      state.preview = '';
      await appendLog(state.store, `remove ${entry.transferId}/${entry.name}`);
      await refreshInbox();
      touch();
    })();
  }

  function onSelect(entry: InboxEntry) {
    state.selected = entry;
    state.preview = '';
    state.inboxError = '';
    touch();
  }

  const trackRevision = () => {
    void peerRevision.value;
  };

  const resolved = computed(() => {
    trackRevision();
    return resolveServers(state.settings, origin);
  });

  const session = computed(() => {
    trackRevision();
    return state.peer?.session ?? createIdleSession();
  });

  const shareUrl = computed(() => {
    trackRevision();
    return shareUrlNow();
  });

  const inbox = computed((): InboxState => {
    trackRevision();
    return inboxState();
  });

  const invite = computed((): InviteState => {
    trackRevision();
    return inviteState();
  });

  const transfer = computed((): TransferViewState => {
    trackRevision();
    return transferState();
  });

  const contacts = computed((): ContactsState => {
    trackRevision();
    return contactsState();
  });

  const logs = computed((): LogsState => {
    trackRevision();
    return logsState();
  });

  const contactsWaiting = computed(() => {
    trackRevision();
    return peerIsLive() && state.roomId === meetRoomId(state.me.id);
  });

  const statusLine = computed(() => {
    trackRevision();
    return formatStatusLine({
      online: app.online,
      session: session.value.state,
      ice: invite.value.ice,
      pongMs: invite.value.lastPongMs,
    });
  });

  const online = computed(() => app.online);
  const canInstall = computed(() => app.canInstall);
  const clientId = computed(() => app.clientId);

  const redraw = () => touch();

  async function init() {
    app.watchUpdates(APP_VERSION);
    app.on('network', redraw);
    app.on('install', redraw);
    app.on('installed', redraw);
    app.on('share-files', (data) => {
      const files = filesFromShare(data);
      if (files.length === 0) return;
      state.transferError = '';
      for (const file of files) queueFile(file);
      flushQueue();
      touch();
    });

    const opened = await openStore();
    if (opened.ok) {
      state.store = opened.value;
      void requestPersist();
      const existing = await readAppLog(state.store);
      if (existing.ok) state.logText = existing.value;
      else state.logError = existing.message;
      await refreshInbox();
      state.hostDraft = await loadTurnHost(state.store);
      state.book = await loadAddressBook(state.store);
    } else {
      state.inboxError = opened.message;
      state.logError = opened.message;
    }
    touch();
    consumeDeepLink();
    globalThis.addEventListener('hashchange', () => consumeDeepLink());
  }

  return {
    peerRevision,
    state,
    resolved,
    session,
    shareUrl,
    inbox,
    invite,
    transfer,
    contacts,
    logs,
    contactsWaiting,
    statusLine,
    online,
    canInstall,
    clientId,
    init,
    onPreset,
    onSaveCustom,
    onInstall,
    onCheckUpdate,
    onSaveHost,
    onCopyHostScript,
    onApplySharePack,
    onScanSharePack,
    onShareWithPeer,
    onCreateInvite,
    onJoin,
    onApplyPaste,
    onShareLink,
    onShareRoom,
    onCopyShareUrl,
    onPasteLink,
    onCopyId,
    onAcceptPending,
    onSkipPending,
    onToggleContact,
    onToggleGroup,
    onSaveProfile,
    onPickAvatar,
    onClearAvatar,
    onGenerateCard,
    onCopyCard,
    onAddContact,
    onRemoveContact,
    onSaveGroup,
    onRemoveGroup,
    onCopy,
    onPing,
    onPickFile,
    onPickFolder,
    onPickError,
    onAcceptFile,
    onRejectFile,
    onCancelFile,
    onPauseFile,
    onResumeFile,
    onRead,
    onRemove,
    onSelect,
  };
});
