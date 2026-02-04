/**
 * Lab Scanner Page
 * Camera-based lab report analysis using Claude Vision (Haiku 4.5)
 * Outputs structured table with flagged abnormals
 */
import { AI } from '../../services/ai.service.js';
import { renderClinicalResponse } from '../utils/formatMedicalResponse.js';

let isLoading = false;
let activePatientName = '';

export function renderLabScanner(container) {
  container.innerHTML = `
    <div class="page-lab-scanner">
      <header class="page-header">
        <h2>Lab Scanner</h2>
        <p class="page-subtitle">Snap a photo of a lab report for instant AI analysis.</p>
      </header>

      <div class="ai-disclaimer">
        <span class="disclaimer-icon">&#9888;&#65039;</span>
        <span>Always verify extracted values against the original report.</span>
      </div>

      <main class="lab-scanner-content">
        <div class="scanner-actions">
          <label class="btn-scanner" id="scanner-camera-btn">
            <input type="file" accept="image/*" capture="environment" id="lab-camera-input" hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            <span>Scan Lab Report</span>
          </label>

          <label class="btn-scanner btn-scanner--secondary" id="scanner-gallery-btn">
            <input type="file" accept="image/*" id="lab-gallery-input" hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            <span>From Gallery</span>
          </label>
        </div>

        <div class="scanner-context-area">
          <label class="input-label" for="lab-patient-context">Patient Context (Optional)</label>
          <input class="input" type="text" id="lab-patient-context" placeholder="e.g., 65M, CKD stage 3, on warfarin">
        </div>

        <div class="scanner-preview" id="scanner-preview" style="display: none;">
          <img id="scanner-preview-img" alt="Lab report preview">
          <button class="btn btn-primary btn-lg" id="scanner-analyze-btn" style="width: 100%; margin-top: var(--space-3);">
            Analyze Report
          </button>
        </div>
      </main>
    </div>

    <!-- Slide-up result panel -->
    <div class="result-panel-backdrop" id="lab-panel-backdrop"></div>
    <div class="result-panel" id="lab-result-panel">
      <div class="panel-header">
        <h3 id="lab-panel-title">Lab Analysis</h3>
        <button class="panel-close-btn" id="lab-panel-close">&times;</button>
      </div>
      <div class="panel-content" id="lab-result-content"></div>
    </div>
  `;

  // State
  let selectedFile = null;
  let selectedBase64 = null;
  let selectedMediaType = 'image/jpeg';

  const cameraInput = document.getElementById('lab-camera-input');
  const galleryInput = document.getElementById('lab-gallery-input');
  const preview = document.getElementById('scanner-preview');
  const previewImg = document.getElementById('scanner-preview-img');
  const analyzeBtn = document.getElementById('scanner-analyze-btn');
  const contextInput = document.getElementById('lab-patient-context');

  // File selection handlers
  cameraInput.addEventListener('change', (e) => handleFileSelect(e.target));
  galleryInput.addEventListener('change', (e) => handleFileSelect(e.target));

  function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    selectedFile = file;
    selectedMediaType = file.type || 'image/jpeg';

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      selectedBase64 = dataUrl.split(',')[1];
      previewImg.src = dataUrl;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  // Analyze button
  analyzeBtn.addEventListener('click', () => {
    if (selectedBase64) {
      const patientCtx = contextInput.value.trim() || null;
      analyzeReport(selectedBase64, selectedMediaType, patientCtx);
    }
  });

  // Panel close handlers
  document.getElementById('lab-panel-close').addEventListener('click', hideResultPanel);
  document.getElementById('lab-panel-backdrop').addEventListener('click', hideResultPanel);

  // If we have a patient name from a card scan, pre-fill context
  if (activePatientName) {
    const titleEl = document.getElementById('lab-panel-title');
    if (titleEl) titleEl.textContent = `Lab Analysis: ${activePatientName}`;
    contextInput.value = activePatientName;
    activePatientName = '';
  }
}

/**
 * Set active patient context (called from patient card scan button)
 */
export function setLabPatientContext(name) {
  activePatientName = name;
}

/**
 * Direct scan from patient card - opens camera and auto-analyzes
 */
