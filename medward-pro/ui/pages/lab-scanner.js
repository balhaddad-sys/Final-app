/**
 * Lab Scanner Page
 * Vision-based lab report analysis via medward_analyzeLabImage / medward_scanLabReport
 */
import { CloudFunctions } from '../../services/firebase.functions.js';

let isLoading = false;
let currentImage = null;

export function renderLabScanner(container) {
  container.innerHTML = `
    <div class="page-lab-scanner">
      <header class="page-header">
        <button class="btn btn-icon back-btn" id="lab-back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg>
          <span>Back</span>
        </button>
        <h2>Lab Scanner</h2>
        <p class="page-subtitle">Take a photo or upload a lab report for AI analysis.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">\u26A0\uFE0F</span>
        <span>AI-generated analysis. Always verify results against the original report.</span>
      </div>

      <main class="lab-scanner-content">
        <div class="lab-upload-area" id="lab-upload-area">
          <div class="upload-zone" id="upload-zone">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <p>Tap to upload or take a photo</p>
            <p class="text-muted" style="font-size: var(--text-xs);">Supports JPEG, PNG, WebP (max 10 MB)</p>
            <input type="file" id="lab-file-input" accept="image/*" capture="environment" style="display: none;" />
          </div>

          <div id="image-preview" class="image-preview" style="display: none;">
            <img id="preview-img" alt="Lab report preview" />
            <button class="btn btn-secondary btn-sm" id="clear-image">Remove</button>
          </div>
        </div>

        <div class="lab-options">
          <label class="input-label">Patient Name (optional)</label>
          <input type="text" class="input" id="lab-patient-name" placeholder="For reference only..." />
        </div>

        <div class="lab-actions">
          <button class="btn btn-primary btn-lg" id="analyze-btn" disabled style="width: 100%;">
            Analyze Lab Report
          </button>
        </div>

        <div id="lab-result" class="lab-result" style="display: none;">
          <h3>Analysis Results</h3>
          <div id="lab-result-content"></div>
        </div>
      </main>
    </div>
  `;

  const fileInput = container.querySelector('#lab-file-input');
  const uploadZone = container.querySelector('#upload-zone');
  const previewContainer = container.querySelector('#image-preview');
  const previewImg = container.querySelector('#preview-img');
  const clearBtn = container.querySelector('#clear-image');
  const analyzeBtn = container.querySelector('#analyze-btn');

  // Back button
  container.querySelector('#lab-back').addEventListener('click', () => {
    history.back();
  });

  // Upload zone click
  uploadZone.addEventListener('click', () => fileInput.click());

  // File selected
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('Image too large. Maximum 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      currentImage = ev.target.result;
      previewImg.src = currentImage;
      uploadZone.style.display = 'none';
      previewContainer.style.display = 'block';
      analyzeBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  });

  // Clear image
  clearBtn.addEventListener('click', () => {
    currentImage = null;
    fileInput.value = '';
    uploadZone.style.display = '';
    previewContainer.style.display = 'none';
    analyzeBtn.disabled = true;
  });

  // Analyze
  analyzeBtn.addEventListener('click', () => {
    if (currentImage) {
      const patientName = container.querySelector('#lab-patient-name').value.trim() || null;
      analyzeLab(currentImage, patientName);
    }
  });
}

async function analyzeLab(imageData, patientName) {
  if (isLoading) return;

  const resultContainer = document.getElementById('lab-result');
  const resultContent = document.getElementById('lab-result-content');
  const analyzeBtn = document.getElementById('analyze-btn');

  resultContainer.style.display = 'block';
  resultContent.innerHTML = '<div class="ai-loading-block"><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span><span class="ai-loading-dot"></span></div>';
  analyzeBtn.disabled = true;
  isLoading = true;

  try {
    // Extract base64 and media type from data URL
    const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
    const mediaType = match ? match[1] : 'image/jpeg';
    const base64 = match ? match[2] : imageData;

    const result = await CloudFunctions.analyzeLabImage(base64, mediaType, patientName);
    resultContent.innerHTML = renderLabResult(result);
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to analyze lab report. Please try again.</p>';
  } finally {
    analyzeBtn.disabled = false;
    isLoading = false;
  }

  resultContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderLabResult(result) {
  if (!result) return '<p>No results.</p>';

  // Server returns structured data under labData
  const data = result.labData || result;

  let html = '<div class="ai-structured-response">';

  // Critical values
  if (data.criticalValues?.length) {
    html += `<div class="ai-section ai-section-urgent">
      <h4 class="ai-section-title">Critical Values</h4>
      <div class="ai-section-content">
        <ul class="ai-list">${data.criticalValues.map(v => `<li>${esc(v)}</li>`).join('')}</ul>
      </div>
    </div>`;
  }

  // Findings
  if (data.findings?.length) {
    html += `<div class="ai-section">
      <h4 class="ai-section-title">Findings</h4>
      <div class="ai-section-content">
        <table class="lab-findings-table">
          <thead><tr><th>Test</th><th>Value</th><th>Status</th><th>Interpretation</th></tr></thead>
          <tbody>
            ${data.findings.map(f => `
              <tr class="${f.status === 'critical' ? 'text-danger' : f.status === 'abnormal' ? 'text-warning' : ''}">
                <td>${esc(f.test)}</td>
                <td>${esc(f.value)} ${esc(f.unit || '')}</td>
                <td>${esc(f.status)}</td>
                <td>${esc(f.interpretation)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // Patterns
  if (data.patterns?.length) {
    html += `<div class="ai-section">
      <h4 class="ai-section-title">Patterns Identified</h4>
      <div class="ai-section-content">
        <ul class="ai-list">${data.patterns.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
      </div>
    </div>`;
  }

  // Recommendations
  if (data.recommendations?.length) {
    html += `<div class="ai-section">
      <h4 class="ai-section-title">Recommendations</h4>
      <div class="ai-section-content">
        <ul class="ai-list">${data.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      </div>
    </div>`;
  }

  // Fallback for raw/text responses
  if (!data.findings && !data.criticalValues && (result.answer || data.answer)) {
    const answerText = result.answer || data.answer;
    html += `<div class="ai-section"><div class="ai-section-content"><p>${esc(answerText)}</p></div></div>`;
  }

  if (data.confidence) {
    html += `<div class="ai-response-footer"><span class="ai-disclaimer-small">Confidence: ${Math.round(data.confidence * 100)}% &mdash; Always verify against original report.</span></div>`;
  }

  html += '</div>';
  return html;
}

function esc(text) {
  if (typeof text !== 'string') return String(text || '');
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
