import {
  CHANNEL_BUFFER_HIGH,
  CHUNK_SIZE_BYTES,
  MAX_FILE_BYTES,
} from '../config/defaults.ts';
import {
  applyTransferEvent,
  createReceiveTransfer,
  createSendTransfer,
  transferChunks,
  type Transfer,
} from '../domain/transfer.ts';
import { chunkLength, chunkOffset, fileBaseName, waitDrain } from './chunk.ts';
import { parseFileControl, type FileControl } from './control.ts';
import { EventEmitter } from './events.ts';
import { generateId } from './id.ts';
import {
  isSafeName,
  openInboxWritable,
  removeInboxTransfer,
  type OpfsStore,
} from './opfs.ts';

export type DataSink = {
  send(data: string | ArrayBuffer): void;
  bufferedAmount: number;
  readyState: string;
  addEventListener: (
    name: string,
    fn: () => void,
    options?: { once?: boolean },
  ) => void;
};

export type ControlSink = {
  send(data: string): void;
  readyState: string;
};

type FilePipeConfig = {
  control: ControlSink;
  bytes: DataSink;
  store?: OpfsStore | null;
  chunkSize?: number;
  maxSize?: number;
};

const concat = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const next = new Uint8Array(left.byteLength + right.byteLength);
  next.set(left);
  next.set(right, left.byteLength);
  return next;
};

export class FilePipe extends EventEmitter {
  config: FilePipeConfig;
  store: OpfsStore | null;
  active: Transfer | null = null;
  incoming: Transfer | null = null;
  source: Blob | null = null;
  writer: FileSystemWritableFileStream | null = null;
  expectBytes: { transferId: string; index: number; size: number } | null =
    null;
  ackWaiters = new Map<string, (index: number) => void>();
  generation = 0;

  constructor(config: FilePipeConfig) {
    super();
    this.config = config;
    this.store = config.store ?? null;
  }

  current(): Transfer | null {
    return this.active ?? this.incoming;
  }

  setStore(store: OpfsStore | null) {
    this.store = store;
  }

  sendFile(file: File) {
    void this.startSend(file);
  }

  accept(transferId: string) {
    void this.acceptOffer(transferId);
  }

  reject(transferId: string, reason = 'отклонено') {
    const incoming = this.incoming;
    if (!incoming || incoming.id !== transferId) return;
    this.incoming = applyTransferEvent(incoming, { type: 'reject', reason });
    this.sendControl({ type: 'file-reject', transferId, reason });
    this.emit('transfer', this.incoming);
    this.incoming = null;
  }

  cancel() {
    const transfer = this.active ?? this.incoming;
    if (!transfer) return;
    this.sendControl({ type: 'file-cancel', transferId: transfer.id });
    this.finish(transfer, { type: 'cancel' });
  }

  onControlRaw(raw: string) {
    try {
      const parsed = parseFileControl(JSON.parse(raw));
      if (!parsed) return false;
      void this.onControl(parsed);
      return true;
    } catch {
      return false;
    }
  }

  async onBytes(data: ArrayBuffer) {
    const expect = this.expectBytes;
    const active = this.active;
    const writer = this.writer;
    if (!expect || !active || !writer) return;
    if (active.id !== expect.transferId) return;
    if (data.byteLength !== expect.size) {
      this.fail(active, 'chunk-size');
      return;
    }
    const position = chunkOffset(expect.index, active.chunkSize);
    await writer.write({ type: 'write', position, data });
    this.sendControl({
      type: 'file-ack',
      transferId: active.id,
      index: expect.index,
    });
    this.active = applyTransferEvent(active, {
      type: 'chunk',
      index: expect.index,
    });
    this.expectBytes = null;
    this.emit('transfer', this.active);
    if (this.active.state === 'writing') {
      await writer.close();
      this.writer = null;
      this.active = applyTransferEvent(this.active, { type: 'done' });
      this.emit('transfer', this.active);
      this.emit('received', this.active);
      this.active = null;
    }
  }

