/**
 * Patient Card - Main list item component
 * Clinical-grade card with status borders, icons, and visual hierarchy
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { EventBus, Events } from '../../core/events.js';

export function PatientCard(patient) {
  const tasks = Data.tasks.pending(patient.id);
  const taskCount = tasks.length;

  const statusKey = patient.status || 'stable';
  const statusClass = {
    'stable': 'status-dot-stable',
    'attention': 'status-dot-attention',
    'critical': 'status-dot-critical'
  }[statusKey] || 'status-dot-stable';

  const statusLabel = {
    'stable': 'Stable',
    'attention': 'Attention',
    'critical': 'Critical'
  }[statusKey] || 'Stable';

  const statusBorderClass = {
    'stable': 'patient-card--stable',
    'attention': 'patient-card--attention',
    'critical': 'patient-card--critical'
  }[statusKey] || 'patient-card--stable';

  const card = document.createElement('div');
  card.className = `card card-interactive patient-card ${statusBorderClass}`;
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
            ${patient.mrn ? `<span class="patient-mrn">MRN ${escapeHtml(patient.mrn)}</span>` : ''}
          </div>
        </div>
        <div class="patient-card-right">
          <button class="patient-scan-btn" data-scan-patient="${escapeHtml(patient.name)}" title="Scan Lab Report">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </button>
          ${taskCount > 0 ? `
            <span class="badge badge-count">${taskCount}</span>
          ` : ''}
          <span class="patient-status-badge patient-status-badge--${statusKey}">${statusLabel}</span>
        </div>
      </div>

      ${patient.diagnosis ? `
        <p class="patient-card-diagnosis truncate">
          ${escapeHtml(patient.diagnosis)}
        </p>
      ` : ''}
    </div>
  `;

  // Scan button handler - navigate to lab scanner with patient context
  const scanBtn = card.querySelector('.patient-scan-btn');
  if (scanBtn) {
    scanBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Dynamic import to avoid circular deps
      import('../pages/lab-scanner.js').then(({ triggerPatientLabScan }) => {
        triggerPatientLabScan(patient.name);
      });
    });
  }

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
  card.className = 'card patient-card patient-card--stable';
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
