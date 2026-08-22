import { splitRelativePath } from './folder-path.ts';

export type OpfsError = {
  ok: false;
  code: string;
  message: string;
};

export type OpfsResult<T> = { ok: true; value: T } | OpfsError;

export type OpfsStore = {
  root: FileSystemDirectoryHandle;
  inbox: FileSystemDirectoryHandle;
  outbox: FileSystemDirectoryHandle;
  transfers: FileSystemDirectoryHandle;
  logs: FileSystemDirectoryHandle;
};

export type InboxEntry = {
  transferId: string;
  name: string;
};

export type TransferCursor = {
  id: string;
  inboxId: string;
  name: string;
  path: string;
  folderId: string;
  size: number;
  mime: string;
  chunkSize: number;
  index: number;
};

export const FIXTURE_TRANSFER_ID = 'fixture';
export const FIXTURE_FILE_NAME = 'hello.txt';
export const FIXTURE_TEXT = 'NoCloud inbox fixture\n';

const DIRS = ['inbox', 'outbox', 'transfers', 'logs'] as const;

const fail = (code: string, message: string): OpfsError => ({
  ok: false,
  code,
  message,
});

const asError = (error: unknown, code: string): OpfsError => {
  if (error instanceof Error) return fail(code, error.message);
  return fail(code, 'OPFS error');
};

export const isSafeName = (name: string): boolean => {
  if (!name || name === '.' || name === '..') return false;
  return !name.includes('/') && !name.includes('\\');
};

const getDir = async (
  root: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle> => {
  return root.getDirectoryHandle(name, { create: true });
};

export const openStore = async (
  root?: FileSystemDirectoryHandle,
): Promise<OpfsResult<OpfsStore>> => {
  try {
    const fs = root ?? (await navigator.storage.getDirectory());
    const inbox = await getDir(fs, DIRS[0]);
    const outbox = await getDir(fs, DIRS[1]);
    const transfers = await getDir(fs, DIRS[2]);
    const logs = await getDir(fs, DIRS[3]);
    return { ok: true, value: { root: fs, inbox, outbox, transfers, logs } };
  } catch (error) {
    return asError(error, 'opfs-unavailable');
  }
};

export const writeFile = async (
  dir: FileSystemDirectoryHandle,
  name: string,
  data: string | BufferSource | Blob,
): Promise<OpfsResult<true>> => {
  if (!isSafeName(name)) return fail('unsafe-name', 'Недопустимое имя файла');
  try {
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return { ok: true, value: true };
  } catch (error) {
    return asError(error, 'write-failed');
  }
};

export const readText = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<OpfsResult<string>> => {
  if (!isSafeName(name)) return fail('unsafe-name', 'Недопустимое имя файла');
  try {
    const handle = await dir.getFileHandle(name);
    const file = await handle.getFile();
    return { ok: true, value: await file.text() };
  } catch (error) {
    return asError(error, 'read-failed');
  }
};

export const removeFile = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<OpfsResult<true>> => {
  if (!isSafeName(name)) return fail('unsafe-name', 'Недопустимое имя файла');
  try {
    await dir.removeEntry(name);
    return { ok: true, value: true };
  } catch (error) {
    return asError(error, 'remove-failed');
  }
};

export const listEntries = async (
  dir: FileSystemDirectoryHandle,
): Promise<OpfsResult<{ name: string; kind: string }[]>> => {
  try {
    const items: { name: string; kind: string }[] = [];
    for await (const entry of dir.entries()) {
      items.push({ name: entry[0], kind: entry[1].kind });
    }
    return { ok: true, value: items };
  } catch (error) {
    return asError(error, 'list-failed');
  }
};

export const appendLog = async (
  store: OpfsStore,
  line: string,
): Promise<OpfsResult<true>> => {
  try {
    const handle = await store.logs.getFileHandle('app.log', { create: true });
    const file = await handle.getFile();
    const writable = await handle.createWritable({ keepExistingData: true });
    const data = `${line}\n`;
    await writable.write({ type: 'write', position: file.size, data });
    await writable.close();
    return { ok: true, value: true };
  } catch (error) {
    return asError(error, 'log-failed');
  }
};

const openInboxHandle = async (
  store: OpfsStore,
  transferId: string,
  path: string,
  create: boolean,
): Promise<OpfsResult<FileSystemFileHandle>> => {
  if (!isSafeName(transferId)) {
    return fail('unsafe-name', 'Недопустимый идентификатор передачи');
  }
  const segments = splitRelativePath(path);
  if (!segments) return fail('unsafe-name', 'Недопустимое имя файла');
  try {
    let folder = await store.inbox.getDirectoryHandle(transferId, { create });
    const last = segments[segments.length - 1];
    if (!last) return fail('unsafe-name', 'Недопустимое имя файла');
    for (let i = 0; i < segments.length - 1; i += 1) {
      const name = segments[i];
      if (!name) return fail('unsafe-name', 'Недопустимое имя файла');
      folder = await folder.getDirectoryHandle(name, { create });
    }
    return {
      ok: true,
      value: await folder.getFileHandle(last, { create }),
    };
  } catch (error) {
    return asError(error, create ? 'write-failed' : 'read-failed');
  }
};

const listDirFiles = async (
  folder: FileSystemDirectoryHandle,
  prefix: string,
): Promise<string[]> => {
  const names: string[] = [];
  for await (const entry of folder.entries()) {
    const name = entry[0];
    const handle = entry[1];
    const rel = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'file') {
      names.push(rel);
      continue;
    }
    if (handle.kind === 'directory') {
      const nested = await listDirFiles(
        handle as FileSystemDirectoryHandle,
        rel,
      );
      for (const item of nested) names.push(item);
    }
  }
  return names;
};

