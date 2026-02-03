/**
 * Patient Card - Main list item component
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { EventBus, Events } from '../../core/events.js';

export function PatientCard(patient) {
  const tasks = Data.tasks.pending(patient.id);
  const taskCount = tasks.length;

  const statusClass = {
    'stable': 'status-dot-stable',
    'attention': 'status-dot-attention',
    'critical': 'status-dot-critical'
  }[patient.status] || 'status-dot-stable';

  const card = document.createElement('div');
  card.className = 'card card-interactive patient-card';
  card.dataset.patientId = patient.id;

  card.innerHTML = `
    <div class="patient-card-content">
      <div class="patient-card-header">
        <div class="patient-card-info">
          <div class="patient-card-name-row">
            <span class="status-dot ${statusClass}"></span>
            <h4 class="patient-name truncate">${escapeHtml(patient.name)}</h4>
          </div>
          <div class="patient-card-meta">
            ${patient.bed ? `<span class="patient-bed">Bed ${escapeHtml(patient.bed)}</span>` : ''}
            ${patient.mrn ? `<span class="patient-mrn">MRN: ${escapeHtml(patient.mrn)}</span>` : ''}
          </div>
        </div>
        ${taskCount > 0 ? `
          <span class="badge badge-count">${taskCount}</span>
        ` : ''}
      </div>

      ${patient.diagnosis ? `
        <p class="patient-card-diagnosis text-secondary truncate">
          ${escapeHtml(patient.diagnosis)}
        </p>
      ` : ''}
    </div>
  `;

  // Click handler
  card.addEventListener('click', () => {
    Store.set({ currentPatientId: patient.id });
    EventBus.emit(Events.PATIENT_SELECTED, patient);
  });

  return card;
}

// Skeleton version for loading state
export function PatientCardSkeleton() {
  const card = document.createElement('div');
  card.className = 'card patient-card';
  card.innerHTML = `
    <div class="patient-card-content">
      <div class="patient-card-header">
        <div class="patient-card-info">
          <div class="patient-card-name-row">
            <div class="skeleton" style="width: 8px; height: 8px; border-radius: 50%;"></div>
            <div class="skeleton" style="width: 140px; height: 20px;"></div>
          </div>
          <div class="patient-card-meta">
            <div class="skeleton" style="width: 60px; height: 14px;"></div>
            <div class="skeleton" style="width: 80px; height: 14px;"></div>
          </div>
        </div>
      </div>
      <div class="skeleton" style="width: 200px; height: 16px; margin-top: 8px;"></div>
    </div>
  `;
  return card;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
