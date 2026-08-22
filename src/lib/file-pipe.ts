import {
  CHANNEL_BUFFER_HIGH,
  CHUNK_SIZE_BYTES,
  MAX_FILE_BYTES,
  MAX_FOLDER_FILES,
} from '../config/defaults.ts';
import {
  applyFolderEvent,
  createReceiveFolder,
  createSendFolder,
  type FolderTransfer,
} from '../domain/folder.ts';
import {
  applyTransferEvent,
  createReceiveTransfer,
  createSendTransfer,
  transferChunks,
  type Transfer,
} from '../domain/transfer.ts';
import { chunkLength, chunkOffset, fileBaseName, waitDrain } from './chunk.ts';
import {
  parseControl,
  type ControlMessage,
  type FileControl,
} from './control.ts';
import { EventEmitter } from './events.ts';
import { folderNameFromPaths, normalizeRelativePath } from './folder-path.ts';
import type { PickedFile } from './folder-walk.ts';
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
  maxFiles?: number;
};

const concat = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const next = new Uint8Array(left.byteLength + right.byteLength);
  next.set(left);
  next.set(right, left.byteLength);
  return next;
};

const isOpen = (folder: FolderTransfer | null): boolean => {
  if (!folder) return false;
  return (
    folder.state !== 'done' &&
    folder.state !== 'failed' &&
    folder.state !== 'canceled'
  );
};

export class FilePipe extends EventEmitter {
  config: FilePipeConfig;
  store: OpfsStore | null;
  active: Transfer | null = null;
  incoming: Transfer | null = null;
  activeFolder: FolderTransfer | null = null;
  incomingFolder: FolderTransfer | null = null;
  acceptedFolderId: string | null = null;
  queue: PickedFile[] = [];
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

  currentFolder(): FolderTransfer | null {
    return this.activeFolder ?? this.incomingFolder;
  }

  setStore(store: OpfsStore | null) {
    this.store = store;
  }

  sendFile(file: File) {
    void this.startSend(file);
  }

  sendFolder(entries: PickedFile[]) {
    void this.startFolder(entries);
  }

  accept(transferId: string) {
    if (this.incomingFolder?.id === transferId) {
      this.acceptFolder(transferId);
      return;
    }
    void this.acceptOffer(transferId);
  }

  reject(transferId: string, reason = 'отклонено') {
    if (this.incomingFolder?.id === transferId) {
      this.rejectFolder(transferId, reason);
      return;
    }
    const incoming = this.incoming;
    if (!incoming || incoming.id !== transferId) return;
    this.incoming = applyTransferEvent(incoming, { type: 'reject', reason });
    this.sendControl({ type: 'file-reject', transferId, reason });
    this.emit('transfer', this.incoming);
    this.incoming = null;
  }

  cancel() {
    const folder = this.currentFolder();
    const transfer = this.current();
    if (folder && isOpen(folder)) {
      this.sendControl({ type: 'folder-cancel', folderId: folder.id });
    }
    if (transfer) {
      this.sendControl({ type: 'file-cancel', transferId: transfer.id });
      this.finish(transfer, { type: 'cancel' });
      return;
    }
    if (folder && isOpen(folder)) this.finishFolder(folder, { type: 'cancel' });
  }

