// ═══════════════════════════════════════════════════════════════════
// MEDWARD PRO — COMPLETE EXTRACTED CODEBASE
// All production-quality code in one reference file
// 36 source files combined
// ═══════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════
// FILE: core/events.js
// ═══════════════════════════════════════════════════════════════════

// core/core.events.js
// Event Bus for decoupling modules. Auth triggers login -> Sync starts -> UI updates.

export const EventBus = {
  _events: new Map(),

  on(event, callback, options = {}) {
    if (!this._events.has(event)) {
      this._events.set(event, []);
    }
    const entry = { callback, once: options.once || false };
    this._events.get(event).push(entry);

    // Return unsubscribe function
    return () => this.off(event, callback);
  },

  once(event, callback) {
    return this.on(event, callback, { once: true });
  },

  emit(event, data) {
    const listeners = this._events.get(event);
    if (!listeners) return;

    listeners.forEach((entry, index) => {
      try {
        entry.callback(data);
        if (entry.once) {
          listeners.splice(index, 1);
        }
      } catch (e) {
        console.error(`[EventBus] Error in "${event}" listener:`, e);
      }
    });
  },

  off(event, callback) {
    const listeners = this._events.get(event);
    if (!listeners) return;

    const index = listeners.findIndex(e => e.callback === callback);
    if (index !== -1) listeners.splice(index, 1);
  },

  clear() {
    this._events.clear();
  }
};

// Standard events to emit:
// 'auth:ready'        - User authenticated
// 'auth:logout'       - User logged out
// 'data:updated'      - Collection/doc changed
// 'sync:status'       - 'connected' | 'disconnected' | 'syncing'
// 'toast:info'        - Show info toast
// 'toast:error'       - Show error toast
// 'toast:success'     - Show success toast
// 'unit:selected'     - Unit was selected
// 'patient:selected'  - Patient was selected
// 'store:patients'    - Patients collection changed
// 'store:tasks'       - Tasks collection changed
// 'store:units'       - Units collection changed


// ═══════════════════════════════════════════════════════════════════
// FILE: core/config.js
// ═══════════════════════════════════════════════════════════════════

// core/config.js
// Environment configuration

export const Config = {
  // App metadata
  APP_NAME: 'MedWard Pro',
  APP_VERSION: '1.0.0',

  // Sync settings
  SYNC_INTERVAL: 30000, // 30 seconds
  STALE_TIME: 5 * 60 * 1000, // 5 minutes
  MAX_RETRY_COUNT: 5,

  // WAL settings
  WAL_CLEANUP_AGE: 24 * 60 * 60 * 1000, // 24 hours
  MAX_WAL_ENTRIES: 1000, // Maximum WAL entries before cleanup

  // UI settings
  TOAST_DURATION: 4000,
  LONG_PRESS_DURATION: 500,

  // Typeahead settings
  TYPEAHEAD_MIN_CHARS: 2,
  TYPEAHEAD_MAX_RESULTS: 8,

  // Validation limits
  MAX_PATIENT_NAME_LENGTH: 200,
  MAX_DIAGNOSIS_LENGTH: 500,
  MAX_TASK_TEXT_LENGTH: 500,
  MAX_MRN_LENGTH: 50,
  MAX_BED_LENGTH: 20,

  // Monitor settings
  MAX_MONITOR_EVENTS: 2500,

  // Firebase emulator ports (for development)
  EMULATOR_PORTS: {
    auth: 9099,
    firestore: 8080,
    functions: 5001,
    hosting: 5000,
    ui: 4000
  },

  // Check if using emulators
  get useEmulators() {
    return import.meta.env?.VITE_USE_EMULATORS === 'true';
  },

  // Check if in development mode
  get isDev() {
    return import.meta.env?.DEV || false;
  },

  // Get Firebase config from environment
  getFirebaseConfig() {
    return {
      apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || '',
      authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || '',
      projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || '',
      storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env?.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || ''
    };
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: core/store.js
// ═══════════════════════════════════════════════════════════════════

// core/store.js
// Single Source of Truth for UI. Never let UI touch Firebase/IndexedDB directly.

import { EventBus } from './core.events.js';

const _state = {
  patients: [],
  tasks: [],
  units: [],
  trash: { patients: [], units: [] },

  // Current selections
  currentUnit: null,
  currentPatient: null,
  currentUser: null,

  // UI state
  currentFilter: 'all',

  // Sync metadata
  lastSync: null,
  syncStatus: 'disconnected'
};

export const Store = {
  // Read-only snapshot (prevents accidental mutation)
  getSnapshot() {
    return JSON.parse(JSON.stringify(_state));
  },

  // Direct access for performance-critical reads
  get patients() { return _state.patients; },
  get tasks() { return _state.tasks; },
  get units() { return _state.units; },
  get trash() { return _state.trash; },
  get currentUnit() { return _state.currentUnit; },
  get currentPatient() { return _state.currentPatient; },
  get currentUser() { return _state.currentUser; },
  get syncStatus() { return _state.syncStatus; },
  get currentFilter() { return _state.currentFilter; },

  // Selectors
  select(collection, filterFn) {
    const data = _state[collection];
    if (!data) return [];
    return filterFn ? data.filter(filterFn) : [...data];
  },

  selectOne(collection, id) {
    const data = _state[collection];
    if (!data) return null;
    return data.find(item => item.id === id) || null;
  },

  // Get deep clone for rollback
  getClone(collection, id) {
    const data = _state[collection];
    if (!data) return null;
    const item = data.find(i => i.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  },

  // Mutations (only way to change state)
  apply(collection, operation, payload, docId) {
    if (!_state[collection]) {
      console.warn(`[Store] Unknown collection: ${collection}`);
      return;
    }

    switch (operation) {
      case 'add':
        _state[collection].push(payload);
        break;

      case 'update':
        const idx = _state[collection].findIndex(i => i.id === docId);
        if (idx !== -1) {
          _state[collection][idx] = { ..._state[collection][idx], ...payload };
        }
        break;

      case 'delete':
        _state[collection] = _state[collection].filter(i => i.id !== docId);
        break;
    }

    EventBus.emit(`store:${collection}`, _state[collection]);
    EventBus.emit('data:updated', { collection, docId, operation });
  },

  // Bulk replace (used when full sync arrives from server)
  replace(collection, items) {
    if (!Array.isArray(items)) {
      console.warn(`[Store] replace expects an array for ${collection}`);
      return;
    }
    _state[collection] = items;
    EventBus.emit(`store:${collection}`, items);
  },

  // Restore after failed optimistic update
  restore(collection, docId, previousItem) {
    const idx = _state[collection].findIndex(i => i.id === docId);

    if (previousItem) {
      if (idx !== -1) {
        _state[collection][idx] = previousItem; // Revert update
      } else {
        _state[collection].push(previousItem); // Revert delete
      }
    } else {
      // No previous item = was an 'add', so remove it
      if (idx !== -1) {
        _state[collection].splice(idx, 1);
      }
    }

    EventBus.emit(`store:${collection}`, _state[collection]);
  },

  // Set current selections
  setCurrentUnit(unit) {
    _state.currentUnit = unit;
    EventBus.emit('unit:selected', unit);
  },

  setCurrentPatient(patient) {
    _state.currentPatient = patient;
    EventBus.emit('patient:selected', patient);
  },

  setCurrentUser(user) {
    _state.currentUser = user;
    EventBus.emit('user:changed', user);
  },

  setSyncStatus(status) {
    _state.syncStatus = status;
    EventBus.emit('sync:status', status);
  },

  setCurrentFilter(filter) {
    _state.currentFilter = filter;
    EventBus.emit('filter:changed', filter);
  },

  // Add to trash
  addToTrash(type, item) {
    if (_state.trash[type]) {
      _state.trash[type].push({
        ...item,
        deletedAt: Date.now()
      });
      EventBus.emit('trash:updated', _state.trash);
    }
  },

  // Remove from trash
  removeFromTrash(type, id) {
    if (_state.trash[type]) {
      _state.trash[type] = _state.trash[type].filter(i => i.id !== id);
      EventBus.emit('trash:updated', _state.trash);
    }
  },

  // Clear trash
  clearTrash(type) {
    if (type) {
      _state.trash[type] = [];
    } else {
      _state.trash = { patients: [], units: [] };
    }
    EventBus.emit('trash:updated', _state.trash);
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: core/router.js
// ═══════════════════════════════════════════════════════════════════

// core/router.js
// Simple SPA router for page navigation

import { EventBus } from './core.events.js';

class RouterManager {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.beforeHooks = [];
    this.afterHooks = [];
  }

  init() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      this._handleRoute(window.location.pathname, false);
    });

    // Handle link clicks
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-route]');
      if (link) {
        e.preventDefault();
        this.navigate(link.getAttribute('href'));
      }
    });

    // Handle initial route
    this._handleRoute(window.location.pathname, false);
  }

  register(path, handler, options = {}) {
    this.routes.set(path, {
      handler,
      requiresAuth: options.requiresAuth ?? true,
      title: options.title || 'MedWard Pro'
    });
    return this;
  }

  beforeEach(hook) {
    this.beforeHooks.push(hook);
    return this;
  }

  afterEach(hook) {
    this.afterHooks.push(hook);
    return this;
  }

  navigate(path, options = {}) {
    const { replace = false, state = {} } = options;

    if (replace) {
      window.history.replaceState(state, '', path);
    } else {
      window.history.pushState(state, '', path);
    }

    this._handleRoute(path, true);
  }

  async _handleRoute(path, emitEvent = true) {
    // Normalize path
    const normalizedPath = this._normalizePath(path);

    // Find matching route
    const route = this.routes.get(normalizedPath);

    if (!route) {
      console.warn(`[Router] No route found for: ${normalizedPath}`);
      // Could redirect to 404 or home
      return;
    }

    // Run before hooks
    for (const hook of this.beforeHooks) {
      const result = await hook(normalizedPath, this.currentRoute);
      if (result === false) {
        return; // Navigation cancelled
      }
    }

    // Update page title
    document.title = route.title;

    // Store previous route
    const previousRoute = this.currentRoute;
    this.currentRoute = normalizedPath;

    // Execute route handler
    try {
      await route.handler({ path: normalizedPath, state: window.history.state });
    } catch (error) {
      console.error(`[Router] Error handling route ${normalizedPath}:`, error);
    }

    // Run after hooks
    for (const hook of this.afterHooks) {
      await hook(normalizedPath, previousRoute);
    }

    if (emitEvent) {
      EventBus.emit('route:changed', { from: previousRoute, to: normalizedPath });
    }
  }

  _normalizePath(path) {
    // Remove trailing slashes and normalize
    let normalized = path.replace(/\/+$/, '') || '/';

    // Handle .html extensions
    if (normalized.endsWith('.html')) {
      normalized = normalized.replace('.html', '');
    }

    return normalized;
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  back() {
    window.history.back();
  }

  forward() {
    window.history.forward();
  }
}

export const Router = new RouterManager();


// ═══════════════════════════════════════════════════════════════════
// FILE: core/app.data.js
// ═══════════════════════════════════════════════════════════════════

// core/app.data.js
// CRITICAL FILE: This is the ONLY interface the UI should use for data operations.

import { Store } from './store.js';
import { Storage } from '../services/storage.adapter.js';
import { Sync } from '../services/firebase.sync.js';
import { EventBus } from './core.events.js';
import { Monitor } from '../monitor/monitor.core.js';

