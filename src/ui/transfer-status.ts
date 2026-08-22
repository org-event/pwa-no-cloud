import { folderProgress, type FolderTransfer } from '../domain/folder.ts';
import { transferProgress, type Transfer } from '../domain/transfer.ts';

export type TransferViewState = {
  connected: boolean;
  current: Transfer | null;
  incoming: Transfer | null;
  folder: FolderTransfer | null;
  incomingFolder: FolderTransfer | null;
  queuedNames: string[];
  error: string;
};

const formatSize = (size: number): string => {
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
};

export const isOpenFolder = (folder: FolderTransfer | null): boolean => {
  if (!folder) return false;
  return (
    folder.state !== 'done' &&
    folder.state !== 'failed' &&
    folder.state !== 'canceled'
  );
};

export const fileStatus = (transfer: Transfer): string => {
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

export const folderStatus = (
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
