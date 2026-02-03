/**
 * Event Bus - Decoupled pub/sub messaging system
 * Usage:
 *   EventBus.on('patient:updated', handler)
 *   EventBus.emit('patient:updated', { id: '123' })
 */
export const EventBus = {
  _events: {},
  _onceEvents: new Set(),

  on(event, callback) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  },

  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this._onceEvents.add(wrapper);
    return this.on(event, wrapper);
  },

  off(event, callback) {
    if (!this._events[event]) return;
    this._events[event] = this._events[event].filter(cb => cb !== callback);
  },

  emit(event, data) {
    if (!this._events[event]) return;
    this._events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Error in "${event}" handler:`, error);
      }
    });
  },

  clear(event) {
    if (event) {
      delete this._events[event];
    } else {
      this._events = {};
    }
  }
};

// Standard event names
export const Events = {
  // Auth
  AUTH_CHANGED: 'auth:changed',
  AUTH_ERROR: 'auth:error',

  // Data
  DATA_UPDATED: 'data:updated',
  DATA_ERROR: 'data:error',

  // Sync
  SYNC_STATUS: 'sync:status',
  SYNC_CONFLICT: 'sync:conflict',

  // UI
  TOAST_SHOW: 'toast:show',
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',

  // Navigation
  ROUTE_CHANGED: 'route:changed',

  // Patients
  PATIENT_SELECTED: 'patient:selected',
  PATIENT_UPDATED: 'patient:updated',
  TASK_ADDED: 'task:added',
  TASK_COMPLETED: 'task:completed'
};
