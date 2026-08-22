export type TransferState =
  | 'queued'
  | 'offering'
  | 'sending'
  | 'receiving'
  | 'writing'
  | 'done'
  | 'paused'
  | 'failed'
  | 'canceled';

export type TransferDirection = 'send' | 'receive';

export type Transfer = {
  id: string;
  name: string;
  size: number;
  mime: string;
  chunkSize: number;
  direction: TransferDirection;
  state: TransferState;
  index: number;
  error: string;
};

export type TransferEvent =
  | { type: 'offer' }
  | { type: 'accept' }
  | { type: 'reject'; reason: string }
  | { type: 'ack'; index: number }
  | { type: 'chunk'; index: number }
  | { type: 'write' }
  | { type: 'done' }
  | { type: 'fail'; message: string }
  | { type: 'cancel' };

export const createSendTransfer = (input: {
  id: string;
  name: string;
  size: number;
  mime: string;
  chunkSize: number;
}): Transfer => ({
  id: input.id,
  name: input.name,
  size: input.size,
  mime: input.mime,
  chunkSize: input.chunkSize,
  direction: 'send',
  state: 'queued',
  index: 0,
  error: '',
});

export const createReceiveTransfer = (input: {
  id: string;
  name: string;
  size: number;
  mime: string;
  chunkSize: number;
}): Transfer => ({
  ...createSendTransfer(input),
  direction: 'receive',
});

export const transferChunks = (transfer: Transfer): number => {
  if (transfer.size <= 0 || transfer.chunkSize <= 0) return 0;
  return Math.ceil(transfer.size / transfer.chunkSize);
};

export const transferProgress = (
  transfer: Transfer,
): { done: number; total: number } => {
  const total = transferChunks(transfer);
  return { done: transfer.index, total };
};

const canApply = (transfer: Transfer, type: TransferEvent['type']): boolean => {
  const state = transfer.state;
  if (type === 'fail' || type === 'cancel') {
    return state !== 'done' && state !== 'failed' && state !== 'canceled';
  }
  if (type === 'offer') return state === 'queued';
  if (type === 'accept' || type === 'reject') return state === 'offering';
  if (type === 'ack') return state === 'sending';
  if (type === 'chunk') return state === 'receiving';
  if (type === 'write') return state === 'receiving';
  if (type === 'done') {
    return state === 'sending' || state === 'writing' || state === 'receiving';
  }
  return false;
};

export const applyTransferEvent = (
  transfer: Transfer,
  event: TransferEvent,
): Transfer => {
  if (!canApply(transfer, event.type)) return transfer;
  if (event.type === 'offer') return { ...transfer, state: 'offering' };
  if (event.type === 'accept') {
    const state = transfer.direction === 'send' ? 'sending' : 'receiving';
    return { ...transfer, state, error: '' };
  }
  if (event.type === 'reject') {
    return { ...transfer, state: 'failed', error: event.reason };
  }
  if (event.type === 'ack') {
    const index = event.index + 1;
    const done = index >= transferChunks(transfer);
    return { ...transfer, index, state: done ? 'done' : 'sending' };
  }
  if (event.type === 'chunk') {
    const index = event.index + 1;
    const last = index >= transferChunks(transfer);
    return {
      ...transfer,
      index,
      state: last ? 'writing' : 'receiving',
    };
  }
  if (event.type === 'write') return { ...transfer, state: 'writing' };
  if (event.type === 'done') return { ...transfer, state: 'done' };
  if (event.type === 'cancel') return { ...transfer, state: 'canceled' };
  return { ...transfer, state: 'failed', error: event.message };
};
