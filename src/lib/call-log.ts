/**
 * Local call history for the Calls tab (incoming/outgoing list).
 */

export const CALL_LOG_KEY = 'nocloud.calls.v1';
export const CALL_LOG_MAX = 100;

export type CallLogDirection = 'in' | 'out';

export type CallLogOutcome =
  | 'started'
  | 'answered'
  | 'missed'
  | 'rejected'
  | 'failed'
  | 'ended';

export type CallLogEntry = {
  id: string;
  peerId: string;
  direction: CallLogDirection;
  outcome: CallLogOutcome;
  ts: number;
};

export type CallLogStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export const emptyCallLog = (): CallLogEntry[] => [];

const isEntry = (value: unknown): value is CallLogEntry => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.peerId === 'string' &&
    (row.direction === 'in' || row.direction === 'out') &&
    typeof row.outcome === 'string' &&
    typeof row.ts === 'number'
  );
};

export const loadCallLog = (storage: CallLogStorage): CallLogEntry[] => {
  const raw = storage.getItem(CALL_LOG_KEY);
  if (!raw) return emptyCallLog();
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown };
    if (!Array.isArray(parsed?.entries)) return emptyCallLog();
    return parsed.entries.filter(isEntry).slice(0, CALL_LOG_MAX);
  } catch {
    return emptyCallLog();
  }
};

export const saveCallLog = (
  storage: CallLogStorage,
  entries: CallLogEntry[],
): void => {
  storage.setItem(
    CALL_LOG_KEY,
    JSON.stringify({ entries: entries.slice(0, CALL_LOG_MAX) }),
  );
};

const newId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const appendCallLog = (
  entries: CallLogEntry[],
  draft: Omit<CallLogEntry, 'id' | 'ts'> & { ts?: number; id?: string },
): CallLogEntry[] => {
  const peerId = draft.peerId.trim();
  if (!peerId) return entries;
  const next: CallLogEntry = {
    id: draft.id ?? newId(),
    peerId,
    direction: draft.direction,
    outcome: draft.outcome,
    ts: draft.ts ?? Date.now(),
  };
  return [next, ...entries].slice(0, CALL_LOG_MAX);
};
