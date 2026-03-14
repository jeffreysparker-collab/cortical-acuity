// Network-first, cache fallback — updates reach users on next load
const CACHE = 'landolt-v2';
const ASSETS = [
  '/cortical-acuity/',
  '/cortical-acuity/index.html',
  '/cortical-acuity/app.js',
  '/cortical-acuity/manifest.json',
  '/cortical-acuity/icons/icon-192.png',
  '/cortical-acuity/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first: try network, fall back to cache, never serve stale HTML for too long
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Update cache with fresh response
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
