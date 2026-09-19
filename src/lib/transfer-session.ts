import { transferCopy } from '@/content/index.ts';
import type { SessionState } from '@/domain/session.ts';
import type { PickedFile } from '@/lib/folder-walk.ts';
import type { TransferPort } from '@/lib/transfer-port.ts';

export type TransferLinkView = {
  state: SessionState;
  roomId: string;
};

export type TransferSessionState = {
  queuedFiles: File[];
  queuedFolder: PickedFile[] | null;
  queuedFolderLabel: string;
  transferError: string;
};

export type TransferSessionCopy = {
  needContact: string;
  needFiles: string;
};

export type TransferSessionDeps = {
  getPort: () => TransferPort | null;
  getLink: () => TransferLinkView | null;
  knockOn?: (peerId: string, asHost: boolean) => Promise<void>;
  meetRoomId: (contactId: string) => string;
  /** May also persist UI selection (e.g. live peer → selected contact). */
  resolveContactId: () => string | null;
  ensureLivePeerInBook?: () => void;
  requestNotify?: () => void;
  note: (line: string) => void;
  notesQueued: (label: string) => string;
  onChange: (state: TransferSessionState) => void;
  copy?: TransferSessionCopy;
};

const defaultCopy = (): TransferSessionCopy => ({
  needContact: transferCopy.needContact,
  needFiles: transferCopy.needFiles,
});

/**
 * Deep module for Transfer product behaviour: stage queue, send over Link,
 * and accept/reject/cancel on the open TransferPort.
 */
export function createTransferSession(deps: TransferSessionDeps) {
  const copy = deps.copy ?? defaultCopy();
  let queuedFiles: File[] = [];
  let queuedFolder: PickedFile[] | null = null;
  let queuedFolderLabel = '';
  let transferError = '';

  const snapshot = (): TransferSessionState => ({
    queuedFiles,
    queuedFolder,
    queuedFolderLabel,
    transferError,
  });

  const publish = () => deps.onChange(snapshot());

  const flushQueue = () => {
    const link = deps.getLink();
    if (!link || link.state !== 'connected') return;
    const port = deps.getPort();
    if (!port || port.activeFile()) return;
    if (queuedFolder && queuedFolder.length > 0) {
      const folder = queuedFolder;
      queuedFolder = null;
      port.sendFolder(folder);
      publish();
      return;
    }
    const next = queuedFiles[0];
    if (!next) return;
    queuedFiles = queuedFiles.slice(1);
    port.sendFile(next);
    publish();
  };

  const queueFile = (file: File) => {
    queuedFiles = [...queuedFiles, file];
    transferError = '';
    deps.note(deps.notesQueued(file.name));
    publish();
  };

  const pickFile = (file: File) => {
    queuedFolder = null;
    queuedFolderLabel = '';
    queuedFiles = [...queuedFiles, file];
    transferError = '';
    deps.note(deps.notesQueued(file.name));
    publish();
  };

  const pickFiles = (files: File[]) => {
    if (files.length === 0) return;
    queuedFolder = null;
    queuedFolderLabel = '';
    transferError = '';
    for (const file of files) {
      queuedFiles = [...queuedFiles, file];
      deps.note(deps.notesQueued(file.name));
    }
    publish();
  };

  const pickFolder = (entries: PickedFile[], label = '') => {
    transferError = '';
    if (entries.length === 0) {
      transferError = copy.needFiles;
      publish();
      return;
    }
    const folderLabel =
      label.trim() || entries[0]?.path.split('/')[0] || 'folder';
    queuedFiles = [];
    queuedFolderLabel = folderLabel;
    queuedFolder = entries.map((entry) => ({
      path: entry.path,
      file: entry.file,
    }));
    deps.note(deps.notesQueued(folderLabel));
    publish();
  };

  const clearStaged = () => {
    queuedFiles = [];
    queuedFolder = null;
    queuedFolderLabel = '';
    transferError = '';
    publish();
  };

  const pickError = (message: string) => {
    transferError = message;
    publish();
  };

  const send = async () => {
    transferError = '';
    deps.ensureLivePeerInBook?.();
    const contactId = deps.resolveContactId();
    if (!contactId) {
      transferError = copy.needContact;
      publish();
      return;
    }
    const hasFiles =
      queuedFiles.length > 0 ||
      Boolean(queuedFolder && queuedFolder.length > 0);
    if (!hasFiles) {
      transferError = copy.needFiles;
      publish();
      return;
    }
    const target = deps.meetRoomId(contactId);
    const link = deps.getLink();
    if (link?.state === 'connected' && link.roomId === target) {
      flushQueue();
      publish();
      return;
    }
    if (!deps.knockOn) {
      transferError = copy.needContact;
      publish();
      return;
    }
    await deps.knockOn(contactId, false);
    flushQueue();
    publish();
  };

  const accept = (transferId: string) => {
    transferError = '';
    deps.ensureLivePeerInBook?.();
    deps.requestNotify?.();
    deps.getPort()?.accept(transferId);
    publish();
  };

  const reject = (transferId: string) => {
    deps.getPort()?.reject(transferId);
    publish();
  };

  const cancel = () => {
    deps.getPort()?.cancel();
    publish();
  };

  const pause = () => {
    deps.getPort()?.pause();
    publish();
  };

  const resume = () => {
    deps.getPort()?.resume();
    publish();
  };

  return {
    getState: snapshot,
    flushQueue,
    queueFile,
    pickFile,
    pickFiles,
    pickFolder,
    clearStaged,
    pickError,
    send,
    accept,
    reject,
    cancel,
    pause,
    resume,
  };
}

export type TransferSession = ReturnType<typeof createTransferSession>;
