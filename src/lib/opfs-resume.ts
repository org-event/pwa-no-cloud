/**
 * OPFS transfer-cursor save/load for FilePipe receive resume.
 */

import type { Transfer } from '@/domain/transfer.ts';
import {
  findTransferCursor,
  removeTransferCursor,
  writeTransferCursor,
  type OpfsStore,
  type TransferCursor,
} from './opfs.ts';

export const inboxKeyFor = (
  transfer: Pick<Transfer, 'id' | 'folderId'>,
  resumeInboxId: string | null,
): string => resumeInboxId || transfer.folderId || transfer.id;

export const cursorFromTransfer = (
  transfer: Transfer,
  inboxId: string,
): TransferCursor => ({
  id: transfer.id,
  inboxId,
  name: transfer.name,
  path: transfer.path,
  folderId: transfer.folderId,
  size: transfer.size,
  mime: transfer.mime,
  chunkSize: transfer.chunkSize,
  index: transfer.index,
});

export type OpfsResumeDeps = {
  getStore: () => OpfsStore | null;
  getResumeInboxId: () => string | null;
};

export type CursorMatch = Pick<
  TransferCursor,
  'name' | 'path' | 'size' | 'chunkSize'
>;

export type OpfsResume = {
  inboxKey(transfer: Pick<Transfer, 'id' | 'folderId'>): string;
  /** Persist receive cursor; no-op without store or for send. */
  save(transfer: Transfer): Promise<void>;
  /** Load matching cursor, or null if none / no store. */
  find(match: CursorMatch): Promise<TransferCursor | null>;
  remove(id: string): Promise<void>;
};

export const createOpfsResume = (deps: OpfsResumeDeps): OpfsResume => {
  const inboxKey = (transfer: Pick<Transfer, 'id' | 'folderId'>) =>
    inboxKeyFor(transfer, deps.getResumeInboxId());

  return {
    inboxKey,
    async save(transfer) {
      const store = deps.getStore();
      if (!store || transfer.direction !== 'receive') return;
      await writeTransferCursor(
        store,
        cursorFromTransfer(transfer, inboxKey(transfer)),
      );
    },
    async find(match) {
      const store = deps.getStore();
      if (!store) return null;
      const found = await findTransferCursor(store, match);
      if (!found.ok) return null;
      return found.value;
    },
    async remove(id) {
      const store = deps.getStore();
      if (!store) return;
      await removeTransferCursor(store, id);
    },
  };
};
