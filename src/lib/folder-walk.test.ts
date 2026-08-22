import { describe, expect, it } from 'vitest';
import { createMemoryRoot } from './opfs-memory.ts';
import { collectFromDirectory, collectFromFileList } from './folder-walk.ts';

const withRelative = (file: File, path: string): File => {
  Object.defineProperty(file, 'webkitRelativePath', { value: path });
  return file;
};

describe('folder walk', () => {
  it('reads webkitRelativePath from a file list', () => {
    const walked = collectFromFileList([
      withRelative(new File(['aa'], 'a.txt'), 'docs/a.txt'),
      withRelative(new File(['bb'], 'b.txt'), 'docs/sub/b.txt'),
    ]);
    expect(walked.ok).toBe(true);
    if (!walked.ok) return;
    expect(walked.value[0]?.path).toBe('docs/a.txt');
    expect(walked.value[1]?.path).toBe('docs/sub/b.txt');
  });

  it('walks a directory handle into relative paths', async () => {
    const root = createMemoryRoot();
    const docs = await root.getDirectoryHandle('docs', { create: true });
    const nested = await docs.getDirectoryHandle('sub', { create: true });
    const a = await docs.getFileHandle('a.txt', { create: true });
    const b = await nested.getFileHandle('b.txt', { create: true });
    const writerA = await a.createWritable();
    await writerA.write('aa');
    await writerA.close();
    const writerB = await b.createWritable();
    await writerB.write('bb');
    await writerB.close();
    const walked = await collectFromDirectory(docs, 'docs');
    expect(walked.ok).toBe(true);
    if (!walked.ok) return;
    const paths = walked.value.map((item) => item.path).sort();
    expect(paths).toEqual(['docs/a.txt', 'docs/sub/b.txt']);
  });
});
