/**
 * Simple hash-based SPA router
 * Supports: /patients, /patients/:id, /handover, /ai, /settings
 */
import { EventBus, Events } from './events.js';

const routes = new Map();
let currentRoute = null;

export const Router = {
  /**
   * Register a route handler
   */
  register(path, handler) {
    routes.set(path, handler);
  },

  /**
   * Navigate to a path
   */
  navigate(path, params = {}) {
    window.location.hash = path;
  },

  /**
   * Get current route info
   */
  current() {
    return currentRoute;
  },

  /**
   * Parse hash and extract route + params
   */
  _parseHash(hash) {
    const path = hash.replace('#', '') || '/';
    const segments = path.split('/').filter(Boolean);

    // Match against registered routes
    for (const [pattern, handler] of routes) {
      const patternSegments = pattern.split('/').filter(Boolean);

      if (patternSegments.length !== segments.length) continue;

      const params = {};
      let match = true;

      for (let i = 0; i < patternSegments.length; i++) {
        if (patternSegments[i].startsWith(':')) {
          // Dynamic segment
          params[patternSegments[i].slice(1)] = segments[i];
        } else if (patternSegments[i] !== segments[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        return { path, pattern, params, handler };
      }
    }

    return { path, pattern: null, params: {}, handler: null };
  },

  /**
   * Handle route change
   */
  async _handleRoute() {
    const route = this._parseHash(window.location.hash);
    const prevRoute = currentRoute;
    currentRoute = route;

    EventBus.emit(Events.ROUTE_CHANGED, { route, prevRoute });

    if (route.handler) {
      try {
        await route.handler(route.params);
      } catch (error) {
        console.error('[Router] Handler error:', error);
      }
    } else {
      console.warn('[Router] No handler for:', route.path);
      // Redirect to default
      this.navigate('/');
    }
  },

  /**
   * Initialize router
   */
  init() {
    window.addEventListener('hashchange', () => this._handleRoute());

    // Handle initial route
    this._handleRoute();
  }
};
