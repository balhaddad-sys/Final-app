importScripts("https://progressier.app/0IpCHZYvGyBKyFwHmGj2/sw.js");

/**
 * MedWard Master - Minimal Service Worker
 * Version: 2.0.0
 * 
 * This service worker ONLY caches static assets.
 * API calls are NEVER intercepted - they go directly to the network.
 */

const CACHE_NAME = 'medward-v2.0.4';
const STATIC_ASSETS = [
  '/Final-app/',
  '/Final-app/index.html',
  '/Final-app/icons/icon-192.png',
  '/Final-app/icons/icon-512.png'
];

// Install - cache static assets
self.addEventListener('install', event => {
  console.log('[MedWard SW] Installing v2.0.4');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.log('[MedWard SW] Install failed:', err))
  );
});

// Activate - clean old caches
self.addEventListener('activate', event => {
  console.log('[MedWard SW] Activating v2.0.4');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch - ONLY cache static assets, NEVER touch API calls
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // NEVER intercept these - let them go directly to network
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('googleusercontent.com') ||
    url.hostname.includes('cloudfunctions.net') ||  // Firebase Cloud Functions
    url.hostname.includes('firebaseio.com') ||      // Firebase Realtime Database
    url.hostname.includes('firestore.googleapis.com') || // Firestore
    url.hostname.includes('anthropic') ||
    url.hostname.includes('openai') ||
    event.request.method !== 'GET'
  ) {
    // Don't call event.respondWith - browser handles it
    return;
  }
  
  // Only cache requests from our own origin
  if (!url.hostname.includes('balhaddad-sys.github.io')) {
    return;
  }
  
  // For static assets from our site - cache first, then network
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(event.request)
          .then(response => {
            // Only cache successful responses
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          });
      })
      .catch(() => {
        // If offline and no cache, return a simple error
        if (event.request.destination === 'document') {
          return new Response('<html><body><h1>Offline</h1><p>Please check your connection.</p></body></html>', {
            headers: { 'Content-Type': 'text/html' }
          });
        }
      })
  );
});

console.log('[MedWard SW] Loaded v2.0.4');
