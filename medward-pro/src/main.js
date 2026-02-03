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

  } catch (error) {
    console.error('[FATAL] Bootstrap failed:', error);
    Monitor.logError('BOOTSTRAP_FAIL', error);

    // Show fatal error UI
    document.body.innerHTML = `
      <div class="fatal-error">
        <div class="fatal-error-content">
          <h1>Application Error</h1>
          <p>MedWard Pro failed to start.</p>
          <p class="error-message">${error.message}</p>
          <div class="fatal-error-actions">
            <button onclick="location.reload()" class="btn btn-primary">Reload</button>
            <button onclick="localStorage.clear(); indexedDB.deleteDatabase('MedWardPro'); location.reload()" class="btn btn-secondary">
              Clear Data & Reload
            </button>
          </div>
          <p class="error-help">
            If the problem persists, please contact support with the error message above.
          </p>
        </div>
      </div>
    `;
  }
}

// Start when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Export for module consumers
export { Data, Store, EventBus, Monitor, Auth, Sync, Storage, Config, Theme, Toast };
