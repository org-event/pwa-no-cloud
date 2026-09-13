/**
 * Presence domain — online / available / knock.
 * Runtime helpers still in `src/lib/presence.ts` until a later move.
 */

export type PresenceStatus = 'unknown' | 'offline' | 'online' | 'available';

export type PresenceEntry = {
  peerId: string;
  status: PresenceStatus;
  checkedAt: number;
};