export const openInboxWritable = async (
  store: OpfsStore,
  transferId: string,
  name: string,
  keep = false,
): Promise<OpfsResult<FileSystemWritableFileStream>> => {
  const handle = await openInboxHandle(store, transferId, name, true);
  if (!handle.ok) return handle;
  try {
    return {
      ok: true,
      value: await handle.value.createWritable({ keepExistingData: keep }),
    };
  } catch (error) {
    return asError(error, 'write-failed');
  }
};

const cursorFileName = (id: string): string => `${id}.json`;

const parseCursor = (raw: string): TransferCursor | null => {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (typeof data.id !== 'string') return null;
    if (typeof data.inboxId !== 'string') return null;
    if (typeof data.name !== 'string') return null;
    if (typeof data.path !== 'string') return null;
    if (typeof data.folderId !== 'string') return null;
    if (typeof data.size !== 'number') return null;
    if (typeof data.mime !== 'string') return null;
    if (typeof data.chunkSize !== 'number') return null;
    if (typeof data.index !== 'number') return null;
    return {
      id: data.id,
      inboxId: data.inboxId,
      name: data.name,
      path: data.path,
      folderId: data.folderId,
      size: data.size,
      mime: data.mime,
      chunkSize: data.chunkSize,
      index: data.index,
    };
  } catch {
    return null;
  }
};

export const sameCursorFile = (
  left: Pick<TransferCursor, 'name' | 'path' | 'size' | 'chunkSize'>,
  right: Pick<TransferCursor, 'name' | 'path' | 'size' | 'chunkSize'>,
): boolean => {
  return (
    left.name === right.name &&
    left.path === right.path &&
    left.size === right.size &&
    left.chunkSize === right.chunkSize
  );
};

export const writeTransferCursor = async (
  store: OpfsStore,
  cursor: TransferCursor,
): Promise<OpfsResult<true>> => {
  if (!isSafeName(cursor.id)) {
    return fail('unsafe-name', 'Недопустимый идентификатор передачи');
  }
  return writeFile(
    store.transfers,
    cursorFileName(cursor.id),
    JSON.stringify(cursor),
  );
};

export const removeTransferCursor = async (
  store: OpfsStore,
  id: string,
): Promise<OpfsResult<true>> => {
  if (!isSafeName(id)) {
    return fail('unsafe-name', 'Недопустимый идентификатор передачи');
  }
  try {
    await store.transfers.removeEntry(cursorFileName(id));
    return { ok: true, value: true };
  } catch {
    return { ok: true, value: true };
  }
};

export const listTransferCursors = async (
  store: OpfsStore,
): Promise<OpfsResult<TransferCursor[]>> => {
  const listed = await listEntries(store.transfers);
  if (!listed.ok) return listed;
  const items: TransferCursor[] = [];
  for (const entry of listed.value) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    const text = await readText(store.transfers, entry.name);
    if (!text.ok) continue;
    const cursor = parseCursor(text.value);
    if (cursor) items.push(cursor);
  }
  return { ok: true, value: items };
};

