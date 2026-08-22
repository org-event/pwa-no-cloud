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
    if (!path) return fail('unsafe-path', 'Недопустимый путь в папке');
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
    return fail('unsafe-path', 'Недопустимое имя папки');
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
    if (!path) return 'Недопустимый путь в папке';
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
