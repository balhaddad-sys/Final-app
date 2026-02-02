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
