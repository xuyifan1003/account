const CACHE = 'money-book-v11';
const URLS = [
  'index.html',
  'manifest.json',
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
  );
});

self.addEventListener('fetch', e => {
  const { request: r } = e;
  if (r.method !== 'GET') return;
  e.respondWith(
    caches.match(r).then(cached => cached || fetch(r).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(r, clone));
      return res;
    })).catch(() => caches.match('index.html'))
  );
});
