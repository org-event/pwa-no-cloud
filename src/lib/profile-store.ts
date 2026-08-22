import {
  defaultNick,
  parseProfileCard,
  sanitizeNick,
  type ProfileCard,
} from '../domain/profile.ts';
import type { IdStorage } from './id.ts';
import { getClientId } from './id.ts';

export const PROFILE_STORAGE_KEY = 'nocloud.profile.v1';

export const loadProfile = (storage: IdStorage): ProfileCard => {
  const id = getClientId(storage);
  const raw = storage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return { id, nick: defaultNick(id), avatar: '' };
  try {
    const parsed = parseProfileCard({
      ...(JSON.parse(raw) as object),
      id,
    });
    if (parsed) return parsed;
  } catch {
    return { id, nick: defaultNick(id), avatar: '' };
  }
  return { id, nick: defaultNick(id), avatar: '' };
};

export const saveProfile = (
  storage: IdStorage,
  draft: { nick: string; avatar: string },
): ProfileCard => {
  const id = getClientId(storage);
  const nick = sanitizeNick(draft.nick) || defaultNick(id);
  const card = { id, nick, avatar: draft.avatar };
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(card));
  return card;
};
