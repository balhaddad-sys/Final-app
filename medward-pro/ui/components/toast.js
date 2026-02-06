// ui/components/toast.js
// Toast notification system

import { EventBus } from '../../core/core.events.js';
import { Config } from '../../core/config.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.queue = [];
    this.maxVisible = 3;
  }

  init() {
    // Create container if it doesn't exist
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    }

    // Listen to events
    EventBus.on('toast:info', (msg) => this.show(msg, 'info'));
    EventBus.on('toast:success', (msg) => this.show(msg, 'success'));
    EventBus.on('toast:error', (msg) => this.show(msg, 'error'));
    EventBus.on('toast:warning', (msg) => this.show(msg, 'warning'));
  }

  show(message, type = 'info', duration = Config.TOAST_DURATION) {
    if (!this.container) {
      this.init();
    }

    // Limit visible toasts
    const visibleToasts = this.container.querySelectorAll('.toast:not(.toast-hiding)');
    if (visibleToasts.length >= this.maxVisible) {
      this.hide(visibleToasts[0]);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = {
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${this._escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Close">&times;</button>
    `;

    // Close button handler
    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.hide(toast);
    });

    // Click to dismiss
    toast.addEventListener('click', (e) => {
      if (e.target.classList.contains('toast')) {
        this.hide(toast);
      }
    });

    this.container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // Auto-hide
    if (duration > 0) {
      const timeoutId = setTimeout(() => this.hide(toast), duration);
      toast._timeoutId = timeoutId;
    }

    return toast;
  }

  hide(toast) {
    if (!toast || toast._hiding) return;

    toast._hiding = true;

    // Clear auto-hide timeout
    if (toast._timeoutId) {
      clearTimeout(toast._timeoutId);
    }

    toast.classList.remove('toast-visible');
    toast.classList.add('toast-hiding');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }

  hideAll() {
    const toasts = this.container?.querySelectorAll('.toast') || [];
    toasts.forEach(toast => this.hide(toast));
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convenience methods
  info(message, duration) {
    return this.show(message, 'info', duration);
  }

  success(message, duration) {
    return this.show(message, 'success', duration);
  }

  error(message, duration) {
    return this.show(message, 'error', duration);
  }

  warning(message, duration) {
    return this.show(message, 'warning', duration);
  }
}

export const Toast = new ToastManager();
