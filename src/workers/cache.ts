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
let pendingShare = null;

const precache = async () => {
  const cache = await caches.open(CACHE);
  await cache.addAll(ASSETS);
};

const handleShare = async (request) => {
  try {
    const data = await request.formData();
    const files = [];
    const items = data.getAll('files');
    for (const item of items) {
      if (!item || typeof item !== 'object' || !item.arrayBuffer) continue;
      files.push({
        name: item.name || 'file',
        type: item.type || 'application/octet-stream',
        buffer: await item.arrayBuffer(),
      });
    }
    pendingShare = files;
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    for (const client of windows) {
      client.postMessage({ type: 'share-files', data: files });
    }
    if (windows.length === 0 && self.clients.openWindow) {
      await self.clients.openWindow('/');
    }
  } catch (error) {}
  return Response.redirect(new URL('/', self.location.origin), 303);
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
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/share') {
    event.respondWith(handleShare(request));
    return;
  }
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
  if (type === 'notify' && self.registration.showNotification) {
    const title = event.data.title || 'NoCloud';
    const body = event.data.body || '';
    void self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
    });
    return;
  }
  if (type === 'ping' && event.source) {
    event.source.postMessage({ type: 'pong' });
    if (pendingShare && pendingShare.length > 0) {
      event.source.postMessage({ type: 'share-files', data: pendingShare });
      pendingShare = null;
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window' });
    if (windows[0]) return windows[0].focus();
    return self.clients.openWindow('/');
  })());
});
`;
};
