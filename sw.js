const CACHE = 'hours-v12';
const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  // ВАЖЛИВО: ваги мають точно збігатись з URL у index.html, інакше SW кешує
  // адресу, яку браузер ніколи не запитує, а реальна підвантажується тільки online.
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// HTML і manifest — network-first (нова версія підхоплюється одразу при оновленні)
// Решта (іконки, шрифти) — cache-first (швидко і офлайн)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const path = url.pathname;
  const isShell =
    path.endsWith('/') ||
    path.endsWith('/index.html') ||
    path.endsWith('/manifest.json');

  if (isShell) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
    );
  }
});
