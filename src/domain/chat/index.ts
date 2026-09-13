export type { ChatMessage, ChatMessageDraft } from './message.ts';
export {
  CHAT_MESSAGE_MAX_CHARS,
  CHAT_MESSAGE_PREFIX,
  CHAT_MESSAGE_VERSION,
  canonicalChatMessage,
  createChatMessage,
  parseAndVerifyChatMessage,
  parseChatMessage,
  verifyChatMessage,
} from './message.ts';
