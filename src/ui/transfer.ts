import { folderProgress, type FolderTransfer } from '../domain/folder.ts';
import { transferProgress, type Transfer } from '../domain/transfer.ts';
import {
  collectFromDirectory,
  collectFromFileList,
  type PickedFile,
} from '../lib/folder-walk.ts';

export type TransferViewState = {
  connected: boolean;
  current: Transfer | null;
  incoming: Transfer | null;
  folder: FolderTransfer | null;
  incomingFolder: FolderTransfer | null;
  queuedNames: string[];
  error: string;
};

export type TransferHandlers = {
  onPickFile: (file: File) => void;
  onPickFolder: (entries: PickedFile[]) => void;
  onPickError: (message: string) => void;
  onAcceptFile: (transferId: string) => void;
  onRejectFile: (transferId: string) => void;
  onCancelFile: () => void;
  onPauseFile: () => void;
  onResumeFile: () => void;
};

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

const isOpenFolder = (folder: FolderTransfer | null): boolean => {
  if (!folder) return false;
  return (
    folder.state !== 'done' &&
    folder.state !== 'failed' &&
    folder.state !== 'canceled'
  );
};

const fileStatus = (transfer: Transfer): string => {
  const progress = transferProgress(transfer);
  const chunk = `${progress.done}/${progress.total}`;
  const label = transfer.path || transfer.name;
  if (transfer.state === 'offering') {
    return transfer.direction === 'send'
      ? `ждём согласие · ${label}`
      : `принять ${label} (${formatSize(transfer.size)})`;
  }
  if (transfer.state === 'sending') return `отправка ${label} ${chunk}`;
  if (transfer.state === 'receiving') return `приём ${label} ${chunk}`;
  if (transfer.state === 'writing') return `запись ${label}`;
  if (transfer.state === 'paused') {
    return `пауза ${label} ${chunk} · можно докачать`;
  }
  if (transfer.state === 'done') return `готово: ${label}`;
  if (transfer.state === 'canceled') return `отменено: ${label}`;
  if (transfer.state === 'failed') {
    return `ошибка ${label}: ${transfer.error}`;
  }
  return label;
};

const folderStatus = (
  folder: FolderTransfer,
  current: Transfer | null,
): string => {
  const progress = folderProgress(folder);
  const count = `${progress.done}/${progress.total}`;
  const currentPath = current?.path ?? folder.name;
  if (folder.state === 'offering') {
    return folder.direction === 'send'
      ? `ждём согласие · папка ${folder.name} (${progress.total} файлов)`
      : `принять папку ${folder.name} (${progress.total} файлов, ${formatSize(folder.totalSize)})`;
  }
  if (folder.state === 'sending') {
    return `отправка ${count} · ${currentPath}`;
  }
  if (folder.state === 'receiving') {
    return `приём ${count} · ${currentPath}`;
  }
  if (folder.state === 'done') return `готово: папка ${folder.name}`;
  if (folder.state === 'canceled') return `отменено: папка ${folder.name}`;
  if (folder.state === 'failed') {
    return `ошибка папки ${folder.name}: ${folder.error}`;
  }
  return `папка ${folder.name}`;
};

const pickDirectory = async (
  fallback: HTMLInputElement,
  handlers: TransferHandlers,
) => {
  const picker = Reflect.get(window, 'showDirectoryPicker');
  if (typeof picker === 'function') {
    try {
      const handle = (await picker.call(window)) as FileSystemDirectoryHandle;
      const walked = await collectFromDirectory(handle);
      if (!walked.ok) {
        handlers.onPickError(walked.message);
        return;
      }
      handlers.onPickFolder(walked.value);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
    }
  }
  fallback.click();
};

