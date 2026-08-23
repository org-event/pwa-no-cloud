export const sectionsCopy = {
  servers: 'Настройки сервера',
  contacts: 'Контакты',
  lan: 'Передача',
  calls: 'Звонки',
  logs: 'Логи',
  help: 'Справка',
} as const;

export const APP_SECTIONS = [
  { id: 'servers' as const, title: sectionsCopy.servers },
  { id: 'contacts' as const, title: sectionsCopy.contacts },
  { id: 'lan' as const, title: sectionsCopy.lan },
  { id: 'calls' as const, title: sectionsCopy.calls },
  { id: 'logs' as const, title: sectionsCopy.logs },
  { id: 'help' as const, title: sectionsCopy.help },
] as const;

export type AppSection = (typeof APP_SECTIONS)[number]['id'];

export const DEFAULT_SECTION: AppSection = 'contacts';

export const sectionFallbackTitle = sectionsCopy.contacts;
