const CACHE_NAME = 'cardapio-v13';

const CORE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/firebase.js',
  './js/db.js',
  './js/auth.js',
  './js/ui.js',
  './js/order.js',
  './js/admin.js',
  './js/menu-viewer.js',
  './js/userhelp.js',
  './js/financas.js',
  './js/notificationChecker.js',
  './js/notificationTrigger.js',
  './js/pushRegistration.js',
  './js/appUpdate.js',
  './js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (url.includes('firebase') || url.includes('googleapis')) return;
  if (request.method !== 'GET') return;

  const isAppAsset = CORE_ASSETS.some(asset => url.endsWith(asset.replace('./', ''))) || url.endsWith('/');

  if (isAppAsset) {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    event.respondWith(cacheFirst(request));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(res => {
    if (res.ok) {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (res.ok) {
      cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    return new Response('', { status: 200, statusText: 'offline', headers: { 'Content-Type': 'text/plain' } });
  }
}
