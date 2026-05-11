const CACHE_NAME = 'rabbit-reader-v8'; // safe-area fix on .screen
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './books.js',
  './manifest.json',
  './qr-code.png',
  './lib/pdf.min.js',
  './lib/pdf.worker.min.js',
  './lib/jszip.min.js'
];

// Install: Cache all assets and force immediate activation
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Rabbit Reader: Caching assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate: Clean up old caches and take control of all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(), // Start controlling all open clients immediately
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        );
      })
    ])
  );
});

// Fetch: Network-first approach for index/app, but Cache-first fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // If we are offline, the network fetch will fail, and we return the cache.
      // If we are online, we try to get the latest, but fallback to cache if slow/fails.
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse); // On network error, return cache

      return cachedResponse || fetchPromise;
    })
  );
});
