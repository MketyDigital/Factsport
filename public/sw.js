const CACHE_NAME = 'factsport-v2'; // Bumped version to clear old bloated caches

const STATIC_ASSETS = [
  '/',
  '/icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

// 🟢 NEW: Automatically delete old bloated caches when this new version activates
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 🛑 THE STORAGE BOMB SHIELD: NEVER cache APIs, Supabase, or Workers.
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('workers.dev')
  ) {
    return; // Bypass the Service Worker entirely
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid, successful static responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});