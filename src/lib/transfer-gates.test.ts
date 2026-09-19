import { describe, expect, it } from 'vitest';
import { fillStreamBuffer } from './stream-fill.ts';
import { createAckGate, createPauseGate } from './transfer-gates.ts';

describe('ack gate', () => {
  it('resolves a waiting chunk', async () => {
    const gate = createAckGate();
    const pending = gate.wait('t1', 2);
    gate.resolve('t1', 2);
    await expect(pending).resolves.toBe(2);
  });

  it('clears waiters with interrupt signal', async () => {
    const gate = createAckGate();
    const pending = gate.wait('t1', 0);
    gate.clear(-1);
    await expect(pending).resolves.toBe(-1);
  });
});

describe('pause gate', () => {
  it('blocks while paused and resumes', async () => {
    const gate = createPauseGate();
    gate.pause();
    let released = false;
    const pending = gate.waitIfPaused().then(() => {
      released = true;
    });
    expect(released).toBe(false);
    gate.resume();
    await pending;
    expect(released).toBe(true);
    expect(gate.paused).toBe(false);
  });

  it('does not block when not paused', async () => {
    const gate = createPauseGate();
    await expect(gate.waitIfPaused()).resolves.toBeUndefined();
  });
});

describe('stream fill', () => {
  it('returns leftover when already enough', async () => {
    const reader = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    }).getReader();
    const leftover = new Uint8Array([1, 2, 3, 4]);
    const filled = await fillStreamBuffer(reader, leftover, 3);
    expect([...filled]).toEqual([1, 2, 3, 4]);
    reader.releaseLock();
  });

  it('reads until need or EOF', async () => {
    const reader = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3]));
        controller.close();
      },
    }).getReader();
    const filled = await fillStreamBuffer(reader, new Uint8Array(), 4);
    expect([...filled]).toEqual([1, 2, 3]);
    reader.releaseLock();
  });
});
