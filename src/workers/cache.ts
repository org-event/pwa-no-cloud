export const CACHE_NAME = 'nocloud-shell-v1';

export const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon.svg',
  '/manifest.webmanifest',
];

export const collectShellAssets = (fileNames: string[]): string[] => {
  const assets = [...SHELL_ASSETS];
  for (const fileName of fileNames) {
    assets.push(`/${fileName}`);
  }
  return assets;
};

export const createWorkerSource = (assets: string[]): string => {
  const list = JSON.stringify(assets);
  return `'use strict';
const CACHE = '${CACHE_NAME}';
const ASSETS = ${list};

const precache = async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const stale = names.filter((name) => name !== CACHE);
    await Promise.all(stale.map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.status === 200) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      if (request.mode === 'navigate') {
        const page = await cache.match('/index.html');
        if (page) return page;
      }
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    }
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'ping' && event.source) {
    event.source.postMessage({ type: 'pong' });
  }
});
`;
};
