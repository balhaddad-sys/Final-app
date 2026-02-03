/**
 * Utility Helpers
 */

/**
 * Debounce a function
 */
export function debounce(fn, ms = 200) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Throttle a function
 */
export function throttle(fn, ms = 100) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

/**
 * Format date relative to now
 */
export function formatRelativeDate(timestamp) {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return formatDate(timestamp);
}

/**
 * Format date to locale string
 */
export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format time
 */
export function formatTime(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format date and time
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '';
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

/**
 * Generate a short ID
 */
export function shortId() {
  return crypto.randomUUID().split('-')[0];
}

/**
 * Deep clone an object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sleep for a given duration
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe HTML escape
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pluralize a word
 */
export function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}
