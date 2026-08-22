import { describe, expect, it } from 'vitest';
import {
  applyTransferEvent,
  createReceiveTransfer,
  createSendTransfer,
} from './transfer.ts';

const sender = () =>
  createSendTransfer({
    id: 't1',
    name: 'a.bin',
    size: 10,
    mime: 'application/octet-stream',
    chunkSize: 4,
  });

describe('transfer machine', () => {
  it('sends chunks and finishes after the last ack', () => {
    let transfer = applyTransferEvent(sender(), { type: 'offer' });
    transfer = applyTransferEvent(transfer, { type: 'accept' });
    expect(transfer.state).toBe('sending');
    transfer = applyTransferEvent(transfer, { type: 'ack', index: 0 });
    transfer = applyTransferEvent(transfer, { type: 'ack', index: 1 });
    expect(transfer.state).toBe('sending');
    transfer = applyTransferEvent(transfer, { type: 'ack', index: 2 });
    expect(transfer.state).toBe('done');
    expect(transfer.index).toBe(3);
  });

  it('cancels in the middle of sending', () => {
    let transfer = applyTransferEvent(sender(), { type: 'offer' });
    transfer = applyTransferEvent(transfer, { type: 'accept' });
    transfer = applyTransferEvent(transfer, { type: 'ack', index: 0 });
    transfer = applyTransferEvent(transfer, { type: 'cancel' });
    expect(transfer.state).toBe('canceled');
    expect(transfer.index).toBe(1);
  });

  it('rejects an offer', () => {
    let transfer = applyTransferEvent(sender(), { type: 'offer' });
    transfer = applyTransferEvent(transfer, {
      type: 'reject',
      reason: 'нет места',
    });
    expect(transfer.state).toBe('failed');
    expect(transfer.error).toBe('нет места');
  });

  it('pauses and resumes sending', () => {
    let transfer = applyTransferEvent(sender(), { type: 'offer' });
    transfer = applyTransferEvent(transfer, { type: 'accept' });
    transfer = applyTransferEvent(transfer, { type: 'ack', index: 0 });
    transfer = applyTransferEvent(transfer, { type: 'pause' });
    expect(transfer.state).toBe('paused');
    expect(transfer.index).toBe(1);
    transfer = applyTransferEvent(transfer, { type: 'resume' });
    expect(transfer.state).toBe('sending');
  });

  it('receives chunks then writes', () => {
    let transfer = createReceiveTransfer({
      id: 't2',
      name: 'a.bin',
      size: 4,
      mime: 'text/plain',
      chunkSize: 4,
    });
    transfer = applyTransferEvent(transfer, { type: 'offer' });
    transfer = applyTransferEvent(transfer, { type: 'accept' });
    transfer = applyTransferEvent(transfer, { type: 'chunk', index: 0 });
    expect(transfer.state).toBe('writing');
    transfer = applyTransferEvent(transfer, { type: 'done' });
    expect(transfer.state).toBe('done');
  });
});
