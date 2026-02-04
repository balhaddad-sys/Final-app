/**
 * Antibiotic Guide Page
 * AI-powered antibiotic recommendations
 */
import { AI } from '../../services/ai.service.js';
import { renderClinicalResponse } from '../utils/formatMedicalResponse.js';

let isLoading = false;

export function renderAntibioticGuide(container) {
  container.innerHTML = `
    <div class="page-antibiotic">
      <header class="page-header">
        <h2>Antibiotic Guide</h2>
        <p class="page-subtitle">Get evidence-based antibiotic recommendations based on infection type and patient factors.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">&#9888;&#65039;</span>
        <span>Always follow local guidelines and consider patient-specific factors. Consult ID for complex cases.</span>
      </div>

      <main class="antibiotic-content">
        <form id="guidance-form" class="antibiotic-form">
          <div class="input-group">
            <label class="input-label" for="abx-condition">Infection / Condition *</label>
            <input type="text" class="input" id="abx-condition" required
                   placeholder="e.g., Community-acquired pneumonia, UTI, Cellulitis">
          </div>

          <div class="form-row" style="margin-top: var(--space-3);">
            <div class="input-group">
              <label class="input-label" for="abx-age">Age Group</label>
              <select class="input" id="abx-age">
                <option value="adult">Adult</option>
                <option value="pediatric">Pediatric</option>
                <option value="neonate">Neonate</option>
                <option value="elderly">Elderly (65+)</option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label" for="abx-renal">Renal Function</label>
              <select class="input" id="abx-renal">
                <option value="normal">Normal (eGFR &gt;60)</option>
                <option value="mild">Mild CKD (eGFR 30-60)</option>
                <option value="moderate">Moderate CKD (eGFR 15-30)</option>
                <option value="severe">Severe CKD (eGFR &lt;15)</option>
                <option value="dialysis">Dialysis</option>
              </select>
            </div>
          </div>

          <div class="input-group" style="margin-top: var(--space-3);">
            <label class="input-label" for="abx-allergies">Drug Allergies</label>
            <input type="text" class="input" id="abx-allergies"
                   placeholder="e.g., Penicillin, Sulfa (leave blank if NKDA)">
          </div>

          <div style="margin-top: var(--space-3);">
            <div class="toggle-row">
              <span class="toggle-row__label">MRSA Risk Factors</span>
              <label class="toggle-switch">
                <input type="checkbox" id="abx-mrsa">
                <span class="toggle-switch__slider"></span>
              </label>
            </div>
            <div class="toggle-row">
              <span class="toggle-row__label">Severe / Septic</span>
              <label class="toggle-switch">
                <input type="checkbox" id="abx-severe">
                <span class="toggle-switch__slider"></span>
              </label>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-lg" id="abx-submit"
                  style="width: 100%; margin-top: var(--space-4);">
            Get Recommendations
          </button>
        </form>

        <div class="common-conditions">
          <h4>Common Conditions</h4>
          <div class="chip-group">
            <button class="chip" data-condition="Community-acquired pneumonia">CAP</button>
            <button class="chip" data-condition="Hospital-acquired pneumonia">HAP</button>
            <button class="chip" data-condition="Urinary tract infection">UTI</button>
            <button class="chip" data-condition="Pyelonephritis">Pyelonephritis</button>
            <button class="chip" data-condition="Cellulitis">Cellulitis</button>
            <button class="chip" data-condition="Diabetic foot infection">DFI</button>
            <button class="chip" data-condition="Intra-abdominal infection">IAI</button>
            <button class="chip" data-condition="Sepsis of unknown source">Sepsis</button>
            <button class="chip" data-condition="Meningitis">Meningitis</button>
            <button class="chip" data-condition="Endocarditis">Endocarditis</button>
          </div>
        </div>

      </main>
    </div>

    <!-- Slide-up result panel -->
    <div class="result-panel-backdrop" id="abx-panel-backdrop"></div>
    <div class="result-panel" id="abx-result-panel">
      <div class="panel-header">
        <h3>Antibiotic Recommendations</h3>
        <button class="panel-close-btn" id="abx-panel-close">&times;</button>
      </div>
      <div class="panel-content" id="abx-result-content"></div>
    </div>
  `;

  // Condition chip clicks
  container.querySelectorAll('.chip[data-condition]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('abx-condition').value = chip.dataset.condition;
    });
  });

  // Form submission
  document.getElementById('guidance-form').addEventListener('submit', handleSubmit);

  // Panel close handlers
  document.getElementById('abx-panel-close').addEventListener('click', hideResultPanel);
  document.getElementById('abx-panel-backdrop').addEventListener('click', hideResultPanel);
}

function showResultPanel() {
  const panel = document.getElementById('abx-result-panel');
  const backdrop = document.getElementById('abx-panel-backdrop');
  if (panel) panel.classList.add('active');
  if (backdrop) backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideResultPanel() {
  const panel = document.getElementById('abx-result-panel');
  const backdrop = document.getElementById('abx-panel-backdrop');
  if (panel) panel.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

async function handleSubmit(e) {
  e.preventDefault();
  if (isLoading) return;

  const condition = document.getElementById('abx-condition').value.trim();
  if (!condition) return;

  const factors = {
    ageGroup: document.getElementById('abx-age').value,
    renalFunction: document.getElementById('abx-renal').value,
    allergies: document.getElementById('abx-allergies').value || 'NKDA',
    mrsaRisk: document.getElementById('abx-mrsa').checked,
    severe: document.getElementById('abx-severe').checked
  };

  const resultContent = document.getElementById('abx-result-content');
  const submitBtn = document.getElementById('abx-submit');

  // Show panel with loading state
  resultContent.innerHTML = '<div class="panel-loading"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span></div>';
  showResultPanel();
  submitBtn.disabled = true;
  isLoading = true;

  try {
    const result = await AI.getAntibioticGuidance(condition, factors);
    resultContent.innerHTML = renderResult(result);
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to get recommendations. Please try again.</p>';
  } finally {
    submitBtn.disabled = false;
    isLoading = false;
  }
}

function renderResult(result) {
  if (!result) return '<p>No results.</p>';

  // If structured sections
  if (result.sections && Object.keys(result.sections).length > 0) {
    let html = '<div class="ai-structured-response">';
    for (const [key, section] of Object.entries(result.sections)) {
      html += `<div class="ai-section">
        <h4 class="ai-section-title">${key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</h4>
        <div class="ai-section-content">${renderSection(section)}</div>
      </div>`;
    }
    if (result.disclaimer) {
      html += `<div class="ai-response-footer"><span class="ai-disclaimer-small">${escapeHtml(result.disclaimer)}</span></div>`;
    }
    html += '</div>';
    return html;
  }

  // Fallback to raw text with clinical formatting
  if (result.raw) {
    return renderClinicalResponse(result.raw, result.disclaimer);
  }

  return '<p>No recommendations available.</p>';
}

function renderSection(section) {
  if (!section) return '';
  if (section.type === 'list') {
    return `<ul class="ai-list">${section.items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }
  return `<p>${escapeHtml(section.content || section)}</p>`;
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.*?)$/gm, '<h4>$1</h4>')
    .replace(/^## (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  if (typeof text !== 'string') return String(text);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
