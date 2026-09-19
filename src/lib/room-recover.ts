/**
 * Room recover timers: re-enter a keepRoom Link after ICE/channel drop.
 */

export type RoomRecoverDeps = {
  /** True when recover is allowed (keepRoom + roomId). */
  enabled: () => boolean;
  /** Skip recover when Link is already healthy. */
  isHealthy: () => boolean;
  /** Re-enter the room; called after delay. */
  recover: (reason: string) => Promise<void>;
  /** Optional notice before recover starts. */
  onSchedule?: (reason: string) => void;
};

export type RoomRecover = {
  cancel: () => void;
  schedule: (reason: string, delayMs: number) => void;
  /** Immediate recover path (e.g. after timer fires). */
  run: (reason: string) => Promise<void>;
  readonly recovering: boolean;
};

export const createRoomRecover = (deps: RoomRecoverDeps): RoomRecover => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let recovering = false;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const run = async (reason: string) => {
    if (!deps.enabled() || recovering) return;
    if (deps.isHealthy()) return;
    recovering = true;
    deps.onSchedule?.(reason);
    try {
      await deps.recover(reason);
    } finally {
      recovering = false;
    }
  };

  const schedule = (reason: string, delayMs: number) => {
    if (!deps.enabled()) return;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      void run(reason);
    }, delayMs);
  };

  return {
    cancel,
    schedule,
    run,
    get recovering() {
      return recovering;
    },
  };
};
