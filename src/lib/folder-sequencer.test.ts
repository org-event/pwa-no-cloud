import { describe, expect, it } from 'vitest';
import {
  applyFolderEvent,
  createReceiveFolder,
  createSendFolder,
} from '@/domain/folder.ts';
import {
  advanceFolder,
  isOpenFolder,
  nextFolderEntry,
} from './folder-sequencer.ts';

const sendFolder = (files: number, index = 0) => {
  const base = createSendFolder({
    id: 'f1',
    name: 'pack',
    files: Array.from({ length: files }, (_, i) => ({
      path: `a/${i}.txt`,
      size: 1,
      mime: 'text/plain',
    })),
    totalSize: files,
  });
  const offered = applyFolderEvent(base, { type: 'offer' });
  const accepted = applyFolderEvent(offered, { type: 'accept' });
  return { ...accepted, index };
};

describe('isOpenFolder', () => {
  it('is false for null and terminal states', () => {
    expect(isOpenFolder(null)).toBe(false);
    const folder = sendFolder(1);
    expect(isOpenFolder(folder)).toBe(true);
    expect(isOpenFolder(applyFolderEvent(folder, { type: 'done' }))).toBe(
      false,
    );
  });
});

describe('advanceFolder', () => {
  it('returns null when direction mismatches or folder closed', () => {
    const folder = sendFolder(2);
    expect(advanceFolder(folder, 'receive')).toBeNull();
    expect(advanceFolder(null, 'send')).toBeNull();
    expect(
      advanceFolder(applyFolderEvent(folder, { type: 'done' }), 'send'),
    ).toBeNull();
  });

  it('advances index and reports done on last file', () => {
    const mid = advanceFolder(sendFolder(2, 0), 'send');
    expect(mid).toEqual({
      folder: expect.objectContaining({ index: 1, state: 'sending' }),
      done: false,
    });
    const last = advanceFolder(mid!.folder, 'send');
    expect(last).toEqual({
      folder: expect.objectContaining({ index: 2, state: 'done' }),
      done: true,
    });
  });

  it('advances receive folders the same way', () => {
    const base = createReceiveFolder({
      id: 'r1',
      name: 'pack',
      files: [
        { path: 'a.txt', size: 1, mime: 'text/plain' },
        { path: 'b.txt', size: 1, mime: 'text/plain' },
      ],
      totalSize: 2,
    });
    const receiving = applyFolderEvent(
      applyFolderEvent(base, { type: 'offer' }),
      { type: 'accept' },
    );
    const advanced = advanceFolder(receiving, 'receive');
    expect(advanced?.done).toBe(false);
    expect(advanced?.folder.index).toBe(1);
  });
});

describe('nextFolderEntry', () => {
  it('returns entry at folder.index or done when exhausted', () => {
    const folder = sendFolder(2, 0);
    const queue = [{ path: 'a/0.txt' }, { path: 'a/1.txt' }];
    expect(nextFolderEntry(folder, queue)).toEqual({
      kind: 'entry',
      entry: queue[0],
    });
    expect(nextFolderEntry({ ...folder, index: 2 }, queue)).toEqual({
      kind: 'done',
    });
  });
});