  onControlRaw(raw: string) {
    try {
      const parsed = parseControl(JSON.parse(raw));
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
    const next = applyTransferEvent(active, {
      type: 'chunk',
      index: expect.index,
    });
    this.expectBytes = null;
    this.active = next;
    this.emit('transfer', next);
    if (next.state === 'writing') await this.completeReceive(next);
    this.sendControl({
      type: 'file-ack',
      transferId: active.id,
      index: expect.index,
    });
  }

  async onControl(message: ControlMessage) {
    if (message.type === 'folder-offer') {
      this.handleFolderOffer(message);
      return;
    }
    if (message.type === 'folder-accept') {
      await this.handleFolderAccept(message.folderId);
      return;
    }
    if (message.type === 'folder-reject') {
      if (this.activeFolder?.id === message.folderId) {
        this.finishFolder(this.activeFolder, {
          type: 'reject',
          reason: message.reason,
        });
      }
      return;
    }
    if (message.type === 'folder-done') {
      const folder = this.activeFolder;
      if (folder && folder.id === message.folderId && folder.state !== 'done') {
        this.activeFolder = applyFolderEvent(folder, { type: 'done' });
        this.emit('folder', this.activeFolder);
      }
      return;
    }
    if (message.type === 'folder-cancel') {
      this.handleRemoteCancel(message.folderId);
      return;
    }
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
    if (message.type === 'file-done') {
      const active = this.active;
      if (
        active &&
        active.id === message.transferId &&
        (active.state === 'receiving' || active.state === 'writing')
      ) {
        await this.completeReceive(active);
      }
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
    const folderId = message.folderId ?? '';
    const auto = Boolean(folderId) && this.acceptedFolderId === folderId;
    if (this.active || this.incoming || this.incomingFolder) {
      this.sendControl({
        type: 'file-reject',
        transferId: message.transferId,
        reason: 'занято',
      });
      return;
    }
    if (isOpen(this.activeFolder) && !auto) {
      this.sendControl({
        type: 'file-reject',
        transferId: message.transferId,
        reason: 'занято',
      });
      return;
    }
    const maxSize = this.config.maxSize ?? MAX_FILE_BYTES;
    const rawPath = message.path ?? message.name;
    const path = normalizeRelativePath(rawPath);
    const name = fileBaseName(path ?? message.name);
    if (!path || message.size > maxSize || !isSafeName(name)) {
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
        path,
        folderId,
        size: message.size,
        mime: message.mime,
        chunkSize: message.chunkSize,
      }),
      { type: 'offer' },
    );
    this.incoming = transfer;
    this.emit('offer', transfer);
    this.emit('transfer', transfer);
    if (auto) void this.acceptOffer(transfer.id);
  }

  handleFolderOffer(
    message: Extract<ControlMessage, { type: 'folder-offer' }>,
  ) {
    if (this.busy()) {
      this.sendControl({
        type: 'folder-reject',
        folderId: message.folderId,
        reason: 'занято',
      });
      return;
    }
    const maxFiles = this.config.maxFiles ?? MAX_FOLDER_FILES;
    const maxSize = this.config.maxSize ?? MAX_FILE_BYTES;
    const name = fileBaseName(message.name);
    if (!isSafeName(name) || message.files.length === 0) {
      this.sendControl({
        type: 'folder-reject',
        folderId: message.folderId,
        reason: 'папка пуста или имя недопустимо',
      });
      return;
    }
    if (message.files.length > maxFiles) {
      this.sendControl({
        type: 'folder-reject',
        folderId: message.folderId,
        reason: 'слишком много файлов',
      });
      return;
    }
    const files = [];
    for (const item of message.files) {
      const path = normalizeRelativePath(item.path);
      if (!path || item.size > maxSize) {
        this.sendControl({
          type: 'folder-reject',
          folderId: message.folderId,
          reason: 'файл слишком большой или путь недопустим',
        });
        return;
      }
      files.push({ path, size: item.size, mime: item.mime });
    }
    const folder = applyFolderEvent(
      createReceiveFolder({
        id: message.folderId,
        name,
        files,
        totalSize: message.totalSize,
      }),
      { type: 'offer' },
    );
    this.incomingFolder = folder;
    this.emit('folder-offer', folder);
    this.emit('folder', folder);
  }

  acceptFolder(folderId: string) {
    const incoming = this.incomingFolder;
    if (!incoming || incoming.id !== folderId) return;
    this.acceptedFolderId = folderId;
    this.activeFolder = applyFolderEvent(incoming, { type: 'accept' });
    this.incomingFolder = null;
    this.sendControl({ type: 'folder-accept', folderId });
    this.emit('folder', this.activeFolder);
  }

