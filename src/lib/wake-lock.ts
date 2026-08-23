/** Keep the screen awake while the user is “available” for knocks / calls. */

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener(type: 'release', listener: () => void): void;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

let sentinel: WakeLockSentinelLike | null = null;
let wantLock = false;

const canRequest = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as WakeLockNavigator;
  return Boolean(nav.wakeLock?.request);
};

export const wakeLockSupported = (): boolean => canRequest();

export const requestWakeLock = async (): Promise<boolean> => {
  wantLock = true;
  if (!canRequest()) return false;
  if (
    typeof document !== 'undefined' &&
    document.visibilityState !== 'visible'
  ) {
    return false;
  }
  if (sentinel && !sentinel.released) return true;
  try {
    const nav = navigator as WakeLockNavigator;
    const next = await nav.wakeLock!.request('screen');
    sentinel = next;
    next.addEventListener('release', () => {
      if (sentinel === next) sentinel = null;
    });
    return true;
  } catch {
    sentinel = null;
    return false;
  }
};

export const releaseWakeLock = async (): Promise<void> => {
  wantLock = false;
  const current = sentinel;
  sentinel = null;
  if (!current || current.released) return;
  try {
    await current.release();
  } catch {
    /* ignore */
  }
};

/** Re-assert lock after tab becomes visible again. */
export const resumeWakeLock = async (): Promise<boolean> => {
  if (!wantLock) return false;
  return requestWakeLock();
};
