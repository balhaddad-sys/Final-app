/**
 * Settings Page
 */
import { Store } from '../../core/store.js';
import { Auth } from '../../services/firebase.auth.js';
import { Storage } from '../../services/storage.adapter.js';
import { EventBus, Events } from '../../core/events.js';
import { Router } from '../../core/router.js';

export function renderSettings(container) {
  const user = Store.get('user');
  const isDark = document.body.classList.contains('dark-theme');

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  container.innerHTML = `
    <div class="page-settings">
      <header class="settings-header">
        <h1>Settings</h1>
      </header>

      <!-- User Card -->
      <div class="settings-user-card">
        <div class="settings-user-avatar">${initials}</div>
        <div class="settings-user-info">
          <h3>${escapeHtml(user?.displayName || 'User')}</h3>
          <p>${escapeHtml(user?.email || '')}</p>
        </div>
      </div>

      <!-- Appearance -->
      <div class="settings-section">
        <div class="settings-section-title">Appearance</div>
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Dark Mode</div>
              <div class="settings-item-desc">Reduce eye strain in low light</div>
            </div>
            <button class="toggle ${isDark ? 'active' : ''}" id="dark-mode-toggle" aria-label="Toggle dark mode"></button>
          </div>
        </div>
      </div>

      <!-- Ward -->
      <div class="settings-section">
        <div class="settings-section-title">Ward</div>
        <div class="settings-group">
          <div class="settings-item" id="change-ward-btn" style="cursor: pointer;">
            <div class="settings-item-info">
              <div class="settings-item-label">Current Ward</div>
              <div class="settings-item-desc" id="current-ward-name">${escapeHtml(Store.currentUnit?.name || 'None selected')}</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <!-- Data -->
      <div class="settings-section">
        <div class="settings-section-title">Data</div>
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">Sync Status</div>
              <div class="settings-item-desc" id="sync-status-text">${Store.get('syncStatus') || 'Unknown'}</div>
            </div>
          </div>
          <div class="settings-item" id="clear-cache-btn" style="cursor: pointer;">
            <div class="settings-item-info">
              <div class="settings-item-label">Clear Local Cache</div>
              <div class="settings-item-desc">Remove cached data (will re-sync)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="settings-section">
        <div class="settings-section-title">About</div>
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item-info">
              <div class="settings-item-label">MedWard Pro</div>
              <div class="settings-item-desc">Clinical Ward Management</div>
            </div>
            <div class="settings-item-value">v1.0.0</div>
          </div>
        </div>
      </div>

      <!-- Logout -->
      <button class="btn btn-danger btn-lg settings-logout-btn" id="logout-btn">
        Sign Out
      </button>

      <p class="settings-version">MedWard Pro v1.0.0</p>
    </div>
  `;

  // Dark mode toggle
  container.querySelector('#dark-mode-toggle')?.addEventListener('click', async (e) => {
    const toggle = e.currentTarget;
    const isNowDark = !document.body.classList.contains('dark-theme');

    document.body.classList.toggle('dark-theme', isNowDark);
    toggle.classList.toggle('active', isNowDark);

    await Storage.meta.set('theme', isNowDark ? 'dark' : 'light');
  });

  // Change ward
  container.querySelector('#change-ward-btn')?.addEventListener('click', () => {
    Store.set({ currentUnitId: null });
    Router.navigate('/units');
  });

  // Clear cache
  container.querySelector('#clear-cache-btn')?.addEventListener('click', async () => {
    if (confirm('Clear all cached data? The app will re-sync from the server.')) {
      try {
        await Storage.clear('patients');
        await Storage.clear('tasks');
        EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Cache cleared' });
        location.reload();
      } catch (error) {
        EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
      }
    }
  });

  // Logout
  container.querySelector('#logout-btn')?.addEventListener('click', async () => {
    if (confirm('Sign out of MedWard Pro?')) {
      await Auth.logout();
      Router.navigate('/login');
    }
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