export const mountTransfer = (
  root: HTMLElement,
  handlers: TransferHandlers,
) => {
  const panel = document.createElement('fieldset');
  panel.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Передача';
  panel.append(legend);

  const pick = document.createElement('input');
  pick.type = 'file';
  pick.className = 'file-input';
  pick.setAttribute('aria-label', 'Выбрать файл для отправки');
  pick.addEventListener('change', () => {
    const file = pick.files?.[0];
    if (file) handlers.onPickFile(file);
    pick.value = '';
  });

  const pickFolder = document.createElement('input');
  pickFolder.type = 'file';
  pickFolder.className = 'file-input';
  pickFolder.multiple = true;
  pickFolder.setAttribute('webkitdirectory', '');
  pickFolder.setAttribute('directory', '');
  pickFolder.setAttribute('aria-label', 'Выбрать папку для отправки');
  pickFolder.addEventListener('change', () => {
    const files = pickFolder.files;
    pickFolder.value = '';
    if (!files || files.length === 0) return;
    const walked = collectFromFileList(files);
    if (!walked.ok) {
      handlers.onPickError(walked.message);
      return;
    }
    handlers.onPickFolder(walked.value);
  });

  const send = document.createElement('button');
  send.type = 'button';
  send.className = 'button button-accent';
  send.textContent = 'Отправить файл';
  send.addEventListener('click', () => pick.click());

  const sendFolder = document.createElement('button');
  sendFolder.type = 'button';
  sendFolder.className = 'button';
  sendFolder.textContent = 'Отправить папку';
  sendFolder.addEventListener('click', () => {
    void pickDirectory(pickFolder, handlers);
  });

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'button';
  accept.textContent = 'Принять';

  const reject = document.createElement('button');
  reject.type = 'button';
  reject.className = 'button button-secondary';
  reject.textContent = 'Отклонить';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'button button-secondary';
  cancel.textContent = 'Отменить';
  cancel.addEventListener('click', () => handlers.onCancelFile());

  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'button button-secondary';
  pause.textContent = 'Пауза';
  pause.addEventListener('click', () => handlers.onPauseFile());

  const resume = document.createElement('button');
  resume.type = 'button';
  resume.className = 'button';
  resume.textContent = 'Продолжить';
  resume.addEventListener('click', () => handlers.onResumeFile());

  const actions = document.createElement('div');
  actions.className = 'home-actions';
  actions.append(send, sendFolder, accept, reject, pause, resume, cancel);

  const status = document.createElement('p');
  status.className = 'tagline';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const error = document.createElement('p');
  error.className = 'error';
  error.hidden = true;
  error.setAttribute('role', 'alert');

  panel.append(pick, pickFolder, actions, status, error);
  root.append(panel);

  return {
    sync(state: TransferViewState) {
      const incomingFile =
        state.incoming && !state.incoming.folderId ? state.incoming : null;
      const needAccept = Boolean(state.incomingFolder || incomingFile);
      const openFolder =
        isOpenFolder(state.folder) || Boolean(state.incomingFolder);
      const queued = state.queuedNames.length > 0;
      panel.hidden = false;
      const blocked =
        Boolean(state.current) || Boolean(state.incoming) || openFolder;
      send.disabled = blocked;
      sendFolder.disabled = blocked;
      accept.hidden = !needAccept;
      reject.hidden = !needAccept;
      accept.textContent = state.incomingFolder
        ? 'Принять папку'
        : 'Принять файл';
      accept.onclick = () => {
        if (state.incomingFolder) {
          handlers.onAcceptFile(state.incomingFolder.id);
          return;
        }
        if (incomingFile) handlers.onAcceptFile(incomingFile.id);
      };
      reject.onclick = () => {
        if (state.incomingFolder) {
          handlers.onRejectFile(state.incomingFolder.id);
          return;
        }
        if (incomingFile) handlers.onRejectFile(incomingFile.id);
      };
      const busy =
        state.current?.state === 'sending' ||
        state.current?.state === 'receiving' ||
        state.folder?.state === 'sending' ||
        state.folder?.state === 'receiving';
      const paused = state.current?.state === 'paused';
      pause.hidden = !busy;
      resume.hidden = !paused;
      cancel.hidden = !busy && !paused;
      const shownFolder = state.incomingFolder ?? state.folder;
      const shownFile = incomingFile ?? state.current;
      let text = '';
      if (shownFolder) text = folderStatus(shownFolder, shownFile);
      else if (shownFile) text = fileStatus(shownFile);
      else if (queued) {
        text = `в очереди: ${state.queuedNames.join(', ')} — уйдёт после соединения`;
      } else if (!state.connected) {
        text = 'файл можно выбрать сейчас — уйдёт после соединения';
      }
      status.hidden = !text;
      status.textContent = text;
      error.hidden = !state.error;
      error.textContent = state.error;
    },
  };
};
