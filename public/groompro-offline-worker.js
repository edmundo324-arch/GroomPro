const cacheName = 'groompro-app-shell-v1';
const shellKey = '/__groompro_offline_shell';
const staticAsset = url => url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

async function saveAssets(addresses) {
  const cache = await caches.open(cacheName);
  await Promise.allSettled(addresses.map(async address => {
    const url = new URL(address, self.location.origin);
    if (!staticAsset(url)) return;
    const response = await fetch(url);
    if (response.ok) await cache.put(url, response);
  }));
}

self.addEventListener('message', event => {
  if (event.data?.type !== 'prepare-shell') return;
  event.waitUntil((async () => {
    await saveAssets(event.data.assets || []);
    const url = new URL(event.source.url);
    if (url.pathname !== '/') return;
    const response = await fetch(url, { cache: 'no-store' });
    if (response.ok && !response.redirected && response.headers.get('content-type')?.includes('text/html')) {
      const cache = await caches.open(cacheName);
      await cache.put(shellKey, response);
      event.source.postMessage({ type: 'shell-ready' });
    }
  })().catch(() => {}));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const navigation = url.origin === self.location.origin && url.pathname === '/' && request.mode === 'navigate';
  if (!navigation && !staticAsset(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok && !response.redirected) await cache.put(navigation ? shellKey : request, response.clone());
      return response;
    } catch {
      return await cache.match(navigation ? shellKey : request) || Response.error();
    }
  })());
});
