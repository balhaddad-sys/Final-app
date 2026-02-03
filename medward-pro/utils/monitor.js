/**
 * Logging and Debugging Monitor
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const _logs = [];
const MAX_LOGS = 500;

export const Monitor = {
  _level: LOG_LEVELS.info,

  /**
   * Initialize monitor
   */
  init(options = {}) {
    this._level = LOG_LEVELS[options.level] || LOG_LEVELS.info;

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.logError('UNHANDLED', event.error || new Error(event.message));
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError('UNHANDLED_PROMISE', event.reason || new Error('Unhandled promise rejection'));
    });
  },

  /**
   * Log a message
   */
  log(category, message, data = null, level = 'info') {
    const entry = {
      timestamp: Date.now(),
      category,
      message,
      data,
      level
    };

    _logs.push(entry);
    if (_logs.length > MAX_LOGS) _logs.shift();

    if (LOG_LEVELS[level] >= this._level) {
      const method = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[method](`[${category}] ${message}`, data || '');
    }
  },

  /**
   * Log an error
   */
  logError(category, error, context = null) {
    this.log(category, error.message, {
      name: error.name,
      stack: error.stack,
      context
    }, 'error');
  },

  /**
   * Performance mark
   */
  mark(name) {
    try {
      performance.mark(name);
    } catch (e) { /* ignore */ }
  },

  /**
   * Performance measure
   */
  measure(name, startMark, endMark) {
    try {
      performance.measure(name, startMark, endMark);
    } catch (e) { /* ignore */ }
  },

  /**
   * Get all logs
   */
  getLogs(category = null) {
    if (category) {
      return _logs.filter(l => l.category === category);
    }
    return [..._logs];
  },

  /**
   * Clear logs
   */
  clearLogs() {
    _logs.length = 0;
  },

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(_logs, null, 2);
  }
};
