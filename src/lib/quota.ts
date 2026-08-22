export type QuotaInfo = {
  usage: number;
  quota: number;
  free: number;
};

export const estimateQuota = async (): Promise<QuotaInfo | null> => {
  const storage = navigator.storage;
  if (!storage?.estimate) return null;
  try {
    const info = await storage.estimate();
    const usage = info.usage ?? 0;
    const quota = info.quota ?? 0;
    if (quota <= 0) return null;
    return { usage, quota, free: Math.max(0, quota - usage) };
  } catch {
    return null;
  }
};

export const requestPersist = async (): Promise<boolean> => {
  const storage = navigator.storage;
  if (!storage?.persist) return false;
  try {
    return await storage.persist();
  } catch {
    return false;
  }
};
