/**
 * Electrolyte Correction Verification Page
 * Uses oncall_verifyElectrolyteCorrection
 */
import { CloudFunctions } from '../../services/firebase.functions.js';

let isLoading = false;

const ELECTROLYTE_PRESETS = [
  { label: 'Hyponatremia', electrolyte: 'Sodium', scenario: 'Sodium 118 mmol/L. Patient is 70kg female with euvolemic hyponatremia. Plan: 3% NaCl at 15 mL/hr.' },
  { label: 'Hyperkalemia', electrolyte: 'Potassium', scenario: 'Potassium 6.8 mmol/L with peaked T waves. Plan: Calcium gluconate 10%, insulin 10U + D50, salbutamol neb.' },
  { label: 'Hypocalcemia', electrolyte: 'Calcium', scenario: 'Corrected calcium 1.6 mmol/L, symptomatic (tetany). Plan: IV calcium gluconate 10% 20mL over 10 min.' },
  { label: 'Hypomagnesemia', electrolyte: 'Magnesium', scenario: 'Magnesium 0.4 mmol/L with refractory hypokalemia. Plan: IV MgSO4 2g over 2 hours.' },
  { label: 'Hypophosphatemia', electrolyte: 'Phosphate', scenario: 'Phosphate 0.3 mmol/L in refeeding patient. Plan: IV sodium phosphate 30 mmol over 6 hours.' },
  { label: 'Metabolic Acidosis', electrolyte: 'Bicarbonate', scenario: 'pH 7.15, HCO3 8 mmol/L, AG 22. Severe metabolic acidosis. Plan: NaHCO3 infusion 150 mEq in 1L D5W.' }
];

