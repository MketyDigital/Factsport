const CACHE_NAME = 'factsport-v1';

// 1. Install Event: Cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/icon.png',
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

// 2. Fetch Event: Network First, Fallback to Cache (Safe for betting apps)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If the network works, return data AND cache a copy
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // If network fails (offline), try the cache
        return caches.match(event.request);
      })
  );
});