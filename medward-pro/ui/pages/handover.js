/**
 * Handover Management Page
 */
import { Store } from '../../core/store.js';
import { Data } from '../../core/data.js';
import { EventBus, Events } from '../../core/events.js';

export function renderHandover(container) {
  container.innerHTML = `
    <div class="page-handover">
      <header class="handover-header">
        <h1>Handover</h1>
        <p>Patient summary for shift handover</p>
      </header>

      <div class="handover-list" id="handover-list">
        <!-- Handover cards render here -->
      </div>

      <div class="empty-state hidden" id="handover-empty">
        <div class="empty-state-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </div>
        <h3>No patients to hand over</h3>
        <p>Add patients to your ward first</p>
      </div>

      <div class="handover-actions">
        <button class="btn btn-primary btn-lg" id="copy-handover" style="flex: 1;">
          Copy to Clipboard
        </button>
        <button class="btn btn-secondary btn-lg" id="share-handover" style="flex: 1;">
          Share
        </button>
      </div>
    </div>
  `;

  renderHandoverList();

  // Subscribe to updates
  EventBus.on('store:patients', renderHandoverList);
  EventBus.on('store:tasks', renderHandoverList);

  // Copy button
  container.querySelector('#copy-handover')?.addEventListener('click', copyHandoverToClipboard);

  // Share button
  container.querySelector('#share-handover')?.addEventListener('click', shareHandover);
}

function renderHandoverList() {
  const listEl = document.getElementById('handover-list');
  const emptyEl = document.getElementById('handover-empty');
  if (!listEl) return;

  const patients = Store.activePatients;

  if (patients.length === 0) {
    listEl.innerHTML = '';
    emptyEl?.classList.remove('hidden');
    return;
  }

  emptyEl?.classList.add('hidden');
  listEl.innerHTML = '';

  patients.forEach(patient => {
    const tasks = Data.tasks.list(patient.id);
    const pendingTasks = tasks.filter(t => !t.completed);

    const card = document.createElement('div');
    card.className = 'handover-patient-card';

    const statusIcon = {
      'stable': 'status-dot-stable',
      'attention': 'status-dot-attention',
      'critical': 'status-dot-critical'
    }[patient.status] || 'status-dot-stable';

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-2);">
        <span class="status-dot ${statusIcon}"></span>
        <h3 class="handover-patient-name patient-name">${escapeHtml(patient.name)}</h3>
      </div>
      <div class="handover-patient-info">
        ${patient.bed ? `Bed ${escapeHtml(patient.bed)}` : ''}
        ${patient.bed && patient.diagnosis ? ' &middot; ' : ''}
        ${patient.diagnosis ? escapeHtml(patient.diagnosis) : ''}
      </div>
      ${patient.notes ? `
        <div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-2);">
          ${escapeHtml(patient.notes)}
        </div>
      ` : ''}
      <div class="handover-tasks-summary">
        ${pendingTasks.length > 0 ? `
          <span class="handover-task-pending">${pendingTasks.length} pending task${pendingTasks.length !== 1 ? 's' : ''}</span>
          <ul style="margin-top: var(--space-1); padding-left: var(--space-5); font-size: var(--text-sm);">
            ${pendingTasks.map(t => `<li>${escapeHtml(t.text)}</li>`).join('')}
          </ul>
        ` : `
          <span style="color: var(--success); font-size: var(--text-sm);">No pending tasks</span>
        `}
      </div>
    `;

    listEl.appendChild(card);
  });
}

function generateHandoverText() {
  const patients = Store.activePatients;
  const unit = Store.currentUnit;
  const lines = [];

  lines.push(`HANDOVER - ${unit?.name || 'Ward'}`);
  lines.push(`Date: ${new Date().toLocaleDateString()}`);
  lines.push(`Time: ${new Date().toLocaleTimeString()}`);
  lines.push('---');

  patients.forEach(patient => {
    lines.push('');
    lines.push(`${patient.name} | Bed: ${patient.bed || 'N/A'} | Status: ${patient.status}`);
    if (patient.diagnosis) lines.push(`  Dx: ${patient.diagnosis}`);
    if (patient.notes) lines.push(`  Notes: ${patient.notes}`);

    const tasks = Data.tasks.pending(patient.id);
    if (tasks.length > 0) {
      lines.push(`  Pending Tasks:`);
      tasks.forEach(t => lines.push(`    - ${t.text}`));
    }
  });

  return lines.join('\n');
}

async function copyHandoverToClipboard() {
  const text = generateHandoverText();

  try {
    await navigator.clipboard.writeText(text);
    EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Handover copied to clipboard' });
  } catch (error) {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    EventBus.emit(Events.TOAST_SHOW, { type: 'success', message: 'Handover copied' });
  }
}

async function shareHandover() {
  const text = generateHandoverText();

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Ward Handover',
        text: text
      });
    } catch (error) {
      if (error.name !== 'AbortError') {
        EventBus.emit(Events.TOAST_SHOW, { type: 'error', message: 'Share failed' });
      }
    }
  } else {
    // Fallback to copy
    copyHandoverToClipboard();
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
