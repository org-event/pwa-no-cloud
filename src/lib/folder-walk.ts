import { filePipeCopy } from '@/content/index.ts';
import { isSafeName } from './opfs.ts';
import { fileBaseName } from './chunk.ts';
import { normalizeRelativePath } from './folder-path.ts';

export type PickedFile = {
  file: File;
  path: string;
};

export type WalkResult =
  | { ok: true; value: PickedFile[] }
  | { ok: false; code: string; message: string };

const fail = (code: string, message: string): WalkResult => ({
  ok: false,
  code,
  message,
});

export const collectFromFileList = (files: ArrayLike<File>): WalkResult => {
  const items: PickedFile[] = [];
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    if (!file) continue;
    const raw = file.webkitRelativePath || file.name;
    const path = normalizeRelativePath(raw);
    if (!path) return fail('unsafe-path', filePipeCopy.invalidFolderWalkPath);
    items.push({ file, path });
  }
  return { ok: true, value: items };
};

export const collectFromDirectory = async (
  root: FileSystemDirectoryHandle,
  rootName?: string,
): Promise<WalkResult> => {
  const folder = fileBaseName(rootName ?? root.name);
  if (!isSafeName(folder)) {
    return fail('unsafe-path', filePipeCopy.invalidFolderName);
  }
  const items: PickedFile[] = [];
  const error = await walkDir(root, folder, items);
  if (error) return fail('unsafe-path', error);
  return { ok: true, value: items };
};

const walkDir = async (
  dir: FileSystemDirectoryHandle,
  prefix: string,
  items: PickedFile[],
): Promise<string | null> => {
  for await (const entry of dir.entries()) {
    const name = entry[0];
    const handle = entry[1];
    const path = normalizeRelativePath(`${prefix}/${name}`);
    if (!path) return filePipeCopy.invalidFolderWalkPath;
    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle;
      items.push({ file: await fileHandle.getFile(), path });
      continue;
    }
    if (handle.kind === 'directory') {
      const nested = handle as FileSystemDirectoryHandle;
      const failed = await walkDir(nested, path, items);
      if (failed) return failed;
    }
  }
  return null;
};

type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file?: (
    ok: (file: File) => void,
    err?: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      ok: (entries: FileSystemEntryLike[]) => void,
      err?: (error: DOMException) => void,
    ) => void;
  };
};

const readAllEntries = (
  reader: NonNullable<FileSystemEntryLike['createReader']> extends () => infer R
    ? R
    : never,
): Promise<FileSystemEntryLike[]> =>
  new Promise((resolve, reject) => {
    const all: FileSystemEntryLike[] = [];
    const pump = () => {
      reader.readEntries(
        (chunk) => {
          if (chunk.length === 0) {
            resolve(all);
            return;
          }
          all.push(...chunk);
          pump();
        },
        (error) => reject(error),
      );
    };
    pump();
  });

const walkEntry = async (
  entry: FileSystemEntryLike,
  prefix: string,
  items: PickedFile[],
): Promise<string | null> => {
  if (entry.isFile) {
    const path = normalizeRelativePath(
      prefix ? `${prefix}/${entry.name}` : entry.name,
    );
    if (!path) return filePipeCopy.invalidFolderWalkPath;
    const file = await new Promise<File>((resolve, reject) => {
      entry.file?.(resolve, reject);
    });
    items.push({ file, path });
    return null;
  }
  if (!entry.isDirectory || !entry.createReader) return null;
  const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
  const children = await readAllEntries(entry.createReader());
  for (const child of children) {
    const failed = await walkEntry(child, nextPrefix, items);
    if (failed) return failed;
  }
  return null;
};

export const collectFromDrop = async (
  data: DataTransfer | null,
): Promise<WalkResult & { folderName?: string }> => {
  if (!data) return fail('empty', filePipeCopy.invalidFolderWalkPath);
  const items = data.items;
  if (items && items.length > 0) {
    const entries: FileSystemEntryLike[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const entry = (
        item as DataTransferItem & {
          webkitGetAsEntry?: () => FileSystemEntryLike | null;
        }
      ).webkitGetAsEntry?.();
      if (entry) entries.push(entry);
    }
    const directories = entries.filter((entry) => entry.isDirectory);
    if (directories.length > 0) {
      const root = directories[0];
      if (!root) return fail('empty', filePipeCopy.invalidFolderWalkPath);
      const picked: PickedFile[] = [];
      const failed = await walkEntry(root, '', picked);
      if (failed) return fail('unsafe-path', failed);
      if (picked.length === 0) {
        return fail('empty', filePipeCopy.invalidFolderWalkPath);
      }
      return { ok: true, value: picked, folderName: root.name };
    }
  }
  if (!data.files || data.files.length === 0) {
    return fail('empty', filePipeCopy.invalidFolderWalkPath);
  }
  const asFolder = Array.from(data.files).some((file) =>
    Boolean(file.webkitRelativePath),
  );
  const walked = collectFromFileList(data.files);
  if (!walked.ok) return walked;
  if (asFolder) {
    return {
      ...walked,
      folderName: walked.value[0]?.path.split('/')[0],
    };
  }
  return walked;
};
