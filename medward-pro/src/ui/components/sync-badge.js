// ui/components/sync-badge.js
// Sync status indicator

import { EventBus } from '../../core/core.events.js';
import { Storage } from '../../services/storage.adapter.js';
import { Sync } from '../../services/firebase.sync.js';

class SyncBadgeManager {
  constructor() {
    this.badge = null;
    this.status = 'disconnected';
    this.modal = null;
  }

  attach(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[SyncBadge] Container not found: ${containerId}`);
      return;
    }

    // Create badge element
    this.badge = document.createElement('div');
    this.badge.className = 'sync-badge';
    this.badge.innerHTML = this._getHTML();
    this.badge.setAttribute('role', 'status');
    this.badge.setAttribute('aria-live', 'polite');
    container.appendChild(this.badge);

    // Listen for status changes
    EventBus.on('sync:status', (status) => this.update(status));

    // Click to show details
    this.badge.addEventListener('click', () => this.showDetails());

    // Initial state
    this.update(navigator.onLine ? 'connected' : 'offline');

    return this;
  }

  update(status) {
    this.status = status;
    if (!this.badge) return;

    this.badge.innerHTML = this._getHTML();
    this.badge.className = `sync-badge sync-${status}`;

    // Update aria label
    const labels = {
      connected: 'Synced with server',
      syncing: 'Syncing data',
      offline: 'Working offline',
      error: 'Sync error',
      disconnected: 'Not connected'
    };
    this.badge.setAttribute('aria-label', labels[status] || 'Unknown status');
  }

  _getHTML() {
    const states = {
      connected: { icon: '<span class="sync-dot connected"></span>', text: 'Synced' },
      syncing: { icon: '<span class="sync-spinner"></span>', text: 'Syncing...' },
      offline: { icon: '<span class="sync-dot offline"></span>', text: 'Offline' },
      error: { icon: '<span class="sync-dot error"></span>', text: 'Sync Error' },
      disconnected: { icon: '<span class="sync-dot"></span>', text: 'Disconnected' }
    };

    const state = states[this.status] || states.disconnected;

    return `
      ${state.icon}
      <span class="sync-text">${state.text}</span>
    `;
  }

  async showDetails() {
    // Close existing modal
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
      return;
    }

    const stats = await Storage.wal.getStats();
    const syncStats = await Sync.getStats();

    this.modal = document.createElement('div');
    this.modal.className = 'modal-overlay';
    this.modal.innerHTML = `
      <div class="modal sync-modal">
        <div class="modal-header">
          <h3>Sync Status</h3>
          <button class="modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="sync-status-indicator sync-${this.status}">
            <span class="status-dot"></span>
            <span class="status-text">${this._getStatusText()}</span>
          </div>

          <div class="sync-stats">
            <div class="stat">
              <span class="stat-value">${stats.pending}</span>
              <span class="stat-label">Pending</span>
            </div>
            <div class="stat">
              <span class="stat-value">${stats.synced}</span>
              <span class="stat-label">Synced</span>
            </div>
            <div class="stat">
              <span class="stat-value">${stats.failed}</span>
              <span class="stat-label">Failed</span>
            </div>
          </div>

          <div class="sync-info">
            <p><strong>Online:</strong> ${syncStats.isOnline ? 'Yes' : 'No'}</p>
            <p><strong>Active Listeners:</strong> ${syncStats.activeListeners}</p>
            <p><strong>Currently Syncing:</strong> ${syncStats.isSyncing ? 'Yes' : 'No'}</p>
          </div>

          ${stats.pending > 0 ? `
            <div class="sync-warning">
              <p>You have ${stats.pending} change(s) waiting to sync.</p>
              <p class="text-muted">These will sync automatically when online.</p>
            </div>
          ` : ''}

          ${stats.failed > 0 ? `
            <div class="sync-error-info">
              <p>${stats.failed} change(s) failed to sync.</p>
              <button class="btn btn-secondary btn-sm retry-failed">Retry Failed</button>
            </div>
          ` : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary force-sync">Force Sync</button>
          <button class="btn btn-primary close-modal">Close</button>
        </div>
      </div>
    `;

    // Event handlers
    this.modal.querySelector('.modal-close').addEventListener('click', () => this.closeModal());
    this.modal.querySelector('.close-modal').addEventListener('click', () => this.closeModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.closeModal();
    });

    // Force sync button
    this.modal.querySelector('.force-sync').addEventListener('click', async () => {
      await Sync.flushOutbox();
      this.showDetails(); // Refresh modal
    });

    // Retry failed button
    const retryBtn = this.modal.querySelector('.retry-failed');
    if (retryBtn) {
      retryBtn.addEventListener('click', async () => {
        // Reset failed items to pending
        const all = await Storage.wal.getAll();
        for (const item of all.filter(i => i.status === 'failed_fatal')) {
          await Storage.wal.updateStatus(item.id, 'pending');
        }
        await Sync.flushOutbox();
        this.showDetails();
      });
    }

    document.body.appendChild(this.modal);

    // Animate in
    requestAnimationFrame(() => {
      this.modal.classList.add('modal-visible');
    });
  }

  closeModal() {
    if (this.modal) {
      this.modal.classList.remove('modal-visible');
      setTimeout(() => {
        this.modal?.remove();
        this.modal = null;
      }, 200);
    }
  }

  _getStatusText() {
    const texts = {
      connected: 'Connected and synced',
      syncing: 'Syncing changes...',
      offline: 'Working offline - changes saved locally',
      error: 'Sync error - some changes may not be saved',
      disconnected: 'Not connected to server'
    };
    return texts[this.status] || 'Unknown status';
  }

  destroy() {
    this.closeModal();
    if (this.badge) {
      this.badge.remove();
      this.badge = null;
    }
  }
}

export const SyncBadge = new SyncBadgeManager();
