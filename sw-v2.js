const CACHE_NAME = 'cardapio-v30';

// ===== Notificacoes do site (Firebase Cloud Messaging) =====
// Com o site fechado o FCM mostra a notificacao sozinho e, no clique, abre o link
// que o Worker mandou (?notif=acao&next=...). Sem config.js aqui: o SW nao tem window.
importScripts('vendor/firebase-app-compat.js', 'vendor/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: 'AIzaSyDVaHDQ-gqnRHCEPopne1kzhIKAo2gIIGQ',
  authDomain: 'cardapio-8ddea.firebaseapp.com',
  projectId: 'cardapio-8ddea',
  storageBucket: 'cardapio-8ddea.appspot.com',
  messagingSenderId: '1019677985212',
  appId: '1:1019677985212:web:57c7820a62585a867dc3b9'
});
firebase.messaging();

// Clique nas notificacoes que a propria pagina mostrou (site aberto). As do FCM
// (data.FCM_MSG) ficam com o handler do Firebase.
self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  if (data.FCM_MSG || !data.action) return;
  event.notification.close();
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const client = all[0];
    if (client) {
      await client.focus();
      client.postMessage({ type: 'notification-click', action: data.action, isNextWeek: data.isNextWeek });
    } else {
      const url = new URL('./', self.registration.scope);
      url.searchParams.set('notif', data.action);
      if (data.isNextWeek) url.searchParams.set('next', data.isNextWeek);
      await self.clients.openWindow(url.href);
    }
  })());
});

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  './css/styles.css',
  './css/theme.css',
  './js/config.js',
  './js/theme.js',
  './js/devConsole.js',
  './js/firebase.js',
  './js/db.js',
  './js/auth.js',
  './js/ui.js',
  './js/order.js',
  './js/admin.js',
  './js/menu-viewer.js',
  './js/userhelp.js',
  './js/home.js',
  './js/financas.js',
  './js/notificationChecker.js',
  './js/notificationTrigger.js',
  './js/pushRegistration.js',
  './js/installHelper.js',
  './js/adminNotify.js',
  './js/menuText.js',
  './js/adminHome.js',
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

  // So o dominio importa: os arquivos vendor/firebase-*.js do proprio site devem ir pro cache
  const host = new URL(url).hostname;
  if (host.includes('firebase') || host.includes('googleapis') || host.includes('gstatic')) return;
  if (request.method !== 'GET') return;
  // APIs com dados que mudam (contracheque, releases, push): nunca servir do cache,
  // senao o cache-first devolve para sempre a primeira resposta.
  if (url.includes('api.github.com') || url.includes('mogidascruzes.sp.gov.br') || url.includes('workers.dev')) return;

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
