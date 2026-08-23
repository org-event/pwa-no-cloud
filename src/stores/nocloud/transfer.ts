import { notes, transferCopy } from '@/content/index.ts';
import { meetRoomId } from '@/domain/profile.ts';
import type { InboxEntry } from '@/lib/opfs.ts';
import {
  appendLog,
  listInbox,
  readInboxFile,
  removeInboxFile,
} from '@/lib/opfs.ts';
import { requestNotifyPermission } from '@/lib/notify.ts';
import type { PickedFile } from '@/lib/folder-walk.ts';
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

  const flushQueue = () => {
    if (!state.peer || state.peer.state !== 'connected') return;
    if (state.peer.activeFile()) return;
    if (state.queuedFolder && state.queuedFolder.length > 0) {
      const folder = state.queuedFolder;
      state.queuedFolder = null;
      state.peer.sendFolder(folder);
      return;
    }
    const next = state.queuedFiles[0];
    if (!next) return;
    state.queuedFiles = state.queuedFiles.slice(1);
    state.peer.sendFile(next);
  };

  const queueFile = (file: File) => {
    state.queuedFiles = [...state.queuedFiles, markRaw(file)];
    state.transferError = '';
    ctx.note(notes.queued(file.name));
  };

  function onPickFile(file: File) {
    state.queuedFolder = null;
    state.queuedFolderLabel = '';
    queueFile(file);
    touch();
  }

  function onPickFiles(files: File[]) {
    if (files.length === 0) return;
    state.queuedFolder = null;
    state.queuedFolderLabel = '';
    state.transferError = '';
    for (const file of files) queueFile(file);
    touch();
  }

  function onPickFolder(entries: PickedFile[], label = '') {
    state.transferError = '';
    if (entries.length === 0) {
      state.transferError = transferCopy.needFiles;
      touch();
      return;
    }
    const folderLabel =
      label.trim() || entries[0]?.path.split('/')[0] || 'folder';
    state.queuedFiles = [];
    state.queuedFolderLabel = folderLabel;
    state.queuedFolder = entries.map((entry) => ({
      path: entry.path,
      file: markRaw(entry.file),
    }));
    ctx.note(notes.queued(folderLabel));
    touch();
  }

  function onClearStaged() {
    state.queuedFiles = [];
    state.queuedFolder = null;
    state.queuedFolderLabel = '';
    state.transferError = '';
    touch();
  }

  function onPickError(message: string) {
    state.transferError = message;
    touch();
  }

  async function onSendTransfer() {
    state.transferError = '';
    const contactId = state.selectedContactIds[0];
    if (!contactId) {
      state.transferError = transferCopy.needContact;
      touch();
      return;
    }
    const hasFiles =
      state.queuedFiles.length > 0 ||
      Boolean(state.queuedFolder && state.queuedFolder.length > 0);
    if (!hasFiles) {
      state.transferError = transferCopy.needFiles;
      touch();
      return;
    }
    const target = meetRoomId(contactId);
    if (state.peer?.state === 'connected' && state.roomId === target) {
      flushQueue();
      touch();
      return;
    }
    const knock = ctx.refs.knockOn;
    if (!knock) {
      state.transferError = transferCopy.needContact;
      touch();
      return;
    }
    await knock(contactId, true);
    flushQueue();
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

  return {
    setInboxError,
    refreshInbox,
    flushQueue,
    queueFile,
    onPickFile,
    onPickFiles,
    onPickFolder,
    onClearStaged,
    onPickError,
    onSendTransfer,
    onAcceptFile,
    onRejectFile,
    onCancelFile,
    onPauseFile,
    onResumeFile,
    onRead,
    onRemove,
    onSelect,
  };
}