export function triggerPatientLabScan(patientName) {
  activePatientName = patientName;
  // Navigate to lab scanner page
  window.location.hash = '/lab-scanner';
}

function showResultPanel() {
  const panel = document.getElementById('lab-result-panel');
  const backdrop = document.getElementById('lab-panel-backdrop');
  if (panel) panel.classList.add('active');
  if (backdrop) backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hideResultPanel() {
  const panel = document.getElementById('lab-result-panel');
  const backdrop = document.getElementById('lab-panel-backdrop');
  if (panel) panel.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

async function analyzeReport(base64Image, mediaType, patientContext) {
  if (isLoading) return;

  const resultContent = document.getElementById('lab-result-content');
  const analyzeBtn = document.getElementById('scanner-analyze-btn');
  const titleEl = document.getElementById('lab-panel-title');

  if (titleEl && activePatientName) {
    titleEl.textContent = `Lab Analysis: ${activePatientName}`;
  }

  // Show panel with scanning loader
  resultContent.innerHTML = `
    <div class="scanning-loader">
      <div class="scan-line"></div>
      <p>Extracting Clinical Data...</p>
    </div>
  `;
  showResultPanel();
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = 'Analyzing...';
  isLoading = true;

  try {
    const result = await AI.analyzeLabReport(base64Image, mediaType, patientContext);

    if (result.error) {
      resultContent.innerHTML = `<p class="text-danger">${escapeHtml(result.error)}</p>`;
    } else if (result.raw) {
      resultContent.innerHTML = renderLabOutput(result.raw, result.disclaimer);
    } else {
      resultContent.innerHTML = '<p>No results extracted from the image.</p>';
    }
  } catch (error) {
    resultContent.innerHTML = '<p class="text-danger">Failed to analyze lab report. Please try again.</p>';
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'Analyze Report';
    isLoading = false;
  }
}

function renderLabOutput(markdown, disclaimer) {
  // Convert markdown to HTML for lab output
  let html = '<div class="lab-report-output">';

  // Parse the markdown - handle tables, headers, lists
  const lines = markdown.split('\n');
  let inTable = false;
  let tableHtml = '';
  let isHeader = true;

  for (const line of lines) {
    const trimmed = line.trim();

    // Table row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Skip separator rows
      if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
        isHeader = false;
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHtml = '<table><thead>';
      }

      const cells = trimmed.split('|').filter(c => c.trim() !== '');
      const tag = isHeader ? 'th' : 'td';

      if (!isHeader && tableHtml.includes('<thead>') && !tableHtml.includes('</thead>')) {
        tableHtml += '</thead><tbody>';
      }

      tableHtml += '<tr>';
      cells.forEach(cell => {
        tableHtml += `<${tag}>${escapeHtml(cell.trim())}</${tag}>`;
      });
      tableHtml += '</tr>';
      continue;
    }

    // Close table if we were in one
    if (inTable && !trimmed.startsWith('|')) {
      inTable = false;
      isHeader = true;
      tableHtml += '</tbody></table>';
      html += tableHtml;
      tableHtml = '';
    }

    // Headers
    if (trimmed.startsWith('### ')) {
      html += `<h3 class="lab-section-title">${escapeHtml(trimmed.slice(4))}</h3>`;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      html += `<h3 class="lab-section-title">${escapeHtml(trimmed.slice(3))}</h3>`;
      continue;
    }

    // Bold text
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      html += `<p><strong>${escapeHtml(trimmed.slice(2, -2))}</strong></p>`;
      continue;
    }

    // List items
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      html += `<p class="lab-list-item">${escapeHtml(trimmed.slice(2))}</p>`;
      continue;
    }

    // Regular paragraph
    if (trimmed.length > 0) {
      html += `<p>${escapeHtml(trimmed)}</p>`;
    }
  }

  // Close any open table
  if (inTable) {
    tableHtml += '</tbody></table>';
    html += tableHtml;
  }

  html += '</div>';

  if (disclaimer) {
    html += `<div class="ai-response-footer"><span class="ai-disclaimer-small">${escapeHtml(disclaimer)}</span></div>`;
  }

  return html;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return String(text);
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
