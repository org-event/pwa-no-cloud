export const MAX_PATH_LENGTH = 512;
export const MAX_PATH_SEGMENTS = 16;

const isSafeSegment = (name: string): boolean => {
  if (!name || name === '.' || name === '..') return false;
  return !name.includes('/') && !name.includes('\\');
};

export const normalizeRelativePath = (raw: string): string | null => {
  if (!raw || raw.includes('..')) return null;
  const trimmed = raw.trim().replaceAll('\\', '/');
  if (!trimmed || trimmed.startsWith('/')) return null;
  if (trimmed.includes(':')) return null;
  if (trimmed.length > MAX_PATH_LENGTH) return null;
  const parts: string[] = [];
  const chunks = trimmed.split('/');
  for (const chunk of chunks) {
    const name = chunk.trim();
    if (!name || name === '.') continue;
    if (!isSafeSegment(name)) return null;
    parts.push(name);
  }
  if (parts.length === 0 || parts.length > MAX_PATH_SEGMENTS) return null;
  return parts.join('/');
};

export const splitRelativePath = (raw: string): string[] | null => {
  const path = normalizeRelativePath(raw);
  if (!path) return null;
  return path.split('/');
};

export const folderNameFromPaths = (paths: string[]): string => {
  const first = paths[0];
  if (!first) return 'folder';
  const head = first.split('/')[0];
  return head && isSafeSegment(head) ? head : 'folder';
};