  async onControl(message: FileControl) {
    if (message.type === 'file-offer') {
      this.handleOffer(message);
      return;
    }
    if (message.type === 'file-accept') {
      await this.handleAccept(message.transferId);
      return;
    }
    if (message.type === 'file-reject') {
      if (this.active?.id === message.transferId) {
        this.finish(this.active, { type: 'reject', reason: message.reason });
      }
      return;
    }
    if (message.type === 'file-ack') {
      const key = `${message.transferId}:${message.index}`;
      const waiter = this.ackWaiters.get(key);
      if (waiter) waiter(message.index);
      return;
    }
    if (message.type === 'file-chunk-meta') {
      this.expectBytes = {
        transferId: message.transferId,
        index: message.index,
        size: message.size,
      };
      return;
    }
    if (message.type === 'file-cancel' || message.type === 'file-error') {
      const transfer = this.active ?? this.incoming;
      if (transfer && transfer.id === message.transferId) {
        this.finish(transfer, { type: 'cancel' });
      }
    }
  }

  handleOffer(message: Extract<FileControl, { type: 'file-offer' }>) {
    if (this.active || this.incoming) {
      this.sendControl({
        type: 'file-reject',
        transferId: message.transferId,
        reason: 'занято',
      });
      return;
    }
    const maxSize = this.config.maxSize ?? MAX_FILE_BYTES;
    const name = fileBaseName(message.name);
    if (message.size > maxSize || !isSafeName(name)) {
      this.sendControl({
        type: 'file-reject',
        transferId: message.transferId,
        reason: 'файл слишком большой или имя недопустимо',
      });
      return;
    }
    const transfer = applyTransferEvent(
      createReceiveTransfer({
        id: message.transferId,
        name,
        size: message.size,
        mime: message.mime,
        chunkSize: message.chunkSize,
      }),
      { type: 'offer' },
    );
    this.incoming = transfer;
    this.emit('offer', transfer);
    this.emit('transfer', transfer);
  }

  async acceptOffer(transferId: string) {
    const incoming = this.incoming;
    if (!incoming || incoming.id !== transferId) return;
    if (!this.store) {
      this.reject(transferId, 'нет OPFS');
      return;
    }
    const writable = await openInboxWritable(
      this.store,
      incoming.id,
      incoming.name,
    );
    if (!writable.ok) {
      this.reject(transferId, writable.message);
      return;
    }
    this.writer = writable.value;
    this.active = applyTransferEvent(incoming, { type: 'accept' });
    this.incoming = null;
    this.sendControl({ type: 'file-accept', transferId });
    this.emit('transfer', this.active);
  }

  async startSend(file: File) {
    if (this.active || this.incoming) {
      this.emit('error', 'Уже идёт передача');
      return;
    }
    const maxSize = this.config.maxSize ?? MAX_FILE_BYTES;
    const name = fileBaseName(file.name);
    if (file.size > maxSize) {
      this.emit('error', 'Файл больше лимита');
      return;
    }
    if (!isSafeName(name)) {
      this.emit('error', 'Недопустимое имя файла');
      return;
    }
    const chunkSize = this.config.chunkSize ?? CHUNK_SIZE_BYTES;
    const transfer = applyTransferEvent(
      createSendTransfer({
        id: generateId(),
        name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        chunkSize,
      }),
      { type: 'offer' },
    );
    this.active = transfer;
    this.source = file;
    this.sendControl({
      type: 'file-offer',
      transferId: transfer.id,
      name: transfer.name,
      size: transfer.size,
      mime: transfer.mime,
      chunkSize: transfer.chunkSize,
    });
    this.emit('transfer', transfer);
  }

  async handleAccept(transferId: string) {
    const active = this.active;
    const source = this.source;
    if (!active || active.id !== transferId || !source) return;
    this.active = applyTransferEvent(active, { type: 'accept' });
    this.emit('transfer', this.active);
    await this.pushBytes(this.active, source);
  }

