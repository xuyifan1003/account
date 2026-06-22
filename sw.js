const CACHE = 'money-book-v1';
const URLS = ['index.html', 'styles.css', 'app.js', 'manifest.json'];

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
