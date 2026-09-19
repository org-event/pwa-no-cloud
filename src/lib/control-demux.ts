/**
 * Control DataChannel demux: file frames are handled by FilePipe first;
 * remaining raw strings become chat / profile / keepalive events.
 */

import { parseProfileCard, type ProfileCard } from '@/domain/profile.ts';
import { isChatControlFrame } from './peer-chat.ts';

export type ControlDemuxResult =
  | { kind: 'chat'; wire: string }
  | { kind: 'profile'; card: ProfileCard }
  | { kind: 'ping'; t: unknown }
  | { kind: 'pong'; rttBase: number }
  | { kind: 'broken'; message: string }
  | { kind: 'ignore' };

/** Classify a non-file control frame (after FilePipe.onControlRaw returned false). */
export const demuxControlFrame = (
  raw: string,
  brokenMessage: string,
): ControlDemuxResult => {
  if (isChatControlFrame(raw)) {
    return {
      kind: 'chat',
      wire: raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim(),
    };
  }
  try {
    const data = JSON.parse(raw) as { type?: string; t?: number };
    if (data.type === 'profile') {
      const card = parseProfileCard(data);
      if (card) return { kind: 'profile', card };
      return { kind: 'ignore' };
    }
    if (data.type === 'ping') return { kind: 'ping', t: data.t };
    if (data.type === 'pong' && typeof data.t === 'number') {
      return { kind: 'pong', rttBase: data.t };
    }
    return { kind: 'ignore' };
  } catch {
    return { kind: 'broken', message: brokenMessage };
  }
};
