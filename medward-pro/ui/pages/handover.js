/**
 * Handover Page
 * Patient selection, QR generation, and receiving
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { Handover } from '../../services/handover.service.js';
import { EventBus, Events } from '../../core/events.js';
import { openModal, closeModal } from '../components/modal.js';

let selectedPatients = new Set();

export function renderHandover(container) {
  container.innerHTML = `
    <div class="page-handover">
      <header class="handover-header">
        <h2>Patient Handover</h2>
      </header>

      <div class="handover-tabs">
        <button class="tab-btn active" data-tab="send">Send Handover</button>
        <button class="tab-btn" data-tab="receive">Receive Handover</button>
      </div>

      <!-- Send Tab -->
      <div class="handover-tab-content" id="tab-send">
        <div class="handover-section">
          <h3>Select Patients</h3>
          <p style="font-size: var(--text-sm); color: var(--text-secondary);">Choose patients to hand over to the next team</p>

          <div class="patient-select-list" id="patient-select-list">
            <!-- Patient checkboxes render here -->
          </div>
        </div>

        <div class="handover-actions">
          <div class="handover-count">
            <span id="selected-count">0</span> patients selected
          </div>
          <button class="btn btn-primary btn-lg" id="generate-qr" disabled>
            Generate QR Code
          </button>
        </div>
      </div>

      <!-- Receive Tab -->
      <div class="handover-tab-content hidden" id="tab-receive">
        <div class="handover-section receive-section">
          <div class="receive-icon">📷</div>
          <h3>Scan Handover QR</h3>
          <p style="font-size: var(--text-sm); color: var(--text-secondary);">Scan the QR code from the sending device to receive patients</p>

          <button class="btn btn-primary btn-lg" id="scan-qr" style="margin-top: var(--space-4);">
            <span>📷</span> Scan QR Code
          </button>

          <div class="receive-divider">
            <span>or</span>
          </div>

          <button class="btn btn-secondary" id="enter-code">
            Enter Code Manually
          </button>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  const tabs = container.querySelectorAll('.tab-btn');
  const tabContents = container.querySelectorAll('.handover-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabContents.forEach(content => {
        content.classList.toggle('hidden', content.id !== `tab-${tab.dataset.tab}`);
      });
    });
  });

  // Render patient list
  renderPatientSelectList(container);

  // Generate QR
  container.querySelector('#generate-qr').addEventListener('click', generateQR);

  // Scan QR
  container.querySelector('#scan-qr').addEventListener('click', scanQR);

  // Manual code entry
  container.querySelector('#enter-code').addEventListener('click', enterCodeManually);
}

function renderPatientSelectList(container) {
  const listEl = container.querySelector('#patient-select-list');
  const patients = Store.activePatients;

  if (patients.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No active patients to hand over</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = patients.map(patient => `
    <label class="patient-select-item card card-borderless" data-patient-id="${patient.id}">
      <input type="checkbox" class="patient-checkbox" value="${patient.id}" />
      <div class="patient-select-info">
        <span class="patient-name">${escapeHtml(patient.name)}</span>
        <span class="patient-meta">
          ${patient.bed ? `Bed ${escapeHtml(patient.bed)}` : ''}
          ${patient.diagnosis ? `• ${escapeHtml(patient.diagnosis)}` : ''}
        </span>
      </div>
      <span class="badge badge-count">${Data.tasks.pending(patient.id).length}</span>
    </label>
  `).join('');

  // Checkbox handlers
  listEl.querySelectorAll('.patient-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selectedPatients.add(checkbox.value);
      } else {
        selectedPatients.delete(checkbox.value);
      }
      updateSelectedCount(container);
    });
  });
}

function updateSelectedCount(container) {
  const countEl = container.querySelector('#selected-count');
  const generateBtn = container.querySelector('#generate-qr');

  countEl.textContent = selectedPatients.size;
  generateBtn.disabled = selectedPatients.size === 0;
}

async function generateQR() {
  if (selectedPatients.size === 0) return;

  try {
    const { handover, qrDataUrl, expiresIn } = await Handover.generateHandover(
      Array.from(selectedPatients)
    );

    // Show QR modal
    const content = document.createElement('div');
    content.className = 'qr-display';
    content.innerHTML = `
      <div class="qr-image-container">
        <img src="${qrDataUrl}" alt="Handover QR Code" class="qr-image" />
      </div>

      <div class="qr-info">
        <h4>${handover.patientCount} Patient${handover.patientCount > 1 ? 's' : ''}</h4>
        <p style="color: var(--text-secondary); font-size: var(--text-sm);">
          ${handover.patients.map(p => escapeHtml(p.name)).join(', ')}
        </p>
      </div>

      <div class="qr-expiry">
        <span class="qr-expiry-icon">⏱️</span>
        <span>Expires in <strong id="expiry-countdown">${Math.floor(expiresIn / 60)}:00</strong></span>
      </div>

      <div class="qr-actions" style="margin-top: var(--space-4);">
        <button class="btn btn-secondary" id="print-handover" style="width: 100%;">
          🖨️ Print Summary
        </button>
      </div>
    `;

    openModal({
      id: 'qr-modal',
      title: 'Handover QR Code',
      content
    });

    // Countdown timer
    let remaining = expiresIn;
    const countdownEl = content.querySelector('#expiry-countdown');
    const interval = setInterval(() => {
      remaining--;
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      countdownEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

      if (remaining <= 0) {
        clearInterval(interval);
        closeModal();
        EventBus.emit(Events.TOAST_SHOW, { type: 'warning', message: 'Handover QR expired' });
      }
    }, 1000);

    // Print handler
    content.querySelector('#print-handover').addEventListener('click', () => {
      printHandoverSummary(handover);
    });

  } catch (error) {
    EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
  }
}

async function scanQR() {
  try {
    const qrData = await Handover.scanQR();

    // Fetch full handover data
    const handover = await Handover.fetchHandover(qrData.id, qrData.hash);

    // Show confirmation modal
    showReceiveConfirmation(handover);

  } catch (error) {
    if (error.message !== 'Cancelled') {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  }
}

function showReceiveConfirmation(handover) {
  const content = document.createElement('div');
  content.className = 'receive-confirmation';
  content.innerHTML = `
    <div class="receive-from">
      <span style="color: var(--text-secondary); font-size: var(--text-sm);">From:</span>
      <strong>${escapeHtml(handover.fromUser.name || handover.fromUser.email)}</strong>
      <span style="color: var(--text-muted); font-size: var(--text-sm);">${escapeHtml(handover.fromUnit.name)}</span>
    </div>

    <div class="receive-patients">
      <h4>${handover.patientCount} Patient${handover.patientCount > 1 ? 's' : ''}</h4>
      <ul class="receive-patient-list">
        ${handover.patients.map(p => `
          <li>
            <span class="patient-name">${escapeHtml(p.name)}</span>
            ${p.bed ? `<span style="font-size: var(--text-sm); color: var(--text-secondary);">Bed ${escapeHtml(p.bed)}</span>` : ''}
            <span class="badge badge-count" style="margin-left: auto;">${(p.tasks || []).length} tasks</span>
          </li>
        `).join('')}
      </ul>
    </div>

    <div class="receive-actions">
      <button class="btn btn-secondary" id="decline-handover">Decline</button>
      <button class="btn btn-primary" id="accept-handover">Accept Handover</button>
    </div>
  `;

  openModal({
    id: 'receive-modal',
    title: 'Incoming Handover',
    content
  });

  // Handlers
  content.querySelector('#decline-handover').addEventListener('click', () => {
    closeModal();
  });

  content.querySelector('#accept-handover').addEventListener('click', async () => {
    try {
      const targetUnitId = Store.get('currentUnitId');
      const results = await Handover.acceptHandover(handover, targetUnitId);

      closeModal();

      if (results.failed.length === 0) {
        EventBus.emit(Events.TOAST_SHOW, {
          type: 'success',
          message: `Received ${results.success.length} patient${results.success.length > 1 ? 's' : ''}`
        });
      } else {
        EventBus.emit(Events.TOAST_SHOW, {
          type: 'warning',
          message: `Received ${results.success.length}, failed ${results.failed.length}`
        });
      }

    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: error.message });
    }
  });
}

function enterCodeManually() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="input-group">
      <label class="input-label">Handover Code</label>
      <input type="text" class="input" id="manual-code" placeholder="Enter code from sending device" />
    </div>
    <button class="btn btn-primary btn-lg" id="submit-code" style="width: 100%; margin-top: var(--space-4);">
      Retrieve Handover
    </button>
  `;

  openModal({
    id: 'manual-code-modal',
    title: 'Enter Handover Code',
    content
  });

  content.querySelector('#submit-code').addEventListener('click', async () => {
    const code = content.querySelector('#manual-code').value.trim();
    if (!code) return;

    try {
      const handover = await Handover.fetchHandover(code, null);
      closeModal();
      showReceiveConfirmation(handover);
    } catch (error) {
      EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: 'Invalid code' });
    }
  });
}

function printHandoverSummary(handover) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Handover Summary</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 8px; }
        .patient { margin-bottom: 24px; page-break-inside: avoid; }
        .patient-header { display: flex; justify-content: space-between; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
        .patient-name { font-weight: bold; font-size: 16px; }
        .tasks { margin-left: 20px; }
        .task { margin: 4px 0; }
        .meta { color: #666; font-size: 12px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>Patient Handover - ${new Date().toLocaleDateString()}</h1>
      <p class="meta">From: ${escapeHtml(handover.fromUser.name || handover.fromUser.email)} | Unit: ${escapeHtml(handover.fromUnit.name)}</p>

      ${handover.patients.map(p => `
        <div class="patient">
          <div class="patient-header">
            <span class="patient-name">${escapeHtml(p.name)}</span>
            <span>${p.bed ? `Bed ${escapeHtml(p.bed)}` : ''} ${p.mrn ? `| MRN: ${escapeHtml(p.mrn)}` : ''}</span>
          </div>
          <p><strong>Diagnosis:</strong> ${escapeHtml(p.diagnosis || 'Not specified')}</p>
          ${p.notes ? `<p><strong>Notes:</strong> ${escapeHtml(p.notes)}</p>` : ''}
          ${(p.tasks || []).length > 0 ? `
            <p><strong>Pending Tasks:</strong></p>
            <ul class="tasks">
              ${p.tasks.map(t => `<li class="task">${escapeHtml(t.text)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
