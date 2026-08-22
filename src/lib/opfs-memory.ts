type MemoryNode = MemoryDirectory | MemoryFile;

class MemoryFile {
  kind = 'file' as const;
  bytes = new Uint8Array();
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async getFile() {
    return new File([this.bytes], this.name);
  }

  async createWritable(options?: { keepExistingData?: boolean }) {
    return new MemoryWritable(this, Boolean(options?.keepExistingData));
  }
}

class MemoryWritable {
  position = 0;
  file: MemoryFile;

  constructor(file: MemoryFile, keepExistingData: boolean) {
    this.file = file;
    if (!keepExistingData) this.file.bytes = new Uint8Array();
    this.position = this.file.bytes.length;
  }

  async write(chunk: unknown) {
    let data: unknown = chunk;
    if (chunk && typeof chunk === 'object' && 'type' in chunk) {
      const record = chunk as {
        type?: string;
        position?: number;
        data?: unknown;
      };
      if (record.type === 'write') {
        if (typeof record.position === 'number') {
          this.position = record.position;
        }
        data = record.data;
      }
    }
    const bytes = await toBytes(data);
    const end = this.position + bytes.length;
    const next = new Uint8Array(Math.max(this.file.bytes.length, end));
    next.set(this.file.bytes);
    next.set(bytes, this.position);
    this.file.bytes = next;
    this.position = end;
  }

  async close() {}
}

const toBytes = async (data: unknown): Promise<Uint8Array> => {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data === undefined || data === null) return new Uint8Array();
  throw new Error('unsupported write payload');
};

export class MemoryDirectory {
  kind = 'directory' as const;
  children = new Map<string, MemoryNode>();
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.children.get(name);
    if (existing?.kind === 'directory') return existing;
    if (existing) throw new Error('TypeMismatchError');
    if (!options?.create) throw new Error('NotFoundError');
    const dir = new MemoryDirectory(name);
    this.children.set(name, dir);
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.children.get(name);
    if (existing?.kind === 'file') return existing;
    if (existing) throw new Error('TypeMismatchError');
    if (!options?.create) throw new Error('NotFoundError');
    const file = new MemoryFile(name);
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string, _options?: { recursive?: boolean }) {
    if (!this.children.delete(name)) throw new Error('NotFoundError');
  }

  async *entries(): AsyncIterableIterator<[string, MemoryNode]> {
    for (const item of this.children) {
      yield [item[0], item[1]];
    }
  }
}

export const createMemoryRoot = (): FileSystemDirectoryHandle => {
  return new MemoryDirectory('root') as unknown as FileSystemDirectoryHandle;
};
