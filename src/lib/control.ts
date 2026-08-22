export type FileControl =
  | {
      type: 'file-offer';
      transferId: string;
      name: string;
      size: number;
      mime: string;
      chunkSize: number;
      folderId?: string;
      path?: string;
    }
  | { type: 'file-accept'; transferId: string; startIndex?: number }
  | { type: 'file-reject'; transferId: string; reason: string }
  | { type: 'file-pause'; transferId: string }
  | { type: 'file-resume'; transferId: string }
  | { type: 'file-chunk-meta'; transferId: string; index: number; size: number }
  | { type: 'file-ack'; transferId: string; index: number }
  | { type: 'file-done'; transferId: string }
  | { type: 'file-error'; transferId: string; code: string }
  | { type: 'file-cancel'; transferId: string };

export type FolderControl =
  | {
      type: 'folder-offer';
      folderId: string;
      name: string;
      files: { path: string; size: number; mime: string }[];
      totalSize: number;
    }
  | { type: 'folder-accept'; folderId: string }
  | { type: 'folder-reject'; folderId: string; reason: string }
  | { type: 'folder-done'; folderId: string }
  | { type: 'folder-cancel'; folderId: string };

export type ControlMessage = FileControl | FolderControl;

const isObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object';
};

const asString = (value: unknown): string | null => {
  return typeof value === 'string' ? value : null;
};

const asNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const parseFileControl = (raw: unknown): FileControl | null => {
  if (!isObject(raw)) return null;
  const type = raw.type;
  const transferId = asString(raw.transferId);
  if (!transferId) return null;
  if (type === 'file-offer') {
    const name = asString(raw.name);
    const size = asNumber(raw.size);
    const mime = asString(raw.mime);
    const chunkSize = asNumber(raw.chunkSize);
    if (!name || size === null || !mime || chunkSize === null) return null;
    const folderId = asString(raw.folderId) ?? undefined;
    const path = asString(raw.path) ?? undefined;
    return { type, transferId, name, size, mime, chunkSize, folderId, path };
  }
  if (type === 'file-accept') {
    const startIndex = asNumber(raw.startIndex) ?? 0;
    if (startIndex < 0) return null;
    return { type, transferId, startIndex };
  }
  if (
    type === 'file-done' ||
    type === 'file-cancel' ||
    type === 'file-pause' ||
    type === 'file-resume'
  ) {
    return { type, transferId };
  }
  if (type === 'file-reject') {
    const reason = asString(raw.reason) ?? 'отклонено';
    return { type, transferId, reason };
  }
  if (type === 'file-chunk-meta' || type === 'file-ack') {
    const index = asNumber(raw.index);
    if (index === null) return null;
    if (type === 'file-ack') return { type, transferId, index };
    const size = asNumber(raw.size);
    if (size === null) return null;
    return { type, transferId, index, size };
  }
  if (type === 'file-error') {
    const code = asString(raw.code) ?? 'error';
    return { type, transferId, code };
  }
  return null;
};

export const parseFolderControl = (raw: unknown): FolderControl | null => {
  if (!isObject(raw)) return null;
  const type = raw.type;
  const folderId = asString(raw.folderId);
  if (!folderId) return null;
  if (type === 'folder-offer') {
    const name = asString(raw.name);
    const totalSize = asNumber(raw.totalSize);
    if (!name || totalSize === null || !Array.isArray(raw.files)) return null;
    const files: { path: string; size: number; mime: string }[] = [];
    for (const item of raw.files) {
      if (!isObject(item)) return null;
      const path = asString(item.path);
      const size = asNumber(item.size);
      const mime = asString(item.mime);
      if (!path || size === null || !mime) return null;
      files.push({ path, size, mime });
    }
    return { type, folderId, name, files, totalSize };
  }
  if (
    type === 'folder-accept' ||
    type === 'folder-done' ||
    type === 'folder-cancel'
  ) {
    return { type, folderId };
  }
  if (type === 'folder-reject') {
    const reason = asString(raw.reason) ?? 'отклонено';
    return { type, folderId, reason };
  }
  return null;
};

export const parseControl = (raw: unknown): ControlMessage | null => {
  return parseFileControl(raw) ?? parseFolderControl(raw);
};
