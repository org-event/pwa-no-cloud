import {
  APP_SECTIONS,
  DEFAULT_SECTION,
  sectionFallbackTitle,
  type AppSection,
} from '@/content/index.ts';
import { parseDeepLink } from '@/lib/app-link.ts';

export { APP_SECTIONS, DEFAULT_SECTION, type AppSection };

export const parseSectionHash = (hash: string, search = ''): AppSection => {
  return parseDeepLink(hash, search).section;
};

export const sectionHash = (section: AppSection): string => `#${section}`;

export const sectionTitle = (section: AppSection): string => {
  for (const item of APP_SECTIONS) {
    if (item.id === section) return item.title;
  }
  return sectionFallbackTitle;
};
