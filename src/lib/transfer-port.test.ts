import { fromPartial } from '@total-typescript/shoehorn';
import { describe, expect, it, vi } from 'vitest';
import { bindTransferPort, type TransferPipeLike } from './transfer-port.ts';

describe('TransferPort', () => {
  it('bindTransferPort forwards byte-plane calls to the pipe', () => {
    const file = new File(['x'], 'x.txt');
    const sendFile = vi.fn();
    const accept = vi.fn();
    const pause = vi.fn();
    const pipe: TransferPipeLike = fromPartial({
      sendFile,
      sendFolder: vi.fn(),
      accept,
      reject: vi.fn(),
      cancel: vi.fn(),
      pause,
      resume: vi.fn(),
      current: vi.fn(() => null),
      currentFolder: vi.fn(() => null),
      active: null,
      incoming: null,
      activeFolder: null,
      incomingFolder: null,
    });

    const port = bindTransferPort(pipe);
    port.sendFile(file);
    port.accept('t1');
    port.pause();
    expect(sendFile).toHaveBeenCalledWith(file);
    expect(accept).toHaveBeenCalledWith('t1');
    expect(pause).toHaveBeenCalled();
    expect(port.activeFile()).toBeNull();
  });
});
