/**
 * Store - Single source of truth for UI state
 * Immutable updates with subscription support
 */
import { EventBus } from './events.js';

const initialState = {
  // User & Auth
  user: null,
  isAuthenticated: false,

  // Current selections
  currentUnitId: null,
  currentPatientId: null,

  // Data collections
  units: [],
  patients: [],
  tasks: [],

  // UI State
  isLoading: true,
  syncStatus: 'disconnected', // 'connected' | 'syncing' | 'disconnected' | 'error'
  lastSyncTime: null,

  // Filters
  patientFilter: 'all', // 'all' | 'active' | 'pending-tasks' | 'critical'
  searchQuery: ''
};

let _state = { ...initialState };
const _subscribers = new Set();

export const Store = {
  /**
   * Get current state snapshot (read-only copy)
   */
  getState() {
    return { ..._state };
  },

  /**
   * Get specific slice of state
   */
  get(key) {
    return _state[key];
  },

  /**
   * Select items from a collection with optional filter
   */
  select(collection, filterFn = null) {
    const items = _state[collection] || [];
    return filterFn ? items.filter(filterFn) : [...items];
  },

  /**
   * Find single item in collection
   */
  find(collection, id) {
    return (_state[collection] || []).find(item => item.id === id) || null;
  },

  /**
   * Get deep clone of an item (for rollback snapshots)
   */
  getSnapshot(collection, id) {
    const item = this.find(collection, id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  },

  /**
   * Update state - the ONLY way to modify state
   */
  set(updates) {
    const prevState = _state;
    _state = { ..._state, ...updates };

    // Notify subscribers
    _subscribers.forEach(fn => {
      try {
        fn(_state, prevState);
      } catch (e) {
        console.error('[Store] Subscriber error:', e);
      }
    });

    // Emit granular events for specific changes
    Object.keys(updates).forEach(key => {
      EventBus.emit(`store:${key}`, _state[key]);
    });
  },

  /**
   * Apply mutation to collection (add/update/delete)
   */
  mutate(collection, operation, payload, id) {
    const items = [...(_state[collection] || [])];

    switch (operation) {
      case 'add':
        items.push(payload);
        break;

      case 'update': {
        const updateIdx = items.findIndex(i => i.id === id);
        if (updateIdx !== -1) {
          items[updateIdx] = { ...items[updateIdx], ...payload };
        }
        break;
      }

      case 'delete': {
        const deleteIdx = items.findIndex(i => i.id === id);
        if (deleteIdx !== -1) {
          items.splice(deleteIdx, 1);
        }
        break;
      }

      case 'replace':
        // Replace entire collection
        this.set({ [collection]: payload });
        return;
    }

    this.set({ [collection]: items });
  },

  /**
   * Restore item from snapshot (for rollback)
   */
  restore(collection, id, snapshot) {
    const items = [...(_state[collection] || [])];
    const idx = items.findIndex(i => i.id === id);

    if (snapshot) {
      if (idx !== -1) {
        items[idx] = snapshot;
      } else {
        items.push(snapshot);
      }
    } else if (idx !== -1) {
      items.splice(idx, 1);
    }

    this.set({ [collection]: items });
  },

  /**
   * Subscribe to state changes
   */
  subscribe(callback) {
    _subscribers.add(callback);
    return () => _subscribers.delete(callback);
  },

  /**
   * Reset to initial state
   */
  reset() {
    _state = { ...initialState };
    _subscribers.forEach(fn => fn(_state, initialState));
  },

  // === Computed Getters ===

  get currentUnit() {
    return this.find('units', _state.currentUnitId);
  },

  get currentPatient() {
    return this.find('patients', _state.currentPatientId);
  },

  get activePatients() {
    return this.select('patients', p =>
      p.unitId === _state.currentUnitId &&
      !p.dischargedAt &&
      !p.deletedAt
    );
  },

  get filteredPatients() {
    let patients = this.activePatients;

    // Apply search
    if (_state.searchQuery) {
      const q = _state.searchQuery.toLowerCase();
      patients = patients.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.mrn?.toLowerCase().includes(q) ||
        p.bed?.toLowerCase().includes(q)
      );
    }

    // Apply filter
    switch (_state.patientFilter) {
      case 'critical':
        patients = patients.filter(p => p.status === 'critical');
        break;
      case 'pending-tasks':
        patients = patients.filter(p => {
          const tasks = this.select('tasks', t => t.patientId === p.id && !t.completed);
          return tasks.length > 0;
        });
        break;
    }

    return patients;
  }
};
