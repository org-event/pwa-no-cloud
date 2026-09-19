import type { FolderTransfer } from '@/domain/folder.ts';
import type { Transfer } from '@/domain/transfer.ts';
import type { PickedFile } from './folder-walk.ts';

/** File/folder Transfer behind open Link channels (byte-plane seam). */
export type TransferPort = {
  sendFile(file: File): void;
  sendFolder(entries: PickedFile[]): void;
  accept(transferId: string): void;
  reject(transferId: string, reason?: string): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  current(): Transfer | null;
  currentFolder(): FolderTransfer | null;
  activeFile(): Transfer | null;
  incomingFile(): Transfer | null;
  activeFolder(): FolderTransfer | null;
  incomingFolder(): FolderTransfer | null;
};

/**
 * Adapt FilePipe (or a compatible pipe) to the TransferPort seam.
 * Link exposes only this port — not FilePipe methods.
 */
export type TransferPipeLike = {
  sendFile(file: File): void;
  sendFolder(entries: PickedFile[]): void;
  accept(transferId: string): void;
  reject(transferId: string, reason?: string): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  current(): Transfer | null;
  currentFolder(): FolderTransfer | null;
  active: Transfer | null;
  incoming: Transfer | null;
  activeFolder: FolderTransfer | null;
  incomingFolder: FolderTransfer | null;
};

export const bindTransferPort = (pipe: TransferPipeLike): TransferPort => ({
  sendFile: (file) => pipe.sendFile(file),
  sendFolder: (entries) => pipe.sendFolder(entries),
  accept: (id) => pipe.accept(id),
  reject: (id, reason) => pipe.reject(id, reason),
  cancel: () => pipe.cancel(),
  pause: () => pipe.pause(),
  resume: () => pipe.resume(),
  current: () => pipe.current(),
  currentFolder: () => pipe.currentFolder(),
  activeFile: () => pipe.active,
  incomingFile: () => pipe.incoming,
  activeFolder: () => pipe.activeFolder,
  incomingFolder: () => pipe.incomingFolder,
});
