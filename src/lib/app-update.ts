export const VERSION_FILE = 'version.json';

export const versionFileUrl = (base: string): string => {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}${VERSION_FILE}`;
};

export const parseRemoteVersion = (raw: unknown): string | null => {
  if (!raw || typeof raw !== 'object') return null;
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'string') return null;
  const trimmed = version.trim();
  return trimmed || null;
};

export type UpdateDecision = 'current' | 'reload' | 'unavailable';

export const decideUpdate = (
  local: string,
  remote: string | null,
): UpdateDecision => {
  if (!remote) return 'unavailable';
  return remote === local ? 'current' : 'reload';
};
