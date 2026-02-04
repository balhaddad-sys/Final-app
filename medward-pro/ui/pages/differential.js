/**
 * Differential Diagnosis Page
 * Dedicated page for oncall_generateDifferential
 */
import { CloudFunctions } from '../../services/firebase.functions.js';
import { Store } from '../../core/store.js';

let isLoading = false;

export function renderDifferential(container) {
  container.innerHTML = `
    <div class="page-differential">
      <header class="page-header">
        <button class="btn btn-icon back-btn" id="diff-back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
          <span>Back</span>
        </button>
        <h2>Differential Diagnosis</h2>
        <p class="page-subtitle">Generate a structured differential based on presenting symptoms and findings.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">\u26A0\uFE0F</span>
        <span>AI-generated differential. Always apply clinical judgment.</span>
      </div>

      <main class="diff-content">
        <div class="diff-form">
          <div class="form-group">
            <label class="input-label">Presenting Symptoms *</label>
            <textarea class="input" id="diff-symptoms" placeholder="e.g., 65M with acute-onset chest pain, diaphoresis, and dyspnea..." rows="3"></textarea>
          </div>

          <div class="form-group">
            <label class="input-label">Relevant History (optional)</label>
            <textarea class="input" id="diff-history" placeholder="e.g., HTN, DM, previous MI, current medications..." rows="2"></textarea>
          </div>

          <div class="form-group">
            <label class="input-label">Key Findings (optional)</label>
            <textarea class="input" id="diff-findings" placeholder="e.g., BP 90/60, HR 110, Troponin 0.8 ng/mL, ECG: ST elevation V1-V4..." rows="2"></textarea>
          </div>

          <div class="form-group">
            <label class="input-label">
              <input type="checkbox" id="diff-include-context" />
              Include current patient context
            </label>
          </div>

          <button class="btn btn-primary btn-lg" id="diff-submit" style="width: 100%;">
            Generate Differential
          </button>
        </div>

        <div id="diff-result" class="diff-result" style="display: none;">
          <h3>Differential Diagnosis</h3>
          <div id="diff-result-content"></div>
        </div>
      </main>
    </div>
  `;

  // Back button
  container.querySelector('#diff-back').addEventListener('click', () => {
    history.back();
  });

  // Submit
  container.querySelector('#diff-submit').addEventListener('click', submitDifferential);
}

async function submitDifferential() {
  const symptoms = document.getElementById('diff-symptoms').value.trim();
  if (!symptoms || isLoading) return;

  const history = document.getElementById('diff-history').value.trim();
  const findings = document.getElementById('diff-findings').value.trim();
  const includeContext = document.getElementById('diff-include-context').checked;

  let query = symptoms;
  if (history) query += `\nHistory: ${history}`;
  if (findings) query += `\nFindings: ${findings}`;

  // Add patient context if checked
  if (includeContext) {
    const patient = Store.currentPatient;
    if (patient) {
      const ctx = [];
      if (patient.age) ctx.push(`Age: ${patient.age}`);
      if (patient.sex) ctx.push(`Sex: ${patient.sex}`);
      if (patient.diagnosis) ctx.push(`Known diagnosis: ${patient.diagnosis}`);
      if (ctx.length) query += `\nPatient context: ${ctx.join(', ')}`;
    }
  }

  const resultContainer = document.getElementById('diff-result');
  const resultContent = document.getElementById('diff-result-content');
  const submitBtn = document.getElementById('diff-submit');

  resultContainer.style.display = 'block';
  resultContent.innerHTML = '<div class="ai-loading-block"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span></div>';
  submitBtn.disabled = true;
  isLoading = true;

  try {
    const result = await CloudFunctions.generateDifferential(query);
    resultContent.innerHTML = renderDiffResult(result);
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to generate differential. Please try again.</p>';
  } finally {
    submitBtn.disabled = false;
    isLoading = false;
  }

  resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderDiffResult(result) {
  if (!result) return '<p>No results.</p>';

  // Handle structured sections response
  if (result.sections && Object.keys(result.sections).length > 0) {
    const sectionLabels = {
      assessment: 'Assessment',
      red_flags: 'Red Flags',
      immediate_actions: 'Immediate Actions',
      differential: 'Differential Diagnosis',
      workup: 'Workup',
      treatment: 'Initial Management',
      disposition: 'Disposition',
      references: 'References'
    };

    let html = '<div class="ai-structured-response">';
    for (const [key, section] of Object.entries(result.sections)) {
      const label = sectionLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const isUrgent = key === 'red_flags' || key === 'immediate_actions';
      html += `<div class="ai-section ${isUrgent ? 'ai-section-urgent' : ''}">
        <h4 class="ai-section-title">${label}</h4>
        <div class="ai-section-content">${renderSection(section)}</div>
      </div>`;
    }
    if (result.disclaimer) {
      html += `<div class="ai-response-footer"><span class="ai-disclaimer-small">${esc(result.disclaimer)}</span></div>`;
    }
    html += '</div>';
    return html;
  }

  // Fallback for raw text
  if (result.answer || result.raw) {
    const text = result.answer || result.raw;
    return `<div class="ai-structured-response"><div class="ai-section"><div class="ai-section-content"><p>${formatText(text)}</p></div></div></div>`;
  }

  return '<p>No differential generated.</p>';
}

function renderSection(section) {
  if (!section) return '';
  if (section.type === 'list') {
    return `<ul class="ai-list">${section.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
  }
  return `<p>${esc(section.content || section)}</p>`;
}

function formatText(text) {
  return esc(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*?)$/gm, '<h4>$1</h4>')
    .replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>');
}

function esc(text) {
  if (typeof text !== 'string') return String(text || '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
