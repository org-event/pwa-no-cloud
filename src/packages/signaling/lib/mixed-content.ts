export { MIXED_CONTENT_SIGNALING } from '@/content/index.ts';
import { MIXED_CONTENT_SIGNALING } from '@/content/index.ts';

export const signalingUrlNeedsTls = (url: string): boolean => {
  const lower = url.trim().toLowerCase();
  if (!lower) return false;
  if (lower.startsWith('https:') || lower.startsWith('wss:')) return false;
  return lower.startsWith('http:') || lower.startsWith('ws:');
};

export const mixedContentBlocksSignaling = (
  url: string,
  pageProtocol = globalThis.location?.protocol ?? '',
): boolean => {
  return pageProtocol === 'https:' && signalingUrlNeedsTls(url);
};

export const humanizeSignalingError = (raw: string): string => {
  if (/insecure WebSocket/i.test(raw) || /Mixed Content/i.test(raw)) {
    return MIXED_CONTENT_SIGNALING;
  }
  return raw;
};
