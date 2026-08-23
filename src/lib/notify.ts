import { notifyCopy } from '@/content/index.ts';

export const requestNotifyPermission = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const result = await Notification.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
};

export const notifyFileReceived = async (name: string): Promise<boolean> => {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission !== 'granted') return false;
  const title = notifyCopy.fileReceived;
  const body = name;
  try {
    if (navigator.serviceWorker) {
      const ready = await navigator.serviceWorker.ready;
      if (ready.showNotification) {
        await ready.showNotification(title, {
          body,
          icon: `${import.meta.env.BASE_URL}icon.svg`,
        });
        return true;
      }
    }
    new Notification(title, {
      body,
      icon: `${import.meta.env.BASE_URL}icon.svg`,
    });
    return true;
  } catch {
    return false;
  }
};
