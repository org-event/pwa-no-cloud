/**
 * Read from a byte stream until `need` bytes are buffered (or EOF).
 */

const concat = (left: Uint8Array, right: Uint8Array): Uint8Array => {
  const next = new Uint8Array(left.byteLength + right.byteLength);
  next.set(left);
  next.set(right, left.byteLength);
  return next;
};

/** Grow `leftover` from `reader` until it holds at least `need` bytes, or EOF. */
export const fillStreamBuffer = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  leftover: Uint8Array,
  need: number,
): Promise<Uint8Array> => {
  let buffer = leftover;
  while (buffer.byteLength < need) {
    const read = await reader.read();
    if (read.done) return buffer;
    buffer = concat(buffer, read.value);
  }
  return buffer;
};
