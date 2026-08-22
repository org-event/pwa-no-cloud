export type ShareFilePayload = {
  name: string;
  type: string;
  buffer: ArrayBuffer;
};

const isPayload = (value: unknown): value is ShareFilePayload => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    typeof record.type === 'string' &&
    record.buffer instanceof ArrayBuffer
  );
};

export const filesFromShare = (data: unknown): File[] => {
  if (!Array.isArray(data)) return [];
  const files: File[] = [];
  for (const item of data) {
    if (!isPayload(item)) continue;
    files.push(new File([item.buffer], item.name, { type: item.type }));
  }
  return files;
};
