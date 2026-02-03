/**
 * MedWard Pro - Service Worker
 * Provides offline caching and background sync
 */

const CACHE_NAME = 'medward-pro-v1';
const STATIC_ASSETS = [
  '/app.html',
  '/css/design-tokens.css',
  '/css/base.css',
  '/css/components.css',
  '/css/pages.css',
  '/manifest.json'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Firebase and API requests
  if (request.url.includes('firestore.googleapis.com') ||
      request.url.includes('firebase') ||
      request.url.includes('googleapis.com/identitytoolkit')) {
    return;
  }

  // For navigation requests, use network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/app.html'))
    );
    return;
  }

  // For assets, use stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });

      return cached || fetchPromise;
    })
  );
});