  rejectFolder(folderId: string, reason: string) {
    const incoming = this.incomingFolder;
    if (!incoming || incoming.id !== folderId) return;
    this.incomingFolder = applyFolderEvent(incoming, {
      type: 'reject',
      reason,
    });
    this.sendControl({ type: 'folder-reject', folderId, reason });
    this.emit('folder', this.incomingFolder);
    this.incomingFolder = null;
  }

  async acceptOffer(transferId: string) {
    const incoming = this.incoming;
    if (!incoming || incoming.id !== transferId) return;
    if (!this.store) {
      this.reject(transferId, 'нет OPFS');
      return;
    }
    const inboxId = incoming.folderId || incoming.id;
    const writable = await openInboxWritable(
      this.store,
      inboxId,
      incoming.path,
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

  async startSend(file: File, extra?: { folderId: string; path: string }) {
    if (this.active || this.incoming || this.incomingFolder) {
      this.emit('error', 'Уже идёт передача');
      return;
    }
    if (isOpen(this.activeFolder) && !extra) {
      this.emit('error', 'Уже идёт передача');
      return;
    }
    const maxSize = this.config.maxSize ?? MAX_FILE_BYTES;
    const path = extra?.path
      ? normalizeRelativePath(extra.path)
      : fileBaseName(file.name);
    const name = fileBaseName(path ?? file.name);
    if (!path) {
      this.emit('error', 'Недопустимый путь');
      return;
    }
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
        path,
        folderId: extra?.folderId ?? '',
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
      path: transfer.path,
      folderId: transfer.folderId || undefined,
      size: transfer.size,
      mime: transfer.mime,
      chunkSize: transfer.chunkSize,
    });
    this.emit('transfer', transfer);
  }

  async startFolder(entries: PickedFile[]) {
    if (this.busy()) {
      this.emit('error', 'Уже идёт передача');
      return;
    }
    const maxFiles = this.config.maxFiles ?? MAX_FOLDER_FILES;
    const maxSize = this.config.maxSize ?? MAX_FILE_BYTES;
    if (entries.length === 0) {
      this.emit('error', 'Папка пуста');
      return;
    }
    if (entries.length > maxFiles) {
      this.emit('error', 'Слишком много файлов в папке');
      return;
    }
    const files = [];
    const queue: PickedFile[] = [];
    let totalSize = 0;
    for (const entry of entries) {
      const path = normalizeRelativePath(entry.path);
      if (!path) {
        this.emit('error', 'Недопустимый путь в папке');
        return;
      }
      if (entry.file.size > maxSize) {
        this.emit('error', 'Файл в папке больше лимита');
        return;
      }
      totalSize += entry.file.size;
      files.push({
        path,
        size: entry.file.size,
        mime: entry.file.type || 'application/octet-stream',
      });
      queue.push({ file: entry.file, path });
    }
    const name = folderNameFromPaths(files.map((item) => item.path));
    const folder = applyFolderEvent(
      createSendFolder({
        id: generateId(),
        name,
        files,
        totalSize,
      }),
      { type: 'offer' },
    );
    this.activeFolder = folder;
    this.queue = queue;
    this.sendControl({
      type: 'folder-offer',
      folderId: folder.id,
      name: folder.name,
      files,
      totalSize,
    });
    this.emit('folder', folder);
  }

  async handleAccept(transferId: string) {
    const active = this.active;
    const source = this.source;
    if (!active || active.id !== transferId || !source) return;
    this.active = applyTransferEvent(active, { type: 'accept' });
    this.emit('transfer', this.active);
    await this.pushBytes(this.active, source);
  }

  async handleFolderAccept(folderId: string) {
    const folder = this.activeFolder;
    if (!folder || folder.id !== folderId) return;
    this.activeFolder = applyFolderEvent(folder, { type: 'accept' });
    this.emit('folder', this.activeFolder);
    await this.sendNextInFolder();
  }