  async pushBytes(transfer: Transfer, source: Blob) {
    const gen = this.generation;
    const reader = source.stream().getReader();
    let leftover = new Uint8Array();
    let index = 0;
    const total = transferChunks(transfer);
    try {
      while (index < total && gen === this.generation) {
        const need = chunkLength(index, transfer.size, transfer.chunkSize);
        leftover = new Uint8Array(await this.fill(reader, leftover, need));
        if (leftover.byteLength < need) {
          this.fail(transfer, 'short-read');
          return;
        }
        const chunk = leftover.subarray(0, need);
        leftover = leftover.subarray(need);
        await waitDrain(this.config.bytes, CHANNEL_BUFFER_HIGH);
        if (gen !== this.generation) return;
        this.sendControl({
          type: 'file-chunk-meta',
          transferId: transfer.id,
          index,
          size: need,
        });
        const copy = new Uint8Array(need);
        copy.set(chunk);
        this.config.bytes.send(copy.buffer);
        await this.waitAck(transfer.id, index);
        if (gen !== this.generation) return;
        this.active = applyTransferEvent(this.active ?? transfer, {
          type: 'ack',
          index,
        });
        this.emit('transfer', this.active);
        index += 1;
      }
      if (gen !== this.generation) return;
      this.sendControl({ type: 'file-done', transferId: transfer.id });
      if (this.active && this.active.state !== 'done') {
        this.active = applyTransferEvent(this.active, { type: 'done' });
        this.emit('transfer', this.active);
      }
      this.source = null;
      this.active = this.active?.state === 'done' ? null : this.active;
    } catch (err) {
      if (gen !== this.generation) return;
      const message = err instanceof Error ? err.message : 'send-failed';
      this.fail(transfer, message);
    } finally {
      reader.releaseLock();
    }
  }

  async fill(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    leftover: Uint8Array,
    need: number,
  ): Promise<Uint8Array> {
    let buffer = leftover;
    while (buffer.byteLength < need) {
      const read = await reader.read();
      if (read.done) return buffer;
      buffer = concat(buffer, read.value);
    }
    return buffer;
  }

  waitAck(transferId: string, index: number): Promise<number> {
    const key = `${transferId}:${index}`;
    return new Promise((resolve) => {
      this.ackWaiters.set(key, resolve);
    });
  }

  sendControl(message: FileControl) {
    if (this.config.control.readyState !== 'open') return;
    this.config.control.send(JSON.stringify(message));
  }

  fail(transfer: Transfer, code: string) {
    this.sendControl({ type: 'file-error', transferId: transfer.id, code });
    this.finish(transfer, { type: 'fail', message: code });
  }

  finish(
    transfer: Transfer,
    event: {
      type: 'cancel' | 'fail' | 'reject';
      reason?: string;
      message?: string;
    },
  ) {
    this.generation += 1;
    for (const waiter of this.ackWaiters.values()) waiter(-1);
    this.ackWaiters.clear();
    this.expectBytes = null;
    this.source = null;
    const writer = this.writer;
    this.writer = null;
    if (writer) void writer.close();
    if (this.store && transfer.direction === 'receive') {
      void removeInboxTransfer(this.store, transfer.id);
    }
    let next = transfer;
    if (event.type === 'reject') {
      next = applyTransferEvent(transfer, {
        type: 'reject',
        reason: event.reason ?? '',
      });
    } else if (event.type === 'fail') {
      next = applyTransferEvent(transfer, {
        type: 'fail',
        message: event.message ?? '',
      });
    } else {
      next = applyTransferEvent(transfer, { type: 'cancel' });
    }
    if (this.active?.id === transfer.id) this.active = null;
    if (this.incoming?.id === transfer.id) this.incoming = null;
    this.emit('transfer', next);
  }
}
