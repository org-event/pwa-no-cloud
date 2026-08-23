import { MIXED_CONTENT_SIGNALING } from './signaling.ts';

export const contactsCopy = {
  inBook: (nick: string) => `В книге: ${nick}`,
  nickRules: 'Ник: буквы, цифры, пробел, . _ - до 32 знаков.',
  nickSaved: 'Ник сохранён.',
  avatarUnreadable: 'Не удалось прочитать фото.',
  avatarSaved: 'Фото сохранено. Второй получит карточку по каналу.',
  avatarCleared: 'Лого сгенерировано из id.',
  cardCopied: 'Карточка скопирована. Отправьте её.',
  cardCopyFailed: 'Не удалось скопировать.',
  pasteCard: 'Вставьте карточку C1. которую прислали.',
  ownCard: 'Это ваша карточка.',
  removed: 'Удалено.',
  groupNeedMembers: 'Нужны название и хотя бы один человек.',
  groupSaved: (label: string) => `Группа «${label}». Канал всё равно 1:1.`,
  groupRemoved: 'Группа удалена.',
} as const;

export const knockNeedS1Known = (nick: string) =>
  `${nick} в списке, но «в сети» не будет: вставьте пакет S1. в «Настройки сервера» на обоих устройствах. Одна Wi‑Fi без S1 не соединит.`;

export const knockNeedS1 = () =>
  'Нужен пакет S1. в «Настройки сервера» на обоих устройствах. Одна Wi‑Fi без сокета не соединит.';

export const knockBlockedNotice = (
  knownNick: string | undefined,
  mixedContent: boolean,
): string => {
  if (knownNick) return knockNeedS1Known(knownNick);
  if (mixedContent) return MIXED_CONTENT_SIGNALING;
  return knockNeedS1();
};

export const knockAlreadyNotice = (
  asHost: boolean,
  knownNick: string | undefined,
): string => {
  if (asHost) return 'Уже ждём, кто вставит карточку.';
  if (knownNick) return `${knownNick} в списке. Уже стучимся.`;
  return 'Уже стучимся.';
};

export const knockStartNotice = (
  asHost: boolean,
  knownNick: string | undefined,
): string => {
  if (asHost) return 'Карточка готова. Копируйте и не закрывайте окно.';
  if (knownNick) return `${knownNick} в списке. Стучимся…`;
  return 'Стучимся…';
};
