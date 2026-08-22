export type FileControl =
  | {
      type: 'file-offer';
      transferId: string;
      name: string;
      size: number;
      mime: string;
      chunkSize: number;
    }
  | { type: 'file-accept'; transferId: string }
  | { type: 'file-reject'; transferId: string; reason: string }
  | { type: 'file-chunk-meta'; transferId: string; index: number; size: number }
  | { type: 'file-ack'; transferId: string; index: number }
  | { type: 'file-done'; transferId: string }
  | { type: 'file-error'; transferId: string; code: string }
  | { type: 'file-cancel'; transferId: string };

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
    return { type, transferId, name, size, mime, chunkSize };
  }
  if (
    type === 'file-accept' ||
    type === 'file-done' ||
    type === 'file-cancel'
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
