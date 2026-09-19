/**
 * Folder index advance and next-file decisions for FilePipe.
 */

import {
  applyFolderEvent,
  type FolderDirection,
  type FolderTransfer,
} from '@/domain/folder.ts';

export const isOpenFolder = (folder: FolderTransfer | null): boolean => {
  if (!folder) return false;
  return (
    folder.state !== 'done' &&
    folder.state !== 'failed' &&
    folder.state !== 'canceled'
  );
};

export type FolderAdvance = {
  folder: FolderTransfer;
  done: boolean;
};

/**
 * Advance past the current file index when the folder is open for `direction`.
 * Returns null when advance is not applicable.
 */
export const advanceFolder = (
  folder: FolderTransfer | null,
  direction: FolderDirection,
): FolderAdvance | null => {
  if (!folder || folder.direction !== direction || !isOpenFolder(folder)) {
    return null;
  }
  const next = applyFolderEvent(folder, {
    type: 'file',
    index: folder.index,
  });
  return { folder: next, done: next.state === 'done' };
};

export type QueueStep<T> = { kind: 'entry'; entry: T } | { kind: 'done' };

/** Next queue entry at folder.index, or done when exhausted. */
export const nextFolderEntry = <T>(
  folder: FolderTransfer,
  queue: readonly T[],
): QueueStep<T> => {
  const entry = queue[folder.index];
  if (!entry) return { kind: 'done' };
  return { kind: 'entry', entry };
};
