/**
 * Unit Selection Page
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { Router } from '../../core/router.js';
import { EventBus, Events } from '../../core/events.js';
import { Storage } from '../../services/storage.adapter.js';
import { Sync } from '../../services/firebase.sync.js';
import { openModal, closeModal } from '../components/modal.js';

export function renderUnits(container) {
  container.innerHTML = `
    <div class="page-units">
      <header class="units-header">
        <h1>Select Ward</h1>
        <p>Choose a ward to manage</p>
      </header>

      <div class="units-grid" id="units-grid">
        <!-- Units render here -->
      </div>
    </div>
  `;

  const grid = container.querySelector('#units-grid');

  // Subscribe to units changes
  EventBus.on('store:units', () => renderUnitCards(grid));

  // Initial render
  renderUnitCards(grid);
}

function renderUnitCards(grid) {
  const units = Data.units.list();

  grid.innerHTML = '';

  units.forEach(unit => {
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.innerHTML = `
      <span class="unit-card-icon">${unit.icon || ''}</span>
      <span class="unit-card-name">${escapeHtml(unit.name)}</span>
    `;

    card.addEventListener('click', async () => {
      Store.set({ currentUnitId: unit.id });
      await Storage.meta.set('lastUnitId', unit.id);
      Sync.subscribeToUnit(unit.id);
      Router.navigate('/');
    });

    grid.appendChild(card);
  });

  // Add unit button
  const addCard = document.createElement('div');
  addCard.className = 'unit-card add-unit-card';
  addCard.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
    <span class="unit-card-name">New Ward</span>
  `;

  addCard.addEventListener('click', openAddUnitModal);
  grid.appendChild(addCard);
}

function openAddUnitModal() {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="input-group">
      <label class="input-label" for="unit-name">Ward Name *</label>
      <input type="text" class="input" id="unit-name" name="name" required autofocus placeholder="e.g., Internal Medicine">
    </div>
    <div class="input-group" style="margin-top: var(--space-3);">
      <label class="input-label" for="unit-icon">Icon</label>
      <div style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2);">
        ${['', '', '', '', '', '', '', ''].map(icon => `
          <button type="button" class="icon-picker-btn ${icon === '' ? 'selected' : ''}" data-icon="${icon}"
            style="width: 44px; height: 44px; font-size: 1.5rem; border: 2px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-surface); cursor: pointer;">
            ${icon}
          </button>
        `).join('')}
      </div>
      <input type="hidden" name="icon" id="unit-icon" value="">
    </div>
    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: var(--space-4);">
      Create Ward
    </button>
  `;

  // Icon picker
  form.querySelectorAll('.icon-picker-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      form.querySelectorAll('.icon-picker-btn').forEach(b => {
        b.style.borderColor = 'var(--border-default)';
      });
      btn.style.borderColor = 'var(--primary)';
      form.querySelector('#unit-icon').value = btn.dataset.icon;
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      await Data.units.create(data);
      closeModal();
      EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Ward created' });
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });

  openModal({
    id: 'add-unit-modal',
    title: 'Create New Ward',
    content: form
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
