/**
 * Drug Information Lookup Page
 * Dedicated page for drug info via medward_getDrugInfo
 */
import { CloudFunctions } from '../../services/firebase.functions.js';

let isLoading = false;

const COMMON_DRUGS = [
  'Metformin', 'Amlodipine', 'Enoxaparin', 'Vancomycin',
  'Meropenem', 'Furosemide', 'Amiodarone', 'Insulin Glargine',
  'Ceftriaxone', 'Metoprolol', 'Omeprazole', 'Warfarin'
];

export function renderDrugInfo(container) {
  container.innerHTML = `
    <div class="page-drug-info">
      <header class="page-header">
        <button class="btn btn-icon back-btn" id="drug-back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
          <span>Back</span>
        </button>
        <h2>Drug Information</h2>
        <p class="page-subtitle">Look up clinical drug information with dosing adjustments.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">\u26A0\uFE0F</span>
        <span>AI-generated drug information. Always verify with official formulary.</span>
      </div>

      <main class="drug-content">
        <div class="drug-search-area">
          <div class="input-group">
            <input type="text" class="input" id="drug-name-input" placeholder="Enter drug name..." autocomplete="off" />
            <button class="btn btn-primary" id="drug-search-btn">Look Up</button>
          </div>
        </div>

        <div class="drug-quick-picks">
          <h4>Common Medications</h4>
          <div class="chip-group">
            ${COMMON_DRUGS.map(d => `<button class="chip" data-drug="${d}">${d}</button>`).join('')}
          </div>
        </div>

        <div id="drug-result" class="drug-result" style="display: none;">
          <div id="drug-result-content"></div>
        </div>
      </main>
    </div>
  `;

  // Back button
  container.querySelector('#drug-back').addEventListener('click', () => {
    history.back();
  });

  // Search
  container.querySelector('#drug-search-btn').addEventListener('click', () => {
    const name = container.querySelector('#drug-name-input').value.trim();
    if (name) lookupDrug(name);
  });

  // Enter key
  container.querySelector('#drug-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const name = e.target.value.trim();
      if (name) lookupDrug(name);
    }
  });

  // Quick picks
  container.querySelectorAll('[data-drug]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelector('#drug-name-input').value = chip.dataset.drug;
      lookupDrug(chip.dataset.drug);
    });
  });
}

async function lookupDrug(drugName) {
  if (isLoading) return;

  const resultContainer = document.getElementById('drug-result');
  const resultContent = document.getElementById('drug-result-content');

  resultContainer.style.display = 'block';
  resultContent.innerHTML = '<div class="ai-loading-block"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span></div>';
  isLoading = true;

  try {
    const result = await CloudFunctions.getDrugInfo(drugName);
    resultContent.innerHTML = renderDrugResult(result);
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to retrieve drug information. Please try again.</p>';
  } finally {
    isLoading = false;
  }

  resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderDrugResult(result) {
  if (!result) return '<p>No results found.</p>';

  const info = result.drugInfo || result;

  let html = '<div class="ai-structured-response">';

  if (info.genericName) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Generic Name</h4><div class="ai-section-content"><p>${esc(info.genericName)}</p></div></div>`;
  }
  if (info.brandNames?.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Brand Names</h4><div class="ai-section-content"><p>${info.brandNames.map(esc).join(', ')}</p></div></div>`;
  }
  if (info.class) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Drug Class</h4><div class="ai-section-content"><p>${esc(info.class)}</p></div></div>`;
  }
  if (info.indications?.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Indications</h4><div class="ai-section-content"><ul class="ai-list">${info.indications.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></div>`;
  }
  if (info.dosing) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Dosing</h4><div class="ai-section-content">`;
    if (info.dosing.adult) html += `<p><strong>Adult:</strong> ${esc(info.dosing.adult)}</p>`;
    if (info.dosing.renal) html += `<p><strong>Renal adjustment:</strong> ${esc(info.dosing.renal)}</p>`;
    if (info.dosing.hepatic) html += `<p><strong>Hepatic adjustment:</strong> ${esc(info.dosing.hepatic)}</p>`;
    html += `</div></div>`;
  }
  if (info.contraindications) {
    // Handle both array and {absolute:[], relative:[]} formats
    if (Array.isArray(info.contraindications) && info.contraindications.length) {
      html += `<div class="ai-section ai-section-urgent"><h4 class="ai-section-title">Contraindications</h4><div class="ai-section-content"><ul class="ai-list">${info.contraindications.map(c => `<li>${esc(c)}</li>`).join('')}</ul></div></div>`;
    } else if (info.contraindications.absolute?.length || info.contraindications.relative?.length) {
      html += `<div class="ai-section ai-section-urgent"><h4 class="ai-section-title">Contraindications</h4><div class="ai-section-content">`;
      if (info.contraindications.absolute?.length) html += `<p><strong>Absolute:</strong></p><ul class="ai-list">${info.contraindications.absolute.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
      if (info.contraindications.relative?.length) html += `<p><strong>Relative:</strong></p><ul class="ai-list">${info.contraindications.relative.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
      html += `</div></div>`;
    }
  }
  if (info.sideEffects) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Side Effects</h4><div class="ai-section-content">`;
    if (info.sideEffects.common?.length) html += `<p><strong>Common:</strong> ${info.sideEffects.common.map(esc).join(', ')}</p>`;
    if (info.sideEffects.serious?.length) html += `<p class="text-danger"><strong>Serious:</strong> ${info.sideEffects.serious.map(esc).join(', ')}</p>`;
    html += `</div></div>`;
  }
  if (info.interactions?.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Interactions</h4><div class="ai-section-content"><ul class="ai-list">${info.interactions.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div></div>`;
  }
  if (info.clinicalPearls?.length) {
    html += `<div class="ai-section"><h4 class="ai-section-title">Clinical Pearls</h4><div class="ai-section-content"><ul class="ai-list">${info.clinicalPearls.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div></div>`;
  }

  // Fallback: if no structured fields, render raw answer
  if (!info.genericName && !info.indications && result.answer) {
    html += `<div class="ai-section"><div class="ai-section-content"><p>${esc(result.answer)}</p></div></div>`;
  }

  html += '<div class="ai-response-footer"><span class="ai-disclaimer-small">Verify with official formulary and clinical guidelines.</span></div>';
  html += '</div>';
  return html;
}

function esc(text) {
  if (typeof text !== 'string') return String(text || '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
