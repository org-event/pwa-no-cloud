export type FolderState =
  | 'queued'
  | 'offering'
  | 'sending'
  | 'receiving'
  | 'done'
  | 'failed'
  | 'canceled';

export type FolderDirection = 'send' | 'receive';

export type FolderFileMeta = {
  path: string;
  size: number;
  mime: string;
};

export type FolderTransfer = {
  id: string;
  name: string;
  files: FolderFileMeta[];
  totalSize: number;
  direction: FolderDirection;
  state: FolderState;
  index: number;
  error: string;
};

export type FolderEvent =
  | { type: 'offer' }
  | { type: 'accept' }
  | { type: 'reject'; reason: string }
  | { type: 'file'; index: number }
  | { type: 'done' }
  | { type: 'fail'; message: string }
  | { type: 'cancel' };

export const createSendFolder = (input: {
  id: string;
  name: string;
  files: FolderFileMeta[];
  totalSize: number;
}): FolderTransfer => ({
  id: input.id,
  name: input.name,
  files: input.files,
  totalSize: input.totalSize,
  direction: 'send',
  state: 'queued',
  index: 0,
  error: '',
});

export const createReceiveFolder = (input: {
  id: string;
  name: string;
  files: FolderFileMeta[];
  totalSize: number;
}): FolderTransfer => ({
  ...createSendFolder(input),
  direction: 'receive',
});

export const folderProgress = (
  folder: FolderTransfer,
): { done: number; total: number } => {
  return { done: folder.index, total: folder.files.length };
};

const canApply = (
  folder: FolderTransfer,
  type: FolderEvent['type'],
): boolean => {
  const state = folder.state;
  if (type === 'fail' || type === 'cancel') {
    return state !== 'done' && state !== 'failed' && state !== 'canceled';
  }
  if (type === 'offer') return state === 'queued';
  if (type === 'accept' || type === 'reject') return state === 'offering';
  if (type === 'file') {
    return state === 'sending' || state === 'receiving';
  }
  if (type === 'done') {
    return state === 'sending' || state === 'receiving';
  }
  return false;
};

export const applyFolderEvent = (
  folder: FolderTransfer,
  event: FolderEvent,
): FolderTransfer => {
  if (!canApply(folder, event.type)) return folder;
  if (event.type === 'offer') return { ...folder, state: 'offering' };
  if (event.type === 'accept') {
    const state = folder.direction === 'send' ? 'sending' : 'receiving';
    return { ...folder, state, error: '' };
  }
  if (event.type === 'reject') {
    return { ...folder, state: 'failed', error: event.reason };
  }
  if (event.type === 'file') {
    const index = event.index + 1;
    const done = index >= folder.files.length;
    return { ...folder, index, state: done ? 'done' : folder.state };
  }
  if (event.type === 'done') return { ...folder, state: 'done' };
  if (event.type === 'cancel') return { ...folder, state: 'canceled' };
  return { ...folder, state: 'failed', error: event.message };
};
