import { notes, componentsCopy } from '@/content/index.ts';
import { meetRoomId } from '@/domain/profile.ts';
import type { InboxEntry } from '@/lib/opfs.ts';
import {
  appendLog,
  listInbox,
  readInboxBlob,
  removeInboxFile,
} from '@/lib/opfs.ts';
import { saveFileToDevice } from '@/lib/save-file.ts';
import { requestNotifyPermission } from '@/lib/notify.ts';
import type { PickedFile } from '@/lib/folder-walk.ts';
import {
  createTransferSession,
  type TransferSessionState,
} from '@/lib/transfer-session.ts';
import { markRaw } from 'vue';
import type { NocloudContext } from './context.ts';

export function createTransferSlice(ctx: NocloudContext) {
  const { state, touch } = ctx;

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

  const syncStaging = (next: TransferSessionState) => {
    state.queuedFiles = next.queuedFiles.map((file) => markRaw(file));
    state.queuedFolder = next.queuedFolder
      ? next.queuedFolder.map((entry) => ({
          path: entry.path,
          file: markRaw(entry.file),
        }))
      : null;
    state.queuedFolderLabel = next.queuedFolderLabel;
    state.transferError = next.transferError;
    touch();
  };

  const session = createTransferSession({
    getPort: () => state.peer?.transfer ?? null,
    getLink: () =>
      state.peer
        ? { state: state.peer.state, roomId: state.peer.roomId }
        : null,
    knockOn: async (peerId, asHost) => {
      await ctx.ports.contacts.knockOn?.(peerId, asHost);
    },
    meetRoomId,
    resolveContactId: () => {
      let contactId = state.selectedContactIds[0] ?? null;
      if (!contactId && state.livePeerId && state.livePeerId !== state.me.id) {
        contactId = state.livePeerId;
        state.selectedContactIds = [contactId];
        state.selectedGroupIds = [];
      }
      return contactId;
    },
    ensureLivePeerInBook: () => ctx.ports.contacts.ensureLivePeerInBook?.(),
    requestNotify: () => {
      void requestNotifyPermission();
    },
    note: ctx.note,
    notesQueued: notes.queued,
    onChange: syncStaging,
  });

  function onSave(entry: InboxEntry) {
    void (async () => {
      if (!state.store) return;
      const blob = await readInboxBlob(
        state.store,
        entry.transferId,
        entry.name,
      );
      if (!blob.ok) {
        setInboxError(blob.message);
        touch();
        return;
      }
      try {
        const result = await saveFileToDevice(blob.value);
        if (result === 'aborted') {
          state.inboxError = '';
          state.preview = componentsCopy.inbox.saveAborted;
          touch();
          return;
        }
        state.inboxError = '';
        state.preview = componentsCopy.inbox.saved;
        await appendLog(state.store, `save ${entry.transferId}/${entry.name}`);
        touch();
      } catch {
        setInboxError(componentsCopy.inbox.saveFailed);
        touch();
      }
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

  return {
    setInboxError,
    refreshInbox,
    flushQueue: session.flushQueue,
    queueFile: session.queueFile,
    onPickFile: session.pickFile,
    onPickFiles: session.pickFiles,
    onPickFolder: (entries: PickedFile[], label = '') =>
      session.pickFolder(entries, label),
    onClearStaged: session.clearStaged,
    onPickError: session.pickError,
    onSendTransfer: session.send,
    onAcceptFile: session.accept,
    onRejectFile: session.reject,
    onCancelFile: session.cancel,
    onPauseFile: session.pause,
    onResumeFile: session.resume,
    onSave,
    onRemove,
    onSelect,
  };
}
