import type { FolderTransfer } from '@/domain/folder.ts';
import type { Transfer } from '@/domain/transfer.ts';
import type { PickedFile } from './folder-walk.ts';

/** File/folder Transfer behind open Link channels. */
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
