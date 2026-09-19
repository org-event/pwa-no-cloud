/**
 * Byte-plane flow gates for FilePipe: per-chunk acks and remote pause.
 */

export type AckGate = {
  wait(transferId: string, index: number): Promise<number>;
  /** Resolve a pending wait for this chunk (no-op if none). */
  resolve(transferId: string, index: number): void;
  /** Wake all waiters with `signal` (default -1 = interrupt) and clear. */
  clear(signal?: number): void;
};

export const createAckGate = (): AckGate => {
  const waiters = new Map<string, (index: number) => void>();
  const keyOf = (transferId: string, index: number) => `${transferId}:${index}`;

  return {
    wait(transferId, index) {
      return new Promise((resolve) => {
        waiters.set(keyOf(transferId, index), resolve);
      });
    },
    resolve(transferId, index) {
      const waiter = waiters.get(keyOf(transferId, index));
      if (waiter) waiter(index);
    },
    clear(signal = -1) {
      for (const waiter of waiters.values()) waiter(signal);
      waiters.clear();
    },
  };
};

export type PauseGate = {
  readonly paused: boolean;
  pause(): void;
  /** Unpause and wake waiters. */
  resume(): void;
  waitIfPaused(): Promise<void>;
};

export const createPauseGate = (): PauseGate => {
  let paused = false;
  let resumeWaiters: Array<() => void> = [];

  const release = () => {
    for (const waiter of resumeWaiters) waiter();
    resumeWaiters = [];
  };

  return {
    get paused() {
      return paused;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      release();
    },
    waitIfPaused() {
      if (!paused) return Promise.resolve();
      return new Promise((resolve) => {
        resumeWaiters.push(resolve);
      });
    },
  };
};
