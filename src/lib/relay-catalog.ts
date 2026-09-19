import { notes, serversCopy } from '@/content/index.ts';
import {
  createUserSettings,
  decodeSharePack,
  iceOnlyShare,
  iceServersHaveTurn,
  resolveServers,
  saveUserSettings,
} from '@/config/index.ts';
import type { StorageLike } from '@/config/storage.ts';
import type { CustomServerDraft, UserSettings } from '@/config/types.ts';
import {
  addRelayUrl,
  applyRelayFailover,
  mergeRemoteRelays,
  removeRelayUrl,
  setActiveRelay,
  type RelayBundle,
} from '@/domain/discovery/index.ts';
import { parseAndVerifyRelayRedirectNote } from '@/domain/relay/redirect.ts';
import {
  createSavedServer,
  titleFromDraft,
  type SavedServer,
  type ServerReach,
} from '@/domain/saved-server.ts';
import type { TurnHostDraft } from '@/domain/turn-host.ts';
import { EMPTY_TURN_HOST } from '@/domain/turn-host.ts';
import type { OpfsStore } from '@/lib/opfs.ts';
import {
  fetchRelayBundle as defaultFetchRelayBundle,
  remoteRelayUrls,
  type FetchRelayBundleResult,
} from '@/lib/relay-bundle-fetch.ts';
import { saveRelayBundle } from '@/lib/relay-bundle-store.ts';
import {
  loadSavedServers,
  saveSavedServers,
  upsertSavedServer,
} from '@/lib/saved-servers-store.ts';
import {
  probeSignaling as defaultProbeSignaling,
  type ProbeResult,
} from '@/lib/probe-signaling.ts';
import { loadTurnHost, saveTurnHost } from '@/lib/turn-host-store.ts';

export type RelayCatalogState = {
  settings: UserSettings;
  savedServers: SavedServer[];
  activeServerId: string | null;
  relayBundle: RelayBundle;
  hostNotice: string;
  manualReach: ServerReach;
  shareWithPeer: boolean;
  hostDraft: TurnHostDraft;
};

export type RelayCatalogDeps = {
  storage: StorageLike;
  getOpfsStore: () => OpfsStore | null;
  origin: () => string | undefined;
  presenceAvailable: () => boolean;
  ensurePresenceActive: () => void | Promise<void>;
  startPresence: () => void | Promise<void>;
  copyText: (text: string) => Promise<boolean | undefined>;
  note: (line: string) => void;
  onChange: (state: RelayCatalogState) => void;
  probeSignaling?: (signalingUrl: string) => Promise<ProbeResult>;
  fetchRelayBundle?: (signalingUrl: string) => Promise<FetchRelayBundleResult>;
  parseRedirect?: typeof parseAndVerifyRelayRedirectNote;
  initial?: Partial<RelayCatalogState>;
};

/**
 * Deep module for control-plane Relay catalog: saved list, active settings,
 * share-pack apply, probe/reach, Relay Bundle merge/active/failover.
 * The Pinia servers slice is a thin Vue adapter.
 */