export const findTransferCursor = async (
  store: OpfsStore,
  match: Pick<TransferCursor, 'name' | 'path' | 'size' | 'chunkSize'>,
): Promise<OpfsResult<TransferCursor | null>> => {
  const listed = await listTransferCursors(store);
  if (!listed.ok) return listed;
  for (const cursor of listed.value) {
    if (sameCursorFile(cursor, match)) return { ok: true, value: cursor };
  }
  return { ok: true, value: null };
};

export const removeInboxTransfer = async (
  store: OpfsStore,
  transferId: string,
): Promise<OpfsResult<true>> => {
  if (!isSafeName(transferId)) {
    return fail('unsafe-name', 'Недопустимый идентификатор передачи');
  }
  try {
    await store.inbox.removeEntry(transferId, { recursive: true });
    return { ok: true, value: true };
  } catch (error) {
    return asError(error, 'remove-failed');
  }
};

export const writeInboxFile = async (
  store: OpfsStore,
  transferId: string,
  name: string,
  data: string | BufferSource | Blob,
): Promise<OpfsResult<true>> => {
  const handle = await openInboxHandle(store, transferId, name, true);
  if (!handle.ok) return handle;
  try {
    const writable = await handle.value.createWritable();
    await writable.write(data);
    await writable.close();
    return { ok: true, value: true };
  } catch (error) {
    return asError(error, 'write-failed');
  }
};

export const readInboxFile = async (
  store: OpfsStore,
  transferId: string,
  name: string,
): Promise<OpfsResult<string>> => {
  const handle = await openInboxHandle(store, transferId, name, false);
  if (!handle.ok) return handle;
  try {
    const file = await handle.value.getFile();
    return { ok: true, value: await file.text() };
  } catch (error) {
    return asError(error, 'read-failed');
  }
};

export const removeInboxFile = async (
  store: OpfsStore,
  transferId: string,
  name: string,
): Promise<OpfsResult<true>> => {
  if (!isSafeName(transferId)) {
    return fail('unsafe-name', 'Недопустимый идентификатор передачи');
  }
  const segments = splitRelativePath(name);
  if (!segments) return fail('unsafe-name', 'Недопустимое имя файла');
  try {
    let folder = await store.inbox.getDirectoryHandle(transferId);
    const last = segments[segments.length - 1];
    if (!last) return fail('unsafe-name', 'Недопустимое имя файла');
    for (let i = 0; i < segments.length - 1; i += 1) {
      const dir = segments[i];
      if (!dir) return fail('unsafe-name', 'Недопустимое имя файла');
      folder = await folder.getDirectoryHandle(dir);
    }
    const removed = await removeFile(folder, last);
    if (!removed.ok) return removed;
    const root = await store.inbox.getDirectoryHandle(transferId);
    const left = await listDirFiles(root, '');
    if (left.length === 0) {
      await store.inbox.removeEntry(transferId, { recursive: true });
    }
    return { ok: true, value: true };
  } catch (error) {
    return asError(error, 'remove-failed');
  }
};

export const listInbox = async (
  store: OpfsStore,
): Promise<OpfsResult<InboxEntry[]>> => {
  try {
    const items: InboxEntry[] = [];
    for await (const entry of store.inbox.entries()) {
      const transferId = entry[0];
      const handle = entry[1];
      if (handle.kind !== 'directory') continue;
      const folder = handle as FileSystemDirectoryHandle;
      const names = await listDirFiles(folder, '');
      for (const name of names) {
        items.push({ transferId, name });
      }
    }
    return { ok: true, value: items };
  } catch (error) {
    return asError(error, 'list-failed');
  }
};

export const writeFixture = async (
  store: OpfsStore,
): Promise<OpfsResult<InboxEntry>> => {
  const written = await writeInboxFile(
    store,
    FIXTURE_TRANSFER_ID,
    FIXTURE_FILE_NAME,
    FIXTURE_TEXT,
  );
  if (!written.ok) return written;
  await appendLog(store, `write ${FIXTURE_TRANSFER_ID}/${FIXTURE_FILE_NAME}`);
  return {
    ok: true,
    value: { transferId: FIXTURE_TRANSFER_ID, name: FIXTURE_FILE_NAME },
  };
};
