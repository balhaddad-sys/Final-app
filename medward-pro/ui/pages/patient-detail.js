/**
 * Patient Detail - Slide-up panel view
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { EventBus, Events } from '../../core/events.js';
import { Router } from '../../core/router.js';
import { TaskItem, AddTaskForm } from '../components/task-item.js';
import { openModal, closeModal } from '../components/modal.js';

let _unsubscribers = [];

export function renderPatientDetail(container, params) {
  // Clean up previous
  _unsubscribers.forEach(unsub => unsub());
  _unsubscribers = [];

  const patientId = params.id;
  const patient = Data.patients.get(patientId);

  if (!patient) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Patient not found</h3>
        <p>This patient may have been removed.</p>
        <button class="btn btn-primary" onclick="location.hash='/'">Go Back</button>
      </div>
    `;
    return;
  }

  Store.set({ currentPatientId: patientId });

  const statusLabel = {
    'stable': 'Stable',
    'attention': 'Needs Attention',
    'critical': 'Critical'
  }[patient.status] || 'Stable';

  const statusClass = {
    'stable': 'status-dot-stable',
    'attention': 'status-dot-attention',
    'critical': 'status-dot-critical'
  }[patient.status] || 'status-dot-stable';

  container.innerHTML = `
    <div class="page-patient-detail">
      <!-- Header -->
      <div class="patient-detail-header">
        <button class="patient-detail-back" id="back-btn" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="patient-detail-name">
          <h2 class="patient-name">${escapeHtml(patient.name)}</h2>
          <div class="patient-detail-status">
            <span class="status-dot ${statusClass}"></span>
            <span>${statusLabel}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon" id="patient-menu-btn" aria-label="More options">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
          </svg>
        </button>
      </div>

      <!-- Patient Info -->
      <div class="patient-info-grid">
        <div class="patient-info-item">
          <div class="patient-info-label">Bed</div>
          <div class="patient-info-value">${escapeHtml(patient.bed) || 'N/A'}</div>
        </div>
        <div class="patient-info-item">
          <div class="patient-info-label">MRN</div>
          <div class="patient-info-value">${escapeHtml(patient.mrn) || 'N/A'}</div>
        </div>
        <div class="patient-info-item">
          <div class="patient-info-label">Age</div>
          <div class="patient-info-value clinical-value">${patient.age || 'N/A'}</div>
        </div>
        <div class="patient-info-item">
          <div class="patient-info-label">Status</div>
          <div class="patient-info-value">
            <select class="input" id="status-select" style="padding: var(--space-1) var(--space-2); font-size: var(--text-sm);">
              <option value="stable" ${patient.status === 'stable' ? 'selected' : ''}>Stable</option>
              <option value="attention" ${patient.status === 'attention' ? 'selected' : ''}>Attention</option>
              <option value="critical" ${patient.status === 'critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>
      </div>

      ${patient.diagnosis ? `
        <div class="card" style="padding: var(--space-4); margin-bottom: var(--space-4);">
          <div class="patient-info-label" style="margin-bottom: var(--space-1);">Diagnosis</div>
          <div style="font-size: var(--text-sm);">${escapeHtml(patient.diagnosis)}</div>
        </div>
      ` : ''}

      <!-- Tasks -->
      <div class="tasks-section">
        <div class="tasks-section-header">
          <h3>Tasks</h3>
          <span class="badge badge-primary" id="task-count">0</span>
        </div>
        <div class="task-list" id="task-list">
          <!-- Tasks render here -->
        </div>
        <div id="add-task-container" style="margin-top: var(--space-3);"></div>
      </div>

      <!-- Notes -->
      <div class="notes-section">
        <h3>Notes</h3>
        <textarea
          class="input notes-textarea"
          id="patient-notes"
          placeholder="Clinical notes..."
        >${escapeHtml(patient.notes || '')}</textarea>
      </div>

      <!-- Actions -->
      <div class="patient-actions">
        <button class="btn btn-secondary" id="edit-patient-btn" style="flex: 1;">Edit Details</button>
        <button class="btn btn-danger" id="discharge-btn" style="flex: 1;">Discharge</button>
      </div>
    </div>
  `;

  // Setup interactions
  setupBackButton(container);
  setupStatusChange(container, patientId);
  setupNotes(container, patientId);
  setupActions(container, patientId, patient);
  renderTasks(patientId);
  setupAddTaskForm(patientId);

  // Subscribe to task changes
  _unsubscribers.push(EventBus.on('store:tasks', () => renderTasks(patientId)));
}

function renderTasks(patientId) {
  const taskList = document.getElementById('task-list');
  const taskCount = document.getElementById('task-count');
  if (!taskList) return;

  const tasks = Data.tasks.list(patientId);
  const pendingCount = tasks.filter(t => !t.completed).length;

  if (taskCount) taskCount.textContent = pendingCount;

  taskList.innerHTML = '';

  if (tasks.length === 0) {
    taskList.innerHTML = '<p style="font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-2);">No tasks yet</p>';
    return;
  }

  // Show pending first, then completed
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.createdAt - b.createdAt;
  });

  sorted.forEach(task => {
    taskList.appendChild(TaskItem(task));
  });
}

function setupAddTaskForm(patientId) {
  const formContainer = document.getElementById('add-task-container');
  if (!formContainer) return;

  formContainer.appendChild(AddTaskForm(patientId, () => renderTasks(patientId)));
}

function setupBackButton(container) {
  container.querySelector('#back-btn')?.addEventListener('click', () => {
    Router.navigate('/');
  });
}

function setupStatusChange(container, patientId) {
  container.querySelector('#status-select')?.addEventListener('change', async (e) => {
    try {
      await Data.patients.update(patientId, { status: e.target.value });
      EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Status updated' });
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });
}

function setupNotes(container, patientId) {
  const notesEl = container.querySelector('#patient-notes');
  let saveTimer;

  notesEl?.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await Data.patients.update(patientId, { notes: notesEl.value });
      } catch (error) {
        console.error('[PatientDetail] Failed to save notes:', error);
      }
    }, 1000);
  });
}

function setupActions(container, patientId, patient) {
  // Edit button
  container.querySelector('#edit-patient-btn')?.addEventListener('click', () => {
    openEditModal(patientId, patient);
  });

  // Discharge button
  container.querySelector('#discharge-btn')?.addEventListener('click', async () => {
    if (confirm(`Discharge ${patient.name}? This will archive the patient.`)) {
      try {
        await Data.patients.discharge(patientId);
        EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Patient discharged' });
        Router.navigate('/');
      } catch (error) {
        EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
      }
    }
  });

  // Menu button
  container.querySelector('#patient-menu-btn')?.addEventListener('click', () => {
    openPatientMenu(patientId, patient);
  });
}

function openEditModal(patientId, patient) {
  const form = document.createElement('form');
  form.innerHTML = `
    <div class="input-group">
      <label class="input-label">Patient Name *</label>
      <input type="text" class="input" name="name" value="${escapeHtml(patient.name)}" required>
    </div>
    <div class="form-row" style="margin-top: var(--space-3);">
      <div class="input-group">
        <label class="input-label">Bed</label>
        <input type="text" class="input" name="bed" value="${escapeHtml(patient.bed || '')}">
      </div>
      <div class="input-group">
        <label class="input-label">MRN</label>
        <input type="text" class="input" name="mrn" value="${escapeHtml(patient.mrn || '')}">
      </div>
    </div>
    <div class="input-group" style="margin-top: var(--space-3);">
      <label class="input-label">Diagnosis</label>
      <input type="text" class="input" name="diagnosis" value="${escapeHtml(patient.diagnosis || '')}">
    </div>
    <div class="input-group" style="margin-top: var(--space-3);">
      <label class="input-label">Age</label>
      <input type="number" class="input" name="age" value="${patient.age || ''}">
    </div>
    <button type="submit" class="btn btn-primary btn-lg" style="width: 100%; margin-top: var(--space-4);">
      Save Changes
    </button>
  `;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    if (data.age) data.age = parseInt(data.age, 10);

    try {
      await Data.patients.update(patientId, data);
      closeModal();
      EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Patient updated' });
      // Re-render detail
      const container = document.getElementById('app');
      if (container) renderPatientDetail(container, { id: patientId });
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });

  openModal({ title: 'Edit Patient', content: form });
}

function openPatientMenu(patientId, patient) {
  const menu = document.createElement('div');
  menu.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: var(--space-2);">
      <button class="btn btn-ghost" id="menu-delete" style="justify-content: flex-start; color: var(--danger);">
        Delete Patient
      </button>
    </div>
  `;

  menu.querySelector('#menu-delete')?.addEventListener('click', async () => {
    if (confirm(`Delete ${patient.name}? This action can be undone.`)) {
      try {
        await Data.patients.delete(patientId);
        closeModal();
        EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Patient deleted' });
        Router.navigate('/');
      } catch (error) {
        EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
      }
    }
  });

  openModal({ title: 'Options', content: menu });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

