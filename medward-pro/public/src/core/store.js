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