export function createRelayCatalog(deps: RelayCatalogDeps) {
  const probe = deps.probeSignaling ?? defaultProbeSignaling;
  const fetchBundle = deps.fetchRelayBundle ?? defaultFetchRelayBundle;
  const parseRedirect = deps.parseRedirect ?? parseAndVerifyRelayRedirectNote;

  const seed = deps.initial ?? {};
  let settings: UserSettings = seed.settings ?? createUserSettings();
  let savedServers: SavedServer[] = seed.savedServers ?? [];
  let activeServerId: string | null = seed.activeServerId ?? null;
  let relayBundle: RelayBundle = seed.relayBundle ?? {
    urls: [],
    activeUrl: null,
    updatedAt: 0,
  };
  let hostNotice = seed.hostNotice ?? '';
  let manualReach: ServerReach = seed.manualReach ?? 'unknown';
  let shareWithPeer = seed.shareWithPeer ?? true;
  let hostDraft: TurnHostDraft = seed.hostDraft ?? { ...EMPTY_TURN_HOST };

  const snapshot = (): RelayCatalogState => ({
    settings,
    savedServers,
    activeServerId,
    relayBundle,
    hostNotice,
    manualReach,
    shareWithPeer,
    hostDraft,
  });

  const publish = () => deps.onChange(snapshot());

  const persistSavedServers = () => {
    const opfs = deps.getOpfsStore();
    if (!opfs) return;
    void saveSavedServers(opfs, savedServers);
  };

  const persistRelayBundle = () => {
    saveRelayBundle(deps.storage, relayBundle);
  };

  const activateSavedServer = (server: SavedServer, notice?: string) => {
    settings = createUserSettings('custom', server.draft);
    saveUserSettings(settings, deps.storage);
    activeServerId = server.id;
    if (notice) hostNotice = notice;
    void deps.ensurePresenceActive();
  };

  const applyActiveRelayToSettings = (options?: {
    restartPresence?: boolean;
  }) => {
    const url = relayBundle.activeUrl;
    if (!url) return;
    const kind = /^https?:/i.test(url) ? 'http-poll' : 'websocket';
    const draft: CustomServerDraft = {
      signaling: { kind, url },
      iceServers: settings.custom.iceServers.map((server) => ({
        ...server,
      })),
    };
    settings = createUserSettings('custom', draft);
    saveUserSettings(settings, deps.storage);
    if (options?.restartPresence !== false) {
      void deps.ensurePresenceActive();
    }
  };

  const probeAndMark = async (serverId: string) => {
    const server = savedServers.find((item) => item.id === serverId);
    if (!server) return;
    const url = server.draft.signaling.url;
    if (!url) {
      savedServers = savedServers.map((item) =>
        item.id === serverId ? { ...item, reach: 'unknown' } : item,
      );
      publish();
      return;
    }
    savedServers = savedServers.map((item) =>
      item.id === serverId ? { ...item, reach: 'checking' } : item,
    );
    publish();
    const result = await probe(url);
    savedServers = savedServers.map((item) =>
      item.id === serverId
        ? { ...item, reach: result.ok ? 'up' : 'down' }
        : item,
    );
    persistSavedServers();
    publish();
  };

  const rememberDraft = (
    draft: CustomServerDraft,
    notice?: string,
    title?: string,
  ) => {
    const next = upsertSavedServer(savedServers, draft, title);
    savedServers = next.list;
    activateSavedServer(next.server, notice);
    persistSavedServers();
    publish();
    void probeAndMark(next.server.id);
  };

  const applyShareDraft = (draft: CustomServerDraft, notice: string) => {
    rememberDraft(draft, notice, titleFromDraft(draft));
  };

  const shareDraftForInvite = (): CustomServerDraft | null => {
    if (!shareWithPeer) return null;
    const resolved = resolveServers(settings, deps.origin());
    if (!resolved.ok) return null;
    if (!iceServersHaveTurn(resolved.value.iceServers)) return null;
    return iceOnlyShare(resolved.value.iceServers);
  };

  const onPreset = (presetId: string) => {
    settings = { ...settings, presetId };
    saveUserSettings(settings, deps.storage);
    publish();
  };

  const onSaveCustom = (custom: CustomServerDraft) => {
    rememberDraft(custom);
    deps.note(notes.customServerSaved);
    publish();
  };

  const onSaveCustomToList = async (custom: CustomServerDraft) => {
    rememberDraft(custom);
    deps.note(notes.serverInList);
    publish();
  };

  const onSelectSavedServer = (id: string) => {
    const server = savedServers.find((item) => item.id === id);
    if (!server) return;
    activateSavedServer(server);
    publish();
    void probeAndMark(id);
  };

  const onRemoveSavedServer = (id: string) => {
    savedServers = savedServers.filter((item) => item.id !== id);
    if (activeServerId === id) {
      activeServerId = savedServers[0]?.id ?? null;
      const next = savedServers[0];
      if (next) activateSavedServer(next);
    }
    persistSavedServers();
    hostNotice = serversCopy.removedFromList;
    publish();
  };

  const onProbeSavedServer = async (id: string) => {
    await probeAndMark(id);
  };

  const onProbeDraft = async (draft: CustomServerDraft) => {
    const url = draft.signaling.url;
    if (!url) {
      manualReach = 'unknown';
      publish();
      return { ok: false as const, message: serversCopy.socketUrlRequired };
    }
    manualReach = 'checking';
    publish();
    const result = await probe(url);
    manualReach = result.ok ? 'up' : 'down';
    publish();
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, message: result.message };
  };

  const onCopyText = async (text: string, okNotice: string) => {
    const ok = await deps.copyText(text);
    hostNotice = ok ? okNotice : serversCopy.copyFailed;
    publish();
  };

  const onSaveHost = (draft: TurnHostDraft) => {
    void (async () => {
      hostDraft = draft;
      const opfs = deps.getOpfsStore();
      if (opfs) {
        const saved = await saveTurnHost(opfs, draft);
        hostNotice = saved.ok ? serversCopy.hostSaved : saved.message;
      } else {
        hostNotice = serversCopy.opfsUnavailable;
      }
      publish();
    })();
  };

  const onCopyHostScript = (script: string) => {
    void (async () => {
      const ok = await deps.copyText(script);
      hostNotice = ok
        ? serversCopy.commandsCopied
        : serversCopy.commandsCopyFailed;
      publish();
    })();
  };

  const applySharePackText = async (
    text: string,
    options?: { fromQr?: boolean },
  ) => {
    const redirect = await parseRedirect(text);
    if (redirect.ok) {
      const next = mergeRemoteRelays(
        relayBundle,
        redirect.value.relays,
        redirect.value.issuedAt,
      );
      const withActive =
        next.activeUrl === redirect.value.relays[0]
          ? next
          : setActiveRelay(next, redirect.value.relays[0]!);
      relayBundle = withActive;
      persistRelayBundle();
      applyActiveRelayToSettings();
      hostNotice = serversCopy.redirectApplied;
      deps.note(notes.sharePackSaved);
      publish();
      return;
    }
    const packed = decodeSharePack(text);
    if (!packed.ok) {
      hostNotice = packed.message;
      publish();
      return;
    }
    const notice = options?.fromQr
      ? serversCopy.packFromQrSaved
      : serversCopy.packSaved;
    applyShareDraft(packed.value, notice);
    deps.note(
      options?.fromQr ? notes.serversFromQrSaved : notes.sharePackSaved,
    );
    publish();
  };

  const onApplySharePack = (text: string) => {
    void applySharePackText(text);
  };

  const reportHostNotice = (notice: string) => {
    hostNotice = notice;
    publish();
  };

  const seedDemoServers = () => {
    const demos = [
      {
        id: 'demo-alpha',
        title: 'demo-alpha.sslip.io',
        url: 'https://wss-demo-alpha.sslip.io:8443',
        reach: 'up' as const,
      },
      {
        id: 'demo-beta',
        title: 'demo-beta.sslip.io',
        url: 'https://wss-demo-beta.sslip.io:8443',
        reach: 'down' as const,
      },
    ];
    let changed = false;
    for (const demo of demos) {
      if (savedServers.some((item) => item.id === demo.id)) continue;
      const server = createSavedServer(
        {
          signaling: { kind: 'websocket', url: demo.url },
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        },
        demo.title,
      );
      server.id = demo.id;
      server.reach = demo.reach;
      savedServers = [...savedServers, server];
      changed = true;
    }
    if (!changed) return;
    if (!activeServerId && savedServers[0]) {
      activateSavedServer(savedServers[0]);
    }
    persistSavedServers();
    publish();
  };

  const onShareWithPeer = (on: boolean) => {
    shareWithPeer = on;
    publish();
  };

  const onAddRelayUrl = (raw: string) => {
    const next = addRelayUrl(relayBundle, raw);
    if (next === relayBundle) {
      hostNotice = serversCopy.relayInvalid;
      publish();
      return false;
    }
    relayBundle = next;
    persistRelayBundle();
    applyActiveRelayToSettings();
    hostNotice = serversCopy.relayAdded;
    publish();
    return true;
  };

  const onSelectRelayUrl = (raw: string) => {
    const next = setActiveRelay(relayBundle, raw);
    if (next === relayBundle) return;
    const wasPresent = deps.presenceAvailable();
    relayBundle = next;
    persistRelayBundle();
    applyActiveRelayToSettings({ restartPresence: false });
    if (wasPresent) {
      void deps.startPresence();
    } else {
      void deps.ensurePresenceActive();
    }
    hostNotice = serversCopy.relayActive;
    publish();
  };

  const onRemoveRelayUrl = (raw: string) => {
    relayBundle = removeRelayUrl(relayBundle, raw);
    persistRelayBundle();
    applyActiveRelayToSettings();
    hostNotice = serversCopy.relayRemoved;
    publish();
  };

  const refreshRelayBundleFrom = async (
    signalingUrl: string,
  ): Promise<boolean> => {
    const result = await fetchBundle(signalingUrl);
    if (!result.ok) return false;
    const next = mergeRemoteRelays(
      relayBundle,
      remoteRelayUrls(result.value),
      result.value.issuedAt,
    );
    const withSelf = mergeRemoteRelays(
      next,
      [signalingUrl],
      result.value.issuedAt,
    );
    if (
      withSelf.urls.length === relayBundle.urls.length &&
      withSelf.activeUrl === relayBundle.activeUrl &&
      withSelf.updatedAt === relayBundle.updatedAt
    ) {
      return true;
    }
    relayBundle = withSelf;
    persistRelayBundle();
    publish();
    return true;
  };

  const failoverRelay = (failedUrl: string): boolean => {
    const next = applyRelayFailover(relayBundle, failedUrl);
    if (!next) return false;
    relayBundle = next;
    persistRelayBundle();
    applyActiveRelayToSettings({ restartPresence: false });
    const active = next.activeUrl ?? failedUrl;
    hostNotice = serversCopy.relayFailover(active);
    publish();
    return true;
  };

  /** After OPFS opens — load saved list + TURN host into the catalog. */
  const hydrateFromOpfs = async () => {
    const opfs = deps.getOpfsStore();
    if (!opfs) return;
    savedServers = await loadSavedServers(opfs);
    hostDraft = await loadTurnHost(opfs);
    publish();
    for (const server of savedServers) void probeAndMark(server.id);
  };

  return {
    applyShareDraft,
    probeAndMark,
    shareDraftForInvite,
    onPreset,
    onSaveCustom,
    onSaveCustomToList,
    onSelectSavedServer,
    onRemoveSavedServer,
    onProbeSavedServer,
    onProbeDraft,
    onCopyText,
    onSaveHost,
    onCopyHostScript,
    onApplySharePack,
    applySharePackText,
    reportHostNotice,
    onShareWithPeer,
    seedDemoServers,
    onAddRelayUrl,
    onSelectRelayUrl,
    onRemoveRelayUrl,
    refreshRelayBundleFrom,
    failoverRelay,
    hydrateFromOpfs,
  };
}

export type RelayCatalog = ReturnType<typeof createRelayCatalog>;
