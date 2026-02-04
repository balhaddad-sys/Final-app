/**
 * MedWard Pro - Application Bootstrap
 */
import { initDatabase } from '../services/storage.db.js';
import { Storage } from '../services/storage.adapter.js';
import { Auth } from '../services/firebase.auth.js';
import { Sync } from '../services/firebase.sync.js';
import { Store } from './store.js';
import { Router } from './router.js';
import { EventBus, Events } from './events.js';

// UI
import { BottomNav } from '../ui/components/bottom-nav.js';
import { initToasts } from '../ui/components/toast.js';
import { initModals } from '../ui/components/modal.js';

// Pages
import { renderDashboard } from '../ui/pages/dashboard.js';
import { renderLogin } from '../ui/pages/login.js';
import { renderUnits } from '../ui/pages/units.js';
import { renderPatientDetail } from '../ui/pages/patient-detail.js';
import { renderHandover } from '../ui/pages/handover.js';
import { renderAIAssistant } from '../ui/pages/ai-assistant.js';
import { renderAntibioticGuide } from '../ui/pages/antibiotic-guide.js';
import { renderOncallAssistant } from '../ui/pages/oncall-assistant.js';
import { renderSettings } from '../ui/pages/settings.js';
import { renderLabScanner } from '../ui/pages/lab-scanner.js';

// Advanced features
import { Privacy } from '../utils/privacy.js';
import { Theme } from '../utils/theme.js';
import { Audit } from '../services/audit.service.js';
import { initTaskTypeaheads } from '../ui/components/task-typeahead.js';

// Boot guard
let _bootResolve;
let _bootReject;
window.MW_READY = new Promise((resolve, reject) => {
  _bootResolve = resolve;
  _bootReject = reject;
});

window.MW = {
  ready() {
    return window.MW_READY;
  },
  async reset() {
    console.log('[MW] Starting nuclear reset...');
    try {
      localStorage.clear();
      sessionStorage.clear();
      await new Promise((resolve) => {
        const req = indexedDB.deleteDatabase('MedWardPro');
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
        setTimeout(resolve, 3000);
      });
      location.reload(true);
    } catch (e) {
      location.reload(true);
    }
  }
};

async function bootstrap() {
  const startTime = performance.now();
  console.log('[MedWard] Starting...');

  try {
    // 1. Initialize IndexedDB
    await initDatabase();
    console.log('[MedWard] Database ready');

    // 2. Initialize UI systems
    initToasts();
    initModals();

    // 3. Initialize theme (with auto dark mode)
    await Theme.init();

    // 3b. Initialize privacy protection
    Privacy.init();

    // 3c. Log session start for audit
    Audit.log(Audit.actions.AUTH_LOGIN, 'session', null).catch(() => {});

    // 4. Clean up old WAL entries
    try {
      await Storage.wal.autoCleanup();
    } catch (e) {
      console.warn('[MedWard] WAL cleanup skipped:', e.message);
    }

    // 5. Initialize Sync
    Sync.init();

    // 6. Setup routes
    setupRoutes();

    // 7. Initialize Auth (triggers AUTH_CHANGED)
    Auth.init();

    // 8. Auth-based routing
    EventBus.on(Events.AUTH_CHANGED, ({ user }) => {
      if (user) {
        loadUserData();
      } else {
        Router.navigate('/login');
      }
    });

    // 9. Start router
    Router.init();

    // 10. Register service worker
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('[MedWard] Service worker registered');
      } catch (e) {
        console.warn('[MedWard] Service worker registration failed:', e.message);
      }
    }

    const bootTime = performance.now() - startTime;
    console.log(`[MedWard] Ready in ${bootTime.toFixed(0)}ms`);

    _bootResolve({ bootTime });

  } catch (error) {
    console.error('[MedWard] Boot failed:', error);
    _bootReject(error);

    document.body.innerHTML = `
      <div class="fatal-error">
        <div class="fatal-error-content">
          <h1>Application Error</h1>
          <p>MedWard Pro failed to start.</p>
          <div class="error-details">
            <p class="error-message">${escapeHtml(error.message)}</p>
          </div>
          <div class="fatal-error-actions">
            <button onclick="location.reload()" class="btn btn-primary">Reload Page</button>
            <button onclick="window.MW.reset()" class="btn btn-secondary">Full Reset</button>
          </div>
        </div>
      </div>
    `;
  }
}

function setupRoutes() {
  const appContainer = document.getElementById('app');

  Router.register('/login', () => {
    hideBottomNav();
    renderLogin(appContainer);
  });

  Router.register('/units', () => {
    hideBottomNav();
    renderUnits(appContainer);
  });

  Router.register('/', () => {
    if (!Store.get('isAuthenticated')) {
      Router.navigate('/login');
      return;
    }
    if (!Store.get('currentUnitId')) {
      Router.navigate('/units');
      return;
    }
    showBottomNav();
    renderDashboard(appContainer);

    // Initialize typeahead after render
    setTimeout(() => initTaskTypeaheads(), 0);
  });

  Router.register('/patients/:id', (params) => {
    if (!Store.get('isAuthenticated')) {
      Router.navigate('/login');
      return;
    }
    showBottomNav();
    renderPatientDetail(appContainer, params);
  });

  Router.register('/handover', () => {
    if (!requireAuth()) return;
    showBottomNav();
    renderHandover(appContainer);
  });

  Router.register('/ai', () => {
    if (!requireAuth()) return;
    showBottomNav();
    renderAIAssistant(appContainer);
  });

  Router.register('/antibiotic-guide', () => {
    if (!requireAuth()) return;
    showBottomNav();
    renderAntibioticGuide(appContainer);
  });

  Router.register('/oncall', () => {
    if (!requireAuth()) return;
    showBottomNav();
    renderOncallAssistant(appContainer);
  });

  Router.register('/lab-scanner', () => {
    if (!requireAuth()) return;
    showBottomNav();
    renderLabScanner(appContainer);
  });

  Router.register('/settings', () => {
    if (!requireAuth()) return;
    showBottomNav();
    renderSettings(appContainer);
  });
}

async function loadUserData() {
  Store.set({ isLoading: true });

  try {
    // Load units
    await Sync.loadUnits();

    // Check for last used unit
    const lastUnitId = await Storage.meta.get('lastUnitId');
    if (lastUnitId && Store.find('units', lastUnitId)) {
      Store.set({ currentUnitId: lastUnitId });
      Sync.subscribeToUnit(lastUnitId);
      Router.navigate('/');
    } else if (Store.get('units').length > 0) {
      Router.navigate('/units');
    } else {
      Router.navigate('/units');
    }
  } catch (error) {
    console.error('[MedWard] Failed to load user data:', error);
    // Try to use cached data
    try {
      const cachedUnits = await Storage.getAll('units');
      if (cachedUnits.length > 0) {
        Store.set({ units: cachedUnits });
      }
    } catch (e) { /* ignore */ }
    Router.navigate('/units');
  } finally {
    Store.set({ isLoading: false });
  }
}

function requireAuth() {
  if (!Store.get('isAuthenticated')) {
    Router.navigate('/login');
    return false;
  }
  return true;
}

function showBottomNav() {
  let nav = document.getElementById('bottom-nav');
  if (!nav) {
    nav = BottomNav();
    document.body.appendChild(nav);
  }
  nav.style.display = '';
}

function hideBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'none';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Start app when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
