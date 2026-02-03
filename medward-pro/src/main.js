// src/main.js
// Application entry point

// Import base CSS so Vite includes it in the build
import '../public/styles/base.css';

import { Storage } from './services/storage.adapter.js';
import { Sync } from './services/firebase.sync.js';
import { Auth } from './services/firebase.auth.js';
import { Data } from './core/app.data.js';
import { Store } from './core/store.js';
import { EventBus } from './core/core.events.js';
import { Monitor } from './monitor/monitor.core.js';
import { Toast } from './ui/components/toast.js';
import { SyncBadge } from './ui/components/sync-badge.js';
import { Theme } from './ui/theme.js';
import { Config } from './core/config.js';

// Track boot progress
const bootSteps = [];
function trackStep(name) {
  bootSteps.push({ name, time: performance.now() });
  Monitor.log('RUNTIME', `Boot step: ${name}`);
}

// ========================================
// BOOT GUARD PATTERN
// Creates a promise that resolves when the app is fully initialized
// Other modules should await window.MW_READY before using DB/services
// ========================================
let _bootResolve;
let _bootReject;
window.MW_READY = new Promise((resolve, reject) => {
  _bootResolve = resolve;
  _bootReject = reject;
});

// Helper for modules to safely wait for boot
window.MW = {
  ready() {
    return window.MW_READY;
  },

  // Nuclear reset: clears all local data and reloads
  async reset() {
    console.log('[MW] Starting nuclear reset...');

    try {
      // 1. Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();
      console.log('[MW] Cleared storage');

      // 2. Delete IndexedDB
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('MedWardPro');
        req.onsuccess = () => {
          console.log('[MW] IndexedDB deleted');
          resolve();
        };
        req.onerror = () => {
          console.warn('[MW] IndexedDB delete error (continuing anyway)');
          resolve();
        };
        req.onblocked = () => {
          console.warn('[MW] IndexedDB blocked - close other tabs');
          resolve();
        };
        // Timeout fallback
        setTimeout(resolve, 3000);
      });

      console.log('[MW] Nuclear reset complete. Reloading...');
      location.reload(true);
    } catch (e) {
      console.error('[MW] Reset failed:', e);
      // Force reload anyway
      location.reload(true);
    }
  },

  // Get current boot status
  getStatus() {
    return {
      steps: bootSteps,
      isReady: Storage.isReady?.() || false,
      lastStep: bootSteps.length > 0 ? bootSteps[bootSteps.length - 1].name : 'not started'
    };
  }
};

