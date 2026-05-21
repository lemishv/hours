const CACHE = 'hours-v13';

// Критичний shell — без цього офлайн взагалі не відкривається.
// Якщо тут падіння — SW свідомо не активується. Це краще за тихий
// порожній кеш, який вдає що все добре.
const CRITICAL = [
  './',
  'index.html',
  'manifest.json'
];

// Опціональні ресурси. Кожен кешуємо окремо через allSettled —
// помилка одного не валить решту. Якщо CDN недоступний у момент
// встановлення, офлайн працює без PDF-експорту або без кастомних
// шрифтів, але працює.
const OPTIONAL = [
  'icon-192.png',
  'icon-512.png',
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Критичне — мусить пройти.
    await cache.addAll(CRITICAL);
    // Опціональне — best-effort.
    await Promise.allSettled(OPTIONAL.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const path = url.pathname;
  const isShell =
    path.endsWith('/') ||
    path.endsWith('/index.html') ||
    path.endsWith('/manifest.json');

  if (isShell) {
    // Network-first для shell: нова версія підхоплюється одразу.
    // Офлайн → з кешу; якщо точного матчу нема — повертаємо index.html
    // як універсальний fallback.
    e.respondWith((async () => {
      try {
        const res = await fetch(e.request);
        if (res && res.status === 200 && res.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(e.request, res.clone());
        }
        return res;
      } catch {
        const cached = await caches.match(e.request);
        return cached
          || await caches.match('index.html')
          || await caches.match('./');
      }
    })());
  } else {
    // Cache-first для всього іншого (іконки, шрифти, CDN-скрипти).
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        return await fetch(e.request);
      } catch {
        return Response.error();
      }
    })());
  }
});
