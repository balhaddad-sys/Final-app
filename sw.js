importScripts("https://progressier.app/0IpCHZYvGyBKyFwHmGj2/sw.js");

// ============================================
// API BYPASS - Let API calls go directly to network
// ============================================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Don't intercept Google Apps Script API calls
  if (url.hostname.includes('script.google.com') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('script.googleusercontent.com')) {
    // Return without calling event.respondWith() - browser handles it directly
    return;
  }
});

/**
 * MedWard Master - Service Worker
 * Version: 1.0.1
 *
 * Professional PWA service worker with:
 * - Multi-strategy caching
 * - Offline support
 * - Background sync
 * - Cache management
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  version: '1.0.0',
  caches: {
    static: 'medward-static-v1.0.0',
    dynamic: 'medward-dynamic-v1.0.0',
    api: 'medward-api-v1.0.0'
  },
  timeouts: {
    network: 10000 // 10 seconds
  },
  limits: {
    maxEntries: 50,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  },
  apiMaxAge: 24 * 60 * 60 * 1000 // 1 day for API responses
};

// Static assets to precache
const PRECACHE_ASSETS = [
  '/Final-app/',
  '/Final-app/index.html',
  '/Final-app/manifest.json',
  '/Final-app/js/app.js',
  '/Final-app/js/medward-neural.js',
  '/Final-app/js/clinical-components.js',
  '/Final-app/icons/icon-192.png',
  '/Final-app/icons/icon-512.png'
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Logging utility with MedWard prefix
 */
function log(message, type = 'info') {
  const prefix = '[MedWard SW]';
  if (type === 'error') {
    console.error(prefix, message);
  } else if (type === 'warn') {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }
}

/**
 * Network request with timeout
 */
function fetchWithTimeout(request, timeout = CONFIG.timeouts.network) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

/**
 * Check if cache entry is expired
 */
function isCacheExpired(response, maxAge) {
  if (!response) return true;

  const cachedTime = response.headers.get('sw-cache-time');
  if (!cachedTime) return true;

  const age = Date.now() - parseInt(cachedTime, 10);
  return age > maxAge;
}

/**
 * Add timestamp header to response
 */
function addTimestampToResponse(response) {
  const clonedResponse = response.clone();
  const headers = new Headers(clonedResponse.headers);
  headers.append('sw-cache-time', Date.now().toString());

  return clonedResponse.blob().then(body => {
    return new Response(body, {
      status: clonedResponse.status,
      statusText: clonedResponse.statusText,
      headers: headers
    });
  });
}

/**
 * Enforce cache size limit
 */
async function limitCacheSize(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxEntries) {
    // Remove oldest entries
    const entriesToDelete = keys.length - maxEntries;
    for (let i = 0; i < entriesToDelete; i++) {
      await cache.delete(keys[i]);
    }
    log(`Cache ${cacheName} trimmed: removed ${entriesToDelete} entries`);
  }
}

/**
 * Check if URL matches pattern
 */
function matchesPattern(url, patterns) {
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    } else if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    return false;
  });
}

/**
 * Determine request type
 */
function getRequestType(request) {
  const url = new URL(request.url);

  // API requests
  if (url.hostname.includes('script.google.com') ||
      url.pathname.includes('/api/')) {
    return 'api';
  }

  // Analytics and external resources
  if (url.hostname.includes('analytics') ||
      url.hostname.includes('gtag') ||
      url.hostname.includes('google-analytics')) {
    return 'analytics';
  }

  // Static assets
  if (request.destination === 'image' ||
      request.destination === 'font' ||
      request.destination === 'style' ||
      request.destination === 'script') {
    return 'static';
  }

  // HTML pages
  if (request.destination === 'document' ||
      request.headers.get('accept')?.includes('text/html')) {
    return 'html';
  }

  return 'other';
}

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Cache First Strategy
 * Best for: Static assets (CSS, JS, images, fonts)
 */
