import { shellCopy } from '@/content/index.ts';
import { openStore, readAppLog, clearAppLog } from '@/lib/opfs.ts';
import { loadAddressBook } from '@/lib/contacts-store.ts';
import { requestPersist } from '@/lib/quota.ts';
import { filesFromShare } from '@/lib/share.ts';
import { APP_VERSION } from '@/config/index.ts';
import type { NocloudContext } from './context.ts';

export type ShellDeps = {
  /** Load saved servers + TURN host into RelayCatalog after OPFS opens. */
  hydrateServersFromOpfs: () => Promise<void>;
};

export function createShellSlice(ctx: NocloudContext, deps: ShellDeps) {
  const { state, app, touch } = ctx;

  function onInstall() {
    void app.install();
  }

  function onCheckUpdate() {
    void (async () => {
      state.updateChecking = true;
      state.updateNotice = shellCopy.checking;
      touch();
      const decision = await app.checkForUpdate(APP_VERSION);
      state.updateChecking = false;
      if (decision === 'reload') {
        state.updateNotice = shellCopy.reloading;
        touch();
        await app.refreshShell();
        return;
      }
      const wipe = globalThis.confirm(
        decision === 'current'
          ? shellCopy.confirmCurrent
          : shellCopy.confirmFailed,
      );
      if (wipe) {
        state.updateNotice = shellCopy.wipingCache;
        touch();
        await app.refreshShell();
        return;
      }
      state.updateNotice =
        decision === 'current' ? shellCopy.upToDate : shellCopy.checkFailed;
      touch();
    })();
  }

  async function init() {
    const redraw = () => touch();

    app.watchUpdates(APP_VERSION);
    app.on('network', (data) => {
      redraw();
      const online =
        data && typeof data === 'object' && 'online' in data
          ? Boolean((data as { online: boolean }).online)
          : app.online;
      if (online) {
        ctx.ports.session.resumeMeetRoom?.();
        void ctx.ports.presence.ensurePresenceActive?.();
      }
    });
    app.on('install', redraw);
    app.on('installed', redraw);
    app.on('share-files', (data) => {
      const files = filesFromShare(data);
      if (files.length === 0) return;
      state.transferError = '';
      for (const file of files) ctx.ports.transfer.queueFile?.(file);
      ctx.ports.transfer.flushQueue?.();
      touch();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          ctx.ports.session.resumeMeetRoom?.();
          void ctx.ports.presence.ensurePresenceActive?.();
        }
      });
    }
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('pageshow', () => {
        void ctx.ports.presence.ensurePresenceActive?.();
      });
      globalThis.addEventListener('focus', () => {
        void ctx.ports.presence.ensurePresenceActive?.();
      });
    }

    const opened = await openStore();
    if (opened.ok) {
      state.store = opened.value;
      void requestPersist();
      const existing = await readAppLog(state.store);
      if (existing.ok) state.logText = existing.value;
      else state.logError = existing.message;
      await ctx.ports.transfer.refreshInbox?.();
      await deps.hydrateServersFromOpfs();
      state.book = await loadAddressBook(state.store);
      state.contactsNotice = '';
      await ctx.ports.contacts.seedDemoContacts?.();
    } else {
      state.inboxError = opened.message;
      state.logError = opened.message;
    }
    touch();
    ctx.ports.session.consumeDeepLink?.();
    globalThis.addEventListener('hashchange', () =>
      ctx.ports.session.consumeDeepLink?.(),
    );
    void ctx.ports.presence.ensurePresenceActive?.();
  }

  function onClearLogs() {
    state.logText = '';
    state.logError = '';
    touch();
    const store = state.store;
    if (!store) return;
    void (async () => {
      const cleared = await clearAppLog(store);
      if (!cleared.ok) {
        state.logError = cleared.message;
        touch();
      }
    })();
  }

  return {
    init,
    onInstall,
    onCheckUpdate,
    onClearLogs,
  };
}
