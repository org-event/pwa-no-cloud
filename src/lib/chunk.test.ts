import { describe, expect, it } from 'vitest';
import {
  chunkCount,
  chunkLength,
  fileBaseName,
  sliceBytes,
  waitDrain,
} from './chunk.ts';

describe('chunk helpers', () => {
  it('splits a payload into indexed slices', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(chunkCount(bytes.byteLength, 4)).toBe(3);
    expect(chunkLength(0, 10, 4)).toBe(4);
    expect(chunkLength(2, 10, 4)).toBe(2);
    expect([...sliceBytes(bytes, 2, 4)]).toEqual([8, 9]);
  });

  it('keeps only the file name', () => {
    expect(fileBaseName('a/b/hello.txt')).toBe('hello.txt');
    expect(fileBaseName('../secret')).toBe('file');
  });

  it('resolves when bufferedAmount is already low', async () => {
    const channel = {
      bufferedAmount: 0,
      addEventListener() {},
    };
    await waitDrain(channel, 1024);
  });

  it('waits for bufferedamountlow when the buffer is full', async () => {
    const listeners: Array<() => void> = [];
    const channel = {
      bufferedAmount: 4000,
      addEventListener(_name: string, fn: () => void) {
        listeners.push(fn);
      },
    };
    const pending = waitDrain(channel, 1000);
    channel.bufferedAmount = 10;
    for (const fn of listeners) fn();
    await pending;
  });
});
