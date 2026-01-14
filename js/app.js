/**
 * MedWard Master - Frontend Application
 * GitHub Pages + Google Apps Script Backend
 */

// ==================== Configuration ====================
const CONFIG = {
  // Google Apps Script Backend URL
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycbz-wDxy9_fy5z8fYxlyGn0TJL-qmGGaxisnQFc7VE_knoFnOX6hhpAx4HVo1fbO13VO8w/exec',
  APP_NAME: 'MedWard Master',
  VERSION: '1.0.0'
};

// ==================== State Management ====================
const AppState = {
  user: null,
  token: null,
  currentInput: null,
  currentResults: null
};

// ==================== DOM Elements ====================
const Elements = {
  // Sections
  loginSection: document.getElementById('login-section'),
  inputSection: document.getElementById('input-section'),
  resultsSection: document.getElementById('results-section'),
  userSection: document.getElementById('user-section'),

  // Login
  usernameInput: document.getElementById('username-input'),
  loginBtn: document.getElementById('login-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  usernameDisplay: document.getElementById('username-display'),

  // Input Method
  methodBtns: document.querySelectorAll('.method-btn'),
  textInputArea: document.getElementById('text-input-area'),
  imageInputArea: document.getElementById('image-input-area'),

  // Input Fields
  medicalText: document.getElementById('medical-text'),
  imageUpload: document.getElementById('image-upload'),
  fileNameDisplay: document.getElementById('file-name'),
  imagePreview: document.getElementById('image-preview'),
  docType: document.getElementById('doc-type'),

  // Buttons
  analyzeBtn: document.getElementById('analyze-btn'),
  clearBtn: document.getElementById('clear-btn'),
  newAnalysisBtn: document.getElementById('new-analysis-btn'),
  printBtn: document.getElementById('print-btn'),

  // Loading
  loadingIndicator: document.getElementById('loading-indicator'),

  // Results
  summaryContent: document.getElementById('summary-content'),
  findingsContent: document.getElementById('findings-content'),
  alertsContent: document.getElementById('alerts-content'),
  normalContent: document.getElementById('normal-content'),
  pearlsContent: document.getElementById('pearls-content'),
  questionsContent: document.getElementById('questions-content'),
  patientExplanationContent: document.getElementById('patient-explanation-content'),
  recommendationsContent: document.getElementById('recommendations-content'),

  // Toast
  toast: document.getElementById('toast')
};

// ==================== Event Listeners ====================
function initializeEventListeners() {
  // Login
  Elements.loginBtn.addEventListener('click', handleLogin);
  Elements.usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  Elements.logoutBtn.addEventListener('click', handleLogout);

  // Input Method Toggle
  Elements.methodBtns.forEach(btn => {
    btn.addEventListener('click', () => toggleInputMethod(btn.dataset.method));
  });

  // File Upload
  Elements.imageUpload.addEventListener('change', handleFileSelect);

  // Analysis
  Elements.analyzeBtn.addEventListener('click', handleAnalyze);
  Elements.clearBtn.addEventListener('click', clearInputs);
  Elements.newAnalysisBtn.addEventListener('click', startNewAnalysis);
  Elements.printBtn.addEventListener('click', () => window.print());

  // Copy to clipboard
  const copySummaryBtn = document.getElementById('copy-summary-btn');
  if (copySummaryBtn) {
    copySummaryBtn.addEventListener('click', () => {
      copyToClipboard(Elements.summaryContent.textContent);
    });
  }
}

// ==================== Authentication ====================
async function handleLogin() {
  const username = Elements.usernameInput.value.trim();

  if (!username) {
    showToast('Please enter a username', 'error');
    return;
  }

  // Validate backend URL
  if (CONFIG.BACKEND_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    showToast('Please configure your Google Apps Script backend URL in js/app.js', 'error');
    return;
  }

  try {
    showLoading(true);
    const response = await callBackend('login', { username });

    if (response.success) {
      AppState.user = response.user;
      AppState.token = response.token;

      // Update UI
      Elements.usernameDisplay.textContent = `👤 ${username}`;
      Elements.userSection.style.display = 'flex';
      Elements.loginSection.style.display = 'none';
      Elements.inputSection.style.display = 'block';

      showToast(`Welcome, ${username}!`, 'success');
    } else {
      showToast('Login failed: ' + response.error, 'error');
    }
  } catch (error) {
    showToast('Login error: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function handleLogout() {
  AppState.user = null;
  AppState.token = null;

  // Reset UI
  Elements.userSection.style.display = 'none';
  Elements.inputSection.style.display = 'none';
  Elements.resultsSection.style.display = 'none';
  Elements.loginSection.style.display = 'block';
  Elements.usernameInput.value = '';

  clearInputs();
  showToast('Logged out successfully', 'success');
}

// ==================== Input Management ====================
function toggleInputMethod(method) {
  // Update button states
  Elements.methodBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.method === method);
  });

  // Toggle input areas
  if (method === 'text') {
    Elements.textInputArea.style.display = 'block';
    Elements.imageInputArea.style.display = 'none';
  } else {
    Elements.textInputArea.style.display = 'none';
    Elements.imageInputArea.style.display = 'block';
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];

  if (file) {
    // Update file name display
    Elements.fileNameDisplay.textContent = file.name;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      Elements.imagePreview.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <p class="mt-lg">${file.name} (${formatFileSize(file.size)})</p>
      `;
    };
    reader.readAsDataURL(file);
  }
}

function clearInputs() {
  Elements.medicalText.value = '';
  Elements.imageUpload.value = '';
  Elements.fileNameDisplay.textContent = 'Choose an image file or drag here';
  Elements.imagePreview.innerHTML = '';
  Elements.docType.selectedIndex = 0;
}

// ==================== Analysis ====================
async function handleAnalyze() {
  const text = Elements.medicalText.value.trim();
  const file = Elements.imageUpload.files[0];
  const docType = Elements.docType.value;

  // Validation
  if (!text && !file) {
    showToast('Please enter text or upload an image', 'error');
    return;
  }

  try {
    showLoading(true);

    // Prepare payload
    const payload = {
      documentType: docType,
      username: AppState.user?.username || 'Guest'
    };

    // Handle image or text
    if (file) {
      payload.image = await fileToBase64(file);
    } else {
      payload.text = text;
    }

    // Call backend
    const response = await callBackend('interpret', payload);

    if (response.success) {
      AppState.currentResults = response;
      displayResults(response);
      showToast('Analysis complete!', 'success');
    } else {
      showToast('Analysis failed: ' + response.error, 'error');
    }

  } catch (error) {
    showToast('Analysis error: ' + error.message, 'error');
    console.error('Analysis error:', error);
  } finally {
    showLoading(false);
  }
}

// ==================== Results Display ====================
function displayResults(data) {
  // Hide input, show results
  Elements.inputSection.style.display = 'none';
  Elements.resultsSection.style.display = 'block';

  // Summary
  if (data.interpretation?.summary) {
    Elements.summaryContent.innerHTML = `<p>${escapeHtml(data.interpretation.summary)}</p>`;
  }

  // Key Findings
  if (data.interpretation?.keyFindings) {
    Elements.findingsContent.innerHTML = createList(
      data.interpretation.keyFindings,
      'findings-list'
    );
  }

  // Abnormalities
  if (data.interpretation?.abnormalities && data.interpretation.abnormalities.length > 0) {
    Elements.alertsContent.innerHTML = createList(
      data.interpretation.abnormalities,
      'findings-list',
      'alert-item'
    );
  } else {
    Elements.alertsContent.innerHTML = '<p>No abnormalities detected.</p>';
  }

  // Normal Findings
  if (data.interpretation?.normalFindings && data.interpretation.normalFindings.length > 0) {
    Elements.normalContent.innerHTML = createList(
      data.interpretation.normalFindings,
      'findings-list',
      'normal-item'
    );
  } else {
    Elements.normalContent.innerHTML = '<p>No normal findings listed.</p>';
  }

  // Clinical Pearls
  if (data.clinicalPearls && data.clinicalPearls.length > 0) {
    Elements.pearlsContent.innerHTML = createList(data.clinicalPearls, 'pearls-list');
  } else {
    Elements.pearlsContent.innerHTML = '<p>No clinical pearls available.</p>';
  }

  // Discussion Points
  if (data.potentialQuestions && data.potentialQuestions.length > 0) {
    Elements.questionsContent.innerHTML = createList(data.potentialQuestions, 'questions-list');
  } else {
    Elements.questionsContent.innerHTML = '<p>No specific discussion points.</p>';
  }

  // Patient-Friendly Explanation
  if (data.presentation?.patientFriendly) {
    Elements.patientExplanationContent.innerHTML = `<p>${escapeHtml(data.presentation.patientFriendly)}</p>`;
  }

  // Recommendations
  if (data.presentation?.recommendations && data.presentation.recommendations.length > 0) {
    Elements.recommendationsContent.innerHTML = createList(
      data.presentation.recommendations,
      'recommendations-list'
    );
  } else {
    Elements.recommendationsContent.innerHTML = '<p>No specific recommendations.</p>';
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function createList(items, listClass, itemClass = '') {
  if (!items || items.length === 0) return '<p>No data available.</p>';

  const listItems = items
    .map(item => `<li class="${itemClass}">${escapeHtml(item)}</li>`)
    .join('');

  return `<ul class="${listClass}">${listItems}</ul>`;
}

function startNewAnalysis() {
  Elements.resultsSection.style.display = 'none';
  Elements.inputSection.style.display = 'block';
  clearInputs();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== Backend Communication ====================
async function callBackend(action, data = {}) {
  const payload = {
    action,
    ...data
  };

  try {
    const response = await fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain' // Important: Avoids CORS preflight
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Backend call error:', error);
    throw error;
  }
}

// ==================== Utilities ====================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showToast('Copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy', 'error'));
}

function showLoading(show) {
  Elements.loadingIndicator.style.display = show ? 'block' : 'none';
  Elements.analyzeBtn.disabled = show;

  if (show) {
    Elements.analyzeBtn.innerHTML = '<span class="spinner"></span> Analyzing...';
  } else {
    Elements.analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span> Analyze Report';
  }
}

function showToast(message, type = 'info') {
  Elements.toast.textContent = message;
  Elements.toast.className = `toast ${type} show`;

  setTimeout(() => {
    Elements.toast.classList.remove('show');
  }, 3000);
}

// ==================== Initialization ====================
function initialize() {
  console.log(`${CONFIG.APP_NAME} v${CONFIG.VERSION} initialized`);

  // Check if backend URL is configured
  if (CONFIG.BACKEND_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
    console.warn('⚠️ Backend URL not configured. Please update CONFIG.BACKEND_URL in js/app.js');
  }

  // Initialize event listeners
  initializeEventListeners();

  // Check for saved session (optional enhancement)
  // loadSavedSession();
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// ==================== Export for testing (optional) ====================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CONFIG,
    AppState,
    callBackend,
    fileToBase64,
    formatFileSize
  };
}
