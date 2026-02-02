// features/patients/patient.ui.js
// Patient UI rendering functions

import { PatientService } from './patient.service.js';
import { TaskService } from '../tasks/task.service.js';

export const PatientUI = {
  // Render patient card HTML
  renderCard(patient, options = {}) {
    const { showTasks = true, compact = false } = options;
    const stats = showTasks ? TaskService.getStats(patient.id) : null;

    const initials = this._getInitials(patient.name);
    const statusClass = `status-${patient.status || 'active'}`;

    return `
      <div class="patient-card ${compact ? 'patient-card-compact' : ''} ${statusClass}">
        <div class="patient-header">
          <div class="patient-avatar">${initials}</div>
          <div class="patient-info">
            <h4 class="patient-name">${this._escapeHtml(patient.name)}</h4>
            <div class="patient-meta">
              ${patient.mrn ? `<span class="patient-mrn">MRN: ${this._escapeHtml(patient.mrn)}</span>` : ''}
              ${patient.bed ? `<span class="patient-bed">Bed: ${this._escapeHtml(patient.bed)}</span>` : ''}
            </div>
          </div>
          ${patient.status !== 'active' ? `
            <span class="patient-status-badge">${patient.status}</span>
          ` : ''}
        </div>
        ${patient.diagnosis ? `
          <div class="patient-diagnosis">
            <span class="diagnosis-label">Dx:</span>
            <span class="diagnosis-text">${this._escapeHtml(patient.diagnosis)}</span>
          </div>
        ` : ''}
        ${stats && !compact ? `
          <div class="patient-tasks-summary">
            <span class="tasks-pending ${stats.urgent > 0 ? 'has-urgent' : ''}">
              ${stats.pending} pending ${stats.urgent > 0 ? `(${stats.urgent} urgent)` : ''}
            </span>
            <span class="tasks-completed">${stats.completed} done</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  // Render patient list item (for sidebar/list view)
  renderListItem(patient) {
    const stats = TaskService.getStats(patient.id);
    const initials = this._getInitials(patient.name);
    const hasUrgent = stats.urgent > 0;

    return `
      <div class="patient-item" data-id="${patient.id}">
        <div class="patient-avatar ${hasUrgent ? 'has-urgent' : ''}">${initials}</div>
        <div class="patient-info">
          <span class="patient-name">${this._escapeHtml(patient.name)}</span>
          <span class="patient-meta">
            ${patient.bed ? `Bed ${this._escapeHtml(patient.bed)}` : ''}
            ${stats.pending > 0 ? ` - ${stats.pending} tasks` : ''}
          </span>
        </div>
        ${hasUrgent ? '<span class="urgent-indicator" title="Has urgent tasks">!</span>' : ''}
      </div>
    `;
  },

  // Render patient detail view
  renderDetail(patient) {
    const stats = TaskService.getStats(patient.id);
    const tasks = TaskService.getByPatient(patient.id);
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    return `
      <div class="patient-detail">
        <div class="patient-detail-header">
          <div class="patient-avatar large">${this._getInitials(patient.name)}</div>
          <div class="patient-detail-info">
            <h2>${this._escapeHtml(patient.name)}</h2>
            <div class="patient-detail-meta">
              ${patient.mrn ? `<span>MRN: ${this._escapeHtml(patient.mrn)}</span>` : ''}
              ${patient.bed ? `<span>Bed: ${this._escapeHtml(patient.bed)}</span>` : ''}
              <span class="patient-status-badge status-${patient.status}">${patient.status}</span>
            </div>
          </div>
          <div class="patient-actions">
            <button class="btn btn-icon" data-action="edit" title="Edit patient">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-icon" data-action="menu" title="More options">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </button>
          </div>
        </div>

        ${patient.diagnosis ? `
          <div class="patient-detail-section">
            <h4>Diagnosis</h4>
            <p>${this._escapeHtml(patient.diagnosis)}</p>
          </div>
        ` : ''}

        ${patient.notes ? `
          <div class="patient-detail-section">
            <h4>Notes</h4>
            <p>${this._escapeHtml(patient.notes)}</p>
          </div>
        ` : ''}

        <div class="patient-detail-section">
          <div class="section-header">
            <h4>Tasks</h4>
            <button class="btn btn-sm btn-primary" data-action="add-task">+ Add Task</button>
          </div>

          <div class="task-stats">
            <span class="stat">${stats.pending} pending</span>
            <span class="stat">${stats.completed} completed</span>
            ${stats.urgent > 0 ? `<span class="stat urgent">${stats.urgent} urgent</span>` : ''}
          </div>

          <div class="task-list" id="patient-tasks">
            ${pendingTasks.length > 0 ? `
              <div class="task-group">
                <h5>Pending</h5>
                ${pendingTasks.map(t => this.renderTask(t)).join('')}
              </div>
            ` : ''}

            ${completedTasks.length > 0 ? `
              <div class="task-group task-group-completed">
                <h5>Completed (${completedTasks.length})</h5>
                ${completedTasks.map(t => this.renderTask(t)).join('')}
              </div>
            ` : ''}

            ${tasks.length === 0 ? `
              <div class="empty-tasks">
                <p>No tasks yet</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  // Render task item
  renderTask(task) {
    const priorityClass = task.priority === 'urgent' ? 'task-urgent' : '';
    const completedClass = task.completed ? 'task-completed' : '';

    return `
      <div class="task-item ${priorityClass} ${completedClass}" data-id="${task.id}">
        <label class="task-checkbox">
          <input type="checkbox" ${task.completed ? 'checked' : ''} data-action="toggle-task">
          <span class="checkmark"></span>
        </label>
        <div class="task-content">
          <span class="task-text">${this._escapeHtml(task.text)}</span>
          <span class="task-category">${task.category || 'general'}</span>
        </div>
        <button class="btn btn-icon btn-sm task-delete" data-action="delete-task" title="Delete task">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
  },

  // Render patient form
  renderForm(patient = null) {
    const isEdit = !!patient;

    return `
      <form class="patient-form" id="patient-form">
        <div class="form-group">
          <label class="form-label" for="patient-name">Name *</label>
          <input type="text" id="patient-name" name="name" class="form-input" required
                 value="${patient?.name ? this._escapeHtml(patient.name) : ''}"
                 placeholder="Patient name">
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="patient-mrn">MRN</label>
            <input type="text" id="patient-mrn" name="mrn" class="form-input"
                   value="${patient?.mrn ? this._escapeHtml(patient.mrn) : ''}"
                   placeholder="Medical record number">
          </div>
          <div class="form-group">
            <label class="form-label" for="patient-bed">Bed</label>
            <input type="text" id="patient-bed" name="bed" class="form-input"
                   value="${patient?.bed ? this._escapeHtml(patient.bed) : ''}"
                   placeholder="Bed number">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="patient-diagnosis">Diagnosis</label>
          <textarea id="patient-diagnosis" name="diagnosis" class="form-input" rows="2"
                    placeholder="Primary diagnosis">${patient?.diagnosis ? this._escapeHtml(patient.diagnosis) : ''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="patient-notes">Notes</label>
          <textarea id="patient-notes" name="notes" class="form-input" rows="3"
                    placeholder="Additional notes">${patient?.notes ? this._escapeHtml(patient.notes) : ''}</textarea>
        </div>

        <div class="form-actions">
          <button type="button" class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Add'} Patient</button>
        </div>
      </form>
    `;
  },

  // Helper: Get initials from name
  _getInitials(name) {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  },

  // Helper: Escape HTML
  _escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};
