import { domainCopy } from '@/content/index.ts';
import type { CustomServerDraft } from '@/config/types.ts';
import { generateId } from '@/lib/id.ts';

export type ServerReach = 'unknown' | 'up' | 'down' | 'checking';

export type SavedServer = {
  id: string;
  title: string;
  address: string;
  draft: CustomServerDraft;
  createdAt: number;
  updatedAt: number;
  reach: ServerReach;
};

export const signalingAddress = (draft: CustomServerDraft): string => {
  const url = draft.signaling.url?.trim();
  if (url) return url;
  return draft.signaling.kind === 'manual'
    ? domainCopy.manualNoSocket
    : domainCopy.noAddress;
};

export const titleFromDraft = (draft: CustomServerDraft): string => {
  const url = draft.signaling.url?.trim();
  if (!url) return domainCopy.manualServer;
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
};

export const createSavedServer = (
  draft: CustomServerDraft,
  title?: string,
): SavedServer => {
  const now = Date.now();
  return {
    id: generateId(),
    title: title?.trim() || titleFromDraft(draft),
    address: signalingAddress(draft),
    draft: {
      signaling: { ...draft.signaling },
      iceServers: draft.iceServers.map((server) => ({ ...server })),
    },
    createdAt: now,
    updatedAt: now,
    reach: 'unknown',
  };
};
