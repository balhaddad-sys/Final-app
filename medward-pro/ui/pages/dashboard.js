/**
 * Dashboard - Main patient list view
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { EventBus, Events } from '../../core/events.js';
import { Router } from '../../core/router.js';
import { PatientCard, PatientCardSkeleton } from '../components/patient-card.js';
import { openModal, closeModal } from '../components/modal.js';

let listContainer = null;
let _unsubscribers = [];

export function renderDashboard(container) {
  // Clean up previous subscriptions
  _unsubscribers.forEach(unsub => unsub());
  _unsubscribers = [];

  container.innerHTML = `
    <div class="page-dashboard">
      <!-- Header -->
      <header class="dashboard-header glass-header">
        <div class="dashboard-header-top">
          <div class="unit-info">
            <span class="unit-icon" id="unit-icon"></span>
            <h1 class="unit-name" id="unit-name">Loading...</h1>
          </div>
          <div class="dashboard-header-right">
            <span class="patient-count-badge" id="patient-count">0 patients</span>
            <div class="sync-indicator" id="sync-indicator">
              <span class="sync-icon">&#x27F3;</span>
              <span class="sync-text">Synced</span>
            </div>
          </div>
        </div>

        <!-- Search -->
        <div class="search-container">
          <input
            type="search"
            class="input search-input"
            id="patient-search"
            placeholder="Search patients..."
            autocomplete="off"
          >
        </div>

        <!-- Filter chips -->
        <div class="filter-chips" id="filter-chips">
          <button class="chip chip-active" data-filter="all">All</button>
          <button class="chip" data-filter="critical">Critical</button>
          <button class="chip" data-filter="pending-tasks">Pending Tasks</button>
        </div>
      </header>

      <!-- Patient List -->
      <main class="patient-list-container">
        <div class="patient-list" id="patient-list">
          <!-- Patients render here -->
        </div>

        <div class="empty-state hidden" id="empty-state">
          <div class="empty-state-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </div>
          <h3>No patients yet</h3>
          <p>Add your first patient to get started</p>
        </div>
      </main>

      <!-- FAB -->
      <button class="fab" id="add-patient-fab" aria-label="Add patient">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  `;

  listContainer = container.querySelector('#patient-list');

  // Event bindings
  setupSearch(container);
  setupFilters(container);
  setupFAB(container);

  // Subscribe to store updates
  _unsubscribers.push(EventBus.on('store:patients', renderPatientList));
  _unsubscribers.push(EventBus.on('store:tasks', renderPatientList));
  _unsubscribers.push(EventBus.on('store:searchQuery', renderPatientList));
  _unsubscribers.push(EventBus.on('store:patientFilter', renderPatientList));
  _unsubscribers.push(EventBus.on('store:currentUnitId', updateUnitInfo));
  _unsubscribers.push(EventBus.on(Events.SYNC_STATUS, updateSyncIndicator));

  // Patient selected -> navigate to detail
  _unsubscribers.push(EventBus.on(Events.PATIENT_SELECTED, (patient) => {
    Router.navigate(`/patients/${patient.id}`);
  }));

  // Initial render
  updateUnitInfo();
  renderPatientList();
}

function renderPatientList() {
  if (!listContainer) return;

  const patients = Store.filteredPatients;
  const emptyState = document.getElementById('empty-state');

  if (Store.get('isLoading')) {
    // Show skeletons
    listContainer.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      listContainer.appendChild(PatientCardSkeleton());
    }
    emptyState?.classList.add('hidden');
    return;
  }

  if (patients.length === 0) {
    listContainer.innerHTML = '';
    emptyState?.classList.remove('hidden');
    return;
  }

  emptyState?.classList.add('hidden');

  // Update patient count
  const countEl = document.getElementById('patient-count');
  if (countEl) countEl.textContent = `${patients.length} patient${patients.length !== 1 ? 's' : ''}`;

  // Full re-render for simplicity (keyed diffing can be added later)
  listContainer.innerHTML = '';
  patients.forEach(patient => {
    listContainer.appendChild(PatientCard(patient));
  });
}

function updateUnitInfo() {
  const unit = Store.currentUnit;
  const nameEl = document.getElementById('unit-name');
  const iconEl = document.getElementById('unit-icon');

  if (unit) {
    if (nameEl) nameEl.textContent = unit.name;
    if (iconEl) iconEl.textContent = unit.icon || '';
  }
}

function updateSyncIndicator(status) {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;

  indicator.className = `sync-indicator ${status === 'syncing' ? 'syncing' : ''}`;
  const text = indicator.querySelector('.sync-text');

  const labels = {
    connected: 'Synced',
    syncing: 'Syncing...',
    disconnected: 'Offline',
    error: 'Sync error'
  };

  if (text) text.textContent = labels[status] || 'Synced';
}

function setupSearch(container) {
  const input = container.querySelector('#patient-search');
  let debounceTimer;

  input?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      Store.set({ searchQuery: e.target.value });
    }, 200);
  });
}

function setupFilters(container) {
  const chips = container.querySelector('#filter-chips');

  chips?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;

    // Update active state
    chips.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
    chip.classList.add('chip-active');

    // Apply filter
    Store.set({ patientFilter: chip.dataset.filter });
  });
}

function setupFAB(container) {
  const fab = container.querySelector('#add-patient-fab');

  fab?.addEventListener('click', () => {
    openAddPatientModal();
  });
}

function openAddPatientModal() {
  const form = document.createElement('form');
  form.className = 'add-patient-form';
  form.innerHTML = `
    <div class="input-group">
      <label class="input-label" for="patient-name">Patient Name *</label>
      <input type="text" class="input" id="patient-name" name="name" required autofocus>
    </div>

    <div class="form-row" style="margin-top: var(--space-3);">
      <div class="input-group">
        <label class="input-label" for="patient-bed">Bed</label>
        <input type="text" class="input" id="patient-bed" name="bed" placeholder="e.g., 12A">
      </div>

      <div class="input-group">
        <label class="input-label" for="patient-mrn">MRN</label>
        <input type="text" class="input" id="patient-mrn" name="mrn">
      </div>
    </div>

    <div class="input-group" style="margin-top: var(--space-3);">
      <label class="input-label" for="patient-diagnosis">Diagnosis</label>
      <input type="text" class="input" id="patient-diagnosis" name="diagnosis" placeholder="Primary diagnosis">
    </div>

    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: var(--space-4);">
      Add Patient
    </button>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
      await Data.patients.add(data);
      closeModal();
      EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Patient added' });
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });

  openModal({
    id: 'add-patient-modal',
    title: 'Add Patient',
    content: form
  });
}
