import { serversCopy } from '@/content/index.ts';
import {
  createRelayCatalog,
  type RelayCatalogState,
} from '@/lib/relay-catalog.ts';
import { canScanQr, decodeQrFromFile } from '@/lib/scan-qr.ts';
import type { NocloudContext } from './context.ts';

export function createServersSlice(ctx: NocloudContext) {
  const { state, storage, touch, note } = ctx;

  const syncUi = (next: RelayCatalogState) => {
    state.settings = next.settings;
    state.savedServers = next.savedServers;
    state.activeServerId = next.activeServerId;
    state.relayBundle = next.relayBundle;
    state.hostNotice = next.hostNotice;
    state.manualReach = next.manualReach;
    state.shareWithPeer = next.shareWithPeer;
    state.hostDraft = next.hostDraft;
    touch();
  };

  const catalog = createRelayCatalog({
    storage,
    getOpfsStore: () => state.store,
    origin: () => ctx.origin,
    presenceAvailable: () => state.presenceAvailable,
    ensurePresenceActive: () => {
      void ctx.ports.presence.ensurePresenceActive?.();
    },
    startPresence: () => {
      void ctx.ports.presence.startPresence?.();
    },
    copyText: async (text) => ctx.ports.session.copyText?.(text),
    note,
    onChange: syncUi,
    initial: {
      settings: state.settings,
      savedServers: state.savedServers,
      activeServerId: state.activeServerId,
      relayBundle: state.relayBundle,
      hostNotice: state.hostNotice,
      manualReach: state.manualReach,
      shareWithPeer: state.shareWithPeer,
      hostDraft: state.hostDraft,
    },
  });

  function onScanSharePack(file: File) {
    void (async () => {
      if (!canScanQr()) {
        catalog.reportHostNotice(serversCopy.qrUnsupported);
        return;
      }
      const raw = await decodeQrFromFile(file);
      if (!raw) {
        catalog.reportHostNotice(serversCopy.qrNotRecognized);
        return;
      }
      await catalog.applySharePackText(raw, { fromQr: true });
    })();
  }

  return {
    applyShareDraft: catalog.applyShareDraft,
    probeAndMark: catalog.probeAndMark,
    shareDraftForInvite: catalog.shareDraftForInvite,
    onPreset: catalog.onPreset,
    onSaveCustom: catalog.onSaveCustom,
    onSaveCustomToList: catalog.onSaveCustomToList,
    onSelectSavedServer: catalog.onSelectSavedServer,
    onRemoveSavedServer: catalog.onRemoveSavedServer,
    onProbeSavedServer: catalog.onProbeSavedServer,
    onProbeDraft: catalog.onProbeDraft,
    onCopyText: catalog.onCopyText,
    onSaveHost: catalog.onSaveHost,
    onCopyHostScript: catalog.onCopyHostScript,
    onApplySharePack: catalog.onApplySharePack,
    onScanSharePack,
    onShareWithPeer: catalog.onShareWithPeer,
    seedDemoServers: catalog.seedDemoServers,
    onAddRelayUrl: catalog.onAddRelayUrl,
    onSelectRelayUrl: catalog.onSelectRelayUrl,
    onRemoveRelayUrl: catalog.onRemoveRelayUrl,
    refreshRelayBundleFrom: catalog.refreshRelayBundleFrom,
    failoverRelay: catalog.failoverRelay,
    hydrateFromOpfs: catalog.hydrateFromOpfs,
  };
}
