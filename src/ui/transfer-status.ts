import { transferCopy } from '@/content/index.ts';
import { folderProgress, type FolderTransfer } from '@/domain/folder.ts';
import { transferProgress, type Transfer } from '@/domain/transfer.ts';

export type QueuedItemView = {
  key: string;
  name: string;
  size: number;
};

export type TransferViewState = {
  connected: boolean;
  current: Transfer | null;
  incoming: Transfer | null;
  folder: FolderTransfer | null;
  incomingFolder: FolderTransfer | null;
  queuedNames: string[];
  queuedItems: QueuedItemView[];
  queuedFolderName: string;
  queuedFolderCount: number;
  queuedFolderItems: QueuedItemView[];
  queuedFolderBytes: number;
  queuedBytes: number;
  error: string;
};

const formatSize = (size: number): string => {
  if (size < 1024) return transferCopy.sizeBytes(size);
  if (size < 1024 * 1024) return transferCopy.sizeKb(size);
  return transferCopy.sizeMb(size);
};

export const formatSizeLabel = formatSize;

export const isOpenFolder = (folder: FolderTransfer | null): boolean => {
  if (!folder) return false;
  return (
    folder.state !== 'done' &&
    folder.state !== 'failed' &&
    folder.state !== 'canceled'
  );
};

export const transferPercent = (transfer: Transfer): number => {
  if (transfer.state === 'done') return 100;
  const progress = transferProgress(transfer);
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.round((100 * progress.done) / progress.total));
};

export const transferBytes = (
  transfer: Transfer,
): { done: number; total: number } => {
  const progress = transferProgress(transfer);
  if (progress.total <= 0) {
    return {
      done: transfer.state === 'done' ? transfer.size : 0,
      total: transfer.size,
    };
  }
  const done = Math.min(
    transfer.size,
    Math.round((transfer.size * progress.done) / progress.total),
  );
  return { done, total: transfer.size };
};

export const folderPercent = (folder: FolderTransfer): number => {
  if (folder.state === 'done') return 100;
  const progress = folderProgress(folder);
  if (progress.total <= 0) return 0;
  return Math.min(100, Math.round((100 * progress.done) / progress.total));
};

export const fileStatus = (transfer: Transfer): string => {
  const progress = transferProgress(transfer);
  const chunk = `${progress.done}/${progress.total}`;
  const label = transfer.path || transfer.name;
  if (transfer.state === 'offering') {
    return transfer.direction === 'send'
      ? transferCopy.waitingConsent(label)
      : transferCopy.acceptFile(label, formatSize(transfer.size));
  }
  if (transfer.state === 'sending') return transferCopy.sending(label, chunk);
  if (transfer.state === 'receiving')
    return transferCopy.receiving(label, chunk);
  if (transfer.state === 'writing') return transferCopy.writing(label);
  if (transfer.state === 'paused') {
    return transferCopy.paused(label, chunk);
  }
  if (transfer.state === 'done') return transferCopy.done(label);
  if (transfer.state === 'canceled') return transferCopy.canceled(label);
  if (transfer.state === 'failed') {
    return transferCopy.failed(label, transfer.error);
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
      ? transferCopy.folderWaitingConsent(folder.name, progress.total)
      : transferCopy.acceptFolder(
          folder.name,
          progress.total,
          formatSize(folder.totalSize),
        );
  }
  if (folder.state === 'sending') {
    return transferCopy.folderSending(count, currentPath);
  }
  if (folder.state === 'receiving') {
    return transferCopy.folderReceiving(count, currentPath);
  }
  if (folder.state === 'done') return transferCopy.folderDone(folder.name);
  if (folder.state === 'canceled')
    return transferCopy.folderCanceled(folder.name);
  if (folder.state === 'failed') {
    return transferCopy.folderFailed(folder.name, folder.error);
  }
  return transferCopy.folderLabel(folder.name);
};
