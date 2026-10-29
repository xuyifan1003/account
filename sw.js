const CACHE = 'money-book';
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

  // App shell: stale-while-revalidate — 命中缓存立即返回（秒开），后台静默更新缓存供下次打开使用
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(r);
      const network = fetch(r).then(res => {
        if (res && res.ok) cache.put(r, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
