import { describe, expect, it } from 'vitest';
import {
  applyFolderEvent,
  createReceiveFolder,
  createSendFolder,
  folderProgress,
} from './folder.ts';

const photos = () =>
  createSendFolder({
    id: 'f1',
    name: 'photos',
    totalSize: 9,
    files: [
      { path: 'photos/a.jpg', size: 4, mime: 'image/jpeg' },
      { path: 'photos/b.jpg', size: 5, mime: 'image/jpeg' },
    ],
  });

describe('folder machine', () => {
  it('counts finished files and completes after the last one', () => {
    let folder = applyFolderEvent(photos(), { type: 'offer' });
    folder = applyFolderEvent(folder, { type: 'accept' });
    expect(folder.state).toBe('sending');
    folder = applyFolderEvent(folder, { type: 'file', index: 0 });
    expect(folderProgress(folder)).toEqual({ done: 1, total: 2 });
    folder = applyFolderEvent(folder, { type: 'file', index: 1 });
    expect(folder.state).toBe('done');
    expect(folder.index).toBe(2);
  });

  it('cancels after the first file', () => {
    let folder = applyFolderEvent(photos(), { type: 'offer' });
    folder = applyFolderEvent(folder, { type: 'accept' });
    folder = applyFolderEvent(folder, { type: 'file', index: 0 });
    folder = applyFolderEvent(folder, { type: 'cancel' });
    expect(folder.state).toBe('canceled');
    expect(folder.index).toBe(1);
  });

  it('rejects a folder offer', () => {
    let folder = applyFolderEvent(photos(), { type: 'offer' });
    folder = applyFolderEvent(folder, {
      type: 'reject',
      reason: 'нет места',
    });
    expect(folder.state).toBe('failed');
    expect(folder.error).toBe('нет места');
  });

  it('receives files then finishes', () => {
    let folder = createReceiveFolder({
      id: 'f2',
      name: 'docs',
      totalSize: 2,
      files: [{ path: 'docs/a.txt', size: 2, mime: 'text/plain' }],
    });
    folder = applyFolderEvent(folder, { type: 'offer' });
    folder = applyFolderEvent(folder, { type: 'accept' });
    expect(folder.state).toBe('receiving');
    folder = applyFolderEvent(folder, { type: 'file', index: 0 });
    expect(folder.state).toBe('done');
  });
});