export const Data = {
  // ========================================
  // CENTRALIZED STATE ACCESS
  // ========================================

  get state() {
    return Store.getSnapshot();
  },

  get patients() {
    return Store.patients;
  },

  get tasks() {
    return Store.tasks;
  },

  get units() {
    return Store.units;
  },

  // ========================================
  // CORE MUTATION HANDLER (THE "BRAIN")
  // ========================================

  async _mutate(collection, operation, payload, docId) {
    const mutationId = crypto.randomUUID();
    const timestamp = Date.now();

    // 1. SNAPSHOT FOR ROLLBACK (Critical: capture BEFORE mutation)
    const previousState = Store.getClone(collection, docId);

    try {
      // 2. OPTIMISTIC UPDATE (In-Memory)
      // UI reflects change immediately
      Store.apply(collection, operation, payload, docId);

      // 3. PERSIST TO WAL (IndexedDB)
      // Survives browser crash/refresh
      const mutationRecord = {
        id: mutationId,
        collection,
        operation,
        docId,
        payload,
        timestamp,
        status: 'pending'
      };

      await Storage.wal.add(mutationRecord);

      // 4. PERSIST TO LOCAL STORE
      // Mirror the change in IndexedDB
      if (collection === 'patients') {
        if (operation === 'add' || operation === 'update') {
          await Storage.patients.upsert({ id: docId, ...payload });
        } else if (operation === 'delete') {
          await Storage.patients.softDelete(docId);
        }
      } else if (collection === 'tasks') {
        if (operation === 'add' || operation === 'update') {
          await Storage.tasks.upsert({ id: docId, ...payload });
        } else if (operation === 'delete') {
          await Storage.tasks.delete(docId);
        }
      } else if (collection === 'units') {
        if (operation === 'add' || operation === 'update') {
          await Storage.units.upsert({ id: docId, ...payload });
        } else if (operation === 'delete') {
          await Storage.units.delete(docId);
        }
      }

      // 5. SYNC TO CLOUD (non-blocking)
      // Don't await - let UI remain responsive
      this._syncToCloud(mutationRecord, previousState);

      Monitor.log('DATA', `${operation} ${collection}/${docId}`, { mutationId });

      return { success: true, id: docId };

    } catch (error) {
      // CRITICAL: System error (IDB full, memory error)
      console.error('[Data] Critical mutation error:', error);
      Monitor.logError('DATA_MUTATION_FAIL', error);

      // Rollback UI immediately
      if (previousState !== undefined) {
        Store.restore(collection, docId, previousState);
      }

      throw error;
    }
  },

  // ========================================
  // SYNC TO CLOUD WITH ROLLBACK
  // ========================================

  async _syncToCloud(mutation, previousState) {
    try {
      // Offline? Leave in WAL for background sync
      if (!navigator.onLine) {
        console.log(`[Data] Offline. Queued: ${mutation.id}`);
        EventBus.emit('sync:status', 'offline');
        return;
      }

      EventBus.emit('sync:status', 'syncing');

      // Try sending to Firebase
      await Sync.push(mutation);

      // Success! Mark WAL as synced
      await Storage.wal.updateStatus(mutation.id, 'synced');

      EventBus.emit('sync:status', 'connected');

    } catch (networkError) {
      // Identify FATAL vs TRANSIENT errors
      const isFatal =
        networkError.code === 'permission-denied' ||
        networkError.code === 'invalid-argument' ||
        networkError.type === 'validation';

      if (isFatal) {
        // SERVER REJECTED - Rollback UI
        Monitor.logError('DATA_SYNC_REJECTED', networkError);

        Store.restore(mutation.collection, mutation.docId, previousState);

        EventBus.emit('toast:error', `Save failed: ${networkError.message}`);

        await Storage.wal.updateStatus(mutation.id, 'failed_fatal');

      } else {
        // TRANSIENT - Leave pending, sync loop will retry
        console.warn(`[Data] Transient sync error. Will retry: ${mutation.id}`);
        await Storage.wal.incrementRetry(mutation.id);
      }
    }
  },

  // ========================================
  // PUBLIC API: PATIENTS
  // ========================================

  Patients: {
    get(unitId) {
      // Always return local data instantly
      const localData = Store.select('patients', p =>
        p.unitId === unitId && !p.deleted
      );

      // Background revalidation (Stale-While-Revalidate)
      if (Sync.shouldRefetch('patients', unitId)) {
        Sync.pull('patients', unitId).catch(console.warn);
      }

      return localData;
    },

    getAll() {
      return Store.select('patients', p => !p.deleted);
    },

    getById(id) {
      return Store.selectOne('patients', id);
    },

    getByStatus(status) {
      return Store.select('patients', p => p.status === status && !p.deleted);
    },

    async add(patientData) {
      // Validation
      if (!patientData.name?.trim()) {
        throw new Error('Patient name is required');
      }

      const id = patientData.id || crypto.randomUUID();
      const patient = {
        id,
        name: patientData.name.trim(),
        mrn: patientData.mrn || '',
        bed: patientData.bed || '',
        diagnosis: patientData.diagnosis || '',
        notes: patientData.notes || '',
        unitId: patientData.unitId || Store.currentUnit?.id,
        status: patientData.status || 'active',
        deleted: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('patients', 'add', patient, id);
    },

    async update(id, patches) {
      const updates = {
        ...patches,
        updatedAt: Date.now()
      };
      return Data._mutate('patients', 'update', updates, id);
    },

    async discharge(id) {
      return Data._mutate('patients', 'update', {
        status: 'discharged',
        dischargedAt: Date.now(),
        updatedAt: Date.now()
      }, id);
    },

    async archive(id) {
      return Data._mutate('patients', 'update', {
        status: 'archived',
        archivedAt: Date.now(),
        updatedAt: Date.now()
      }, id);
    },

    async delete(id) {
      // Soft delete
      return Data._mutate('patients', 'update', {
        deleted: true,
        deletedAt: Date.now(),
        updatedAt: Date.now()
      }, id);
    },

    async restore(id) {
      return Data._mutate('patients', 'update', {
        deleted: false,
        deletedAt: null,
        updatedAt: Date.now()
      }, id);
    },

    async permanentDelete(id) {
      return Data._mutate('patients', 'delete', {}, id);
    }
  },

  // ========================================
  // PUBLIC API: TASKS
  // ========================================

  Tasks: {
    getByPatient(patientId) {
      return Store.select('tasks', t => t.patientId === patientId && !t.deleted);
    },

    getAll() {
      return Store.select('tasks', t => !t.deleted);
    },

    getById(id) {
      return Store.selectOne('tasks', id);
    },

    getPending() {
      return Store.select('tasks', t => !t.completed && !t.deleted);
    },

    getCompleted() {
      return Store.select('tasks', t => t.completed && !t.deleted);
    },

    async add(patientId, text, category = 'general') {
      if (!text?.trim()) {
        throw new Error('Task text is required');
      }

      const id = crypto.randomUUID();
      const task = {
        id,
        patientId,
        text: text.trim(),
        category,
        completed: false,
        deleted: false,
        priority: 'routine',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('tasks', 'add', task, id);
    },

    async addWithDetails(taskData) {
      if (!taskData.text?.trim()) {
        throw new Error('Task text is required');
      }
      if (!taskData.patientId) {
        throw new Error('Patient ID is required');
      }

      const id = taskData.id || crypto.randomUUID();
      const task = {
        id,
        patientId: taskData.patientId,
        text: taskData.text.trim(),
        category: taskData.category || 'general',
        completed: false,
        deleted: false,
        priority: taskData.priority || 'routine',
        dueDate: taskData.dueDate || null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('tasks', 'add', task, id);
    },

    async toggle(taskId, completed) {
      return Data._mutate('tasks', 'update', {
        completed,
        completedAt: completed ? Date.now() : null,
        updatedAt: Date.now()
      }, taskId);
    },

    async update(taskId, patches) {
      return Data._mutate('tasks', 'update', {
        ...patches,
        updatedAt: Date.now()
      }, taskId);
    },

    async delete(taskId) {
      return Data._mutate('tasks', 'update', {
        deleted: true,
        deletedAt: Date.now(),
        updatedAt: Date.now()
      }, taskId);
    },

    async permanentDelete(taskId) {
      return Data._mutate('tasks', 'delete', {}, taskId);
    }
  },

  // ========================================
  // PUBLIC API: UNITS
  // ========================================

  Units: {
    getAll() {
      return Store.units;
    },

    getById(id) {
      return Store.selectOne('units', id);
    },

    async create(name, icon = '') {
      if (!name?.trim()) {
        throw new Error('Unit name is required');
      }

      const id = crypto.randomUUID();
      const unit = {
        id,
        name: name.trim(),
        icon,
        members: [Store.currentUser?.uid].filter(Boolean),
        ownerId: Store.currentUser?.uid,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      return Data._mutate('units', 'add', unit, id);
    },

    async update(id, patches) {
      return Data._mutate('units', 'update', {
        ...patches,
        updatedAt: Date.now()
      }, id);
    },

    async delete(id) {
      return Data._mutate('units', 'delete', {}, id);
    },

    async addMember(unitId, userId) {
      const unit = Store.selectOne('units', unitId);
      if (!unit) throw new Error('Unit not found');

      const members = [...(unit.members || [])];
      if (!members.includes(userId)) {
        members.push(userId);
      }

      return Data._mutate('units', 'update', {
        members,
        updatedAt: Date.now()
      }, unitId);
    },

    async removeMember(unitId, userId) {
      const unit = Store.selectOne('units', unitId);
      if (!unit) throw new Error('Unit not found');

      const members = (unit.members || []).filter(m => m !== userId);

      return Data._mutate('units', 'update', {
        members,
        updatedAt: Date.now()
      }, unitId);
    },

    select(unit) {
      Store.setCurrentUnit(unit);
      Storage.meta.set('lastUnitId', unit?.id);
    },

    getCurrent() {
      return Store.currentUnit;
    }
  },

  // ========================================
  // INITIALIZATION
  // ========================================

  async init() {
    try {
      // Initialize storage
      await Storage.init();

      // Load cached data from IndexedDB into Store
      const [patients, tasks, units] = await Promise.all([
        Storage.patients.getAll(),
        Storage.tasks.getAll(),
        Storage.units.getAll()
      ]);

      Store.replace('patients', patients);
      Store.replace('tasks', tasks);
      Store.replace('units', units);

      // Restore last selected unit
      const lastUnitId = await Storage.meta.get('lastUnitId');
      if (lastUnitId) {
        const unit = units.find(u => u.id === lastUnitId);
        if (unit) {
          Store.setCurrentUnit(unit);
        }
      }

      Monitor.log('DATA', 'Data layer initialized', {
        patients: patients.length,
        tasks: tasks.length,
        units: units.length
      });

      return true;
    } catch (error) {
      Monitor.logError('DATA_INIT_FAIL', error);
      throw error;
    }
  },

  // ========================================
  // EXPORT/IMPORT
  // ========================================

  async exportAll() {
    return Storage.exportAll();
  },

  async importAll(data) {
    const result = await Storage.importAll(data);
    if (result) {
      // Reload into Store
      const [patients, tasks, units] = await Promise.all([
        Storage.patients.getAll(),
        Storage.tasks.getAll(),
        Storage.units.getAll()
      ]);

      Store.replace('patients', patients);
      Store.replace('tasks', tasks);
      Store.replace('units', units);
    }
    return result;
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: core/main.js
// ═══════════════════════════════════════════════════════════════════

// src/main.js
// Application entry point

// Import base CSS so Vite includes it in the build
import '../styles/base.css';

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

    // 2. Initialize local storage (IndexedDB) - MUST be before Theme
    await Storage.init();
    trackStep('storage');
    Monitor.log('RUNTIME', 'Storage initialized');

    // 3. Initialize theme (requires Storage for preference)
    await Theme.init();
    trackStep('theme');

    // 4. Initialize Toast system
    Toast.init();
    trackStep('toast');

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


// ═══════════════════════════════════════════════════════════════════
// FILE: services/firebase.config.js
// ═══════════════════════════════════════════════════════════════════

// services/firebase.config.js
// Firebase initialization and configuration

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { Config } from '../core/config.js';

// Get Firebase config from environment
const firebaseConfig = Config.getFirebaseConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
// Initialize Firestore with persistent cache (replaces enableIndexedDbPersistence)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
export const functions = getFunctions(app);

// Connect to emulators in development
if (Config.useEmulators) {
  try {
    connectAuthEmulator(auth, `http://localhost:${Config.EMULATOR_PORTS.auth}`, {
      disableWarnings: true
    });
    connectFirestoreEmulator(db, 'localhost', Config.EMULATOR_PORTS.firestore);
    connectFunctionsEmulator(functions, 'localhost', Config.EMULATOR_PORTS.functions);
    console.log('[Firebase] Connected to emulators');
  } catch (e) {
    console.warn('[Firebase] Failed to connect to emulators:', e.message);
  }
}

export default app;

// Export for debugging
if (Config.isDev) {
  window.__FIREBASE__ = { app, auth, db, functions };
}


// ═══════════════════════════════════════════════════════════════════
// FILE: services/firebase.auth.js
// ═══════════════════════════════════════════════════════════════════

// services/firebase.auth.js
// Authentication service

import { auth } from './firebase.config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { EventBus } from '../core/core.events.js';
import { Store } from '../core/store.js';
import { Monitor } from '../monitor/monitor.core.js';

export const Auth = {
  _unsubscribe: null,

  // Initialize auth listener
  init() {
    this._unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        };

        Store.setCurrentUser(userData);
        EventBus.emit('auth:ready', userData);
        Monitor.log('AUTH', `User authenticated: ${user.email}`);
      } else {
        Store.setCurrentUser(null);
        EventBus.emit('auth:logout');
        Monitor.log('AUTH', 'User logged out');
      }
    });
  },

  // Stop listening to auth changes
  destroy() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },

  // Get current user
  getCurrentUser() {
    return auth.currentUser;
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!auth.currentUser;
  },

  // Email/Password sign in
  async signIn(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      Monitor.log('AUTH', `Sign in successful: ${email}`);
      return { success: true, user: result.user };
    } catch (error) {
      Monitor.logError('AUTH_SIGNIN_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Create new account
  async signUp(email, password, displayName = '') {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      Monitor.log('AUTH', `Sign up successful: ${email}`);
      return { success: true, user: result.user };
    } catch (error) {
      Monitor.logError('AUTH_SIGNUP_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Google sign in
  async signInWithGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      Monitor.log('AUTH', `Google sign in successful: ${result.user.email}`);
      return { success: true, user: result.user };
    } catch (error) {
      Monitor.logError('AUTH_GOOGLE_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Sign out
  async signOut() {
    try {
      await signOut(auth);
      Monitor.log('AUTH', 'Sign out successful');
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_SIGNOUT_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Send password reset email
  async resetPassword(email) {
    try {
      await sendPasswordResetEmail(auth, email);
      Monitor.log('AUTH', `Password reset email sent to: ${email}`);
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_RESET_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Update user profile
  async updateProfile(updates) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      await updateProfile(user, updates);
      Monitor.log('AUTH', 'Profile updated');
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_PROFILE_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No user logged in');

      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);
      Monitor.log('AUTH', 'Password changed');
      return { success: true };
    } catch (error) {
      Monitor.logError('AUTH_PASSWORD_FAIL', error);
      return { success: false, error: this._formatError(error) };
    }
  },

  // Format Firebase auth errors to user-friendly messages
  _formatError(error) {
    const errorMap = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'An account with this email already exists',
      'auth/weak-password': 'Password must be at least 6 characters',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/popup-closed-by-user': 'Sign in cancelled',
      'auth/invalid-credential': 'Invalid credentials. Please try again'
    };

    return errorMap[error.code] || error.message || 'An error occurred';
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: services/firebase.functions.js
// ═══════════════════════════════════════════════════════════════════

// services/firebase.functions.js
// Cloud function calls

import { functions, auth } from './firebase.config.js';
import { httpsCallable } from 'firebase/functions';
import { Monitor } from '../monitor/monitor.core.js';
import { EventBus } from '../core/core.events.js';

// Cache for function references
const _functionCache = new Map();

function getFunction(name) {
  if (!_functionCache.has(name)) {
    _functionCache.set(name, httpsCallable(functions, name));
  }
  return _functionCache.get(name);
}

// Wait for Firebase auth to resolve before calling functions that require auth.
// Without this, calls made immediately after page load may fail with
// "unauthenticated" because onAuthStateChanged hasn't fired yet.
let _authReady = false;
let _authReadyResolve;
const _authReadyPromise = new Promise((resolve) => { _authReadyResolve = resolve; });

// Listen for first auth state resolution
import { onAuthStateChanged } from 'firebase/auth';
const _unsubAuth = onAuthStateChanged(auth, (user) => {
  _authReady = true;
  _authReadyResolve(user);
  _unsubAuth(); // Only need the first resolution
});

async function waitForAuth() {
  if (_authReady) return;
  // Wait up to 10 seconds for auth to resolve
  await Promise.race([
    _authReadyPromise,
    new Promise((resolve) => setTimeout(resolve, 10000))
  ]);
}

export const CloudFunctions = {
  // ========================================
  // DATA OPERATIONS
  // ========================================

  async loadData(clientRev = 0, deviceId = null) {
    try {
      const fn = getFunction('loadData');
      const result = await fn({ clientRev, deviceId });
      Monitor.log('FUNCTIONS', 'loadData completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_LOAD_DATA', error);
      throw error;
    }
  },

  async saveData(payload, baseRev, options = {}) {
    try {
      const fn = getFunction('saveData');
      const result = await fn({
        payload,
        baseRev,
        force: options.force || false,
        deviceId: options.deviceId,
        idempotencyKey: options.idempotencyKey
      });
      Monitor.log('FUNCTIONS', 'saveData completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_SAVE_DATA', error);
      throw error;
    }
  },

  // ========================================
  // TRASH OPERATIONS
  // ========================================

  async moveToTrash(itemIds, itemType) {
    try {
      const fn = getFunction('moveToTrash');
      const result = await fn({ itemIds, itemType });
      Monitor.log('FUNCTIONS', `Moved ${itemIds.length} items to trash`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_TRASH', error);
      throw error;
    }
  },

  async restoreFromTrash(itemIds, itemType) {
    try {
      const fn = getFunction('restoreFromTrash');
      const result = await fn({ itemIds, itemType });
      Monitor.log('FUNCTIONS', `Restored ${itemIds.length} items from trash`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_RESTORE', error);
      throw error;
    }
  },

  // ========================================
  // HANDOVER OPERATIONS
  // ========================================

  async sendPatient(recipientEmail, patientData, notes = '') {
    try {
      const fn = getFunction('sendPatient');
      const result = await fn({ recipientEmail, patientData, notes });
      Monitor.log('FUNCTIONS', `Patient sent to ${recipientEmail}`);
      EventBus.emit('toast:success', `Handover sent to ${recipientEmail}`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_SEND_PATIENT', error);
      EventBus.emit('toast:error', `Failed to send: ${error.message}`);
      throw error;
    }
  },

  async checkInbox() {
    try {
      const fn = getFunction('checkInbox');
      const result = await fn({});
      Monitor.log('FUNCTIONS', `Inbox check: ${result.data.count} items`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_CHECK_INBOX', error);
      throw error;
    }
  },

  async acceptInboxPatient(itemId, unitId) {
    try {
      const fn = getFunction('acceptInboxPatient');
      const result = await fn({ itemId, unitId });
      Monitor.log('FUNCTIONS', 'Patient accepted from inbox');
      EventBus.emit('toast:success', 'Patient added to your unit');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_ACCEPT_PATIENT', error);
      EventBus.emit('toast:error', `Failed to accept: ${error.message}`);
      throw error;
    }
  },

  async declineInboxItem(itemId) {
    try {
      const fn = getFunction('declineInboxPatient');
      const result = await fn({ itemId });
      Monitor.log('FUNCTIONS', 'Inbox item declined');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_DECLINE_INBOX', error);
      throw error;
    }
  },

  // ========================================
  // AI OPERATIONS
  // ========================================

  async askClinical(question, { context = null, systemPrompt = null, model = 'claude-sonnet-4-20250514' } = {}) {
    await waitForAuth();

    if (!auth.currentUser) {
      const err = new Error('You must be logged in to use the AI Assistant.');
      err.code = 'functions/unauthenticated';
      throw err;
    }

    try {
      const fn = getFunction('medward_askClinical');
      const result = await fn({ question, context, systemPrompt, model });
      Monitor.log('FUNCTIONS', 'AI query completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_AI_CLINICAL', error, {
        code: error.code,
        message: error.message,
        details: error.details
      });

      if (error.code === 'functions/not-found' || error.message?.includes('NOT_FOUND') || error.message?.includes('could not be found')) {
        EventBus.emit('toast:error', 'AI Cloud Functions are not deployed. Run: firebase deploy --only functions');
      } else if (error.code === 'resource-exhausted' || error.code === 'functions/resource-exhausted') {
        EventBus.emit('toast:warning', 'Rate limit reached. Please wait before trying again.');
      } else if (error.code === 'functions/unauthenticated' || error.code === 'unauthenticated') {
        EventBus.emit('toast:error', 'You must be logged in to use the AI Assistant.');
      } else if (error.code === 'functions/failed-precondition' || error.message?.includes('ANTHROPIC_API_KEY')) {
        EventBus.emit('toast:error', 'AI service not configured. ANTHROPIC_API_KEY secret needs to be set.');
      } else {
        EventBus.emit('toast:error', `AI error: ${error.message || 'Service temporarily unavailable'}`);
      }

      throw error;
    }
  },

  async analyzeLabImage(imageBase64, mediaType = 'image/jpeg', patientName = null) {
    await waitForAuth();
    if (!auth.currentUser) {
      const err = new Error('You must be logged in to use Lab Scanner.');
      err.code = 'functions/unauthenticated';
      throw err;
    }
    try {
      const fn = getFunction('medward_analyzeLabImage');
      const result = await fn({ imageBase64, mediaType, patientName });
      Monitor.log('FUNCTIONS', 'Lab image analysis completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_LAB_ANALYSIS', error);
      throw error;
    }
  },

  async getDrugInfo(drugName, indication = null) {
    await waitForAuth();
    if (!auth.currentUser) {
      const err = new Error('You must be logged in to use Drug Info.');
      err.code = 'functions/unauthenticated';
      throw err;
    }
    try {
      const fn = getFunction('medward_getDrugInfo');
      const result = await fn({ drugName, indication });
      Monitor.log('FUNCTIONS', `Drug info retrieved: ${drugName}`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_DRUG_INFO', error);
      throw error;
    }
  },

  async generateHandoverSummary(patientId) {
    try {
      const fn = getFunction('medward_generateHandoverSummary');
      const result = await fn({ patientId });
      Monitor.log('FUNCTIONS', 'Handover summary generated');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_HANDOVER_SUMMARY', error);
      throw error;
    }
  },

  // ========================================
  // ANTIBIOTIC GUIDE
  // ========================================

  async getAntibioticGuidance(condition, patientFactors = {}) {
    await waitForAuth();
    if (!auth.currentUser) {
      const err = new Error('You must be logged in to use Antibiotic Guide.');
      err.code = 'functions/unauthenticated';
      throw err;
    }
    try {
      const fn = getFunction('medward_getAntibioticGuidance');
      const result = await fn({ condition, patientFactors });
      Monitor.log('FUNCTIONS', `Antibiotic guidance: ${condition}`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_ANTIBIOTIC', error);
      throw error;
    }
  },

  // ========================================
  // ADMIN OPERATIONS
  // ========================================

  async exportUserData() {
    try {
      const fn = getFunction('exportUserData');
      const result = await fn({});
      Monitor.log('FUNCTIONS', 'User data exported');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_EXPORT', error);
      throw error;
    }
  },

  async deleteAccount(confirmation) {
    try {
      const fn = getFunction('deleteAccount');
      const result = await fn({ confirmation });
      Monitor.log('FUNCTIONS', 'Account deletion initiated');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_DELETE_ACCOUNT', error);
      throw error;
    }
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: services/storage.db.js
// ═══════════════════════════════════════════════════════════════════

// services/storage.db.js
// IndexedDB setup for persistent offline storage with WAL support

const DB_NAME = 'MedWardPro';
const DB_VERSION = 1;

// Helper to create descriptive "not initialized" errors
function notInitializedError(operation) {
  const error = new Error(
    `Database not initialized. Cannot perform "${operation}". ` +
    'This usually means: 1) The app is still loading, 2) IndexedDB init failed, or ' +
    '3) Code ran before await Storage.init(). Use "await window.MW.ready()" before DB operations.'
  );
  error.code = 'DB_NOT_INITIALIZED';
  return error;
}

export const StorageDB = {
  db: null,
  _initPromise: null, // Track initialization state
  _initError: null,   // Store init error for better diagnostics

  async init() {
    // Return existing promise if already initializing/initialized
    if (this._initPromise) {
      return this._initPromise;
    }

    // Already initialized - return immediately
    if (this.db) {
      return this.db;
    }

    // Check if IndexedDB is available
    if (!window.indexedDB) {
      this._initError = new Error('IndexedDB not supported in this browser');
      throw this._initError;
    }

    this._initPromise = new Promise((resolve, reject) => {
      let request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        this._initError = new Error(`Failed to open database: ${e.message}`);
        reject(this._initError);
        return;
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Patients store
        if (!db.objectStoreNames.contains('patients')) {
          const patients = db.createObjectStore('patients', { keyPath: 'id' });
          patients.createIndex('by_unit', 'unitId', { unique: false });
          patients.createIndex('by_deleted', 'deleted', { unique: false });
          patients.createIndex('by_updated', 'updatedAt', { unique: false });
          patients.createIndex('by_status', 'status', { unique: false });
        }

        // Units store
        if (!db.objectStoreNames.contains('units')) {
          const units = db.createObjectStore('units', { keyPath: 'id' });
          units.createIndex('by_updated', 'updatedAt', { unique: false });
        }

        // Tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasks = db.createObjectStore('tasks', { keyPath: 'id' });
          tasks.createIndex('by_patient', 'patientId', { unique: false });
          tasks.createIndex('by_completed', 'completed', { unique: false });
          tasks.createIndex('by_deleted', 'deleted', { unique: false });
        }

        // Trash store
        if (!db.objectStoreNames.contains('trash')) {
          const trash = db.createObjectStore('trash', { keyPath: 'id' });
          trash.createIndex('by_type', 'type', { unique: false });
          trash.createIndex('by_deleted', 'deletedAt', { unique: false });
        }

        // Write-Ahead Log (WAL) - THE CRITICAL STORE
        if (!db.objectStoreNames.contains('wal')) {
          const wal = db.createObjectStore('wal', { keyPath: 'id' });
          wal.createIndex('by_status', 'status', { unique: false });
          wal.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // Metadata store
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }

        // Handover inbox store
        if (!db.objectStoreNames.contains('inbox')) {
          const inbox = db.createObjectStore('inbox', { keyPath: 'id' });
          inbox.createIndex('by_status', 'status', { unique: false });
          inbox.createIndex('by_created', 'createdAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this._initError = null; // Clear any previous error
        console.log('[StorageDB] Initialized successfully');
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[StorageDB] Failed to initialize:', event.target.error);
        this._initError = new Error(`Database error: ${event.target.error?.message || 'Unknown error'}`);
        reject(this._initError);
      };

      request.onblocked = () => {
        console.warn('[StorageDB] Database blocked - close other tabs');
        this._initError = new Error('Database blocked - please close other tabs using this app');
        reject(this._initError);
      };
    });

    return this._initPromise;
  },

  // Get initialization status for debugging
  getInitStatus() {
    return {
      isInitialized: this.db !== null,
      hasError: this._initError !== null,
      error: this._initError?.message || null,
      isInitializing: this._initPromise !== null && this.db === null
    };
  },

  // Generic transaction helper
  async _tx(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`_tx(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let result;
      try {
        result = callback(store);
      } catch (e) {
        reject(e);
        return;
      }

      tx.oncomplete = () => resolve(result?.result || result);
      tx.onerror = () => reject(tx.error);
    });
  },

  // CRUD operations
  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`get(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`put(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).put(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`delete(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`getAll(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`getByIndex(${storeName}, ${indexName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const index = tx.objectStore(storeName).index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  },

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`clear(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  async count(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`count(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readonly');
      const request = tx.objectStore(storeName).count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // Batch operations
  async putMany(storeName, items) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`putMany(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      items.forEach(item => store.put(item));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteMany(storeName, keys) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(notInitializedError(`deleteMany(${storeName})`));
        return;
      }

      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      keys.forEach(key => store.delete(key));

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  },

  // Check if database is ready
  isReady() {
    return this.db !== null;
  },

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this._initPromise = null;
    }
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: services/storage.adapter.js
// ═══════════════════════════════════════════════════════════════════

// services/storage.adapter.js
// Wraps IndexedDB with Write-Ahead Log for guaranteed durability

import { StorageDB } from './storage.db.js';

export const Storage = {
  db: null,

  async init() {
    this.db = await StorageDB.init();
    return this.db;
  },

  // ========================================
  // WRITE-AHEAD LOG (WAL) OPERATIONS
  // This is the heart of offline reliability
  // ========================================

  wal: {
    async add(mutation) {
      const record = {
        id: mutation.id || crypto.randomUUID(),
        collection: mutation.collection,
        operation: mutation.operation,
        docId: mutation.docId,
        payload: mutation.payload,
        timestamp: mutation.timestamp || Date.now(),
        status: 'pending', // pending | synced | failed_fatal
        retryCount: 0,
        idempotencyKey: `${mutation.collection}:${mutation.docId}:${mutation.operation}:${Date.now()}`
      };

      await StorageDB.put('wal', record);
      return record;
    },

    async getPending() {
      return StorageDB.getByIndex('wal', 'by_status', 'pending');
    },

    async getAll() {
      return StorageDB.getAll('wal');
    },

    async get(id) {
      return StorageDB.get('wal', id);
    },

    async updateStatus(id, status) {
      const record = await StorageDB.get('wal', id);
      if (record) {
        record.status = status;
        record.lastAttempt = Date.now();
        await StorageDB.put('wal', record);
      }
      return record;
    },

    async incrementRetry(id) {
      const record = await StorageDB.get('wal', id);
      if (record) {
        record.retryCount = (record.retryCount || 0) + 1;
        record.lastAttempt = Date.now();
        await StorageDB.put('wal', record);
      }
      return record;
    },

    async clearSynced(olderThan = 24 * 60 * 60 * 1000) {
      const all = await StorageDB.getAll('wal');
      const cutoff = Date.now() - olderThan;
      const toDelete = [];

      for (const record of all) {
        if (record.status === 'synced' && record.timestamp < cutoff) {
          toDelete.push(record.id);
        }
      }

      if (toDelete.length > 0) {
        await StorageDB.deleteMany('wal', toDelete);
      }

      return toDelete.length;
    },

    async getStats() {
      const all = await StorageDB.getAll('wal');
      return {
        pending: all.filter(r => r.status === 'pending').length,
        synced: all.filter(r => r.status === 'synced').length,
        failed: all.filter(r => r.status === 'failed_fatal').length,
        total: all.length
      };
    },

    async clear() {
      return StorageDB.clear('wal');
    },

    // Enforce max WAL size to prevent unbounded growth
    async enforceMaxSize(maxEntries = 1000) {
      const all = await StorageDB.getAll('wal');

      if (all.length <= maxEntries) {
        return 0;
      }

      // Sort by timestamp, oldest first
      all.sort((a, b) => a.timestamp - b.timestamp);

      // Delete oldest synced entries first, then oldest failed, keeping pending
      const toDelete = [];
      const pending = all.filter(r => r.status === 'pending');
      const synced = all.filter(r => r.status === 'synced');
      const failed = all.filter(r => r.status === 'failed_fatal');

      // Delete synced first (they're already in cloud)
      let excess = all.length - maxEntries;
      for (const record of synced) {
        if (excess <= 0) break;
        toDelete.push(record.id);
        excess--;
      }

      // Then delete old failed entries
      for (const record of failed) {
        if (excess <= 0) break;
        toDelete.push(record.id);
        excess--;
      }

      if (toDelete.length > 0) {
        await StorageDB.deleteMany('wal', toDelete);
        console.log(`[WAL] Cleaned up ${toDelete.length} entries to enforce max size`);
      }

      return toDelete.length;
    },

    // Auto-cleanup: clear synced entries older than 24h and enforce max size
    async autoCleanup() {
      const cleared = await this.clearSynced(24 * 60 * 60 * 1000);
      const enforced = await this.enforceMaxSize(1000);
      return { cleared, enforced };
    }
  },

  // ========================================
  // PATIENT OPERATIONS
  // ========================================

  patients: {
    async upsert(patient) {
      const record = {
        ...patient,
        id: patient.id || crypto.randomUUID(),
        updatedAt: patient.updatedAt || Date.now()
      };
      await StorageDB.put('patients', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('patients', id);
    },

    async getAll() {
      return StorageDB.getAll('patients');
    },

    async getByUnit(unitId) {
      return StorageDB.getByIndex('patients', 'by_unit', unitId);
    },

    async getActive(unitId) {
      const patients = await this.getByUnit(unitId);
      return patients.filter(p => !p.deleted && p.status !== 'archived');
    },

    async getDeleted() {
      return StorageDB.getByIndex('patients', 'by_deleted', true);
    },

    async softDelete(id) {
      const patient = await this.get(id);
      if (patient) {
        patient.deleted = true;
        patient.deletedAt = Date.now();
        await StorageDB.put('patients', patient);
      }
      return patient;
    },

    async restore(id) {
      const patient = await this.get(id);
      if (patient) {
        patient.deleted = false;
        patient.deletedAt = null;
        await StorageDB.put('patients', patient);
      }
      return patient;
    },

    async delete(id) {
      return StorageDB.delete('patients', id);
    },

    async clear() {
      return StorageDB.clear('patients');
    }
  },

  // ========================================
  // TASKS OPERATIONS
  // ========================================

  tasks: {
    async upsert(task) {
      const record = {
        ...task,
        id: task.id || crypto.randomUUID(),
        updatedAt: task.updatedAt || Date.now()
      };
      await StorageDB.put('tasks', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('tasks', id);
    },

    async getAll() {
      return StorageDB.getAll('tasks');
    },

    async getByPatient(patientId) {
      return StorageDB.getByIndex('tasks', 'by_patient', patientId);
    },

    async getCompleted() {
      return StorageDB.getByIndex('tasks', 'by_completed', true);
    },

    async getPending() {
      return StorageDB.getByIndex('tasks', 'by_completed', false);
    },

    async toggleComplete(id, completed) {
      const task = await StorageDB.get('tasks', id);
      if (task) {
        task.completed = completed;
        task.completedAt = completed ? Date.now() : null;
        task.updatedAt = Date.now();
        await StorageDB.put('tasks', task);
      }
      return task;
    },

    async delete(id) {
      return StorageDB.delete('tasks', id);
    },

    async clear() {
      return StorageDB.clear('tasks');
    }
  },

  // ========================================
  // UNITS OPERATIONS
  // ========================================

  units: {
    async upsert(unit) {
      const record = {
        ...unit,
        id: unit.id || crypto.randomUUID(),
        updatedAt: unit.updatedAt || Date.now()
      };
      await StorageDB.put('units', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('units', id);
    },

    async getAll() {
      return StorageDB.getAll('units');
    },

    async delete(id) {
      return StorageDB.delete('units', id);
    },

    async clear() {
      return StorageDB.clear('units');
    }
  },

  // ========================================
  // INBOX OPERATIONS
  // ========================================

  inbox: {
    async add(item) {
      const record = {
        ...item,
        id: item.id || crypto.randomUUID(),
        createdAt: item.createdAt || Date.now(),
        status: item.status || 'pending'
      };
      await StorageDB.put('inbox', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('inbox', id);
    },

    async getAll() {
      return StorageDB.getAll('inbox');
    },

    async getPending() {
      return StorageDB.getByIndex('inbox', 'by_status', 'pending');
    },

    async updateStatus(id, status) {
      const item = await this.get(id);
      if (item) {
        item.status = status;
        item.updatedAt = Date.now();
        await StorageDB.put('inbox', item);
      }
      return item;
    },

    async delete(id) {
      return StorageDB.delete('inbox', id);
    },

    async clear() {
      return StorageDB.clear('inbox');
    }
  },

  // ========================================
  // METADATA OPERATIONS
  // ========================================

  meta: {
    async get(key) {
      const record = await StorageDB.get('meta', key);
      return record?.value;
    },

    async set(key, value) {
      await StorageDB.put('meta', { key, value, updatedAt: Date.now() });
    },

    async delete(key) {
      return StorageDB.delete('meta', key);
    },

    async getAll() {
      const records = await StorageDB.getAll('meta');
      const result = {};
      records.forEach(r => {
        result[r.key] = r.value;
      });
      return result;
    }
  },

  // ========================================
  // TRASH OPERATIONS
  // ========================================

  trash: {
    async add(item, type) {
      const record = {
        ...item,
        id: item.id || crypto.randomUUID(),
        type,
        deletedAt: Date.now()
      };
      await StorageDB.put('trash', record);
      return record;
    },

    async get(id) {
      return StorageDB.get('trash', id);
    },

    async getAll() {
      return StorageDB.getAll('trash');
    },

    async getByType(type) {
      return StorageDB.getByIndex('trash', 'by_type', type);
    },

    async delete(id) {
      return StorageDB.delete('trash', id);
    },

    async clear() {
      return StorageDB.clear('trash');
    }
  },

  // ========================================
  // EXPORT/IMPORT FOR DEBUGGING
  // ========================================

  async exportAll() {
    return {
      patients: await StorageDB.getAll('patients'),
      tasks: await StorageDB.getAll('tasks'),
      units: await StorageDB.getAll('units'),
      wal: await StorageDB.getAll('wal'),
      meta: await StorageDB.getAll('meta'),
      inbox: await StorageDB.getAll('inbox'),
      trash: await StorageDB.getAll('trash'),
      exportedAt: Date.now()
    };
  },

  async importAll(data) {
    // Clear existing data
    await StorageDB.clear('patients');
    await StorageDB.clear('tasks');
    await StorageDB.clear('units');

    // Import new data
    if (data.patients?.length) {
      await StorageDB.putMany('patients', data.patients);
    }
    if (data.tasks?.length) {
      await StorageDB.putMany('tasks', data.tasks);
    }
    if (data.units?.length) {
      await StorageDB.putMany('units', data.units);
    }

    return true;
  },

  // ========================================
  // UTILITY
  // ========================================

  async getStats() {
    return {
      patients: await StorageDB.count('patients'),
      tasks: await StorageDB.count('tasks'),
      units: await StorageDB.count('units'),
      wal: await this.wal.getStats(),
      inbox: await StorageDB.count('inbox'),
      trash: await StorageDB.count('trash')
    };
  },

  isReady() {
    return StorageDB.isReady();
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: ui/toast.js
// ═══════════════════════════════════════════════════════════════════

// ui/components/toast.js
// Toast notification system

import { EventBus } from '../../core/core.events.js';
import { Config } from '../../core/config.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.queue = [];
    this.maxVisible = 3;
  }

  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }

    // Listen to events
    EventBus.on('toast:info', (msg) => this.show(msg, 'info'));
    EventBus.on('toast:success', (msg) => this.show(msg, 'success'));
    EventBus.on('toast:error', (msg) => this.show(msg, 'error'));
    EventBus.on('toast:warning', (msg) => this.show(msg, 'warning'));
  }

  show(message, type = 'info', duration = Config.TOAST_DURATION) {
    if (!this.container) {
      this.init();
    }

    // Limit visible toasts
    const visibleToasts = this.container.querySelectorAll('.toast:not(.toast-hiding)');
    if (visibleToasts.length >= this.maxVisible) {
      this.hide(visibleToasts[0]);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${this._escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.hide(toast);
    });

    // Click to dismiss
    toast.addEventListener('click', (e) => {
      if (e.target.classList.contains('toast')) {
        this.hide(toast);
      }
    });

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Auto-hide
    if (duration > 0) {
      const timeoutId = setTimeout(() => this.hide(toast), duration);
      toast._timeoutId = timeoutId;
    }

    return toast;
  }

  hide(toast) {
    if (!toast || toast._hiding) return;

    toast._hiding = true;

    // Clear auto-hide timeout
    if (toast._timeoutId) {
      clearTimeout(toast._timeoutId);
    }

    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }

  hideAll() {
    const toasts = this.container?.querySelectorAll('.toast') || [];
    toasts.forEach(toast => this.hide(toast));
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convenience methods
  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }
}

export const Toast = new ToastManager();


// ═══════════════════════════════════════════════════════════════════
// FILE: ui/modal.js
// ═══════════════════════════════════════════════════════════════════

// ui/components/modal.js
// Modal dialog component

import { EventBus } from '../../core/core.events.js';

class ModalManager {
  constructor() {
    this.activeModals = [];
    this._setupKeyboardListener();
  }

  _setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activeModals.length > 0) {
        const topModal = this.activeModals[this.activeModals.length - 1];
        if (topModal.closeable !== false) {
          this.close(topModal.id);
        }
      }
    });
  }

  create(options = {}) {
    const {
      id = `modal-${Date.now()}`,
      title = '',
      content = '',
      size = 'medium', // small, medium, large, fullscreen
      closeable = true,
      showHeader = true,
      showFooter = false,
      footerContent = '',
      onOpen = null,
      onClose = null,
      className = ''
    } = options;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = `modal-overlay ${className}`;
    overlay.id = id;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (title) overlay.setAttribute('aria-labelledby', `${id}-title`);

    // Create modal content
    overlay.innerHTML = `
      <div class="modal modal-${size}">
        ${showHeader ? `
          <div class="modal-header">
            <h3 id="${id}-title" class="modal-title">${title}</h3>
            ${closeable ? '<button class="modal-close" aria-label="Close">&times;</button>' : ''}
          </div>
        ` : ''}
        <div class="modal-body">
          ${content}
        </div>
        ${showFooter ? `
          <div class="modal-footer">
            ${footerContent}
          </div>
        ` : ''}
      </div>
    `;

    // Close on overlay click
    if (closeable) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close(id);
        }
      });

      const closeBtn = overlay.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close(id));
      }
    }

    // Track modal
    const modalData = { id, overlay, closeable, onClose };
    this.activeModals.push(modalData);

    // Add to DOM
    document.body.appendChild(overlay);

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('modal-visible');
    });

    // Focus trap
    this._setupFocusTrap(overlay);

    // Callback
    if (onOpen) onOpen(overlay);

    EventBus.emit('modal:opened', { id });

    return {
      id,
      element: overlay,
      close: () => this.close(id),
      setContent: (html) => {
        overlay.querySelector('.modal-body').innerHTML = html;
      },
      setTitle: (text) => {
        const titleEl = overlay.querySelector('.modal-title');
        if (titleEl) titleEl.textContent = text;
      }
    };
  }

  close(id) {
    const index = this.activeModals.findIndex(m => m.id === id);
    if (index === -1) return;

    const modalData = this.activeModals[index];
    const overlay = modalData.overlay;

    // Animate out
    overlay.classList.remove('modal-visible');

    setTimeout(() => {
      overlay.remove();

      // Remove from tracking
      this.activeModals.splice(index, 1);

      // Restore body scroll if no more modals
      if (this.activeModals.length === 0) {
        document.body.style.overflow = '';
      }

      // Callback
      if (modalData.onClose) modalData.onClose();

      EventBus.emit('modal:closed', { id });
    }, 200);
  }

  closeAll() {
    [...this.activeModals].forEach(modal => this.close(modal.id));
  }

  _setupFocusTrap(overlay) {
    const modal = overlay.querySelector('.modal');
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    modal.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    });
  }

  // Convenience methods
  alert(message, title = 'Alert') {
    return new Promise((resolve) => {
      this.create({
        title,
        content: `<p>${message}</p>`,
        size: 'small',
        showFooter: true,
        footerContent: '<button class="btn btn-primary modal-ok">OK</button>',
        onOpen: (overlay) => {
          overlay.querySelector('.modal-ok').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(true);
          });
        }
      });
    });
  }

  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const modal = this.create({
        title,
        content: `<p>${message}</p>`,
        size: 'small',
        showFooter: true,
        footerContent: `
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary modal-confirm">Confirm</button>
        `,
        onOpen: (overlay) => {
          overlay.querySelector('.modal-cancel').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(false);
          });
          overlay.querySelector('.modal-confirm').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(true);
          });
        },
        onClose: () => resolve(false)
      });
    });
  }

  prompt(message, defaultValue = '', title = 'Input') {
    return new Promise((resolve) => {
      this.create({
        title,
        content: `
          <p>${message}</p>
          <input type="text" class="form-input modal-input" value="${defaultValue}">
        `,
        size: 'small',
        showFooter: true,
        footerContent: `
          <button class="btn btn-secondary modal-cancel">Cancel</button>
          <button class="btn btn-primary modal-submit">Submit</button>
        `,
        onOpen: (overlay) => {
          const input = overlay.querySelector('.modal-input');
          input.focus();
          input.select();

          const submit = () => {
            this.close(overlay.id);
            resolve(input.value);
          };

          overlay.querySelector('.modal-cancel').addEventListener('click', () => {
            this.close(overlay.id);
            resolve(null);
          });
          overlay.querySelector('.modal-submit').addEventListener('click', submit);
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submit();
          });
        },
        onClose: () => resolve(null)
      });
    });
  }
}

export const Modal = new ModalManager();


// ═══════════════════════════════════════════════════════════════════
// FILE: monitor/monitor.js
// ═══════════════════════════════════════════════════════════════════

// monitor/monitor.core.js
// Logging, performance tracking, and debugging

import { Config } from '../core/config.js';

const MAX_EVENTS = Config.MAX_MONITOR_EVENTS;
const EVENT_TYPES = ['AUTH', 'SYNC', 'STORE', 'NET', 'UI', 'RUNTIME', 'CONSOLE', 'DATA', 'FUNCTIONS', 'PATIENT', 'TASK', 'UNIT', 'HANDOVER', 'AI'];
const LOG_LEVELS = ['info', 'warn', 'error'];

class MonitorCore {
  constructor() {
    this.events = [];
    this.subscribers = new Set();
    this.stats = {
      byLevel: { info: 0, warn: 0, error: 0 },
      byType: {}
    };
    this.startTime = Date.now();
    this.sessionId = this._generateSessionId();
    this._originalConsole = null;
  }

  _generateSessionId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  init() {
    // Instrument console for capturing
    this._instrumentConsole();

    // Capture unhandled errors
    window.addEventListener('error', (e) => {
      this.logError('UNCAUGHT_ERROR', e.error || new Error(e.message), {
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
      });
    });

    window.addEventListener('unhandledrejection', (e) => {
      this.logError('UNHANDLED_REJECTION', e.reason || new Error('Promise rejected'));
    });

    this.log('RUNTIME', 'Monitor initialized', { sessionId: this.sessionId });
  }

  _instrumentConsole() {
    if (this._originalConsole) return; // Already instrumented

    this._originalConsole = { ...console };

    console.error = (...args) => {
      this.log('CONSOLE', args.map(a => String(a)).join(' '), null, 'error');
      this._originalConsole.error(...args);
    };

    console.warn = (...args) => {
      this.log('CONSOLE', args.map(a => String(a)).join(' '), null, 'warn');
      this._originalConsole.warn(...args);
    };
  }

  log(type, message, data = null, level = 'info') {
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: Date.now(),
      type,
      message,
      data,
      level,
      sessionId: this.sessionId
    };

    // Add to buffer
    this.events.push(event);

    // Maintain max size
    if (this.events.length > MAX_EVENTS) {
      this.events.shift();
    }

    // Update stats
    this.stats.byLevel[level] = (this.stats.byLevel[level] || 0) + 1;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;

    // Notify subscribers
    this.subscribers.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        // Use original console to avoid infinite loop
        this._originalConsole?.error('[Monitor] Subscriber error:', e);
      }
    });

    // Console output in development
    if (Config.isDev && this._originalConsole) {
      const consoleFn = level === 'error' ? this._originalConsole.error :
                        level === 'warn' ? this._originalConsole.warn :
                        this._originalConsole.log;
      consoleFn(`[${type}] ${message}`, data || '');
    }

    return event;
  }

  logError(code, error, context = null) {
    return this.log('RUNTIME', `Error: ${code}`, {
      code,
      message: error?.message || String(error),
      stack: error?.stack,
      context
    }, 'error');
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  getAll(filters = {}) {
    let results = [...this.events];

    if (filters.type) {
      results = results.filter(e => e.type === filters.type);
    }
    if (filters.level) {
      results = results.filter(e => e.level === filters.level);
    }
    if (filters.since) {
      results = results.filter(e => e.timestamp >= filters.since);
    }
    if (filters.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(e =>
        e.message.toLowerCase().includes(search) ||
        JSON.stringify(e.data || '').toLowerCase().includes(search)
      );
    }

    return results;
  }

  getRecent(count = 50) {
    return this.events.slice(-count);
  }

  getErrors() {
    return this.events.filter(e => e.level === 'error');
  }

  getStats() {
    return {
      ...this.stats,
      totalEvents: this.events.length,
      uptime: Date.now() - this.startTime,
      sessionId: this.sessionId
    };
  }

  clear() {
    this.events = [];
    this.stats = { byLevel: { info: 0, warn: 0, error: 0 }, byType: {} };
    this.log('RUNTIME', 'Monitor cleared');
  }

  // Export for debugging
  export() {
    return {
      events: this.events,
      stats: this.getStats(),
      deviceInfo: this._getDeviceInfo(),
      exportedAt: Date.now()
    };
  }

  _getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: navigator.onLine,
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio || 1,
      platform: navigator.platform,
      cookiesEnabled: navigator.cookieEnabled
    };
  }

  // Performance tracking
  async timed(label, asyncFn) {
    const start = performance.now();
    try {
      const result = await asyncFn();
      const duration = performance.now() - start;
      this.log('RUNTIME', `${label} completed`, { duration: `${duration.toFixed(2)}ms` });
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.logError(`${label}_FAILED`, error, { duration: `${duration.toFixed(2)}ms` });
      throw error;
    }
  }

  // Mark performance point
  mark(name) {
    if (typeof performance.mark === 'function') {
      performance.mark(name);
      this.log('RUNTIME', `Performance mark: ${name}`);
    }
  }

  // Measure between marks
  measure(name, startMark, endMark) {
    if (typeof performance.measure === 'function') {
      try {
        const measure = performance.measure(name, startMark, endMark);
        this.log('RUNTIME', `Performance measure: ${name}`, { duration: `${measure.duration.toFixed(2)}ms` });
        return measure.duration;
      } catch (e) {
        // Marks might not exist
      }
    }
    return null;
  }

  // Get performance metrics
  getPerformanceMetrics() {
    if (!performance.getEntriesByType) {
      return null;
    }

    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');

    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd || null,
      loadComplete: navigation?.loadEventEnd || null,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || null,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null,
      timeToInteractive: navigation?.domInteractive || null
    };
  }

  // Debug helper - dump state
  dumpState(modules = {}) {
    const dump = {
      timestamp: Date.now(),
      sessionId: this.sessionId,
      uptime: Date.now() - this.startTime,
      deviceInfo: this._getDeviceInfo(),
      performanceMetrics: this.getPerformanceMetrics(),
      stats: this.getStats(),
      recentErrors: this.getErrors().slice(-10),
      modules: {}
    };

    // Include module states if provided
    for (const [name, module] of Object.entries(modules)) {
      try {
        if (typeof module.getSnapshot === 'function') {
          dump.modules[name] = module.getSnapshot();
        } else if (typeof module.getStats === 'function') {
          dump.modules[name] = module.getStats();
        }
      } catch (e) {
        dump.modules[name] = { error: e.message };
      }
    }

    return dump;
  }
}

export const Monitor = new MonitorCore();


// ═══════════════════════════════════════════════════════════════════
// FILE: data/reference-ranges.js
// ═══════════════════════════════════════════════════════════════════

// data/reference-ranges.js
// Kuwait SI Unit Reference Ranges
// As specified in the OnCall system

export const KUWAIT_REFERENCE_RANGES = {
  // ═══════════════════════════════════════════
  // RENAL FUNCTION
  // ═══════════════════════════════════════════
  'Creatinine': {
    low: 62, high: 106, unit: '\u03BCmol/L',
    criticalHigh: 500,
    conversion: { factor: 0.0113, toUnit: 'mg/dL' }
  },
  'Urea': {
    low: 2.5, high: 7.1, unit: 'mmol/L',
    conversion: { factor: 2.8, toUnit: 'mg/dL' }
  },
  'eGFR': { low: 90, high: 999, unit: 'mL/min/1.73m\u00B2' },

  // ═══════════════════════════════════════════
  // ELECTROLYTES
  // ═══════════════════════════════════════════
  'Sodium': {
    low: 136, high: 145, unit: 'mmol/L',
    criticalLow: 120, criticalHigh: 160
  },
  'Potassium': {
    low: 3.5, high: 5.0, unit: 'mmol/L',
    criticalLow: 2.5, criticalHigh: 6.5
  },
  'Chloride': { low: 98, high: 106, unit: 'mmol/L' },
  'Bicarbonate': { low: 22, high: 29, unit: 'mmol/L' },
  'Calcium': {
    low: 2.2, high: 2.6, unit: 'mmol/L',
    criticalLow: 1.6, criticalHigh: 3.5,
    conversion: { factor: 4, toUnit: 'mg/dL' }
  },
  'Phosphate': { low: 0.8, high: 1.5, unit: 'mmol/L' },
  'Magnesium': { low: 0.7, high: 1.0, unit: 'mmol/L' },

  // ═══════════════════════════════════════════
  // HEMATOLOGY
  // ═══════════════════════════════════════════
  'Hemoglobin': {
    low: 120, high: 160, unit: 'g/L',
    criticalLow: 70,
    conversion: { factor: 0.1, toUnit: 'g/dL' }
  },
  'WBC': { low: 4.0, high: 11.0, unit: '\u00D710\u2079/L' },
  'Platelets': {
    low: 150, high: 400, unit: '\u00D710\u2079/L',
    criticalLow: 20, criticalHigh: 1000
  },
  'Neutrophils': { low: 2.0, high: 7.5, unit: '\u00D710\u2079/L' },
  'Lymphocytes': { low: 1.0, high: 4.0, unit: '\u00D710\u2079/L' },
  'Hematocrit': { low: 0.36, high: 0.46, unit: 'L/L' },
  'MCV': { low: 80, high: 100, unit: 'fL' },
  'RDW': { low: 11.5, high: 14.5, unit: '%' },

  // ═══════════════════════════════════════════
  // COAGULATION
  // ═══════════════════════════════════════════
  'PT': { low: 11, high: 13.5, unit: 'seconds' },
  'INR': { low: 0.9, high: 1.1, unit: '' },
  'APTT': { low: 25, high: 35, unit: 'seconds' },
  'Fibrinogen': { low: 2, high: 4, unit: 'g/L' },
  'D-Dimer': { low: 0, high: 0.5, unit: 'mg/L FEU' },

  // ═══════════════════════════════════════════
  // LIVER FUNCTION
  // ═══════════════════════════════════════════
  'ALT': { low: 0, high: 40, unit: 'U/L' },
  'AST': { low: 0, high: 40, unit: 'U/L' },
  'ALP': { low: 40, high: 130, unit: 'U/L' },
  'GGT': { low: 0, high: 50, unit: 'U/L' },
  'Bilirubin': {
    low: 0, high: 21, unit: '\u03BCmol/L',
    conversion: { factor: 0.058, toUnit: 'mg/dL' }
  },
  'Direct Bilirubin': { low: 0, high: 5, unit: '\u03BCmol/L' },
  'Albumin': { low: 35, high: 50, unit: 'g/L' },
  'Total Protein': { low: 60, high: 80, unit: 'g/L' },
  'Ammonia': { low: 10, high: 47, unit: '\u03BCmol/L' },

  // ═══════════════════════════════════════════
  // CARDIAC MARKERS
  // ═══════════════════════════════════════════
  'Troponin': {
    low: 0, high: 0.04, unit: 'ng/mL',
    criticalHigh: 0.04
  },
  'Troponin-HS': { low: 0, high: 14, unit: 'ng/L' },
  'BNP': { low: 0, high: 100, unit: 'pg/mL' },
  'NT-proBNP': { low: 0, high: 300, unit: 'pg/mL' },
  'CK': { low: 30, high: 200, unit: 'U/L' },
  'CK-MB': { low: 0, high: 25, unit: 'U/L' },
  'LDH': { low: 140, high: 280, unit: 'U/L' },

  // ═══════════════════════════════════════════
  // INFLAMMATORY MARKERS
  // ═══════════════════════════════════════════
  'CRP': { low: 0, high: 5, unit: 'mg/L' },
  'ESR': { low: 0, high: 20, unit: 'mm/hr' },
  'Procalcitonin': {
    low: 0, high: 0.1, unit: 'ng/mL'
    // >0.5 suggests bacterial infection
    // >2.0 suggests severe sepsis
  },
  'Ferritin': { low: 30, high: 300, unit: '\u03BCg/L' },

  // ═══════════════════════════════════════════
  // METABOLIC
  // ═══════════════════════════════════════════
  'Glucose': {
    low: 4.0, high: 6.0, unit: 'mmol/L',
    criticalLow: 2.5, criticalHigh: 25,
    conversion: { factor: 18, toUnit: 'mg/dL' }
  },
  'HbA1c': {
    low: 20, high: 42, unit: 'mmol/mol',
    conversion: { formula: '(val/10.929) + 2.15', toUnit: '%' }
  },
  'Lactate': {
    low: 0.5, high: 2.0, unit: 'mmol/L',
    criticalHigh: 4.0
  },

  // ═══════════════════════════════════════════
  // THYROID
  // ═══════════════════════════════════════════
  'TSH': { low: 0.4, high: 4.0, unit: 'mIU/L' },
  'Free T4': { low: 12, high: 22, unit: 'pmol/L' },
  'Free T3': { low: 3.1, high: 6.8, unit: 'pmol/L' },

  // ═══════════════════════════════════════════
  // LIPIDS
  // ═══════════════════════════════════════════
  'Total Cholesterol': { low: 0, high: 5.2, unit: 'mmol/L' },
  'LDL': { low: 0, high: 2.6, unit: 'mmol/L' },
  'HDL': { low: 1.0, high: 999, unit: 'mmol/L' },
  'Triglycerides': { low: 0, high: 1.7, unit: 'mmol/L' },

  // ═══════════════════════════════════════════
  // ARTERIAL BLOOD GAS
  // ═══════════════════════════════════════════
  'pH': { low: 7.35, high: 7.45, unit: '', criticalLow: 7.2, criticalHigh: 7.6 },
  'pCO2': { low: 35, high: 45, unit: 'mmHg' },
  'pO2': { low: 80, high: 100, unit: 'mmHg', criticalLow: 60 },
  'HCO3': { low: 22, high: 26, unit: 'mmol/L' },
  'Base Excess': { low: -2, high: 2, unit: 'mmol/L' },
  'Anion Gap': { low: 8, high: 12, unit: 'mmol/L' }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: data/drug-database.js
// ═══════════════════════════════════════════════════════════════════

/**
 * Local Drug Reference Database
 * Common medications for quick reference during ward rounds
 */
export const DrugDatabase = {
  categories: [
    'antibiotics',
    'cardiovascular',
    'analgesics',
    'anticoagulants',
    'diabetes',
    'respiratory',
    'gi',
    'electrolytes'
  ],

  drugs: {
    antibiotics: [
      {
        name: 'Amoxicillin/Clavulanate',
        brand: 'Augmentin',
        route: 'PO/IV',
        commonDose: '625mg PO TDS or 1.2g IV TDS',
        indication: 'Community-acquired pneumonia, UTI, skin/soft tissue',
        warnings: ['Hepatotoxicity risk', 'C. difficile risk']
      },
      {
        name: 'Piperacillin/Tazobactam',
        brand: 'Tazocin',
        route: 'IV',
        commonDose: '4.5g IV Q6-8H',
        indication: 'Broad-spectrum: intra-abdominal, HAP, febrile neutropenia',
        warnings: ['Renal dose adjustment', 'Sodium load']
      },
      {
        name: 'Ceftriaxone',
        brand: 'Rocephin',
        route: 'IV/IM',
        commonDose: '1-2g IV OD',
        indication: 'Meningitis, pneumonia, UTI, gonorrhea',
        warnings: ['Do not mix with calcium-containing IV fluids']
      },
      {
        name: 'Vancomycin',
        brand: 'Vancocin',
        route: 'IV',
        commonDose: '15-20mg/kg IV Q8-12H (target trough)',
        indication: 'MRSA infections, C. difficile (PO)',
        warnings: ['Monitor trough levels', 'Red man syndrome', 'Nephrotoxicity']
      },
      {
        name: 'Meropenem',
        brand: 'Merrem',
        route: 'IV',
        commonDose: '1g IV Q8H (2g for meningitis)',
        indication: 'Severe sepsis, multi-drug resistant organisms',
        warnings: ['Seizure risk', 'Renal dose adjustment']
      },
      {
        name: 'Metronidazole',
        brand: 'Flagyl',
        route: 'PO/IV',
        commonDose: '500mg PO/IV TDS',
        indication: 'Anaerobic infections, C. difficile, H. pylori',
        warnings: ['Disulfiram-like reaction with alcohol', 'Peripheral neuropathy']
      }
    ],

    cardiovascular: [
      {
        name: 'Metoprolol',
        brand: 'Lopressor',
        route: 'PO/IV',
        commonDose: '25-100mg PO BD; 5mg IV (acute)',
        indication: 'Hypertension, heart failure, rate control in AF',
        warnings: ['Bradycardia', 'Bronchospasm', 'Do not stop abruptly']
      },
      {
        name: 'Amlodipine',
        brand: 'Norvasc',
        route: 'PO',
        commonDose: '5-10mg PO OD',
        indication: 'Hypertension, angina',
        warnings: ['Peripheral edema', 'Hepatic dose adjustment']
      },
      {
        name: 'Furosemide',
        brand: 'Lasix',
        route: 'PO/IV',
        commonDose: '20-80mg PO/IV (titrate to response)',
        indication: 'Edema, heart failure, acute pulmonary edema',
        warnings: ['Electrolyte monitoring (K+, Na+, Mg2+)', 'Ototoxicity']
      }
    ],

    analgesics: [
      {
        name: 'Paracetamol (Acetaminophen)',
        brand: 'Tylenol/Panadol',
        route: 'PO/IV/PR',
        commonDose: '1g PO/IV Q6H (max 4g/day)',
        indication: 'Pain, fever',
        warnings: ['Hepatotoxicity if >4g/day', 'Reduce dose in liver disease']
      },
      {
        name: 'Morphine',
        brand: 'MS Contin',
        route: 'PO/IV/SC',
        commonDose: '2.5-10mg IV PRN Q4H; 10-30mg PO Q4H',
        indication: 'Severe pain, acute MI, pulmonary edema',
        warnings: ['Respiratory depression', 'Constipation', 'Renal adjustment']
      },
      {
        name: 'Ibuprofen',
        brand: 'Advil/Nurofen',
        route: 'PO',
        commonDose: '400-600mg PO TDS with food',
        indication: 'Pain, inflammation, fever',
        warnings: ['GI bleeding', 'Renal impairment', 'CV risk']
      }
    ],

    anticoagulants: [
      {
        name: 'Enoxaparin',
        brand: 'Clexane/Lovenox',
        route: 'SC',
        commonDose: 'Prophylaxis: 40mg SC OD; Treatment: 1mg/kg SC BD',
        indication: 'DVT/PE prophylaxis and treatment',
        warnings: ['Monitor anti-Xa if renal impairment', 'Adjust for weight/CrCl']
      },
      {
        name: 'Heparin (Unfractionated)',
        brand: 'Heparin',
        route: 'IV/SC',
        commonDose: 'Per protocol (bolus + infusion, target aPTT)',
        indication: 'VTE treatment, ACS, bridge therapy',
        warnings: ['HIT risk', 'Monitor aPTT', 'Protamine for reversal']
      },
      {
        name: 'Warfarin',
        brand: 'Coumadin',
        route: 'PO',
        commonDose: 'Variable - target INR 2-3 (2.5-3.5 for mechanical valve)',
        indication: 'AF, mechanical valve, VTE',
        warnings: ['Numerous drug interactions', 'Monitor INR', 'Vitamin K for reversal']
      }
    ],

    diabetes: [
      {
        name: 'Insulin (Regular)',
        brand: 'Actrapid/Humulin R',
        route: 'IV/SC',
        commonDose: 'Per sliding scale or infusion protocol',
        indication: 'Hyperglycemia, DKA',
        warnings: ['Hypoglycemia', 'Monitor potassium']
      },
      {
        name: 'Metformin',
        brand: 'Glucophage',
        route: 'PO',
        commonDose: '500-1000mg PO BD',
        indication: 'Type 2 diabetes',
        warnings: ['Hold if eGFR <30', 'Hold before contrast', 'Lactic acidosis risk']
      }
    ],

    electrolytes: [
      {
        name: 'Potassium Chloride',
        brand: 'KCl',
        route: 'PO/IV',
        commonDose: 'PO: 20-40 mEq; IV: 10-20 mEq/hr (max 40 mEq/hr via central)',
        indication: 'Hypokalemia',
        warnings: ['Cardiac monitoring if IV >10 mEq/hr', 'Check Mg2+ concurrently']
      },
      {
        name: 'Magnesium Sulfate',
        brand: 'MgSO4',
        route: 'IV',
        commonDose: '2g IV over 1 hour (replacement)',
        indication: 'Hypomagnesemia, eclampsia, torsades',
        warnings: ['Monitor reflexes', 'Renal dose adjustment']
      }
    ]
  },

  /**
   * Get drugs by category
   */
  getByCategory(category) {
    return this.drugs[category] || [];
  },

  /**
   * Search drugs by name
   */
  search(query) {
    if (!query) return [];
    const q = query.toLowerCase();
    const results = [];

    for (const [category, drugs] of Object.entries(this.drugs)) {
      for (const drug of drugs) {
        if (drug.name.toLowerCase().includes(q) ||
            drug.brand.toLowerCase().includes(q) ||
            drug.indication.toLowerCase().includes(q)) {
          results.push({ ...drug, category });
        }
      }
    }

    return results;
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: data/clinical-tasks.js
// ═══════════════════════════════════════════════════════════════════

/**
 * Clinical Task Database
 * Organized by category with common ward tasks
 * Supports fuzzy matching and smart suggestions
 */
export const ClinicalTasks = {
  labs: [
    // Routine
    { id: 'cbc', text: 'Order CBC', keywords: ['blood count', 'hemoglobin', 'wbc', 'platelets'] },
    { id: 'bmp', text: 'Order BMP', keywords: ['metabolic', 'electrolytes', 'creatinine', 'bun'] },
    { id: 'cmp', text: 'Order CMP', keywords: ['comprehensive', 'liver', 'albumin'] },
    { id: 'lfts', text: 'Order LFTs', keywords: ['liver function', 'ast', 'alt', 'bilirubin'] },
    { id: 'coags', text: 'Order Coagulation Panel', keywords: ['pt', 'inr', 'ptt', 'clotting'] },
    { id: 'tsh', text: 'Order TSH', keywords: ['thyroid'] },
    { id: 'hba1c', text: 'Order HbA1c', keywords: ['diabetes', 'glucose', 'sugar'] },
    { id: 'lipids', text: 'Order Lipid Panel', keywords: ['cholesterol', 'triglycerides', 'ldl', 'hdl'] },

    // Urgent
    { id: 'troponin', text: 'Order Troponin', keywords: ['cardiac', 'mi', 'chest pain', 'acs'], urgent: true },
    { id: 'abg', text: 'Order ABG', keywords: ['arterial', 'blood gas', 'respiratory', 'acidosis'], urgent: true },
    { id: 'lactate', text: 'Order Lactate', keywords: ['sepsis', 'shock', 'perfusion'], urgent: true },
    { id: 'dimer', text: 'Order D-Dimer', keywords: ['pe', 'dvt', 'clot', 'embolism'], urgent: true },
    { id: 'bnp', text: 'Order BNP/NT-proBNP', keywords: ['heart failure', 'chf', 'dyspnea'], urgent: true },

    // Cultures
    { id: 'bcx', text: 'Order Blood Cultures x2', keywords: ['sepsis', 'fever', 'infection'] },
    { id: 'ucx', text: 'Order Urine Culture', keywords: ['uti', 'dysuria'] },
    { id: 'sputum', text: 'Order Sputum Culture', keywords: ['pneumonia', 'respiratory'] },

    // Specific
    { id: 'ue', text: 'Order U&E', keywords: ['urea', 'electrolytes', 'potassium', 'sodium'] },
    { id: 'mg', text: 'Order Magnesium', keywords: ['mg', 'electrolyte'] },
    { id: 'phos', text: 'Order Phosphate', keywords: ['phosphorus'] },
    { id: 'ca', text: 'Order Calcium', keywords: ['hypercalcemia', 'hypocalcemia'] },
    { id: 'iron', text: 'Order Iron Studies', keywords: ['ferritin', 'tibc', 'anemia'] },
    { id: 'b12', text: 'Order B12/Folate', keywords: ['anemia', 'macrocytic'] },
    { id: 'crp', text: 'Order CRP', keywords: ['inflammation', 'infection'] },
    { id: 'esr', text: 'Order ESR', keywords: ['sed rate', 'inflammation'] },
    { id: 'procal', text: 'Order Procalcitonin', keywords: ['sepsis', 'bacterial'] },
    { id: 'ammonia', text: 'Order Ammonia', keywords: ['encephalopathy', 'liver'] },
    { id: 'cortisol', text: 'Order Cortisol', keywords: ['adrenal', 'addison'] },
  ],

  imaging: [
    // X-rays
    { id: 'cxr', text: 'Order CXR', keywords: ['chest xray', 'pneumonia', 'effusion'] },
    { id: 'axr', text: 'Order AXR', keywords: ['abdominal xray', 'obstruction', 'constipation'] },

    // CT
    { id: 'ct-head', text: 'Order CT Head', keywords: ['stroke', 'bleed', 'mental status'], urgent: true },
    { id: 'ct-chest', text: 'Order CT Chest', keywords: ['pe', 'lung', 'mass'] },
    { id: 'ct-abd', text: 'Order CT Abdomen/Pelvis', keywords: ['appendicitis', 'abscess', 'obstruction'] },
    { id: 'cta-pe', text: 'Order CTA Chest (PE Protocol)', keywords: ['pulmonary embolism'], urgent: true },
    { id: 'cta-head', text: 'Order CTA Head/Neck', keywords: ['stroke', 'dissection'], urgent: true },

    // Ultrasound
    { id: 'us-abd', text: 'Order US Abdomen', keywords: ['gallbladder', 'liver', 'kidney'] },
    { id: 'us-doppler', text: 'Order Doppler US (DVT)', keywords: ['leg swelling', 'clot'] },
    { id: 'us-renal', text: 'Order Renal US', keywords: ['kidney', 'hydronephrosis', 'aki'] },
    { id: 'echo', text: 'Order Echocardiogram', keywords: ['heart', 'ef', 'valve', 'chf'] },

    // MRI
    { id: 'mri-brain', text: 'Order MRI Brain', keywords: ['stroke', 'tumor', 'ms'] },
    { id: 'mri-spine', text: 'Order MRI Spine', keywords: ['cord compression', 'back pain'] },
    { id: 'mrcp', text: 'Order MRCP', keywords: ['biliary', 'pancreas', 'stones'] },
  ],

  consults: [
    { id: 'cards', text: 'Consult Cardiology', keywords: ['heart', 'arrhythmia', 'mi', 'chf'] },
    { id: 'gi', text: 'Consult GI', keywords: ['liver', 'bleed', 'endoscopy'] },
    { id: 'pulm', text: 'Consult Pulmonology', keywords: ['lung', 'copd', 'respiratory'] },
    { id: 'renal', text: 'Consult Nephrology', keywords: ['kidney', 'dialysis', 'aki'] },
    { id: 'neuro', text: 'Consult Neurology', keywords: ['stroke', 'seizure', 'mental status'] },
    { id: 'id', text: 'Consult Infectious Disease', keywords: ['sepsis', 'antibiotic', 'fever'] },
    { id: 'endo', text: 'Consult Endocrinology', keywords: ['diabetes', 'thyroid', 'adrenal'] },
    { id: 'heme', text: 'Consult Hematology', keywords: ['anemia', 'clotting', 'cancer'] },
    { id: 'onc', text: 'Consult Oncology', keywords: ['cancer', 'tumor', 'chemo'] },
    { id: 'surgery', text: 'Consult Surgery', keywords: ['acute abdomen', 'appendix'] },
    { id: 'ortho', text: 'Consult Orthopedics', keywords: ['fracture', 'bone', 'joint'] },
    { id: 'psych', text: 'Consult Psychiatry', keywords: ['depression', 'suicide', 'agitation'] },
    { id: 'palliative', text: 'Consult Palliative Care', keywords: ['goals of care', 'comfort', 'hospice'] },
    { id: 'sw', text: 'Consult Social Work', keywords: ['discharge', 'placement', 'resources'] },
    { id: 'pt', text: 'Consult PT/OT', keywords: ['mobility', 'rehab', 'therapy'] },
    { id: 'nutrition', text: 'Consult Nutrition', keywords: ['diet', 'feeding', 'tpn'] },
    { id: 'pharmacy', text: 'Consult Pharmacy', keywords: ['medication', 'dosing', 'interaction'] },
  ],

  admin: [
    { id: 'dc-summary', text: 'Write Discharge Summary', keywords: ['discharge', 'paperwork'] },
    { id: 'sick-leave', text: 'Write Sick Leave Certificate', keywords: ['certificate', 'work'] },
    { id: 'transfer', text: 'Arrange Transfer', keywords: ['icu', 'floor', 'facility'] },
    { id: 'family-meeting', text: 'Schedule Family Meeting', keywords: ['goals', 'discussion'] },
    { id: 'update-pcp', text: 'Update PCP', keywords: ['primary care', 'communication'] },
    { id: 'code-status', text: 'Discuss Code Status', keywords: ['dnr', 'resuscitation', 'goals'] },
    { id: 'consent', text: 'Obtain Procedure Consent', keywords: ['informed consent', 'procedure'] },
    { id: 'referral', text: 'Write Outpatient Referral', keywords: ['follow up', 'clinic'] },
    { id: 'med-rec', text: 'Complete Medication Reconciliation', keywords: ['meds', 'home medications'] },
  ],

  procedures: [
    { id: 'iv', text: 'Place IV Access', keywords: ['cannula', 'line'] },
    { id: 'foley', text: 'Insert Foley Catheter', keywords: ['urinary', 'catheter'] },
    { id: 'ng', text: 'Insert NG Tube', keywords: ['nasogastric', 'feeding'] },
    { id: 'abg-draw', text: 'Draw ABG', keywords: ['arterial', 'blood gas'] },
    { id: 'lp', text: 'Perform Lumbar Puncture', keywords: ['spinal tap', 'csf', 'meningitis'] },
    { id: 'paracentesis', text: 'Perform Paracentesis', keywords: ['ascites', 'tap'] },
    { id: 'thoracentesis', text: 'Perform Thoracentesis', keywords: ['effusion', 'tap'] },
    { id: 'central-line', text: 'Place Central Line', keywords: ['cvc', 'ij', 'subclavian'] },
    { id: 'art-line', text: 'Place Arterial Line', keywords: ['a-line', 'bp monitoring'] },
  ],

  medications: [
    { id: 'abx-start', text: 'Start Antibiotics', keywords: ['infection', 'sepsis'] },
    { id: 'pain-mgmt', text: 'Adjust Pain Management', keywords: ['analgesia', 'prn'] },
    { id: 'insulin', text: 'Adjust Insulin Regimen', keywords: ['glucose', 'diabetes'] },
    { id: 'anticoag', text: 'Start/Adjust Anticoagulation', keywords: ['heparin', 'warfarin', 'dvt'] },
    { id: 'diuresis', text: 'Adjust Diuretics', keywords: ['lasix', 'fluid', 'chf'] },
    { id: 'pressors', text: 'Titrate Pressors', keywords: ['vasopressor', 'bp', 'shock'], urgent: true },
    { id: 'fluids', text: 'Order IV Fluids', keywords: ['hydration', 'resuscitation'] },
    { id: 'electrolytes', text: 'Replete Electrolytes', keywords: ['potassium', 'magnesium', 'phosphorus'] },
    { id: 'sedation', text: 'Adjust Sedation', keywords: ['agitation', 'delirium'] },
    { id: 'prn-review', text: 'Review PRN Medications', keywords: ['as needed', 'protocol'] },
  ],

  monitoring: [
    { id: 'vitals-freq', text: 'Increase Vital Sign Frequency', keywords: ['monitoring', 'q1h', 'q2h'] },
    { id: 'tele', text: 'Place on Telemetry', keywords: ['cardiac monitor', 'arrhythmia'] },
    { id: 'neuro-checks', text: 'Neuro Checks q2h', keywords: ['neurological', 'stroke'] },
    { id: 'strict-io', text: 'Strict I/O Monitoring', keywords: ['intake', 'output', 'fluid'] },
    { id: 'daily-weight', text: 'Daily Weights', keywords: ['fluid', 'chf'] },
    { id: 'cbg', text: 'CBG Monitoring', keywords: ['glucose', 'fingerstick', 'diabetes'] },
    { id: 'fall-precautions', text: 'Fall Precautions', keywords: ['safety', 'risk'] },
    { id: 'aspiration', text: 'Aspiration Precautions', keywords: ['swallow', 'npo'] },
    { id: 'isolation', text: 'Place on Isolation', keywords: ['contact', 'droplet', 'airborne'] },
  ]
};

/**
 * Get all tasks as flat array
 */
export function getAllTasks() {
  const all = [];
  for (const [category, tasks] of Object.entries(ClinicalTasks)) {
    tasks.forEach(task => {
      all.push({ ...task, category });
    });
  }
  return all;
}

/**
 * Get tasks by category
 */
export function getTasksByCategory(category) {
  return ClinicalTasks[category] || [];
}

/**
 * Get categories list
 */
export function getCategories() {
  return Object.keys(ClinicalTasks);
}


// ═══════════════════════════════════════════════════════════════════
// FILE: data/ai-prompts.js
// ═══════════════════════════════════════════════════════════════════

// features/ai/ai.prompts.js
// AI prompt templates for clinical decision support

export const AIPrompts = {
  // System prompt for clinical assistant
  systemPrompt: `You are a clinical decision support assistant for healthcare professionals.
Provide evidence-based guidance. Always cite sources when possible (guidelines, UpToDate, etc.).
Structure responses with: Assessment, Red Flags, Recommendations, References.
IMPORTANT: This is for educational purposes. Always recommend consulting specialists for complex cases.
Do not provide definitive diagnoses or treatment decisions without proper clinical evaluation.`,

  // Drug information template
  drugInfo: (drugName, indication) => `
Provide drug information for: ${drugName}
${indication ? `Indication context: ${indication}` : ''}

Format response as:
1. **Drug Class**
2. **Mechanism of Action**
3. **Dosing** (adult, renal/hepatic adjustments)
4. **Contraindications**
5. **Major Interactions**
6. **Monitoring**
7. **Common Side Effects**
8. **References** (cite BNF, UpToDate, or guidelines)
`,

  // Antibiotic guidance template
  antibioticGuidance: (condition, factors) => `
Antibiotic guidance needed for: ${condition}

Patient factors:
- Age group: ${factors.ageGroup || 'adult'}
- Allergies: ${factors.allergies?.join(', ') || 'NKDA'}
- Renal function: ${factors.renalFunction || 'normal'}
- Recent antibiotics: ${factors.recentAbx || 'none'}
- MRSA risk: ${factors.mrsaRisk || 'low'}
- Severe/septic: ${factors.severe ? 'yes' : 'no'}

Provide:
1. **First-line empiric therapy**
2. **Alternative for penicillin allergy**
3. **Dose and duration**
4. **De-escalation guidance**
5. **Local resistance considerations**
6. **Reference guidelines** (NICE, IDSA, local protocols)
`,

  // Differential diagnosis template
  differentialDx: (presentation) => `
Generate a differential diagnosis for: ${presentation}

Format:
1. **Most Likely** (top 3 diagnoses with brief reasoning)
2. **Must Not Miss** (dangerous diagnoses to rule out)
3. **Key differentiating features**
4. **Recommended initial workup**
5. **Red flags for immediate concern**
`,

  // Treatment approach template
  treatmentApproach: (condition) => `
Provide treatment approach for: ${condition}

Structure:
1. **Initial stabilization** (if applicable)
2. **First-line treatment**
3. **Second-line options**
4. **Monitoring parameters**
5. **Expected response timeline**
6. **When to escalate/consult**
7. **Key guidelines referenced**
`,

  // Investigation workup template
  investigationWorkup: (presentation) => `
What investigations should be ordered for: ${presentation}

Organize by:
1. **Immediate/bedside** (ECG, glucose, etc.)
2. **Laboratory** (with rationale for each)
3. **Imaging** (with timing and type)
4. **Special tests** (if indicated)
5. **Interpretation tips**
`,

  // Handover summary template
  handoverSummary: (patientContext) => `
Generate a concise handover summary for a patient with:
- Diagnosis: ${patientContext.diagnosis || 'Not specified'}
- Current status: ${patientContext.status || 'active'}
- Pending tasks: ${patientContext.pendingTasks?.length || 0}
${patientContext.keyFindings ? `- Key findings: ${patientContext.keyFindings}` : ''}

Format as:
1. **One-liner** (brief summary)
2. **Background** (relevant history)
3. **Assessment** (current state)
4. **Plan** (pending items and monitoring)
5. **Concerns** (things to watch for)
`,

  // On-call query template
  onCallQuery: (query) => `
On-call query: ${query}

Provide practical guidance for a junior doctor covering overnight including:
1. **Immediate actions** (what to do right now)
2. **Can it wait?** (urgency assessment)
3. **Who to call if needed**
4. **Documentation points**
5. **Safety netting advice**
`,

  // Pre-built clinical scenarios
  scenarios: {
    sepsisWorkup: {
      title: 'Sepsis Workup',
      prompt: `What is the standard sepsis workup and initial management?

Include:
1. Sepsis-3 criteria
2. Hour-1 bundle components
3. Empiric antibiotic selection
4. Fluid resuscitation guidance
5. Vasopressor initiation criteria
6. Source control considerations`
    },

    chestPain: {
      title: 'Chest Pain Approach',
      prompt: `What is the systematic approach to acute chest pain?

Cover:
1. Immediate assessment (vital signs, ECG)
2. HEART score calculation
3. Must-rule-out diagnoses (ACS, PE, dissection, tension pneumo)
4. Investigation pathway
5. Risk stratification
6. Disposition decisions`
    },

    aki: {
      title: 'Acute Kidney Injury',
      prompt: `How should acute kidney injury be evaluated and managed?

Address:
1. KDIGO staging criteria
2. Pre-renal vs intrinsic vs post-renal
3. Initial workup (labs, imaging, urinalysis)
4. Medication review (nephrotoxins)
5. Fluid management
6. Indications for nephrology consult/dialysis`
    },

    hyperkalemia: {
      title: 'Hyperkalemia Management',
      prompt: `What is the emergency management of hyperkalemia?

Include:
1. ECG changes to look for
2. Cardiac stabilization (calcium)
3. Redistribution therapies (insulin/dextrose, salbutamol)
4. Elimination therapies (diuretics, resins, dialysis)
5. Monitoring frequency
6. When to call nephrology/ICU`
    },

    stroke: {
      title: 'Acute Stroke Management',
      prompt: `What are the key steps in acute stroke management?

Cover:
1. Time-critical actions (door-to-needle)
2. NIHSS key components
3. CT interpretation (ASPECTS score basics)
4. tPA eligibility criteria and contraindications
5. Blood pressure targets
6. Thrombectomy considerations`
    }
  },

  // Get scenario by key
  getScenario(key) {
    return this.scenarios[key] || null;
  },

  // List all scenarios
  listScenarios() {
    return Object.entries(this.scenarios).map(([key, value]) => ({
      key,
      title: value.title
    }));
  }
};


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/config.js
// ═══════════════════════════════════════════════════════════════════

// config.js
// Unified configuration for MedWard Pro Cloud Functions

const UNIFIED_CONFIG = {
  // ── Claude AI ──────────────────────────────────────
  CLAUDE: {
    MODEL: "claude-haiku-4-5-20251001",
    MAX_TOKENS: 8000,
    TEMPERATURE: 0.3
  },

  // ── Input limits ───────────────────────────────────
  MAX_TEXT_CHARS: 10000,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGES_PER_REQUEST: 5,

  // ── Cache ──────────────────────────────────────────
  CACHE_TTL_SECONDS: 3600, // 1 hour

  // ── Timeouts ───────────────────────────────────────
  TEXT_TIMEOUT_SECONDS: 60,
  VISION_TIMEOUT_SECONDS: 90
};

module.exports = { UNIFIED_CONFIG };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/prompts.js
// ═══════════════════════════════════════════════════════════════════

// prompts.js
// System prompts for all Claude AI interactions

const SYSTEM_PROMPTS = {
  // ── MedWard Clinical Q&A ───────────────────────────
  MEDWARD_CLINICAL: `You are a clinical decision support assistant for hospital physicians in Kuwait.
Use Kuwait SI units throughout (mmol/L, \u03BCmol/L, g/L, etc.).

You provide evidence-based clinical guidance for:
- Differential diagnosis
- Treatment approaches and management plans
- Lab interpretation with delta analysis
- Drug information with renal/hepatic dosing adjustments
- Clinical guidelines and protocols

Structure your responses with clear headers and bullet points.
Always highlight red flags and time-critical actions first.
This is for educational support only \u2013 always remind clinicians to use their own judgment.`,

  // ── OnCall Clinical Q&A ────────────────────────────
  ONCALL_CLINICAL: `You are an on-call clinical decision support assistant for junior doctors in Kuwait.
Use Kuwait SI units throughout (mmol/L, \u03BCmol/L, g/L, etc.).

Provide practical guidance for overnight and on-call scenarios:
1. **Immediate actions** \u2013 what to do right now
2. **Can it wait?** \u2013 urgency assessment
3. **Who to call if needed** \u2013 escalation guidance
4. **Documentation points** \u2013 what to chart
5. **Safety netting advice** \u2013 what to watch for

Be concise, action-oriented, and prioritise patient safety.
This is for educational support only \u2013 always remind clinicians to use their own judgment.`,

  // ── Differential Diagnosis ─────────────────────────
  DIFFERENTIAL: `You are a clinical reasoning specialist assisting physicians in Kuwait.
Use Kuwait SI units throughout.

Generate differential diagnoses in this format:
1. **Most Likely** (top 3 diagnoses with brief reasoning)
2. **Must Not Miss** (dangerous diagnoses to rule out)
3. **Key differentiating features** for each
4. **Recommended initial workup** (labs, imaging, bedside)
5. **Red flags for immediate concern**

Prioritise by probability and clinical urgency.
This is for educational support only.`,

  // ── Treatment Plan ─────────────────────────────────
  TREATMENT: `You are a clinical therapeutics specialist in Kuwait.
Use Kuwait SI units and local formulary considerations.

Provide treatment guidance in this format:
1. **Initial stabilisation** (if applicable)
2. **First-line treatment** with doses
3. **Second-line options**
4. **Monitoring parameters** and frequency
5. **Expected response timeline**
6. **When to escalate / consult**
7. **Key guidelines referenced**

This is for educational support only.`,

  // ── Drug Interaction ───────────────────────────────
  DRUG_INTERACTION: `You are a clinical pharmacologist in Kuwait.
Use Kuwait SI units. Focus on practical drug interaction guidance.

For each interaction pair provide:
1. **Severity** (major / moderate / minor)
2. **Mechanism** of interaction
3. **Clinical effect** expected
4. **Management** \u2013 avoid, adjust dose, or monitor
5. **Monitoring parameters**
6. **Alternative agents** if the combination must be avoided

This is for educational support only.`,

  // ── Electrolyte Verification ───────────────────────
  ELECTROLYTE: `You are a nephrology and electrolyte specialist in Kuwait.
Use Kuwait SI units throughout.

Verify electrolyte correction calculations and provide:
1. **Current values** and target values
2. **Deficit / excess** calculation
3. **Recommended replacement** regimen (fluid, rate, route)
4. **Monitoring schedule** (frequency, parameters)
5. **Safety checks** (max infusion rate, cardiac monitoring)
6. **Expected correction timeline**
7. **When to re-check labs**

Return JSON with fields: verification, calculations, regimen, monitoring, warnings.
This is for educational support only.`,

  // ── Ventilator Settings ────────────────────────────
  VENTILATOR: `You are a critical care and respiratory specialist in Kuwait.
Use Kuwait SI units throughout.

Provide ventilator setting guidance including:
1. **Mode recommendation** with rationale
2. **Initial settings** (Vt, RR, FiO2, PEEP)
3. **Adjustment guidance** based on ABG
4. **Lung-protective targets** (Pplat < 30, driving pressure < 15)
5. **Weaning criteria** and protocol
6. **Alarm settings** recommended
7. **Troubleshooting** common issues

Return JSON with fields: mode, settings, targets, adjustments, weaning.
This is for educational support only.`,

  // ── Lab Image Analysis (Vision) ────────────────────
  LAB_ANALYSIS: `You are a clinical laboratory medicine specialist.
Use Kuwait SI units throughout (mmol/L, \u03BCmol/L, g/L, etc.).

Analyze the provided lab report image following this structure:

1. **CRITICAL VALUES** (if any)
   - Flag immediately dangerous values requiring urgent action

2. **INTERPRETATION**
   - Explain each abnormality
   - Note clinically significant changes

3. **CLINICAL CORRELATION**
   - Connect abnormalities to potential diagnoses
   - Explain the physiological mechanisms

4. **PATTERN RECOGNITION**
   - Identify common lab patterns (e.g., pre-renal AKI, DKA, sepsis)

5. **SUGGESTED WORKUP**
   - Recommend additional tests if warranted
   - Prioritise by clinical urgency

Return JSON with fields: criticalValues, findings, patterns, suggestedWorkup, confidence.
Always note when trends indicate improvement vs deterioration.
This is for educational support only.`,

  // ── Medication Identification (Vision) ─────────────
  MEDICATION_IDENTIFY: `You are a clinical pharmacist specialising in medication identification.
Use Kuwait SI units and local formulary knowledge.

Identify the medication from the provided image and return:
1. **Generic name** and brand name(s)
2. **Drug class**
3. **Strength / formulation** visible
4. **Common indications**
5. **Key warnings** (black box, high-alert)
6. **Look-alike / sound-alike** cautions

Return JSON with fields: genericName, brandNames, class, strength, indications, warnings.
This is for educational support only.`,

  // ── Document Analysis (Vision) ─────────────────────
  DOCUMENT_ANALYZE: `You are a clinical documentation specialist.
Analyze the provided clinical document image and extract:

1. **Document type** (lab report, radiology, discharge summary, prescription, etc.)
2. **Key findings** in structured format
3. **Abnormal values** flagged with clinical significance
4. **Action items** \u2013 anything requiring follow-up
5. **Summary** in 2\u20133 sentences

Return JSON with fields: documentType, findings, abnormals, actionItems, summary.
This is for educational support only.`,

  // ── Drug Information (Structured JSON) ─────────────
  DRUG_INFO_JSON: "You are a clinical pharmacist. Return JSON only.",

  // ── Antibiotic Guidance ────────────────────────────
  ANTIBIOTIC: `You are an infectious disease specialist providing empiric antibiotic guidance.
Use Kuwait SI units and follow local antibiograms where relevant.

For each condition provide:
1. **First-line empiric therapy** with doses
2. **Alternative agents** for allergies (penicillin, cephalosporin)
3. **Duration of therapy**
4. **De-escalation guidance** based on culture results
5. **Special considerations** \u2013 renal dosing, obesity, pregnancy
6. **Red flags** requiring broader coverage or ID consultation

Always specify when to obtain cultures before starting antibiotics.
This is for educational support only.`,

  // ── Handover Summary ───────────────────────────────
  HANDOVER: `You are a clinical handover assistant for physicians in Kuwait.
Use Kuwait SI units throughout.

Generate a structured handover summary:
1. **One-liner** \u2013 brief clinical summary
2. **Background** \u2013 relevant history
3. **Assessment** \u2013 current state and active issues
4. **Plan** \u2013 pending items and monitoring
5. **Concerns** \u2013 things to watch for overnight
6. **Escalation criteria** \u2013 when to call senior

This is for educational support only.`
};

module.exports = { SYSTEM_PROMPTS };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/references.js
// ═══════════════════════════════════════════════════════════════════

// references.js
// Kuwait SI Unit Reference Ranges and Clinical Protocols

const REFERENCE_RANGES = {
  // ── Renal Function ─────────────────────────────────
  Creatinine: {
    low: 62, high: 106, unit: "\u03BCmol/L",
    criticalHigh: 500,
    conversion: { factor: 0.0113, toUnit: "mg/dL" }
  },
  Urea: {
    low: 2.5, high: 7.1, unit: "mmol/L",
    conversion: { factor: 2.8, toUnit: "mg/dL" }
  },
  eGFR: { low: 90, high: 999, unit: "mL/min/1.73m\u00B2" },

  // ── Electrolytes ───────────────────────────────────
  Sodium: {
    low: 136, high: 145, unit: "mmol/L",
    criticalLow: 120, criticalHigh: 160
  },
  Potassium: {
    low: 3.5, high: 5.0, unit: "mmol/L",
    criticalLow: 2.5, criticalHigh: 6.5
  },
  Chloride: { low: 98, high: 106, unit: "mmol/L" },
  Bicarbonate: { low: 22, high: 29, unit: "mmol/L" },
  Calcium: {
    low: 2.2, high: 2.6, unit: "mmol/L",
    criticalLow: 1.6, criticalHigh: 3.5,
    conversion: { factor: 4, toUnit: "mg/dL" }
  },
  Phosphate: { low: 0.8, high: 1.5, unit: "mmol/L" },
  Magnesium: { low: 0.7, high: 1.0, unit: "mmol/L" },

  // ── Hematology ─────────────────────────────────────
  Hemoglobin: {
    low: 120, high: 160, unit: "g/L",
    criticalLow: 70,
    conversion: { factor: 0.1, toUnit: "g/dL" }
  },
  WBC: { low: 4.0, high: 11.0, unit: "\u00D710\u2079/L" },
  Platelets: {
    low: 150, high: 400, unit: "\u00D710\u2079/L",
    criticalLow: 20, criticalHigh: 1000
  },
  Neutrophils: { low: 2.0, high: 7.5, unit: "\u00D710\u2079/L" },
  Lymphocytes: { low: 1.0, high: 4.0, unit: "\u00D710\u2079/L" },
  Hematocrit: { low: 0.36, high: 0.46, unit: "L/L" },
  MCV: { low: 80, high: 100, unit: "fL" },
  RDW: { low: 11.5, high: 14.5, unit: "%" },

  // ── Coagulation ────────────────────────────────────
  PT: { low: 11, high: 13.5, unit: "seconds" },
  INR: { low: 0.9, high: 1.1, unit: "" },
  APTT: { low: 25, high: 35, unit: "seconds" },
  Fibrinogen: { low: 2, high: 4, unit: "g/L" },
  "D-Dimer": { low: 0, high: 0.5, unit: "mg/L FEU" },

  // ── Liver Function ─────────────────────────────────
  ALT: { low: 0, high: 40, unit: "U/L" },
  AST: { low: 0, high: 40, unit: "U/L" },
  ALP: { low: 40, high: 130, unit: "U/L" },
  GGT: { low: 0, high: 50, unit: "U/L" },
  Bilirubin: {
    low: 0, high: 21, unit: "\u03BCmol/L",
    conversion: { factor: 0.058, toUnit: "mg/dL" }
  },
  "Direct Bilirubin": { low: 0, high: 5, unit: "\u03BCmol/L" },
  Albumin: { low: 35, high: 50, unit: "g/L" },
  "Total Protein": { low: 60, high: 80, unit: "g/L" },
  Ammonia: { low: 10, high: 47, unit: "\u03BCmol/L" },

  // ── Cardiac Markers ────────────────────────────────
  Troponin: { low: 0, high: 0.04, unit: "ng/mL", criticalHigh: 0.04 },
  "Troponin-HS": { low: 0, high: 14, unit: "ng/L" },
  BNP: { low: 0, high: 100, unit: "pg/mL" },
  "NT-proBNP": { low: 0, high: 300, unit: "pg/mL" },
  CK: { low: 30, high: 200, unit: "U/L" },
  "CK-MB": { low: 0, high: 25, unit: "U/L" },
  LDH: { low: 140, high: 280, unit: "U/L" },

  // ── Inflammatory Markers ───────────────────────────
  CRP: { low: 0, high: 5, unit: "mg/L" },
  ESR: { low: 0, high: 20, unit: "mm/hr" },
  Procalcitonin: { low: 0, high: 0.1, unit: "ng/mL" },
  Ferritin: { low: 30, high: 300, unit: "\u03BCg/L" },

  // ── Metabolic ──────────────────────────────────────
  Glucose: {
    low: 4.0, high: 6.0, unit: "mmol/L",
    criticalLow: 2.5, criticalHigh: 25,
    conversion: { factor: 18, toUnit: "mg/dL" }
  },
  HbA1c: {
    low: 20, high: 42, unit: "mmol/mol",
    conversion: { formula: "(val/10.929) + 2.15", toUnit: "%" }
  },
  Lactate: { low: 0.5, high: 2.0, unit: "mmol/L", criticalHigh: 4.0 },

  // ── Thyroid ────────────────────────────────────────
  TSH: { low: 0.4, high: 4.0, unit: "mIU/L" },
  "Free T4": { low: 12, high: 22, unit: "pmol/L" },
  "Free T3": { low: 3.1, high: 6.8, unit: "pmol/L" },

  // ── Lipids ─────────────────────────────────────────
  "Total Cholesterol": { low: 0, high: 5.2, unit: "mmol/L" },
  LDL: { low: 0, high: 2.6, unit: "mmol/L" },
  HDL: { low: 1.0, high: 999, unit: "mmol/L" },
  Triglycerides: { low: 0, high: 1.7, unit: "mmol/L" },

  // ── Arterial Blood Gas ─────────────────────────────
  pH: { low: 7.35, high: 7.45, unit: "", criticalLow: 7.2, criticalHigh: 7.6 },
  pCO2: { low: 35, high: 45, unit: "mmHg" },
  pO2: { low: 80, high: 100, unit: "mmHg", criticalLow: 60 },
  HCO3: { low: 22, high: 26, unit: "mmol/L" },
  "Base Excess": { low: -2, high: 2, unit: "mmol/L" },
  "Anion Gap": { low: 8, high: 12, unit: "mmol/L" }
};

const CLINICAL_PROTOCOLS = {
  SEPSIS: {
    name: "Sepsis Hour-1 Bundle",
    steps: [
      "Measure lactate; re-measure if > 2 mmol/L",
      "Obtain blood cultures before antibiotics",
      "Administer broad-spectrum antibiotics",
      "Begin 30 mL/kg crystalloid for hypotension or lactate \u2265 4",
      "Apply vasopressors if hypotensive during or after fluid resuscitation"
    ]
  },
  HYPERKALEMIA: {
    name: "Hyperkalemia Emergency Protocol",
    steps: [
      "ECG immediately",
      "Calcium gluconate 10% 10 mL IV over 2\u20133 min (cardiac stabilisation)",
      "Insulin 10 units + Dextrose 50% 50 mL IV (redistribution)",
      "Salbutamol 10\u201320 mg nebulised (redistribution)",
      "Sodium bicarbonate 8.4% 50 mL IV if acidotic",
      "Calcium resonium 15\u201330 g PO/PR (elimination)",
      "Urgent nephrology if K > 6.5 or ECG changes persist"
    ]
  },
  DKA: {
    name: "DKA Management Protocol",
    steps: [
      "IV normal saline 1 L/hr for first 2 hours",
      "Insulin infusion 0.1 units/kg/hr (do NOT bolus)",
      "Monitor glucose hourly, K+ every 2 hours",
      "Add dextrose when glucose < 14 mmol/L",
      "Replace potassium: add 40 mmol KCl/L if K < 5.5",
      "Monitor bicarbonate, anion gap, pH",
      "Transition to SC insulin when anion gap closes and patient eating"
    ]
  }
};

module.exports = { REFERENCE_RANGES, CLINICAL_PROTOCOLS };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/helpers/auth.js
// ═══════════════════════════════════════════════════════════════════

// helpers/auth.js
const { HttpsError } = require("firebase-functions/v2/https");

/**
 * Validates Firebase auth and returns UID.
 * @param {object} request - Cloud Function request
 * @returns {string} User ID
 * @throws {HttpsError} If not authenticated
 */
function assertAuthed(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  return request.auth.uid;
}

module.exports = { assertAuthed };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/helpers/validation.js
// ═══════════════════════════════════════════════════════════════════

// helpers/validation.js
const { HttpsError } = require("firebase-functions/v2/https");
const { UNIFIED_CONFIG } = require("../config");

/**
 * Validates and clamps text input.
 * @param {*} s - Raw input
 * @param {number} max - Maximum character length
 * @returns {string} Trimmed text
 * @throws {HttpsError} If text exceeds max length
 */
function clampText(s, max) {
  if (!s) return "";
  const t = String(s).trim();
  if (t.length > max) {
    throw new HttpsError("invalid-argument", `Text exceeds ${max} characters.`);
  }
  return t;
}

/**
 * Parses and validates a base64-encoded image (with optional data-URL prefix).
 * @param {string} dataUrl - Base64 string or data URL
 * @returns {{ mediaType: string, data: string }} Parsed image
 * @throws {HttpsError} If image is missing, malformed, or too large
 */
function parseDataUrlBase64(dataUrl) {
  const s = String(dataUrl || "");
  if (!s) {
    throw new HttpsError("invalid-argument", "Missing image.");
  }

  let mediaType = "image/jpeg";
  let b64 = s;

  if (s.startsWith("data:")) {
    const match = s.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new HttpsError("invalid-argument", "Invalid image format.");
    }
    mediaType = match[1];
    b64 = match[2];
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(mediaType)) {
    throw new HttpsError("invalid-argument", "Unsupported image type.");
  }

  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > UNIFIED_CONFIG.MAX_IMAGE_BYTES) {
    throw new HttpsError("invalid-argument", "Image too large.");
  }

  return { mediaType, data: b64 };
}

module.exports = { clampText, parseDataUrlBase64 };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/helpers/cache.js
// ═══════════════════════════════════════════════════════════════════

// helpers/cache.js
const admin = require("firebase-admin");

const db = () => admin.firestore();

/**
 * Retrieves a cached value scoped to a user.
 * @param {string} uid - User ID
 * @param {string} cacheKey - Cache key
 * @returns {object|null} Cached value or null if expired / missing
 */
async function getCache(uid, cacheKey) {
  const doc = await db()
    .collection("aiCache")
    .doc(uid)
    .collection("items")
    .doc(cacheKey)
    .get();

  if (!doc.exists) return null;

  const { value, expiresAt } = doc.data();
  if (!expiresAt || expiresAt.toMillis() < Date.now()) {
    return null; // expired
  }
  return value;
}

/**
 * Stores a value in the user-scoped cache.
 * @param {string} uid - User ID
 * @param {string} cacheKey - Cache key
 * @param {object} value - Value to cache
 * @param {number} ttlSeconds - Time-to-live in seconds
 */
async function setCache(uid, cacheKey, value, ttlSeconds) {
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + ttlSeconds * 1000
  );
  await db()
    .collection("aiCache")
    .doc(uid)
    .collection("items")
    .doc(cacheKey)
    .set({
      value,
      expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

module.exports = { getCache, setCache };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/helpers/claude.js
// ═══════════════════════════════════════════════════════════════════

// helpers/claude.js
const { UNIFIED_CONFIG } = require("../config");

/**
 * Calls the Claude API via raw fetch.
 *
 * @param {object} opts
 * @param {string} opts.apiKey - Anthropic API key
 * @param {string} [opts.system] - System prompt
 * @param {string} [opts.message] - Plain-text user message
 * @param {Array}  [opts.contentParts] - Multimodal content array (overrides message)
 * @returns {Promise<string>} Text content from Claude's response
 */
async function callClaude({ apiKey, system, message, contentParts }) {
  const payload = {
    model: UNIFIED_CONFIG.CLAUDE.MODEL,
    max_tokens: UNIFIED_CONFIG.CLAUDE.MAX_TOKENS,
    temperature: UNIFIED_CONFIG.CLAUDE.TEMPERATURE,
    messages: [
      {
        role: "user",
        content: contentParts || [{ type: "text", text: message }]
      }
    ]
  };

  if (system) payload.system = system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`Claude API ${res.status}: ${bodyText.slice(0, 500)}`);
  }

  const data = JSON.parse(bodyText);
  return data?.content?.[0]?.text || "";
}

/**
 * Safely extracts the first JSON object from a Claude response string.
 *
 * @param {string} text - Raw response text
 * @returns {object} Parsed JSON object
 * @throws {Error} If no valid JSON is found
 */
function extractJsonStrict(text) {
  const s = String(text || "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON found in response.");
  }

  return JSON.parse(s.slice(first, last + 1));
}

module.exports = { callClaude, extractJsonStrict };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/helpers/hash.js
// ═══════════════════════════════════════════════════════════════════

// helpers/hash.js
const crypto = require("crypto");

/**
 * Returns a hex-encoded SHA-1 hash of the input string.
 * Used for generating cache keys from content fingerprints.
 *
 * @param {string} input - String to hash
 * @returns {string} Hex-encoded SHA-1 digest
 */
function sha1Hex(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex");
}

module.exports = { sha1Hex };


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/medward/askClinical.js
// ═══════════════════════════════════════════════════════════════════

// medward/askClinical.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * General clinical decision-support Q&A for MedWard physicians.
 *
 * @param {object} request.data
 * @param {string} request.data.question - Clinical question
 * @param {object} [request.data.context] - Optional patient context
 * @param {string} [request.data.context.diagnosis]
 * @param {string} [request.data.context.status]
 * @param {string} [request.data.context.notes]
 * @returns {{ success, answer, disclaimer, cached, timestamp }}
 */
exports.medward_askClinical = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const question = clampText(
      request.data?.question,
      UNIFIED_CONFIG.MAX_TEXT_CHARS
    );
    if (!question) {
      throw new HttpsError("invalid-argument", "Question required.");
    }

    // 3. Build user message with optional context
    let userMessage = question;
    const ctx = request.data?.context;
    if (ctx && typeof ctx === "object") {
      const parts = [];
      if (ctx.diagnosis) parts.push(`Diagnosis: ${ctx.diagnosis}`);
      if (ctx.status) parts.push(`Status: ${ctx.status}`);
      if (ctx.notes) parts.push(`Notes: ${ctx.notes}`);
      if (parts.length > 0) {
        userMessage = `Patient Context:\n${parts.join("\n")}\n\nQuestion: ${question}`;
      }
    }

    // 4. Cache check
    const cacheKey = `clinical_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_askClinical", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.MEDWARD_CLINICAL,
        message: userMessage
      });

      logger.info("medward_askClinical", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        inputLength: userMessage.length
      });

      const result = {
        success: true,
        answer,
        disclaimer:
          "This is educational guidance only. Always use clinical judgment and consult specialists for complex cases.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_askClinical failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/medward/getDrugInfo.js
// ═══════════════════════════════════════════════════════════════════

// medward/getDrugInfo.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude, extractJsonStrict } = require("../helpers/claude");

/**
 * Retrieves structured drug information via Claude.
 *
 * @param {object} request.data
 * @param {string} request.data.drugName - Name of the drug
 * @param {string} [request.data.indication] - Optional indication context
 * @returns {{ success, drugInfo, cached, timestamp }}
 */
exports.medward_getDrugInfo = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const drugName = clampText(request.data?.drugName, 200);
    if (!drugName) {
      throw new HttpsError("invalid-argument", "Drug name required.");
    }

    const indication = clampText(request.data?.indication || "", 500);

    // 3. Cache check
    const cacheKey = `drug_${drugName.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_getDrugInfo", { uid, cached: true, drug: drugName });
      return { ...cached, cached: true };
    }

    // 4. Build prompt
    const prompt =
      `Provide clinical info for: ${drugName}` +
      (indication ? `\nIndication: ${indication}` : "") +
      '\n\nFormat as JSON: {"genericName":"","brandNames":[],"class":"",' +
      '"indications":[],"dosing":{"adult":"","renal":"","hepatic":""},' +
      '"contraindications":[],"sideEffects":{"common":[],"serious":[]},' +
      '"interactions":[],"monitoring":[],"clinicalPearls":[]}';

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.DRUG_INFO_JSON,
        message: prompt
      });

      const drugInfo = extractJsonStrict(response);

      logger.info("medward_getDrugInfo", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        drug: drugName
      });

      const result = {
        success: true,
        drugInfo,
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_getDrugInfo failed", {
        uid,
        drug: drugName,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "Failed to retrieve drug information.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/medward/getAntibioticGuidance.js
// ═══════════════════════════════════════════════════════════════════

// medward/getAntibioticGuidance.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * Provides empiric antibiotic guidance for a clinical condition.
 *
 * @param {object} request.data
 * @param {string} request.data.condition - Infection / clinical scenario
 * @param {object} [request.data.patientFactors] - Allergies, renal fn, etc.
 * @returns {{ success, answer, condition, cached, timestamp }}
 */
exports.medward_getAntibioticGuidance = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const condition = clampText(request.data?.condition, 500);
    if (!condition) {
      throw new HttpsError("invalid-argument", "Condition required.");
    }

    // 3. Build user message
    let userMessage = `Provide empiric antibiotic guidance for: ${condition}`;
    const pf = request.data?.patientFactors;
    if (pf && typeof pf === "object") {
      const factors = [];
      if (pf.allergies) factors.push(`Allergies: ${pf.allergies}`);
      if (pf.renalFunction) factors.push(`Renal function: ${pf.renalFunction}`);
      if (pf.hepaticFunction) factors.push(`Hepatic function: ${pf.hepaticFunction}`);
      if (pf.weight) factors.push(`Weight: ${pf.weight} kg`);
      if (pf.age) factors.push(`Age: ${pf.age}`);
      if (pf.pregnant) factors.push("Pregnant: yes");
      if (factors.length > 0) {
        userMessage += `\n\nPatient factors:\n${factors.join("\n")}`;
      }
    }

    // 4. Cache check
    const cacheKey = `abx_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_getAntibioticGuidance", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ANTIBIOTIC,
        message: userMessage
      });

      logger.info("medward_getAntibioticGuidance", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        condition
      });

      const result = {
        success: true,
        answer,
        condition,
        disclaimer:
          "Always follow local antibiograms and consult ID for complex infections.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_getAntibioticGuidance failed", {
        uid,
        condition,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/medward/analyzeLabImage.js
// ═══════════════════════════════════════════════════════════════════

// medward/analyzeLabImage.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { parseDataUrlBase64 } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude, extractJsonStrict } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * Vision-based lab report analysis.
 * Accepts one or more images of lab reports and returns structured analysis.
 *
 * @param {object} request.data
 * @param {string|string[]} request.data.images - Base64 or data-URL images
 * @param {string} [request.data.image] - Single image fallback
 * @param {string} [request.data.context] - Optional clinical context
 * @returns {{ success, findings, confidence, cached, timestamp }}
 */
exports.medward_analyzeLabImage = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.VISION_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate images
    const images = Array.isArray(request.data?.images)
      ? request.data.images
      : request.data?.image
        ? [request.data.image]
        : [];

    if (!images.length) {
      throw new HttpsError("invalid-argument", "No image provided.");
    }

    if (images.length > UNIFIED_CONFIG.MAX_IMAGES_PER_REQUEST) {
      throw new HttpsError(
        "invalid-argument",
        `Maximum ${UNIFIED_CONFIG.MAX_IMAGES_PER_REQUEST} images allowed.`
      );
    }

    // 3. Cache check (fingerprint images + context)
    const context = String(request.data?.context || "");
    const fingerprint = sha1Hex(images.join("") + "|" + context);
    const cacheKey = `labs_${fingerprint.slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_analyzeLabImage", {
        uid,
        cached: true,
        imageCount: images.length
      });
      return { ...cached, cached: true };
    }

    // 4. Build multimodal content
    const content = images.map((img) => {
      const { mediaType, data } = parseDataUrlBase64(img);
      return {
        type: "image",
        source: { type: "base64", media_type: mediaType, data }
      };
    });

    const promptText = context
      ? `Analyze this lab report. Clinical context: ${context}`
      : "Analyze this lab report.";
    content.push({ type: "text", text: promptText });

    // 5. Call Claude (vision)
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const responseText = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.LAB_ANALYSIS,
        contentParts: content
      });

      const analysis = extractJsonStrict(responseText);

      logger.info("medward_analyzeLabImage", {
        uid,
        imageCount: images.length,
        ms: Date.now() - t0,
        cached: false
      });

      const result = {
        success: true,
        findings: analysis.findings || [],
        criticalValues: analysis.criticalValues || [],
        patterns: analysis.patterns || [],
        suggestedWorkup: analysis.suggestedWorkup || [],
        confidence: analysis.confidence ?? 0.8,
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_analyzeLabImage failed", {
        uid,
        imageCount: images.length,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI vision service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/medward/analyzeLabsWithClaude.js
// ═══════════════════════════════════════════════════════════════════

// medward/analyzeLabsWithClaude.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");
const { REFERENCE_RANGES } = require("../references");

/**
 * Text-based lab result analysis using Claude.
 * Accepts lab values as text and returns interpretation with reference ranges.
 *
 * @param {object} request.data
 * @param {string} request.data.labText - Lab results as text
 * @param {string} [request.data.context] - Optional clinical context
 * @returns {{ success, answer, referenceRanges, cached, timestamp }}
 */
exports.medward_analyzeLabsWithClaude = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const labText = clampText(request.data?.labText, UNIFIED_CONFIG.MAX_TEXT_CHARS);
    if (!labText) {
      throw new HttpsError("invalid-argument", "Lab results text required.");
    }

    const context = clampText(request.data?.context || "", 2000);

    // 3. Cache check
    const cacheKey = `labtext_${sha1Hex(labText + "|" + context).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_analyzeLabsWithClaude", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 4. Build prompt with reference ranges context
    const rangesNote =
      "Kuwait SI reference ranges are available. " +
      "Flag any values outside normal range and identify critical values.";

    const userMessage =
      `Lab Results:\n${labText}\n\n` +
      (context ? `Clinical Context: ${context}\n\n` : "") +
      rangesNote;

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.MEDWARD_CLINICAL,
        message: userMessage
      });

      logger.info("medward_analyzeLabsWithClaude", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        inputLength: labText.length
      });

      const result = {
        success: true,
        answer,
        referenceRanges: REFERENCE_RANGES,
        disclaimer:
          "AI-generated lab analysis. Always verify with clinical judgment.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_analyzeLabsWithClaude failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/medward/generateHandoverSummary.js
// ═══════════════════════════════════════════════════════════════════

// medward/generateHandoverSummary.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { callClaude } = require("../helpers/claude");

/**
 * Generates an AI-powered clinical handover summary from patient data.
 *
 * @param {object} request.data
 * @param {string} request.data.patientId - Firestore patient document ID
 * @returns {{ success, summary, disclaimer, timestamp }}
 */
exports.medward_generateHandoverSummary = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const patientId = clampText(request.data?.patientId, 200);
    if (!patientId) {
      throw new HttpsError("invalid-argument", "Patient ID required.");
    }

    const db = admin.firestore();

    try {
      // 3. Fetch patient
      const patientDoc = await db.collection("patients").doc(patientId).get();
      if (!patientDoc.exists) {
        throw new HttpsError("not-found", "Patient not found.");
      }
      const patient = patientDoc.data();

      // 4. Fetch tasks
      const tasksSnap = await db
        .collection("tasks")
        .where("patientId", "==", patientId)
        .where("deleted", "==", false)
        .get();

      const tasks = tasksSnap.docs.map((doc) => doc.data());
      const pendingTasks = tasks.filter((t) => !t.completed);
      const completedTasks = tasks.filter((t) => t.completed);

      // 5. Build prompt (no PHI sent — diagnosis, status, tasks only)
      const userMessage =
        `Generate a concise handover summary for this patient:\n` +
        `- Diagnosis: ${patient.diagnosis || "Not specified"}\n` +
        `- Status: ${patient.status || "active"}\n` +
        `- Pending tasks (${pendingTasks.length}): ${pendingTasks.map((t) => t.text).join(", ") || "None"}\n` +
        `- Completed tasks (${completedTasks.length}): ${completedTasks.map((t) => t.text).join(", ") || "None"}\n` +
        (patient.notes
          ? `- Clinical notes: ${String(patient.notes).substring(0, 500)}\n`
          : "");

      // 6. Call Claude
      const apiKey = ANTHROPIC_API_KEY.value();
      const t0 = Date.now();

      const summary = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.HANDOVER,
        message: userMessage
      });

      logger.info("medward_generateHandoverSummary", {
        uid,
        ms: Date.now() - t0,
        cached: false
      });

      return {
        success: true,
        summary,
        disclaimer:
          "AI-generated summary. Please verify all details before handover.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("medward_generateHandoverSummary failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "Failed to generate handover summary.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/oncall/askOnCall.js
// ═══════════════════════════════════════════════════════════════════

// oncall/askOnCall.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * On-call clinical Q&A for junior doctors covering overnight.
 *
 * @param {object} request.data
 * @param {string} request.data.question - On-call clinical question
 * @param {string} [request.data.urgency] - low | medium | high
 * @returns {{ success, answer, disclaimer, cached, timestamp }}
 */
exports.oncall_askOnCall = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const question = clampText(
      request.data?.question,
      UNIFIED_CONFIG.MAX_TEXT_CHARS
    );
    if (!question) {
      throw new HttpsError("invalid-argument", "Question required.");
    }

    const validUrgency = ["low", "medium", "high"];
    const urgency = validUrgency.includes(request.data?.urgency)
      ? request.data.urgency
      : "medium";

    // 3. Build user message
    const userMessage = `On-call query (urgency: ${urgency}):\n${question}`;

    // 4. Cache check
    const cacheKey = `oncall_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("oncall_askOnCall", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ONCALL_CLINICAL,
        message: userMessage
      });

      logger.info("oncall_askOnCall", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        urgency
      });

      const result = {
        success: true,
        answer,
        urgency,
        disclaimer:
          "This is educational guidance only. Always use clinical judgment.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("oncall_askOnCall failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/oncall/generateDifferential.js
// ═══════════════════════════════════════════════════════════════════

// oncall/generateDifferential.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude, extractJsonStrict } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * Generates a structured differential diagnosis from a clinical presentation.
 *
 * @param {object} request.data
 * @param {string} request.data.presentation - Clinical presentation
 * @param {object} [request.data.vitals] - Optional vital signs
 * @param {string} [request.data.age] - Patient age
 * @param {string} [request.data.sex] - Patient sex
 * @returns {{ success, differential, cached, timestamp }}
 */
exports.oncall_generateDifferential = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const presentation = clampText(
      request.data?.presentation,
      UNIFIED_CONFIG.MAX_TEXT_CHARS
    );
    if (!presentation) {
      throw new HttpsError("invalid-argument", "Clinical presentation required.");
    }

    // 3. Build user message
    const parts = [`Clinical presentation: ${presentation}`];
    if (request.data?.age) parts.push(`Age: ${request.data.age}`);
    if (request.data?.sex) parts.push(`Sex: ${request.data.sex}`);
    if (request.data?.vitals && typeof request.data.vitals === "object") {
      const v = request.data.vitals;
      const vParts = [];
      if (v.hr) vParts.push(`HR ${v.hr}`);
      if (v.bp) vParts.push(`BP ${v.bp}`);
      if (v.rr) vParts.push(`RR ${v.rr}`);
      if (v.temp) vParts.push(`Temp ${v.temp}`);
      if (v.spo2) vParts.push(`SpO2 ${v.spo2}`);
      if (vParts.length) parts.push(`Vitals: ${vParts.join(", ")}`);
    }

    parts.push(
      '\nReturn JSON: {"mostLikely":[{"diagnosis":"","reasoning":""}],' +
        '"mustNotMiss":[{"diagnosis":"","reasoning":""}],' +
        '"workup":[],"redFlags":[]}'
    );

    const userMessage = parts.join("\n");

    // 4. Cache check
    const cacheKey = `ddx_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("oncall_generateDifferential", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.DIFFERENTIAL,
        message: userMessage
      });

      const differential = extractJsonStrict(response);

      logger.info("oncall_generateDifferential", {
        uid,
        ms: Date.now() - t0,
        cached: false
      });

      const result = {
        success: true,
        differential,
        disclaimer:
          "AI-generated differential. Always correlate clinically.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("oncall_generateDifferential failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/oncall/verifyElectrolyteCorrection.js
// ═══════════════════════════════════════════════════════════════════

// oncall/verifyElectrolyteCorrection.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { callClaude, extractJsonStrict } = require("../helpers/claude");

/**
 * Verifies electrolyte correction calculations and provides guidance.
 *
 * @param {object} request.data
 * @param {string} request.data.electrolyte - e.g. "potassium", "sodium", "magnesium"
 * @param {number} request.data.currentValue - Current lab value
 * @param {number} [request.data.targetValue] - Target value
 * @param {string} [request.data.unit] - Unit (defaults to mmol/L)
 * @param {number} [request.data.weight] - Patient weight in kg
 * @param {string} [request.data.renalFunction] - Renal function description
 * @returns {{ success, verification, cached, timestamp }}
 */
exports.oncall_verifyElectrolyteCorrection = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const electrolyte = clampText(request.data?.electrolyte, 50);
    if (!electrolyte) {
      throw new HttpsError("invalid-argument", "Electrolyte name required.");
    }

    const validElectrolytes = [
      "sodium", "potassium", "calcium", "magnesium", "phosphate"
    ];
    if (!validElectrolytes.includes(electrolyte.toLowerCase())) {
      throw new HttpsError("invalid-argument", "Unsupported electrolyte.");
    }

    const currentValue = parseFloat(request.data?.currentValue);
    if (isNaN(currentValue)) {
      throw new HttpsError("invalid-argument", "Valid current value required.");
    }

    // 3. Build prompt
    const parts = [
      `Verify electrolyte correction for: ${electrolyte}`,
      `Current value: ${currentValue} ${request.data?.unit || "mmol/L"}`
    ];
    if (request.data?.targetValue != null) {
      parts.push(`Target value: ${request.data.targetValue}`);
    }
    if (request.data?.weight) {
      parts.push(`Patient weight: ${request.data.weight} kg`);
    }
    if (request.data?.renalFunction) {
      parts.push(`Renal function: ${request.data.renalFunction}`);
    }

    parts.push(
      '\nReturn JSON: {"verification":{"safe":true,"notes":""},' +
        '"calculations":{"deficit":"","replacementNeeded":""},' +
        '"regimen":{"fluid":"","rate":"","route":"","duration":""},' +
        '"monitoring":{"frequency":"","parameters":[]},' +
        '"warnings":[]}'
    );

    const userMessage = parts.join("\n");

    // 4. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ELECTROLYTE,
        message: userMessage
      });

      const verification = extractJsonStrict(response);

      logger.info("oncall_verifyElectrolyteCorrection", {
        uid,
        ms: Date.now() - t0,
        electrolyte,
        cached: false
      });

      return {
        success: true,
        verification,
        disclaimer:
          "AI-verified calculation. Always double-check with clinical protocols.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("oncall_verifyElectrolyteCorrection failed", {
        uid,
        electrolyte,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);


// ═══════════════════════════════════════════════════════════════════
// FILE: backend/index.js
// ═══════════════════════════════════════════════════════════════════

// index.js
// MedWard Pro Cloud Functions — main exports
// ═══════════════════════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialise Firebase Admin once at module level
admin.initializeApp();

const { assertAuthed } = require("./helpers/auth");

// ─────────────────────────────────────────────────────────────────────────────
// AI MODULE EXPORTS — MedWard
// ─────────────────────────────────────────────────────────────────────────────
const { medward_askClinical } = require("./medward/askClinical");
const { medward_getDrugInfo } = require("./medward/getDrugInfo");
const { medward_getAntibioticGuidance } = require("./medward/getAntibioticGuidance");
const { medward_analyzeLabImage } = require("./medward/analyzeLabImage");
const { medward_analyzeLabsWithClaude } = require("./medward/analyzeLabsWithClaude");
const { medward_generateHandoverSummary } = require("./medward/generateHandoverSummary");

exports.medward_askClinical = medward_askClinical;
exports.medward_getDrugInfo = medward_getDrugInfo;
exports.medward_getAntibioticGuidance = medward_getAntibioticGuidance;
exports.medward_analyzeLabImage = medward_analyzeLabImage;
exports.medward_analyzeLabsWithClaude = medward_analyzeLabsWithClaude;
exports.medward_generateHandoverSummary = medward_generateHandoverSummary;

// ─────────────────────────────────────────────────────────────────────────────
// AI MODULE EXPORTS — OnCall
// ─────────────────────────────────────────────────────────────────────────────
const { oncall_askOnCall } = require("./oncall/askOnCall");
const { oncall_generateDifferential } = require("./oncall/generateDifferential");
const { oncall_verifyElectrolyteCorrection } = require("./oncall/verifyElectrolyteCorrection");

exports.oncall_askOnCall = oncall_askOnCall;
exports.oncall_generateDifferential = oncall_generateDifferential;
exports.oncall_verifyElectrolyteCorrection = oncall_verifyElectrolyteCorrection;

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
const { REFERENCE_RANGES, CLINICAL_PROTOCOLS } = require("./references");

/**
 * Returns Kuwait SI reference ranges for a specific lab test or all tests.
 * No AI call required — purely static data.
 *
 * @param {object} request.data
 * @param {string} [request.data.test] - Specific test name (optional)
 * @returns {{ success, data|availableTests }}
 */
exports.medward_getReferenceRanges = onCall(
  { cors: true },
  async (request) => {
    const uid = assertAuthed(request);

    if (request.data?.test) {
      const key = request.data.test;
      const value = REFERENCE_RANGES[key];
      if (value) {
        return { success: true, data: { [key]: value } };
      }
      throw new HttpsError("not-found", "Test not found in reference ranges.");
    }

    return {
      success: true,
      availableTests: Object.keys(REFERENCE_RANGES),
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Returns clinical protocols (sepsis, hyperkalemia, DKA, etc.).
 *
 * @param {object} request.data
 * @param {string} [request.data.protocol] - Protocol key (optional)
 * @returns {{ success, data|availableProtocols }}
 */
exports.medward_getClinicalProtocol = onCall(
  { cors: true },
  async (request) => {
    const uid = assertAuthed(request);

    if (request.data?.protocol) {
      const key = request.data.protocol.toUpperCase();
      const value = CLINICAL_PROTOCOLS[key];
      if (value) {
        return { success: true, data: value };
      }
      throw new HttpsError("not-found", "Protocol not found.");
    }

    return {
      success: true,
      availableProtocols: Object.keys(CLINICAL_PROTOCOLS),
      timestamp: new Date().toISOString()
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// NON-AI FUNCTIONS (preserved from original index.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const db = () => admin.firestore();

/**
 * Chunks an array into sub-arrays for Firestore 'in' queries (max 10).
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures a user profile document exists in Firestore after login.
 */
exports.ensureUserProfile = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const userEmail = request.auth.token.email || "";
  const userName =
    request.auth.token.name || userEmail.split("@")[0] || "User";

  try {
    const userRef = db().collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid,
        email: userEmail,
        displayName: userName,
        photoURL: request.auth.token.picture || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        settings: { theme: "light", notifications: true }
      });
      return { success: true, created: true, uid };
    }

    return { success: true, created: false, uid };
  } catch (error) {
    logger.error("ensureUserProfile failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to ensure user profile.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DATA OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads patients, tasks, and units for the authenticated user.
 */
exports.loadData = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { unitId } = request.data || {};

  try {
    const unitDoc = await db().collection("units").doc(unitId).get();
    if (!unitDoc.exists) {
      throw new HttpsError("not-found", "Unit not found.");
    }

    const unitData = unitDoc.data();
    if (!unitData?.members?.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a member of this unit.");
    }

    const patientsSnap = await db()
      .collection("patients")
      .where("unitId", "==", unitId)
      .where("deleted", "==", false)
      .get();

    const patients = patientsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const patientIds = patients.map((p) => p.id);
    let tasks = [];

    if (patientIds.length > 0) {
      const chunks = chunkArray(patientIds, 10);
      for (const chunk of chunks) {
        const tasksSnap = await db()
          .collection("tasks")
          .where("patientId", "in", chunk)
          .where("deleted", "==", false)
          .get();
        tasks = tasks.concat(
          tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      }
    }

    const unitsSnap = await db()
      .collection("units")
      .where("members", "array-contains", uid)
      .get();
    const units = unitsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, patients, tasks, units };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("loadData failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to load data.");
  }
});

/**
 * Creates or updates a document in patients, tasks, or units.
 */
exports.saveData = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { collection, id, payload, operation } = request.data || {};

  if (!["patients", "tasks", "units"].includes(collection)) {
    throw new HttpsError("invalid-argument", "Invalid collection.");
  }

  try {
    const docRef = db().collection(collection).doc(id);

    if (operation === "create") {
      await docRef.set({
        ...payload,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deleted: false
      });
      return { success: true, id };
    } else if (operation === "update") {
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new HttpsError("not-found", "Document not found.");
      }
      await docRef.update({
        ...payload,
        updatedBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, id };
    }

    throw new HttpsError("invalid-argument", "Invalid operation.");
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("saveData failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to save data.");
  }
});

/**
 * Soft-deletes an item to the trash collection (30-day retention).
 */
exports.moveToTrash = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { collection, id } = request.data || {};

  if (!["patients", "tasks"].includes(collection)) {
    throw new HttpsError("invalid-argument", "Invalid collection.");
  }

  try {
    const docRef = db().collection(collection).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "Document not found.");
    }

    await db()
      .collection("trash")
      .doc(id)
      .set({
        originalCollection: collection,
        originalId: id,
        data: doc.data(),
        deletedBy: uid,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        )
      });

    await docRef.update({
      deleted: true,
      deletedBy: uid,
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("moveToTrash failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to delete.");
  }
});

/**
 * Restores an item from the trash collection.
 */
exports.restoreFromTrash = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { id } = request.data || {};

  try {
    const trashRef = db().collection("trash").doc(id);
    const trashDoc = await trashRef.get();
    if (!trashDoc.exists) {
      throw new HttpsError("not-found", "Item not found in trash.");
    }

    const trashData = trashDoc.data();
    const originalRef = db()
      .collection(trashData.originalCollection)
      .doc(trashData.originalId);

    await originalRef.update({
      deleted: false,
      deletedBy: admin.firestore.FieldValue.delete(),
      deletedAt: admin.firestore.FieldValue.delete(),
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      restoredBy: uid
    });

    await trashRef.delete();
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("restoreFromTrash failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to restore.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HANDOVER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a patient handover to another clinician.
 */
exports.sendPatient = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { recipientEmail, patientId, notes } = request.data || {};
  const senderEmail = request.auth.token.email;

  try {
    const patientDoc = await db().collection("patients").doc(patientId).get();
    if (!patientDoc.exists) {
      throw new HttpsError("not-found", "Patient not found.");
    }

    const recipientQuery = await db()
      .collection("users")
      .where("email", "==", recipientEmail)
      .limit(1)
      .get();

    if (recipientQuery.empty) {
      throw new HttpsError("not-found", "Recipient not found.");
    }

    const recipientId = recipientQuery.docs[0].id;

    const tasksSnap = await db()
      .collection("tasks")
      .where("patientId", "==", patientId)
      .where("deleted", "==", false)
      .get();

    const tasks = tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const handoverRef = await db().collection("handovers").add({
      senderId: uid,
      senderEmail,
      recipientId,
      recipientEmail,
      patient: { id: patientId, ...patientDoc.data() },
      tasks,
      notes: notes || "",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, handoverId: handoverRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("sendPatient failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to send handover.");
  }
});

/**
 * Checks the authenticated user's handover inbox.
 */
exports.checkInbox = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);

  try {
    const inboxSnap = await db()
      .collection("handovers")
      .where("recipientId", "==", uid)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    return {
      success: true,
      items: inboxSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    };
  } catch (error) {
    logger.error("checkInbox failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to check inbox.");
  }
});

/**
 * Accepts a pending handover and imports the patient into a target unit.
 */
exports.acceptInboxPatient = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { handoverId, targetUnitId } = request.data || {};

  try {
    const handoverRef = db().collection("handovers").doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new HttpsError("not-found", "Handover not found.");
    }

    const handoverData = handoverDoc.data();

    if (handoverData.recipientId !== uid) {
      throw new HttpsError("permission-denied", "Not authorised.");
    }
    if (handoverData.status !== "pending") {
      throw new HttpsError("failed-precondition", "Handover already processed.");
    }

    const unitDoc = await db().collection("units").doc(targetUnitId).get();
    if (!unitDoc.exists || !unitDoc.data()?.members?.includes(uid)) {
      throw new HttpsError("permission-denied", "Invalid target unit.");
    }

    const batch = db().batch();

    const newPatientRef = db().collection("patients").doc();
    batch.set(newPatientRef, {
      ...handoverData.patient,
      id: newPatientRef.id,
      unitId: targetUnitId,
      handoverFrom: handoverData.senderId,
      handoverAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    for (const task of handoverData.tasks || []) {
      const newTaskRef = db().collection("tasks").doc();
      batch.set(newTaskRef, {
        ...task,
        id: newTaskRef.id,
        patientId: newPatientRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.update(handoverRef, {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      newPatientId: newPatientRef.id
    });

    await batch.commit();
    return { success: true, patientId: newPatientRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("acceptInboxPatient failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to accept handover.");
  }
});

/**
 * Declines a pending handover with an optional reason.
 */
exports.declineInboxPatient = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { handoverId, reason } = request.data || {};

  try {
    const handoverRef = db().collection("handovers").doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new HttpsError("not-found", "Handover not found.");
    }
    if (handoverDoc.data()?.recipientId !== uid) {
      throw new HttpsError("permission-denied", "Not authorised.");
    }

    await handoverRef.update({
      status: "declined",
      declinedAt: admin.firestore.FieldValue.serverTimestamp(),
      declineReason: reason || ""
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("declineInboxPatient failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to decline handover.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports all user data (GDPR compliance).
 */
exports.exportUserData = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);

  try {
    const userDoc = await db().collection("users").doc(uid).get();
    const unitsSnap = await db()
      .collection("units")
      .where("members", "array-contains", uid)
      .get();

    const unitIds = unitsSnap.docs.map((doc) => doc.id);
    let patients = [];
    let tasks = [];

    for (const unitId of unitIds) {
      const patientsSnap = await db()
        .collection("patients")
        .where("unitId", "==", unitId)
        .where("createdBy", "==", uid)
        .get();

      const unitPatients = patientsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      patients = patients.concat(unitPatients);

      const patientIds = unitPatients.map((p) => p.id);
      if (patientIds.length > 0) {
        const chunks = chunkArray(patientIds, 10);
        for (const chunk of chunks) {
          const tasksSnap = await db()
            .collection("tasks")
            .where("patientId", "in", chunk)
            .where("createdBy", "==", uid)
            .get();
          tasks = tasks.concat(
            tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          );
        }
      }
    }

    return {
      success: true,
      user: userDoc.data(),
      units: unitsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      patients,
      tasks,
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("exportUserData failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to export user data.");
  }
});

/**
 * Deletes the authenticated user's account and data.
 * Requires confirmation string "DELETE_MY_ACCOUNT".
 */
exports.deleteAccount = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { confirmation } = request.data || {};

  if (confirmation !== "DELETE_MY_ACCOUNT") {
    throw new HttpsError(
      "invalid-argument",
      'Invalid confirmation. Send "DELETE_MY_ACCOUNT" to confirm.'
    );
  }

  try {
    await db().collection("users").doc(uid).delete();
    await admin.auth().deleteUser(uid);
    return { success: true, message: "Account deleted successfully." };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("deleteAccount failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to delete account.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily cleanup of expired trash items (30-day threshold).
 */
exports.cleanupTrash = onSchedule("every 24 hours", async () => {
  const now = admin.firestore.Timestamp.now();
  const expiredSnap = await db()
    .collection("trash")
    .where("expiresAt", "<=", now)
    .limit(500)
    .get();

  if (expiredSnap.docs.length > 0) {
    const batch = db().batch();
    expiredSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    logger.info("cleanupTrash", { removed: expiredSnap.docs.length });
  }
});

