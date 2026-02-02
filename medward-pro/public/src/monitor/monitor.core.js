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