  async sendNextInFolder() {
    const folder = this.activeFolder;
    if (!folder || folder.direction !== 'send') return;
    const entry = this.queue[folder.index];
    if (!entry) {
      this.sendControl({ type: 'folder-done', folderId: folder.id });
      this.activeFolder = applyFolderEvent(folder, { type: 'done' });
      this.emit('folder', this.activeFolder);
      return;
    }
    await this.startSend(entry.file, {
      folderId: folder.id,
      path: entry.path,
    });
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
      if (!this.active) await this.advanceSendFolder();
    } catch (err) {
      if (gen !== this.generation) return;
      const message = err instanceof Error ? err.message : 'send-failed';
      this.fail(transfer, message);
    } finally {
      reader.releaseLock();
    }
  }

  async completeReceive(transfer: Transfer) {
    if (!this.active || this.active.id !== transfer.id) return;
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    if (!this.active || this.active.id !== transfer.id) return;
    this.active = applyTransferEvent(this.active, { type: 'done' });
    this.emit('transfer', this.active);
    this.emit('received', this.active);
    this.active = null;
    this.advanceReceiveFolder();
  }

  async advanceSendFolder() {
    const folder = this.activeFolder;
    if (!folder || folder.direction !== 'send' || !isOpen(folder)) return;
    this.activeFolder = applyFolderEvent(folder, {
      type: 'file',
      index: folder.index,
    });
    this.emit('folder', this.activeFolder);
    if (this.activeFolder.state === 'done') {
      this.sendControl({ type: 'folder-done', folderId: folder.id });
      return;
    }
    await this.sendNextInFolder();
  }

  advanceReceiveFolder() {
    const folder = this.activeFolder;
    if (!folder || folder.direction !== 'receive' || !isOpen(folder)) return;
    this.activeFolder = applyFolderEvent(folder, {
      type: 'file',
      index: folder.index,
    });
    this.emit('folder', this.activeFolder);
    if (this.activeFolder.state === 'done') this.acceptedFolderId = null;
  }

  handleRemoteCancel(folderId: string) {
    const transfer = this.active ?? this.incoming;
    if (transfer && transfer.folderId === folderId) {
      this.finish(transfer, { type: 'cancel' });
      return;
    }
    const folder = this.currentFolder();
    if (folder && folder.id === folderId) {
      this.finishFolder(folder, { type: 'cancel' });
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

  sendControl(message: ControlMessage) {
    if (this.config.control.readyState !== 'open') return;
    this.config.control.send(JSON.stringify(message));
  }

  fail(transfer: Transfer, code: string) {
    this.sendControl({ type: 'file-error', transferId: transfer.id, code });
    this.finish(transfer, { type: 'fail', message: code });
  }

  busy() {
    if (this.active || this.incoming || this.incomingFolder) return true;
    return isOpen(this.activeFolder);
  }

  inboxKey(transfer: Transfer) {
    return transfer.folderId || transfer.id;
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
      void removeInboxTransfer(this.store, this.inboxKey(transfer));
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
    const folder = this.currentFolder();
    if (folder && transfer.folderId === folder.id) {
      this.finishFolder(folder, event);
    }
  }

  finishFolder(
    folder: FolderTransfer,
    event: {
      type: 'cancel' | 'fail' | 'reject';
      reason?: string;
      message?: string;
    },
  ) {
    this.queue = [];
    this.acceptedFolderId = null;
    if (this.store && folder.direction === 'receive') {
      void removeInboxTransfer(this.store, folder.id);
    }
    let next = folder;
    if (event.type === 'reject') {
      next = applyFolderEvent(folder, {
        type: 'reject',
        reason: event.reason ?? '',
      });
    } else if (event.type === 'fail') {
      next = applyFolderEvent(folder, {
        type: 'fail',
        message: event.message ?? '',
      });
    } else {
      next = applyFolderEvent(folder, { type: 'cancel' });
    }
    this.activeFolder = null;
    this.incomingFolder = null;
    this.emit('folder', next);
  }
}
