export type IdStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const CLIENT_ID_KEY = 'nocloud.clientId';

export const generateId = (): string => {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) {
    id += byte.toString(36).padStart(2, '0');
  }
  return id.slice(0, 12);
};

export const getClientId = (storage: IdStorage): string => {
  const existing = storage.getItem(CLIENT_ID_KEY);
  if (existing) return existing;
  const clientId = generateId();
  storage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
};
