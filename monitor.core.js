/**
 * MedWard Pro System Monitor Core
 * =================================
 * Global monitoring bus for logs, errors, network calls, and Firebase operations
 *
 * Usage:
 * 1. Import and call instrumentAll() early in your app initialization
 * 2. Use MW_MONITOR.log(type, msg, data, level) to log events
 * 3. Subscribe to events with MW_MONITOR.subscribe(callback)
 * 4. Access historical logs with MW_MONITOR.getAll()
 */

/**
 * Global monitoring event bus
 */
export const MW_MONITOR = (() => {
  const listeners = new Set();
  const buffer = [];
  const MAX_BUFFER_SIZE = 2000;

  /**
   * Emit an event to all subscribers
   * @private
   */
  function emit(entry) {
    buffer.push(entry);
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.shift(); // Remove oldest entry
    }
    listeners.forEach(fn => {
      try {
        fn(entry);
      } catch (err) {
        console.error('[MW_MONITOR] Listener error:', err);
      }
    });
  }

  /**
   * Log an event to the monitoring system
   * @param {string} type - Event type (e.g., "AUTH", "SYNC", "STORE", "NET", "UI", "RUNTIME")
   * @param {string} msg - Human-readable message
   * @param {*} data - Additional data (optional)
   * @param {string} level - Log level: "info" | "warn" | "error" (default: "info")
   */
  function log(type, msg, data = null, level = "info") {
    const entry = {
      ts: new Date().toISOString(),
      level,
      type,
      msg,
      data
    };
    emit(entry);

    // Also log to console with appropriate level
    const prefix = `[${type}]`;
    if (level === "error") {
      console.error(prefix, msg, data || '');
    } else if (level === "warn") {
      console.warn(prefix, msg, data || '');
    } else {
      console.log(prefix, msg, data || '');
    }
  }

  /**
   * Subscribe to monitoring events
   * @param {Function} fn - Callback function(entry)
   * @returns {Function} Unsubscribe function
   */
  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Get all logged events
   * @returns {Array} Array of log entries
   */
  function getAll() {
    return buffer.slice();
  }

  /**
   * Clear all logged events
   */
  function clear() {
    buffer.length = 0;
    emit({
      ts: new Date().toISOString(),
      level: "info",
      type: "MONITOR",
      msg: "Log buffer cleared",
      data: null
    });
  }

  /**
   * Get statistics about logged events
   * @returns {Object} Statistics object
   */
  function getStats() {
    const stats = {
      total: buffer.length,
      byLevel: { info: 0, warn: 0, error: 0 },
      byType: {}
    };

    buffer.forEach(entry => {
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;
    });

    return stats;
  }

  return { log, subscribe, getAll, clear, getStats };
})();

/**
 * Instrument fetch for network timing and failure tracking
 * @param {Object} MW_MONITOR - The monitoring bus
 */
export function instrumentFetch(monitorBus = MW_MONITOR) {
  if (window._MW_FETCH_INSTRUMENTED) {
    console.warn('[MW_MONITOR] fetch already instrumented');
    return;
  }

  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const url = String(args[0]);
    const start = performance.now();
    monitorBus.log("NET", "fetch:start", { url });

    try {
      const res = await originalFetch(...args);
      const ms = Math.round(performance.now() - start);
      const level = res.ok ? "info" : "warn";
      monitorBus.log("NET", "fetch:done", { url, status: res.status, ms }, level);
      return res;
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      monitorBus.log("NET", "fetch:fail", { url, ms, error: String(err) }, "error");
      throw err;
    }
  };

  window._MW_FETCH_INSTRUMENTED = true;
  monitorBus.log("MONITOR", "fetch instrumented", null, "info");
}

/**
 * Instrument global error handlers
 * @param {Object} MW_MONITOR - The monitoring bus
 */
export function instrumentErrors(monitorBus = MW_MONITOR) {
  if (window._MW_ERRORS_INSTRUMENTED) {
    console.warn('[MW_MONITOR] errors already instrumented');
    return;
  }

  // Capture runtime errors
  window.addEventListener("error", (e) => {
    monitorBus.log("RUNTIME", "window.error", {
      message: e.message,
      file: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack || null
    }, "error");
  });

  // Capture unhandled promise rejections
  window.addEventListener("unhandledrejection", (e) => {
    monitorBus.log("RUNTIME", "unhandledrejection", {
      reason: String(e.reason),
      stack: e.reason?.stack || null
    }, "error");
  });

  window._MW_ERRORS_INSTRUMENTED = true;
  monitorBus.log("MONITOR", "error handlers instrumented", null, "info");
}

