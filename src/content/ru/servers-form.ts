import type { SignalingKind } from '@/config/types.ts';

export const serversFormCopy = {
  manual: 'Вручную (QR / текст)',
} as const;

export const SIGNALING_KIND_OPTIONS: { id: SignalingKind; title: string }[] = [
  { id: 'manual', title: serversFormCopy.manual },
  { id: 'http-poll', title: 'HTTP poll' },
  { id: 'websocket', title: 'WebSocket' },
];
