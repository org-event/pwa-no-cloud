/**
 * Detect signed chat wires on the PeerSession control DataChannel (U1.3).
 * H1. frames must not fall through to JSON control / transfer parsers.
 */

import { CHAT_MESSAGE_PREFIX } from '@/domain/chat/message.ts';

export const isChatControlFrame = (raw: string): boolean => {
  const text = raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  if (!text) return false;
  return text.startsWith(CHAT_MESSAGE_PREFIX) || /^H1\.\s*\{/i.test(text);
};
