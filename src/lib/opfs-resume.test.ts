import { describe, expect, it, vi } from 'vitest';
import {
  createReceiveTransfer,
  createSendTransfer,
} from '@/domain/transfer.ts';
import {
  createOpfsResume,
  cursorFromTransfer,
  inboxKeyFor,
} from './opfs-resume.ts';
import type { OpfsStore, TransferCursor } from './opfs.ts';

const receive = createReceiveTransfer({
  id: 't1',
  name: 'a.txt',
  path: 'dir/a.txt',
  folderId: 'fold',
  size: 10,
  mime: 'text/plain',
  chunkSize: 4,
});

describe('inboxKeyFor', () => {
  it('prefers resumeInboxId, then folderId, then transfer id', () => {
    expect(inboxKeyFor(receive, 'resume')).toBe('resume');
    expect(inboxKeyFor(receive, null)).toBe('fold');
    expect(inboxKeyFor({ ...receive, folderId: '' }, null)).toBe('t1');
  });
});

describe('cursorFromTransfer', () => {
  it('maps transfer fields into a TransferCursor', () => {
    const cursor = cursorFromTransfer({ ...receive, index: 2 }, 'inbox');
    expect(cursor).toEqual({
      id: 't1',
      inboxId: 'inbox',
      name: 'a.txt',
      path: 'dir/a.txt',
      folderId: 'fold',
      size: 10,
      mime: 'text/plain',
      chunkSize: 4,
      index: 2,
    } satisfies TransferCursor);
  });
});

describe('createOpfsResume', () => {
  it('inboxKey tracks resumeInboxId via deps', () => {
    let resumeInboxId: string | null = null;
    const resume = createOpfsResume({
      getStore: () => null,
      getResumeInboxId: () => resumeInboxId,
    });
    expect(resume.inboxKey(receive)).toBe('fold');
    resumeInboxId = 'kept';
    expect(resume.inboxKey(receive)).toBe('kept');
  });

  it('save and find are no-ops without a store', async () => {
    const resume = createOpfsResume({
      getStore: () => null,
      getResumeInboxId: () => null,
    });
    await expect(resume.save(receive)).resolves.toBeUndefined();
    await expect(
      resume.find({
        name: 'a.txt',
        path: 'dir/a.txt',
        size: 10,
        chunkSize: 4,
      }),
    ).resolves.toBeNull();
    await expect(resume.remove('t1')).resolves.toBeUndefined();
  });

  it('save skips send-direction transfers even with a store', async () => {
    const transfers = {
      getFileHandle: vi.fn(),
      removeEntry: vi.fn(),
    };
    const store = { transfers } as unknown as OpfsStore;
    const resume = createOpfsResume({
      getStore: () => store,
      getResumeInboxId: () => null,
    });
    const send = createSendTransfer({
      id: 's1',
      name: 'a.txt',
      size: 1,
      mime: 'text/plain',
      chunkSize: 1,
    });
    await resume.save(send);
    expect(transfers.getFileHandle).not.toHaveBeenCalled();
  });
});