/**
 * Capture console.log/warn/error for centralized logging
 * @param {Object} MW_MONITOR - The monitoring bus
 */
export function instrumentConsole(monitorBus = MW_MONITOR) {
  if (window._MW_CONSOLE_INSTRUMENTED) {
    console.warn('[MW_MONITOR] console already instrumented');
    return;
  }

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = function(...args) {
    monitorBus.log("CONSOLE", "log", { args: args.map(String) }, "info");
    originalLog.apply(console, args);
  };

  console.warn = function(...args) {
    monitorBus.log("CONSOLE", "warn", { args: args.map(String) }, "warn");
    originalWarn.apply(console, args);
  };

  console.error = function(...args) {
    monitorBus.log("CONSOLE", "error", { args: args.map(String) }, "error");
    originalError.apply(console, args);
  };

  window._MW_CONSOLE_INSTRUMENTED = true;
  originalLog('[MW_MONITOR] console instrumented');
}

/**
 * Timing wrapper for async operations
 * Use this to wrap Firebase operations and measure their performance
 *
 * Example:
 *   await timed("unit:update", () => updateUnit(unitId, patch));
 *
 * @param {string} label - Operation label
 * @param {Function} fn - Async function to time
 * @param {Object} monitorBus - The monitoring bus (default: MW_MONITOR)
 * @returns {Promise<*>} Result of the async function
 */
export async function timed(label, fn, monitorBus = MW_MONITOR) {
  const t0 = performance.now();
  try {
    const result = await fn();
    const ms = Math.round(performance.now() - t0);
    monitorBus.log("STORE", `${label}:ok`, { ms }, "info");
    return result;
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    monitorBus.log("STORE", `${label}:fail`, { ms, error: String(e) }, "error");
    throw e;
  }
}

/**
 * Initialize all instrumentation
 * Call this once at app startup
 */
export function instrumentAll() {
  MW_MONITOR.log("MONITOR", "Initializing system monitor", null, "info");
  instrumentFetch();
  instrumentErrors();
  // Note: instrumentConsole() is commented out by default to avoid noise
  // Uncomment if you want to capture ALL console output
  // instrumentConsole();
  MW_MONITOR.log("MONITOR", "System monitor initialized", null, "info");
}

/**
 * Check storage availability and quota
 * @returns {Promise<Object>} Storage info
 */
export async function checkStorageHealth() {
  const info = {
    localStorage: { available: false, error: null },
    sessionStorage: { available: false, error: null },
    quota: null
  };

  // Check localStorage
  try {
    localStorage.setItem('_MW_TEST', '1');
    localStorage.removeItem('_MW_TEST');
    info.localStorage.available = true;
  } catch (err) {
    info.localStorage.error = String(err);
  }

  // Check sessionStorage
  try {
    sessionStorage.setItem('_MW_TEST', '1');
    sessionStorage.removeItem('_MW_TEST');
    info.sessionStorage.available = true;
  } catch (err) {
    info.sessionStorage.error = String(err);
  }

  // Check quota (if available)
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      info.quota = {
        usage: estimate.usage,
        quota: estimate.quota,
        usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
      };
    } catch (err) {
      info.quota = { error: String(err) };
    }
  }

  MW_MONITOR.log("MONITOR", "Storage health check", info, "info");
  return info;
}

/**
 * Run synthetic test operations
 * Useful for testing monitoring and Firebase operations
 */
export async function runSyntheticTests(monitorBus = MW_MONITOR) {
  monitorBus.log("TEST", "Starting synthetic tests", null, "info");

  // Test 1: Log at different levels
  monitorBus.log("TEST", "Info level test", { test: 1 }, "info");
  monitorBus.log("TEST", "Warn level test", { test: 2 }, "warn");
  monitorBus.log("TEST", "Error level test", { test: 3 }, "error");

  // Test 2: Simulate network call
  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    monitorBus.log("TEST", "Simulated network success", { ms: 100 }, "info");
  } catch (err) {
    monitorBus.log("TEST", "Simulated network failure", { error: String(err) }, "error");
  }

  // Test 3: Storage health
  await checkStorageHealth();

  monitorBus.log("TEST", "Synthetic tests complete", null, "info");
}

// Export for global access
if (typeof window !== 'undefined') {
  window.MW_MONITOR = MW_MONITOR;
}
