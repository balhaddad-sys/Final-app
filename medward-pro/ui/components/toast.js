/**
 * Toast Notifications
 */
import { EventBus, Events } from '../../core/events.js';

let container = null;

export function initToasts() {
  container = document.createElement('div');
  container.className = 'toast-container';
  container.id = 'toast-container';
  document.body.appendChild(container);

  EventBus.on(Events.TOAST_SHOW, showToast);
}

export function showToast({ type = 'info', message, duration = 3000 }) {
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = {
    success: '\u2713',
    error: '\u2715',
    warning: '\u26A0',
    info: '\u2139'
  }[type] || '\u2139';

  toast.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
