export const CACHE_NAME = 'nocloud-shell-v4';

export const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon.svg',
  '/manifest.webmanifest',
];

export const joinBase = (base: string, path = ''): string => {
  const root = base.endsWith('/') ? base : `${base}/`;
  if (path === '' || path === '/') return root;
  const name = path.startsWith('/') ? path.slice(1) : path;
  return `${root}${name}`;
};

export const collectShellAssets = (
  fileNames: string[],
  base = '/',
): string[] => {
  const assets = SHELL_ASSETS.map((path) => joinBase(base, path));
  for (const fileName of fileNames) {
    assets.push(joinBase(base, fileName));
  }
  return assets;
};

export const fillWorkerSource = (
  template: string,
  assets: string[],
  base = '/',
): string => {
  const root = joinBase(base);
  return template
    .replaceAll('__CACHE_NAME__', JSON.stringify(CACHE_NAME))
    .replaceAll('__BASE__', JSON.stringify(root))
    .replaceAll('__SHARE__', JSON.stringify(joinBase(base, 'share')))
    .replaceAll('__INDEX__', JSON.stringify(joinBase(base, 'index.html')))
    .replaceAll('__ICON__', JSON.stringify(joinBase(base, 'icon.svg')))
    .replaceAll('__VERSION__', JSON.stringify(joinBase(base, 'version.json')))
    .replaceAll('__ASSETS__', JSON.stringify(assets));
};
