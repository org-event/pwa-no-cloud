/**
 * Classify paste/scan payloads on the locked first screen (U1.6).
 */

import { SHARE_PACK_PREFIX } from '@/config/share-pack.ts';
import { BACKUP_PREFIX } from '@/domain/identity/backup.ts';
import { INTRODUCE_CARD_PREFIX } from '@/domain/introduce.ts';
import { CONTACT_CARD_PREFIX } from '@/domain/profile.ts';
import { REDIRECT_NOTE_PREFIX } from '@/domain/relay/redirect.ts';

export type FirstScreenPasteKind =
  | 'backup'
  | 'mnemonic'
  | 'share-pack'
  | 'redirect'
  | 'contact-card'
  | 'introduce'
  | 'unknown';

export type FirstScreenPaste = {
  kind: FirstScreenPasteKind;
  text: string;
};

const strip = (raw: string): string =>
  raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const looksLikeMnemonic = (text: string): boolean => {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 12 && words.length !== 24) return false;
  return words.every((word) => /^[a-z]+$/.test(word));
};

export const classifyFirstScreenPaste = (raw: string): FirstScreenPaste => {
  const text = strip(raw);
  if (!text) return { kind: 'unknown', text: '' };
  if (text.startsWith(BACKUP_PREFIX) || /^nb1\.\s*/i.test(text)) {
    return { kind: 'backup', text };
  }
  if (text.startsWith(SHARE_PACK_PREFIX) || /^S1\.\s*\{/i.test(text)) {
    return { kind: 'share-pack', text };
  }
  if (text.startsWith(REDIRECT_NOTE_PREFIX) || /^R1\.\s*\{/i.test(text)) {
    return { kind: 'redirect', text };
  }
  if (text.startsWith(INTRODUCE_CARD_PREFIX) || /^I1\.\s*\{/i.test(text)) {
    return { kind: 'introduce', text };
  }
  if (text.startsWith(CONTACT_CARD_PREFIX) || /^P1\.\s*\{/i.test(text)) {
    return { kind: 'contact-card', text };
  }
  if (looksLikeMnemonic(text)) return { kind: 'mnemonic', text };
  return { kind: 'unknown', text };
};

export const PENDING_FIRST_SCREEN_PASTE_KEY = 'nocloud.pendingFirstPaste';
