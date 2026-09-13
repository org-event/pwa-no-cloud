export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'nocloud.theme';

export const readStoredTheme = (): ThemeMode => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // private mode / blocked storage
  }
  return 'light';
};

export const resolveTheme = (mode: ThemeMode): 'light' | 'dark' => {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof globalThis.matchMedia !== 'function') return 'light';
  return globalThis.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

export const applyTheme = (mode: ThemeMode): void => {
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.colorScheme = resolveTheme(mode);
};

export const saveTheme = (mode: ThemeMode): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  applyTheme(mode);
};

export const cycleTheme = (mode: ThemeMode): ThemeMode => {
  if (mode === 'light') return 'dark';
  if (mode === 'dark') return 'system';
  return 'light';
};

/** Call before first paint when possible (also from main). */
export const initTheme = (): ThemeMode => {
  const mode = readStoredTheme();
  applyTheme(mode);
  return mode;
};
