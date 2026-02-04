/**
 * On-Call Assistant Page
 * Quick guidance for common on-call scenarios
 */
import { AI } from '../../services/ai.service.js';
import { renderClinicalResponse } from '../utils/formatMedicalResponse.js';

let isLoading = false;

const COMMON_SCENARIOS = [
  { label: 'Chest Pain', prompt: 'Patient presenting with acute chest pain. What is my initial assessment and workup?' },
  { label: 'Hypotension', prompt: 'Called about patient with low blood pressure. Systematic approach to hypotension on call.' },
  { label: 'Acute SOB', prompt: 'Patient with acute shortness of breath. Differential and initial management.' },
  { label: 'High K+', prompt: 'Patient with hyperkalemia K+ >6.0. Emergency management steps.' },
  { label: 'Fever + Neutropenia', prompt: 'Febrile neutropenia in oncology patient. Immediate workup and empiric treatment.' },
  { label: 'Altered Mental Status', prompt: 'Called about patient with acute confusion/altered mental status. Approach and workup.' },
  { label: 'GI Bleed', prompt: 'Patient with acute upper GI bleed (hematemesis). Initial stabilization and management.' },
  { label: 'Acute Stroke', prompt: 'Suspected acute stroke. Time-critical steps and assessment.' },
  { label: 'Anaphylaxis', prompt: 'Patient with suspected anaphylaxis. Immediate management protocol.' },
  { label: 'Low Urine Output', prompt: 'Called about oliguria/low urine output. Assessment and initial management.' }
];

export function renderOncallAssistant(container) {
  container.innerHTML = `
    <div class="page-oncall">
      <header class="page-header">
        <h2>On-Call Assistant</h2>
        <p class="page-subtitle">Quick guidance for common on-call scenarios. Select a scenario or type your own question.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">&#9888;&#65039;</span>
        <span>Always use clinical judgment. Call senior/specialist for any uncertainty.</span>
      </div>

      <main class="oncall-content">
        <div class="oncall-scenarios">
          <h4>Common Scenarios</h4>
          <div class="scenario-grid">
            ${COMMON_SCENARIOS.map(s => `
              <button class="card card-interactive scenario-card" data-prompt="${escapeAttr(s.prompt)}">
                <span class="scenario-label">${s.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="oncall-custom">
          <h4>Custom Query</h4>
          <div class="oncall-input-area">
            <textarea class="input" id="oncall-input" placeholder="Describe your on-call scenario..." rows="3"></textarea>
            <div class="oncall-urgency">
              <label class="input-label">Urgency:</label>
              <div class="chip-group">
                <button class="chip" data-urgency="routine">Routine</button>
                <button class="chip chip-active" data-urgency="urgent">Urgent</button>
                <button class="chip" data-urgency="critical">Critical</button>
              </div>
            </div>
            <button class="btn btn-primary btn-lg" id="oncall-submit" style="width: 100%; margin-top: var(--space-3);">
              Get Guidance
            </button>
          </div>
        </div>

      </main>
    </div>

    <!-- Slide-up result panel -->
    <div class="result-panel-backdrop" id="oncall-panel-backdrop"></div>
    <div class="result-panel" id="oncall-result-panel">
      <div class="panel-header">
        <h3>On-Call Guidance</h3>
        <button class="panel-close-btn" id="oncall-panel-close">&times;</button>
      </div>
      <div class="panel-content" id="oncall-result-content"></div>
    </div>
  `;

  let selectedUrgency = 'urgent';

  // Urgency chip selection
  container.querySelectorAll('[data-urgency]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-urgency]').forEach(c => c.classList.remove('chip-active'));
      chip.classList.add('chip-active');
      selectedUrgency = chip.dataset.urgency;
    });
  });

  // Scenario card clicks
  container.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', () => {
      submitQuery(card.dataset.prompt, 'urgent');
    });
  });

  // Submit button
  document.getElementById('oncall-submit').addEventListener('click', () => {
    const input = document.getElementById('oncall-input').value.trim();
    if (input) {
      submitQuery(input, selectedUrgency);
    }
  });

  // Enter to submit
  document.getElementById('oncall-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const input = document.getElementById('oncall-input').value.trim();
      if (input) submitQuery(input, selectedUrgency);
    }
  });

  // Panel close handlers
  document.getElementById('oncall-panel-close').addEventListener('click', hideResultPanel);
  document.getElementById('oncall-panel-backdrop').addEventListener('click', hideResultPanel);
}

function showResultPanel() {
  const panel = document.getElementById('oncall-result-panel');
  const backdrop = document.getElementById('oncall-panel-backdrop');
  if (panel) panel.classList.add('active');
  if (backdrop) backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideResultPanel() {
  const panel = document.getElementById('oncall-result-panel');
  const backdrop = document.getElementById('oncall-panel-backdrop');
  if (panel) panel.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

async function submitQuery(scenario, urgency) {
  if (isLoading) return;

  const resultContent = document.getElementById('oncall-result-content');
  const submitBtn = document.getElementById('oncall-submit');

  // Show panel with loading state
  resultContent.innerHTML = '<div class="panel-loading"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span></div>';
  showResultPanel();
  submitBtn.disabled = true;
  isLoading = true;

  try {
    const result = await AI.oncallConsult(scenario, urgency);
    resultContent.innerHTML = renderResult(result);
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to get guidance. Please try again.</p>';
  } finally {
    submitBtn.disabled = false;
    isLoading = false;
  }
}

function renderResult(result) {
  if (!result) return '<p>No results.</p>';

  if (result.sections && Object.keys(result.sections).length > 0) {
    const sectionLabels = {
      assessment: 'Assessment',
      red_flags: 'Red Flags',
      immediate_actions: 'Immediate Actions',
      differential: 'Differential Diagnosis',
      workup: 'Workup',
      treatment: 'Treatment',
      dosing: 'Dosing',
      references: 'References',
      error: 'Error'
    };

    let html = '<div class="ai-structured-response">';
    for (const [key, section] of Object.entries(result.sections)) {
      const label = sectionLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const isUrgent = key === 'red_flags' || key === 'immediate_actions';

      if (isUrgent) {
        html += `<div class="clinical-alert clinical-alert--critical">
          <div class="clinical-alert__content">
            <div class="clinical-alert__title">${label}</div>
            <div class="clinical-alert__body">${renderSection(section)}</div>
          </div>
        </div>`;
      } else {
        html += `<div class="ai-section">
          <h4 class="ai-section-title">${label}</h4>
          <div class="ai-section-content">${renderSection(section)}</div>
        </div>`;
      }
    }
    if (result.disclaimer) {
      html += `<div class="ai-response-footer"><span class="ai-disclaimer-small">${escapeHtml(result.disclaimer)}</span></div>`;
    }
    html += '</div>';
    return html;
  }

  if (result.raw) {
    return renderClinicalResponse(result.raw, result.disclaimer);
  }

  return '<p>No guidance available.</p>';
}

function renderSection(section) {
  if (!section) return '';
  if (section.type === 'list') {
    return `<ul class="ai-list">${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  return `<p>${escapeHtml(section.content || section)}</p>`;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return String(text);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
