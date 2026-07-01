const CACHE = 'money-book-v20';
const URLS = [
  'index.html',
  'manifest.json',
  'icon.png',
  'css/variables.css',
  'css/layout.css',
  'css/components.css',
  'css/pages.css',
  'js/state.js',
  'js/utils.js',
  'js/tabs.js',
  'js/book.js',
  'js/assets.js',
  'js/report.js',
  'js/db.js',
  'js/chart.js',
  'js/app.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request: r } = e;
  if (r.method !== 'GET') return;

  // Supabase API: network-first, fallback to cache
  if (r.url.includes('supabase.co')) {
    e.respondWith(
      caches.match(r).then(cached =>
        fetch(r).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(r, clone));
          return res;
        }).catch(() => cached || new Response('', { status: 503 }))
      )
    );
    return;
  }

  e.respondWith(
    caches.match(r).then(cached => {
      const fetchPromise = fetch(r).then(res =>
        caches.open(CACHE).then(c => { c.put(r, res.clone()); return res; })
      ).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
