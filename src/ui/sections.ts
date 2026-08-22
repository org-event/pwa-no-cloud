import { parseDeepLink } from '../lib/app-link.ts';

export const APP_SECTIONS = [
  { id: 'servers', title: 'Настройки сервера' },
  { id: 'lan', title: 'Передача' },
  { id: 'contacts', title: 'Контакты' },
  { id: 'video', title: 'Видео конф' },
  { id: 'logs', title: 'Логи' },
  { id: 'help', title: 'Справка' },
] as const;

export type AppSection = (typeof APP_SECTIONS)[number]['id'];

export const DEFAULT_SECTION: AppSection = 'lan';

export const parseSectionHash = (hash: string, search = ''): AppSection => {
  return parseDeepLink(hash, search).section;
};

export const sectionHash = (section: AppSection): string => `#${section}`;

export const sectionTitle = (section: AppSection): string => {
  for (const item of APP_SECTIONS) {
    if (item.id === section) return item.title;
  }
  return APP_SECTIONS[1].title;
};
