import {
  defaultNick,
  isProfileId,
  parseProfileCard,
  sanitizeNick,
  type ProfileCard,
} from '@/domain/profile.ts';
import type { IdStorage } from './id.ts';

export const PROFILE_STORAGE_KEY = 'nocloud.profile.v1';
/** Bound identity fingerprint — replaces exploratory nocloud.clientId for profile. */
export const IDENTITY_ID_KEY = 'nocloud.identityId';

const emptyProfile = (): ProfileCard => ({
  id: '',
  nick: defaultNick('user'),
  avatar: '',
});

export const loadProfile = (storage: IdStorage): ProfileCard => {
  const id = storage.getItem(IDENTITY_ID_KEY) ?? '';
  if (!isProfileId(id)) return emptyProfile();
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

/** Bind unlocked identity fingerprint as the only profile id (S0.2 hard cut). */
export const bindIdentityProfile = (
  storage: IdStorage,
  fingerprint: string,
): ProfileCard => {
  if (!isProfileId(fingerprint)) {
    return emptyProfile();
  }
  const id = fingerprint.toLowerCase();
  storage.setItem(IDENTITY_ID_KEY, id);
  const previous = loadProfile(storage);
  const nick = previous.nick || defaultNick(id);
  const avatar = previous.avatar || '';
  const card = { id, nick, avatar };
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(card));
  return card;
};

export const saveProfile = (
  storage: IdStorage,
  draft: { nick: string; avatar: string },
): ProfileCard => {
  const id = storage.getItem(IDENTITY_ID_KEY) ?? '';
  if (!isProfileId(id)) return emptyProfile();
  const nick = sanitizeNick(draft.nick) || defaultNick(id);
  const card = { id, nick, avatar: draft.avatar };
  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(card));
  return card;
};