async function bootstrap() {
  const startTime = performance.now();
  Monitor.mark('boot-start');

  try {
    // 1. Initialize Monitor first (for error capture)
    Monitor.init();
    trackStep('monitor');

    Monitor.log('RUNTIME', 'MedWard Pro bootstrap starting...', {
      version: Config.APP_VERSION,
      isDev: Config.isDev
    });

    // 2. Initialize theme
    await Theme.init();
    trackStep('theme');

    // 3. Initialize Toast system
    Toast.init();
    trackStep('toast');

    // 4. Initialize local storage (IndexedDB)
    await Storage.init();
    trackStep('storage');
    Monitor.log('RUNTIME', 'Storage initialized');

    // 4.5. Clean up old WAL entries to prevent unbounded growth
    // Wrapped in try-catch so cleanup failure doesn't crash the app
    try {
      const walCleanup = await Storage.wal.autoCleanup();
      if (walCleanup.cleared > 0 || walCleanup.enforced > 0) {
        Monitor.log('RUNTIME', 'WAL cleanup completed', walCleanup);
      }
    } catch (walError) {
      Monitor.log('RUNTIME', 'WAL cleanup skipped (non-fatal)', { error: walError.message }, 'warn');
    }

    // 5. Initialize Data layer (loads cached data)
    await Data.init();
    trackStep('data');
    Monitor.log('RUNTIME', 'Data layer initialized');

    // 6. Initialize sync service
    Sync.init();
    trackStep('sync');
    Monitor.log('RUNTIME', 'Sync initialized');

    // 7. Initialize Auth listener
    Auth.init();
    trackStep('auth');

    // 8. Set up auth state handler
    EventBus.on('auth:ready', async (user) => {
      Monitor.log('AUTH', `User authenticated: ${user.email}`);

      // Subscribe to user's units
      Sync.subscribeToUnits(user.uid);

      // Load last selected unit
      const lastUnitId = await Storage.meta.get('lastUnitId');
      if (lastUnitId) {
        const unit = Store.units.find(u => u.id === lastUnitId);
        if (unit) {
          Data.Units.select(unit);
          Sync.subscribeToUnit(lastUnitId);
        }
      }

      // Redirect if on login page
      if (window.location.pathname.includes('login')) {
        window.location.href = '/landing.html';
      }
    });

    EventBus.on('auth:logout', () => {
      Monitor.log('AUTH', 'User logged out');
      Sync.unsubscribeAll();

      // Redirect to login if not already there
      const isPublicPage = ['login', 'index'].some(p =>
        window.location.pathname.includes(p) || window.location.pathname === '/'
      );

      if (!isPublicPage) {
        window.location.href = '/login.html';
      }
    });

    // 9. Set up global error toast handler
    EventBus.on('toast:error', (msg) => Toast.error(msg));
    EventBus.on('toast:success', (msg) => Toast.success(msg));
    EventBus.on('toast:info', (msg) => Toast.info(msg));
    EventBus.on('toast:warning', (msg) => Toast.warning(msg));

    // 10. Initialize Sync Badge if container exists
    const syncBadgeContainer = document.getElementById('sync-status');
    if (syncBadgeContainer) {
      SyncBadge.attach('sync-status');
    }

    // Track boot complete
    const bootTime = performance.now() - startTime;
    Monitor.mark('boot-end');
    Monitor.measure('boot-total', 'boot-start', 'boot-end');

    Monitor.log('RUNTIME', `MedWard Pro ready in ${bootTime.toFixed(0)}ms`, {
      steps: bootSteps.map(s => ({ name: s.name, time: s.time.toFixed(0) }))
    });

    // 11. Expose for debugging in development
    if (Config.isDev) {
      window.__MEDWARD__ = {
        Data,
        Store,
        Storage,
        Sync,
        Auth,
        Monitor,
        EventBus,
        Config,
        Theme,
        Toast
      };
      console.log('[DEV] MedWard Pro debugging available via window.__MEDWARD__');
    }

    // 12. Dispatch ready event
    document.dispatchEvent(new CustomEvent('medward:ready', {
      detail: { bootTime, version: Config.APP_VERSION }
    }));

    // 13. Resolve Boot Guard promise - app is now fully initialized
    _bootResolve({
      db: Storage,
      store: Store,
      data: Data,
      auth: Auth,
      sync: Sync,
      bootTime
    });

  } catch (error) {
    const lastStep = bootSteps.length > 0 ? bootSteps[bootSteps.length - 1].name : 'init';
    console.error('[FATAL] Bootstrap failed:', error);
    console.error('[FATAL] Last completed step:', lastStep);
    console.error('[FATAL] Error details:', { name: error.name, message: error.message, stack: error.stack });
    Monitor.logError('BOOTSTRAP_FAIL', error, { lastStep, bootSteps });

    // Reject Boot Guard promise so any waiting code knows boot failed
    _bootReject(error);

    // Determine error category for better user guidance
    const errorCategory = categorizeBootError(error, lastStep);

    // Show fatal error UI with improved diagnostics
    document.body.innerHTML = `
      <div class="fatal-error">
        <div class="fatal-error-content">
          <h1>Application Error</h1>
          <p>MedWard Pro failed to start.</p>

          <div class="error-details">
            <p class="error-message">${escapeHtml(error.message)}</p>
            <p class="error-step">Failed during: <strong>${lastStep}</strong></p>
            <p class="error-category">${errorCategory.guidance}</p>
          </div>

          <div class="fatal-error-actions">
            <button onclick="location.reload()" class="btn btn-primary">
              Reload Page
            </button>
            <button onclick="window.MW.reset()" class="btn btn-secondary">
              Full Reset & Reload
            </button>
          </div>

          <details class="error-debug">
            <summary>Technical Details (for support)</summary>
            <pre>${escapeHtml(JSON.stringify({
              error: error.message,
              name: error.name,
              step: lastStep,
              category: errorCategory.type,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString(),
              steps: bootSteps.map(s => s.name)
            }, null, 2))}</pre>
          </details>

          <p class="error-help">
            If the problem persists after "Full Reset", please contact support with the technical details above.
          </p>
        </div>
      </div>
    `;
  }
}

// Helper to categorize boot errors for better user guidance
function categorizeBootError(error, lastStep) {
  const msg = error.message.toLowerCase();

  // Database-related errors
  if (msg.includes('indexeddb') || msg.includes('database') || lastStep === 'storage') {
    if (msg.includes('blocked')) {
      return {
        type: 'db_blocked',
        guidance: 'The database is blocked. Please close all other tabs using MedWard Pro and try again.'
      };
    }
    if (msg.includes('not supported')) {
      return {
        type: 'db_unsupported',
        guidance: 'Your browser does not support offline storage. Please use a modern browser (Chrome, Firefox, Safari, Edge).'
      };
    }
    return {
      type: 'db_error',
      guidance: 'A database error occurred. Try "Full Reset & Reload" to clear corrupted data.'
    };
  }

  // Network/Firebase errors
  if (msg.includes('network') || msg.includes('firebase') || msg.includes('fetch')) {
    return {
      type: 'network',
      guidance: 'A network error occurred. Check your internet connection and try again.'
    };
  }

  // Syntax/Script errors (likely from extensions or corrupted cache)
  if (msg.includes('syntax') || msg.includes('unexpected token') || msg.includes('unexpected identifier')) {
    return {
      type: 'syntax',
      guidance: 'A script error occurred. This may be caused by a browser extension. Try: 1) Disable extensions, 2) Open in incognito/private mode, or 3) Try a different browser.'
    };
  }

  // Generic error
  return {
    type: 'unknown',
    guidance: 'An unexpected error occurred. Try "Full Reset & Reload" or contact support if the issue persists.'
  };
}

// Helper to escape HTML in error messages
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Export for module consumers
export { Data, Store, EventBus, Monitor, Auth, Sync, Storage, Config, Theme, Toast };
