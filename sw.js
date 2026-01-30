importScripts("https://progressier.app/0IpCHZYvGyBKyFwHmGj2/sw.js");

/**
 * MedWard Master - Service Worker
 * Version: 2.1.0
 *
 * This service worker clears all caches on startup to ensure fresh content.
 * Note: localStorage (including "Remember Me" data) is NOT affected by cache deletion.
 */

const SW_VERSION = '2.1.0';

// Install - skip waiting to activate immediately
self.addEventListener('install', event => {
  console.log(`[MedWard SW] Installing v${SW_VERSION}`);
  event.waitUntil(self.skipWaiting());
});

// Activate - delete ALL caches immediately on startup
self.addEventListener('activate', event => {
  console.log(`[MedWard SW] Activating v${SW_VERSION} - Clearing all caches...`);
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        console.log(`[MedWard SW] Found ${cacheNames.length} cache(s) to delete`);
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log(`[MedWard SW] Deleting cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => {
        console.log('[MedWard SW] All caches cleared successfully');
        return self.clients.claim();
      })
      .catch(err => console.error('[MedWard SW] Cache deletion error:', err))
  );
});

// Fetch - Network only, no caching (ensures fresh content always)
self.addEventListener('fetch', event => {
  // Let all requests go directly to network without caching
  // This ensures users always get the latest content
  return;
});

// Listen for messages from the main app to clear caches on demand
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_CACHES') {
    console.log('[MedWard SW] Received clear cache request');
    caches.keys().then(cacheNames => {
      Promise.all(cacheNames.map(name => caches.delete(name)))
        .then(() => {
          console.log('[MedWard SW] Caches cleared via message');
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        });
    });
  }
});

console.log(`[MedWard SW] Loaded v${SW_VERSION}`);
