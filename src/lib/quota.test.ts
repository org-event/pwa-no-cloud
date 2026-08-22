import { describe, expect, it, vi } from 'vitest';
import { estimateQuota, requestPersist } from './quota.ts';

describe('quota helpers', () => {
  it('returns free space from storage.estimate', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        estimate: async () => ({ usage: 10, quota: 40 }),
      },
    });
    const info = await estimateQuota();
    expect(info).toEqual({ usage: 10, quota: 40, free: 30 });
    vi.unstubAllGlobals();
  });

  it('asks the browser to persist origin data', async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal('navigator', { storage: { persist } });
    expect(await requestPersist()).toBe(true);
    expect(persist).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
