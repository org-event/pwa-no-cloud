import { signalingLibCopy } from '@/content/index.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import { parseShareDraft } from '@/config/share-pack.ts';
import type { SignalMessage, SignalResult } from './port.ts';

const COMPRESSED = 'N1.';
const PLAIN = 'J1.';

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunk = 0x8000;
  let binary = '';
  let offset = 0;
  while (offset < bytes.length) {
    const end = Math.min(offset + chunk, bytes.length);
    let index = offset;
    while (index < end) {
      binary += String.fromCharCode(bytes[index] ?? 0);
      index += 1;
    }
    offset = end;
  }
  return btoa(binary);
};

const base64ToBytes = (text: string): Uint8Array => {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const canCompress = (): boolean => {
  return typeof CompressionStream === 'function';
};

const deflate = async (text: string): Promise<Uint8Array> => {
  const stream = new Blob([text])
    .stream()
    .pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const inflate = async (bytes: Uint8Array): Promise<string> => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Response(stream).text();
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object';
};

export const parseInvite = (raw: unknown): SignalResult<SignalMessage> => {
  if (!isObject(raw)) {
    return {
      ok: false,
      code: 'invite-invalid',
      message: signalingLibCopy.inviteNotJson,
    };
  }
  const from = raw.from;
  const to = raw.to;
  const data = raw.data;
  if (typeof from !== 'string' || typeof to !== 'string' || !isObject(data)) {
    return {
      ok: false,
      code: 'invite-invalid',
      message: signalingLibCopy.brokenFromTo,
    };
  }
  const type = data.type;
  if (type !== 'offer' && type !== 'answer' && type !== 'candidate') {
    return {
      ok: false,
      code: 'invite-type',
      message: signalingLibCopy.unknownSignalType,
    };
  }
  return {
    ok: true,
    value: { from, to, data: { type, payload: data.payload } },
  };
};

export type DecodedInvite = {
  message: SignalMessage;
  servers?: CustomServerDraft;
};

export const encodeInvite = async (
  message: SignalMessage,
  servers?: CustomServerDraft,
): Promise<string> => {
  const json = JSON.stringify({
    v: 1,
    from: message.from,
    to: message.to,
    data: message.data,
    servers,
  });
  if (!canCompress()) return PLAIN + json;
  const bytes = await deflate(json);
  return COMPRESSED + bytesToBase64(bytes);
};

export const decodeInvite = async (
  text: string,
): Promise<SignalResult<DecodedInvite>> => {
  const raw = text.trim();
  if (!raw) {
    return {
      ok: false,
      code: 'invite-empty',
      message: signalingLibCopy.inviteEmpty,
    };
  }
  try {
    let json = raw;
    if (raw.startsWith(COMPRESSED)) {
      json = await inflate(base64ToBytes(raw.slice(COMPRESSED.length)));
    } else if (raw.startsWith(PLAIN)) {
      json = raw.slice(PLAIN.length);
    }
    const parsedJson = JSON.parse(json) as unknown;
    const parsed = parseInvite(parsedJson);
    if (!parsed.ok) return parsed;
    const servers =
      parsedJson && typeof parsedJson === 'object'
        ? parseShareDraft((parsedJson as { servers?: unknown }).servers)
        : null;
    return {
      ok: true,
      value: {
        message: parsed.value,
        servers: servers ?? undefined,
      },
    };
  } catch {
    return {
      ok: false,
      code: 'invite-parse',
      message: signalingLibCopy.inviteUnreadable,
    };
  }
};
