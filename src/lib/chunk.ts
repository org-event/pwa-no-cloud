export const chunkCount = (size: number, chunkSize: number): number => {
  if (size <= 0 || chunkSize <= 0) return 0;
  return Math.ceil(size / chunkSize);
};

export const chunkOffset = (index: number, chunkSize: number): number => {
  return index * chunkSize;
};

export const chunkLength = (
  index: number,
  size: number,
  chunkSize: number,
): number => {
  const start = chunkOffset(index, chunkSize);
  if (start >= size) return 0;
  return Math.min(chunkSize, size - start);
};

export const sliceBytes = (
  bytes: Uint8Array,
  index: number,
  chunkSize: number,
): Uint8Array => {
  const start = chunkOffset(index, chunkSize);
  const length = chunkLength(index, bytes.byteLength, chunkSize);
  return bytes.subarray(start, start + length);
};

export const fileBaseName = (name: string): string => {
  if (name.includes('..')) return 'file';
  const parts = name.replaceAll('\\', '/').split('/');
  const last = parts[parts.length - 1] ?? '';
  const trimmed = last.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..') return 'file';
  return trimmed;
};

type DrainChannel = {
  bufferedAmount: number;
  addEventListener: (
    name: string,
    fn: () => void,
    options?: { once?: boolean },
  ) => void;
};

export const waitDrain = (
  channel: DrainChannel,
  limit: number,
): Promise<void> => {
  if (channel.bufferedAmount <= limit) return Promise.resolve();
  return new Promise((resolve) => {
    const onLow = () => {
      if (channel.bufferedAmount <= limit) {
        resolve();
        return;
      }
      channel.addEventListener('bufferedamountlow', onLow, { once: true });
    };
    channel.addEventListener('bufferedamountlow', onLow, { once: true });
  });
};