async function cacheFirst(request) {
  const cache = await caches.open(CONFIG.caches.static);
  const cached = await cache.match(request);

  if (cached && !isCacheExpired(cached, CONFIG.limits.maxAge)) {
    log(`Cache hit (Cache First): ${request.url}`);
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request);
    if (response && response.status === 200) {
      const responseWithTime = await addTimestampToResponse(response);
      cache.put(request, responseWithTime.clone());
      await limitCacheSize(CONFIG.caches.static, CONFIG.limits.maxEntries);
    }
    return response;
  } catch (error) {
    log(`Cache First fallback for: ${request.url}`, 'warn');
    // Return stale cache if network fails
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Network First Strategy
 * Best for: API calls
 */
async function networkFirst(request) {
  const cache = await caches.open(CONFIG.caches.api);

  try {
    const response = await fetchWithTimeout(request);
    if (response && response.status === 200) {
      const responseWithTime = await addTimestampToResponse(response);
      cache.put(request, responseWithTime.clone());
      await limitCacheSize(CONFIG.caches.api, CONFIG.limits.maxEntries);
      log(`Network success (Network First): ${request.url}`);
    }
    return response;
  } catch (error) {
    log(`Network failed, trying cache: ${request.url}`, 'warn');
    const cached = await cache.match(request);

    if (cached && !isCacheExpired(cached, CONFIG.apiMaxAge)) {
      return cached;
    }

    throw error;
  }
}

/**
 * Stale While Revalidate Strategy
 * Best for: HTML pages
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CONFIG.caches.dynamic);
  const cached = await cache.match(request);

  const fetchPromise = fetchWithTimeout(request)
    .then(async response => {
      if (response && response.status === 200) {
        const responseWithTime = await addTimestampToResponse(response);
        cache.put(request, responseWithTime.clone());
        await limitCacheSize(CONFIG.caches.dynamic, CONFIG.limits.maxEntries);
      }
      return response;
    })
    .catch(error => {
      log(`Stale While Revalidate fetch failed: ${request.url}`, 'warn');
      return null;
    });

  // Return cached immediately if available, otherwise wait for network
  return cached || fetchPromise;
}

/**
 * Network Only Strategy
 * Best for: Analytics and always-fresh data
 */
async function networkOnly(request) {
  try {
    return await fetchWithTimeout(request);
  } catch (error) {
    log(`Network Only failed: ${request.url}`, 'error');
    throw error;
  }
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Install Event
 * Precache static assets
 */
self.addEventListener('install', event => {
  log(`Installing service worker v${CONFIG.version}`);

  event.waitUntil(
    caches.open(CONFIG.caches.static)
      .then(cache => {
        log('Precaching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        log('Static assets precached successfully');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        log(`Precache failed: ${error}`, 'error');
      })
  );
});

/**
 * Activate Event
 * Clean up old caches and claim clients
 */
self.addEventListener('activate', event => {
  log(`Activating service worker v${CONFIG.version}`);

  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        const validCaches = Object.values(CONFIG.caches);
        const deletePromises = cacheNames
          .filter(cacheName => !validCaches.includes(cacheName))
          .map(cacheName => {
            log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          });

        return Promise.all(deletePromises);
      })
      .then(() => {
        log('Old caches cleaned up');
        // Claim all clients immediately
        return self.clients.claim();
      })
      .then(() => {
        log('Service worker activated and clients claimed');
      })
      .catch(error => {
        log(`Activation failed: ${error}`, 'error');
      })
  );
});

/**
 * Fetch Event
 * Route requests to appropriate caching strategy
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const requestType = getRequestType(request);

  // Skip chrome extensions and non-http(s) requests
  if (!request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Route to appropriate strategy based on request type
        switch (requestType) {
          case 'static':
            return await cacheFirst(request);

          case 'api':
            return await networkFirst(request);

          case 'html':
            return await staleWhileRevalidate(request);

          case 'analytics':
            return await networkOnly(request);

          default:
            return await staleWhileRevalidate(request);
        }
      } catch (error) {
        log(`Fetch failed for ${request.url}: ${error}`, 'error');

        // Return offline fallback for HTML requests
        if (requestType === 'html') {
          const cache = await caches.open(CONFIG.caches.static);
          const fallback = await cache.match('/Final-app/index.html');
          if (fallback) {
            return fallback;
          }
        }

        // Return a custom offline response
        return new Response(
          JSON.stringify({
            error: 'Offline',
            message: 'You are currently offline. Please check your connection.'
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'application/json'
            })
          }
        );
      }
    })()
  );
});

/**
 * Background Sync Event
 * Handle failed requests when back online
 */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-failed-requests') {
    log('Background sync: Retrying failed requests');

    event.waitUntil(
      // Implement your sync logic here
      // This could retry queued API requests
      Promise.resolve()
        .then(() => {
          log('Background sync completed');
        })
        .catch(error => {
          log(`Background sync failed: ${error}`, 'error');
        })
    );
  }
});

/**
 * Message Event
 * Handle messages from clients (e.g., skip waiting)
 */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    log('Skip waiting message received');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CONFIG.version });
  }
});

// ============================================
// OFFLINE FALLBACK
// ============================================

/**
 * Create offline fallback page
 * This is served when no cache is available and network is down
 */
function getOfflineFallback() {
  return new Response(
    `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MedWard - Offline</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #0a0a0f 0%, #12121a 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          padding: 20px;
        }
        .offline-container {
          text-align: center;
          max-width: 400px;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
        }
        p {
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.6;
        }
        button {
          margin-top: 2rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(135deg, #f0c674 0%, #d4a853 100%);
          color: #0a0a0f;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📡</div>
        <h1>You're Offline</h1>
        <p>MedWard requires an internet connection to analyze medical reports. Please check your connection and try again.</p>
        <button onclick="window.location.reload()">Retry</button>
      </div>
    </body>
    </html>
    `,
    {
      headers: { 'Content-Type': 'text/html' }
    }
  );
}

log(`Service Worker v${CONFIG.version} loaded`);
