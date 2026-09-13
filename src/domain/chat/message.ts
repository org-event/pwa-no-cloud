/**
 * Chat message wire (M3 U1.1): signed 1:1 text over DataChannel.
 * Prefix H1. — history/chat; distinct from P1./I1./S1./R1.
 */

import {
  bytesToHex,
  decodePublicKey,
  encodePublicKey,
  hexToBytes,
  signText,
  verifyText,
  type CryptoResult,
  type KeyPair,
} from '../identity/index.ts';

export const CHAT_MESSAGE_PREFIX = 'H1.';
export const CHAT_MESSAGE_VERSION = 1 as const;
export const CHAT_MESSAGE_MAX_CHARS = 4000;

export type ChatMessage = {
  v: typeof CHAT_MESSAGE_VERSION;
  /** Sender wire pubkey `pk1.…`. */
  fromPk: string;
  /** Recipient fingerprint (stable contact id). */
  toId: string;
  text: string;
  /** Unix ms. */
  ts: number;
  sig: string;
};

export type ChatMessageDraft = {
  toId: string;
  text: string;
  ts?: number;
};

const stripNoise = (text: string): string =>
  text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

const extractPayload = (text: string): string | null => {
  const raw = stripNoise(text);
  if (!raw) return null;
  const packed = raw.match(/H1\.\s*(\{[\s\S]*\})/i);
  if (packed?.[1]) return packed[1];
  if (raw.startsWith('{')) return raw;
  return null;
};

const sanitizeText = (raw: string): string | null => {
  const text = raw.split('\0').join('').trim();
  if (!text || text.length > CHAT_MESSAGE_MAX_CHARS) return null;
  return text;
};

export const canonicalChatMessage = (
  fromPk: string,
  toId: string,
  text: string,
  ts: number,
): string =>
  `nocloud.chat.v${CHAT_MESSAGE_VERSION}|${fromPk}|${toId}|${ts}|${text}`;

export const createChatMessage = async (
  draft: ChatMessageDraft,
  sender: KeyPair,
): Promise<CryptoResult<string>> => {
  const text = sanitizeText(draft.text);
  if (!text) {
    return { ok: false, code: 'bad-text', message: 'invalid or empty text' };
  }
  const toId = draft.toId.trim();
  if (!toId || toId.length < 8) {
    return { ok: false, code: 'bad-to', message: 'invalid recipient id' };
  }
  const ts =
    typeof draft.ts === 'number' && Number.isFinite(draft.ts)
      ? Math.trunc(draft.ts)
      : Date.now();
  const fromPk = encodePublicKey(sender.publicKey);
  const message = canonicalChatMessage(fromPk, toId, text, ts);
  try {
    const signature = await signText(message, sender.secretKey);
    const card: ChatMessage = {
      v: CHAT_MESSAGE_VERSION,
      fromPk,
      toId,
      text,
      ts,
      sig: bytesToHex(signature),
    };
    return { ok: true, value: CHAT_MESSAGE_PREFIX + JSON.stringify(card) };
  } catch (error) {
    return {
      ok: false,
      code: 'sign-failed',
      message: error instanceof Error ? error.message : 'sign failed',
    };
  }
};

export const parseChatMessage = (text: string): CryptoResult<ChatMessage> => {
  const payload = extractPayload(text);
  if (!payload) {
    return { ok: false, code: 'not-found', message: 'no H1. chat message' };
  }
  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid chat JSON' };
  }
  if (!json || typeof json !== 'object') {
    return { ok: false, code: 'bad-shape', message: 'chat not an object' };
  }
  const raw = json as Record<string, unknown>;
  if (raw.v !== CHAT_MESSAGE_VERSION) {
    return {
      ok: false,
      code: 'bad-version',
      message: 'unsupported chat version',
    };
  }
  if (
    typeof raw.fromPk !== 'string' ||
    typeof raw.toId !== 'string' ||
    typeof raw.text !== 'string' ||
    typeof raw.sig !== 'string'
  ) {
    return { ok: false, code: 'bad-shape', message: 'missing chat fields' };
  }
  if (typeof raw.ts !== 'number' || !Number.isFinite(raw.ts)) {
    return { ok: false, code: 'bad-shape', message: 'bad ts' };
  }
  const body = sanitizeText(raw.text);
  if (!body || body !== raw.text.trim()) {
    return { ok: false, code: 'bad-text', message: 'invalid text' };
  }
  return {
    ok: true,
    value: {
      v: CHAT_MESSAGE_VERSION,
      fromPk: raw.fromPk,
      toId: raw.toId.trim(),
      text: body,
      ts: Math.trunc(raw.ts),
      sig: raw.sig,
    },
  };
};

export const verifyChatMessage = async (
  message: ChatMessage,
): Promise<CryptoResult<true>> => {
  const key = decodePublicKey(message.fromPk);
  if (!key.ok) return key;
  const sig = hexToBytes(message.sig);
  if (!sig.ok) return sig;
  if (sig.value.byteLength !== 64) {
    return {
      ok: false,
      code: 'bad-sig-length',
      message: 'signature must be 64 bytes',
    };
  }
  const canonical = canonicalChatMessage(
    message.fromPk,
    message.toId,
    message.text,
    message.ts,
  );
  const ok = await verifyText(sig.value, canonical, key.value);
  if (!ok) {
    return {
      ok: false,
      code: 'bad-sig',
      message: 'chat signature invalid',
    };
  }
  return { ok: true, value: true };
};

export const parseAndVerifyChatMessage = async (
  text: string,
): Promise<CryptoResult<ChatMessage>> => {
  const parsed = parseChatMessage(text);
  if (!parsed.ok) return parsed;
  const verified = await verifyChatMessage(parsed.value);
  if (!verified.ok) return verified;
  return parsed;
};
