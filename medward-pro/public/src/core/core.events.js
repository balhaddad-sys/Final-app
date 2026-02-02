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
