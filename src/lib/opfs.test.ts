import { describe, expect, it } from 'vitest';
import { createMemoryRoot } from './opfs-memory.ts';
import {
  FIXTURE_FILE_NAME,
  FIXTURE_TEXT,
  FIXTURE_TRANSFER_ID,
  appendLog,
  isSafeName,
  listInbox,
  openStore,
  readInboxFile,
  readText,
  removeInboxFile,
  writeFixture,
  writeInboxFile,
  writeTransferCursor,
  findTransferCursor,
} from './opfs.ts';

const store = async () => {
  const opened = await openStore(createMemoryRoot());
  if (!opened.ok) throw new Error(opened.message);
  return opened.value;
};

describe('opfs names', () => {
  it('rejects path traversal', () => {
    expect(isSafeName('hello.txt')).toBe(true);
    expect(isSafeName('../secret')).toBe(false);
    expect(isSafeName('a/b')).toBe(false);
  });
});

describe('opfs inbox', () => {
  it('writes, reads, lists, and removes a fixture', async () => {
    const fs = await store();
    const written = await writeFixture(fs);
    expect(written.ok).toBe(true);
    const listed = await listInbox(fs);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value).toEqual([
      { transferId: FIXTURE_TRANSFER_ID, name: FIXTURE_FILE_NAME },
    ]);
    const text = await readInboxFile(
      fs,
      FIXTURE_TRANSFER_ID,
      FIXTURE_FILE_NAME,
    );
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    expect(text.value).toBe(FIXTURE_TEXT);
    const removed = await removeInboxFile(
      fs,
      FIXTURE_TRANSFER_ID,
      FIXTURE_FILE_NAME,
    );
    expect(removed.ok).toBe(true);
    const empty = await listInbox(fs);
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.value).toEqual([]);
  });

  it('appends a line to logs/app.log', async () => {
    const fs = await store();
    const logged = await appendLog(fs, 'hello');
    expect(logged.ok).toBe(true);
    const text = await readText(fs.logs, 'app.log');
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    expect(text.value).toBe('hello\n');
  });

  it('writes and lists a nested inbox path', async () => {
    const fs = await store();
    const written = await writeInboxFile(
      fs,
      'pack',
      'docs/sub/note.txt',
      'nested',
    );
    expect(written.ok).toBe(true);
    const listed = await listInbox(fs);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value).toEqual([
      { transferId: 'pack', name: 'docs/sub/note.txt' },
    ]);
    const text = await readInboxFile(fs, 'pack', 'docs/sub/note.txt');
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    expect(text.value).toBe('nested');
  });

  it('stores a resume cursor under transfers/', async () => {
    const fs = await store();
    const written = await writeTransferCursor(fs, {
      id: 't1',
      inboxId: 't1',
      name: 'note.txt',
      path: 'note.txt',
      folderId: '',
      size: 10,
      mime: 'text/plain',
      chunkSize: 4,
      index: 2,
    });
    expect(written.ok).toBe(true);
    const found = await findTransferCursor(fs, {
      name: 'note.txt',
      path: 'note.txt',
      size: 10,
      chunkSize: 4,
    });
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value?.index).toBe(2);
  });

  it('returns an error when the file is missing', async () => {
    const fs = await store();
    const result = await removeInboxFile(fs, 'missing', 'nope.txt');
    expect(result.ok).toBe(false);
  });
});
