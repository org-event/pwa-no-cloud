import { describe, expect, it, vi } from 'vitest';
import { notifyFileReceived, requestNotifyPermission } from './notify.ts';

describe('notify', () => {
  it('asks for notification permission once', async () => {
    const requestPermission = vi.fn(async () => 'granted');
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission,
    });
    expect(await requestNotifyPermission()).toBe(true);
    expect(requestPermission).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows a received-file notification when allowed', async () => {
    const showNotification = vi.fn(async () => undefined);
    vi.stubGlobal('Notification', { permission: 'granted' });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        ready: Promise.resolve({ showNotification }),
      },
    });
    expect(await notifyFileReceived('note.txt')).toBe(true);
    expect(showNotification).toHaveBeenCalledWith(
      'Файл получен',
      expect.objectContaining({ body: 'note.txt' }),
    );
    vi.unstubAllGlobals();
  });
});
