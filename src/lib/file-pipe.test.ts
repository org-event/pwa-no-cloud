import { describe, expect, it } from 'vitest';
import { FilePipe, type ControlSink, type DataSink } from './file-pipe.ts';
import { createMemoryRoot } from './opfs-memory.ts';
import { listInbox, openStore, readInboxFile } from './opfs.ts';

const openSink = (
  onSend: (data: string | ArrayBuffer) => void,
): DataSink & ControlSink => ({
  readyState: 'open',
  bufferedAmount: 0,
  send: onSend,
  addEventListener() {},
});

const pair = async () => {
  const opened = await openStore(createMemoryRoot());
  if (!opened.ok) throw new Error(opened.message);
  let alice: FilePipe | null = null;
  let bob: FilePipe | null = null;
  const aliceControl = openSink((data) => {
    if (typeof data === 'string') bob?.onControlRaw(data);
  });
  const aliceBytes = openSink((data) => {
    if (typeof data !== 'string') void bob?.onBytes(data);
  });
  const bobControl = openSink((data) => {
    if (typeof data === 'string') alice?.onControlRaw(data);
  });
  const bobBytes = openSink((data) => {
    if (typeof data !== 'string') void alice?.onBytes(data);
  });
  alice = new FilePipe({
    control: aliceControl,
    bytes: aliceBytes,
    chunkSize: 4,
    maxSize: 1024,
  });
  bob = new FilePipe({
    control: bobControl,
    bytes: bobBytes,
    store: opened.value,
    chunkSize: 4,
    maxSize: 1024,
  });
  return { alice, bob, store: opened.value };
};

describe('file pipe', () => {
  it('delivers a file after accept and acks', async () => {
    const { alice, bob, store } = await pair();
    const done = new Promise<void>((resolve) => {
      alice.on('transfer', (value) => {
        const transfer = value as { state?: string };
        if (transfer.state === 'done') resolve();
      });
    });
    bob.on('offer', (value) => {
      const transfer = value as { id: string };
      bob.accept(transfer.id);
    });
    alice.sendFile(
      new File(['abcdefghij'], 'note.txt', { type: 'text/plain' }),
    );
    await done;
    const listed = await listInbox(store);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value[0]?.name).toBe('note.txt');
    const text = await readInboxFile(
      store,
      listed.value[0]?.transferId ?? '',
      'note.txt',
    );
    expect(text.ok).toBe(true);
    if (!text.ok) return;
    expect(text.value).toBe('abcdefghij');
  });

  it('cancels after the first ack', async () => {
    const { alice, bob } = await pair();
    const canceled = new Promise<void>((resolve) => {
      alice.on('transfer', (value) => {
        const transfer = value as { state?: string; index?: number };
        if (transfer.state === 'sending' && transfer.index === 1) {
          alice.cancel();
        }
        if (transfer.state === 'canceled') resolve();
      });
    });
    bob.on('offer', (value) => {
      const transfer = value as { id: string };
      bob.accept(transfer.id);
    });
    alice.sendFile(new File(['abcdefghij'], 'note.txt'));
    await canceled;
    expect(alice.current()?.state ?? 'canceled').toBe('canceled');
  });
});
