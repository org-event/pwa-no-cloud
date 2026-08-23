import { notes, serversCopy } from '@/content/index.ts';
import {
  createUserSettings,
  decodeSharePack,
  iceOnlyShare,
  iceServersHaveTurn,
  resolveServers,
  saveUserSettings,
} from '@/config/index.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import { titleFromDraft } from '@/domain/saved-server.ts';
import { createSavedServer, type SavedServer } from '@/domain/saved-server.ts';
import { canScanQr, decodeQrFromFile } from '@/lib/scan-qr.ts';
import { probeSignaling } from '@/lib/probe-signaling.ts';
import {
  saveSavedServers,
  upsertSavedServer,
} from '@/lib/saved-servers-store.ts';
import type { TurnHostDraft } from '@/domain/index.ts';
import { saveTurnHost } from '@/lib/turn-host-store.ts';
import type { NocloudContext } from './context.ts';

export function createServersSlice(ctx: NocloudContext) {
  const { state, storage, touch, note } = ctx;

  const persistSavedServers = () => {
    if (!state.store) return;
    void saveSavedServers(state.store, state.savedServers);
  };

  const activateSavedServer = (server: SavedServer, notice?: string) => {
    state.settings = createUserSettings('custom', server.draft);
    saveUserSettings(state.settings, storage);
    state.activeServerId = server.id;
    if (notice) state.hostNotice = notice;
    void ctx.refs.ensurePresenceActive?.();
  };

  const probeAndMark = async (serverId: string) => {
    const server = state.savedServers.find((item) => item.id === serverId);
    if (!server) return;
    const url = server.draft.signaling.url;
    if (!url) {
      state.savedServers = state.savedServers.map((item) =>
        item.id === serverId ? { ...item, reach: 'unknown' } : item,
      );
      touch();
      return;
    }
    state.savedServers = state.savedServers.map((item) =>
      item.id === serverId ? { ...item, reach: 'checking' } : item,
    );
    touch();
    const result = await probeSignaling(url);
    state.savedServers = state.savedServers.map((item) =>
      item.id === serverId
        ? { ...item, reach: result.ok ? 'up' : 'down' }
        : item,
    );
    persistSavedServers();
    touch();
  };

  const rememberDraft = (
    draft: CustomServerDraft,
    notice?: string,
    title?: string,
  ) => {
    const next = upsertSavedServer(state.savedServers, draft, title);
    state.savedServers = next.list;
    activateSavedServer(next.server, notice);
    persistSavedServers();
    void ctx.refs.probeAndMark?.(next.server.id);
  };

  const applyShareDraft = (draft: CustomServerDraft, notice: string) => {
    rememberDraft(draft, notice, titleFromDraft(draft));
  };

  const shareDraftForInvite = (): CustomServerDraft | null => {
    if (!state.shareWithPeer) return null;
    const resolved = resolveServers(state.settings, ctx.origin);
    if (!resolved.ok) return null;
    if (!iceServersHaveTurn(resolved.value.iceServers)) return null;
    return iceOnlyShare(resolved.value.iceServers);
  };

  function onPreset(presetId: string) {
    state.settings = { ...state.settings, presetId };
    saveUserSettings(state.settings, storage);
    touch();
  }

  function onSaveCustom(custom: CustomServerDraft) {
    rememberDraft(custom);
    note(notes.customServerSaved);
    touch();
  }

  async function onSaveCustomToList(custom: CustomServerDraft) {
    rememberDraft(custom);
    note(notes.serverInList);
    touch();
  }

  function onSelectSavedServer(id: string) {
    const server = state.savedServers.find((item) => item.id === id);
    if (!server) return;
    activateSavedServer(server);
    touch();
    void probeAndMark(id);
  }

  function onRemoveSavedServer(id: string) {
    state.savedServers = state.savedServers.filter((item) => item.id !== id);
    if (state.activeServerId === id) {
      state.activeServerId = state.savedServers[0]?.id ?? null;
      const next = state.savedServers[0];
      if (next) activateSavedServer(next);
    }
    persistSavedServers();
    state.hostNotice = serversCopy.removedFromList;
    touch();
  }

  async function onProbeSavedServer(id: string) {
    await probeAndMark(id);
  }

  async function onProbeDraft(draft: CustomServerDraft) {
    const url = draft.signaling.url;
    if (!url) {
      state.manualReach = 'unknown';
      touch();
      return { ok: false as const, message: serversCopy.socketUrlRequired };
    }
    state.manualReach = 'checking';
    touch();
    const result = await probeSignaling(url);
    state.manualReach = result.ok ? 'up' : 'down';
    touch();
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, message: result.message };
  }

  async function onCopyText(text: string, okNotice: string) {
    const ok = await ctx.refs.copyText?.(text);
    state.hostNotice = ok ? okNotice : serversCopy.copyFailed;
    touch();
  }

  function onSaveHost(draft: TurnHostDraft) {
    void (async () => {
      state.hostDraft = draft;
      if (state.store) {
        const saved = await saveTurnHost(state.store, draft);
        state.hostNotice = saved.ok ? serversCopy.hostSaved : saved.message;
      } else {
        state.hostNotice = serversCopy.opfsUnavailable;
      }
      touch();
    })();
  }

  function onCopyHostScript(script: string) {
    void (async () => {
      const ok = await ctx.refs.copyText?.(script);
      state.hostNotice = ok
        ? serversCopy.commandsCopied
        : serversCopy.commandsCopyFailed;
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
    applyShareDraft(packed.value, serversCopy.packSaved);
    note(notes.sharePackSaved);
    touch();
  }

  function onScanSharePack(file: File) {
    void (async () => {
      if (!canScanQr()) {
        state.hostNotice = serversCopy.qrUnsupported;
        touch();
        return;
      }
      const raw = await decodeQrFromFile(file);
      if (!raw) {
        state.hostNotice = serversCopy.qrNotRecognized;
        touch();
        return;
      }
      const packed = decodeSharePack(raw);
      if (!packed.ok) {
        state.hostNotice = packed.message;
        touch();
        return;
      }
      applyShareDraft(packed.value, serversCopy.packFromQrSaved);
      note(notes.serversFromQrSaved);
      touch();
    })();
  }

  function seedDemoServers() {
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
      if (state.savedServers.some((item) => item.id === demo.id)) continue;
      const server = createSavedServer(
        {
          signaling: { kind: 'websocket', url: demo.url },
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        },
        demo.title,
      );
      server.id = demo.id;
      server.reach = demo.reach;
      state.savedServers = [...state.savedServers, server];
      changed = true;
    }
    if (!changed) return;
    if (!state.activeServerId && state.savedServers[0]) {
      activateSavedServer(state.savedServers[0]);
    }
    persistSavedServers();
    touch();
  }

  function onShareWithPeer(on: boolean) {
    state.shareWithPeer = on;
    touch();
  }

  return {
    persistSavedServers,
    activateSavedServer,
    rememberDraft,
    probeAndMark,
    applyShareDraft,
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
    onScanSharePack,
    onShareWithPeer,
    seedDemoServers,
  };
}
