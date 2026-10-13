const CACHE_NAME = 'cardapio-v9';

const CORE_ASSETS = [
  './',
  './index.html',
  './js/app.js',
  './js/firebase.js',
  './js/db.js',
  './js/userhelp.js',
  './js/financas.js',
  './js/notificationChecker.js'
];

// Estratégia: stale-while-revalidate para assets do app
// - Serve do cache imediatamente (rápido, funciona offline)
// - Em background, busca na rede e atualiza o cache
// - Próximo acesso pega a versão nova

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

  // Não interceptar Firebase/Google APIs
  if (url.includes('firebase') || url.includes('googleapis')) return;
  if (request.method !== 'GET') return;

  // Para navegação (index.html) e JS/CSS: stale-while-revalidate
  const isAppAsset = CORE_ASSETS.some(asset => url.endsWith(asset.replace('./', ''))) || url.endsWith('/');

  if (isAppAsset) {
    event.respondWith(staleWhileRevalidate(request));
  } else {
    // Outros assets: cache-first (imagens, fonts, etc)
    event.respondWith(cacheFirst(request));
  }
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Fetch em background para atualizar cache
  const fetchPromise = fetch(request).then(res => {
    if (res.ok) {
      cache.put(request, res.clone());
    }
    return res;
  }).catch(() => cached); // Se falhar offline, usa cache

  // Retorna cache imediatamente se tiver, senão espera fetch
  return cached || fetchPromise;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const res = await fetch(request);
  if (res.ok) {
    cache.put(request, res.clone());
  }
  return res;
}