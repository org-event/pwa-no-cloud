import { describe, expect, it } from 'vitest';
import {
  folderNameFromPaths,
  normalizeRelativePath,
  splitRelativePath,
} from './folder-path.ts';

describe('relative folder paths', () => {
  it('keeps a nested posix path', () => {
    expect(normalizeRelativePath('photos/2024/a.jpg')).toBe(
      'photos/2024/a.jpg',
    );
    expect(splitRelativePath('photos/2024/a.jpg')).toEqual([
      'photos',
      '2024',
      'a.jpg',
    ]);
  });

  it('rejects traversal and absolute paths', () => {
    expect(normalizeRelativePath('../secret')).toBe(null);
    expect(normalizeRelativePath('a/../b')).toBe(null);
    expect(normalizeRelativePath('/etc/passwd')).toBe(null);
    expect(normalizeRelativePath('C:\\Windows\\x')).toBe(null);
  });

  it('reads the folder name from the first segment', () => {
    expect(folderNameFromPaths(['photos/a.jpg', 'photos/b.jpg'])).toBe(
      'photos',
    );
  });
});
