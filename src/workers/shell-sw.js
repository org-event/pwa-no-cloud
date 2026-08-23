'use strict';
const CACHE = __CACHE_NAME__;
const BASE = __BASE__;
const SHARE = __SHARE__;
const INDEX = __INDEX__;
const ICON = __ICON__;
const VERSION = __VERSION__;
const ASSETS = __ASSETS__;
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
      await self.clients.openWindow(BASE);
    }
  } catch (error) {}
  return Response.redirect(new URL(BASE, self.location.origin), 303);
};

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const stale = names.filter((name) => name !== CACHE);
      await Promise.all(stale.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === SHARE) {
    event.respondWith(handleShare(request));
    return;
  }
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;
  if (url.pathname === VERSION) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request);
          if (response.status === 200) {
            await cache.put(request, response.clone());
            await cache.put(INDEX, response.clone());
          }
          return response;
        } catch {
          const page = await cache.match(INDEX);
          if (page) return page;
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        }
      }
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.status === 200) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
        });
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'notify' && self.registration.showNotification) {
    const title = event.data.title || 'NoCloud';
    const body = event.data.body || '';
    void self.registration.showNotification(title, {
      body,
      icon: ICON,
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
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window' });
      if (windows[0]) return windows[0].focus();
      return self.clients.openWindow(BASE);
    })(),
  );
});