export function renderElectrolyteCheck(container) {
  container.innerHTML = `
    <div class="page-electrolyte">
      <header class="page-header">
        <button class="btn btn-icon back-btn" id="elec-back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
          <span>Back</span>
        </button>
        <h2>Electrolyte Correction Check</h2>
        <p class="page-subtitle">Verify electrolyte correction plans for safety and accuracy.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">\u26A0\uFE0F</span>
        <span>Safety tool only. Always confirm calculations independently before administering.</span>
      </div>

      <main class="elec-content">
        <div class="elec-presets">
          <h4>Common Scenarios</h4>
          <div class="scenario-grid">
            ${ELECTROLYTE_PRESETS.map(p => `
              <button class="card card-interactive scenario-card" data-scenario="${escapeAttr(p.scenario)}" data-electrolyte="${p.electrolyte}">
                <span class="scenario-label">${p.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="elec-form">
          <h4>Custom Scenario</h4>
          <div class="form-group">
            <label class="input-label">Electrolyte</label>
            <select class="input" id="elec-type">
              <option value="">Select electrolyte...</option>
              <option value="Sodium">Sodium (Na+)</option>
              <option value="Potassium">Potassium (K+)</option>
              <option value="Calcium">Calcium (Ca2+)</option>
              <option value="Magnesium">Magnesium (Mg2+)</option>
              <option value="Phosphate">Phosphate (PO4)</option>
              <option value="Bicarbonate">Bicarbonate (HCO3-)</option>
            </select>
          </div>

          <div class="form-row">
            <div class="form-group form-group-half">
              <label class="input-label">Current Value</label>
              <input type="number" step="0.1" class="input" id="elec-current" placeholder="e.g. 118" />
            </div>
            <div class="form-group form-group-half">
              <label class="input-label">Target Value</label>
              <input type="number" step="0.1" class="input" id="elec-target" placeholder="e.g. 125" />
            </div>
          </div>

          <div class="form-group">
            <label class="input-label">Patient Weight (kg)</label>
            <input type="number" step="0.1" class="input" id="elec-weight" placeholder="e.g. 70" />
          </div>

          <div class="form-group">
            <label class="input-label">Correction Plan</label>
            <textarea class="input" id="elec-plan" placeholder="Describe your planned correction (solution, rate, duration)..." rows="3"></textarea>
          </div>

          <button class="btn btn-primary btn-lg" id="elec-submit" style="width: 100%;">
            Verify Correction
          </button>
        </div>

        <div id="elec-result" class="elec-result" style="display: none;">
          <h3>Verification Result</h3>
          <div id="elec-result-content"></div>
        </div>
      </main>
    </div>
  `;

  // Back button
  container.querySelector('#elec-back').addEventListener('click', () => {
    history.back();
  });

  // Preset cards
  container.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', () => {
      document.getElementById('elec-plan').value = card.dataset.scenario;
      const typeSelect = document.getElementById('elec-type');
      typeSelect.value = card.dataset.electrolyte;
      submitVerification(card.dataset.scenario, card.dataset.electrolyte);
    });
  });

  // Submit
  container.querySelector('#elec-submit').addEventListener('click', () => {
    const electrolyte = document.getElementById('elec-type').value;
    const current = document.getElementById('elec-current').value;
    const target = document.getElementById('elec-target').value;
    const weight = document.getElementById('elec-weight').value;
    const plan = document.getElementById('elec-plan').value.trim();

    if (!plan) return;

    let scenario = plan;
    if (electrolyte && current) {
      scenario = `${electrolyte} ${current} mmol/L`;
      if (target) scenario += `, target ${target} mmol/L`;
      if (weight) scenario += `, weight ${weight} kg`;
      scenario += `. Plan: ${plan}`;
    }

    submitVerification(scenario, electrolyte);
  });
}

async function submitVerification(scenario, electrolyte) {
  if (isLoading) return;

  const resultContainer = document.getElementById('elec-result');
  const resultContent = document.getElementById('elec-result-content');
  const submitBtn = document.getElementById('elec-submit');

  resultContainer.style.display = 'block';
  resultContent.innerHTML = '<div class="ai-loading-block"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span></div>';
  submitBtn.disabled = true;
  isLoading = true;

  try {
    const result = await CloudFunctions.verifyElectrolyteCorrection(scenario, electrolyte);
    resultContent.innerHTML = renderVerificationResult(result);
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to verify correction. Please try again.</p>';
  } finally {
    submitBtn.disabled = false;
    isLoading = false;
  }

  resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderVerificationResult(result) {
  if (!result) return '<p>No results.</p>';

  const data = result.verification || result;
  let html = '<div class="ai-structured-response">';

  // Verified status
  if (data.verified !== undefined) {
    const statusClass = data.verified ? 'ai-section' : 'ai-section ai-section-urgent';
    const statusText = data.verified ? 'VERIFIED - Correction appears safe' : 'WARNING - Review needed';
    html += `<div class="${statusClass}">
      <h4 class="ai-section-title">${statusText}</h4>
    </div>`;
  }

  // Calculation
  if (data.calculation) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Calculation</h4><div class="ai-section-content"><p>${esc(data.calculation)}</p></div></div>`;
  }

  // Expected result
  if (data.expectedResult) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Expected Result</h4><div class="ai-section-content"><p>${esc(data.expectedResult)}</p></div></div>`;
  }

  // Safe rate
  if (data.safeRate) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Safe Correction Rate</h4><div class="ai-section-content"><p>${esc(data.safeRate)}</p></div></div>`;
  }

  // Warnings
  if (data.warnings?.length) {
    html += `<div class="ai-section ai-section-urgent"><h4 class="ai-section-title">Warnings</h4><div class="ai-section-content"><ul class="ai-list">${data.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div></div>`;
  }

  // Recommendations
  if (data.recommendations?.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Recommendations</h4><div class="ai-section-content"><ul class="ai-list">${data.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div></div>`;
  }

  // Fallback for raw text response
  if (!data.calculation && !data.warnings && (result.answer || result.raw)) {
    const text = result.answer || result.raw;
    html += `<div class="ai-section"><div class="ai-section-content"><p>${esc(text)}</p></div></div>`;
  }

  html += '<div class="ai-response-footer"><span class="ai-disclaimer-small">Always independently verify calculations before administering corrections.</span></div>';
  html += '</div>';
  return html;
}

function esc(text) {
  if (typeof text !== 'string') return String(text || '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
