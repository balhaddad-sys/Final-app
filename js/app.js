/**
 * MedWard Master - Frontend Application
 * GitHub Pages + Google Apps Script Backend
 */

// ==================== Configuration ====================
const CONFIG = {
  // Google Apps Script Backend URL
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycby-3iNSD4CquZiyg0inXQ_sGs3IxNrSx1WzRREIv2ABKnyPP5GjvSYZdzClkZqWZ9M7Og/exec',
  APP_NAME: 'MedWard Master',
  VERSION: '1.0.0'
};

// ==================== State Management ====================
const AppState = {
  user: null,
  token: null,
  currentInput: null,
  currentResults: null,
  selectedFiles: [] // Array to store multiple selected files
};

// ==================== Debug Helper (for mobile) ====================
function debugLog(message) {
  // Log to console
  console.log(message);

  // Also log to visual debug panel for mobile users
  const debugContent = document.getElementById('debug-content');
  if (debugContent) {
    const timestamp = new Date().toLocaleTimeString();
    debugContent.innerHTML += `[${timestamp}] ${message}\n`;
    debugContent.scrollTop = debugContent.scrollHeight;
  }
}

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
  imageGallery: document.getElementById('image-gallery'),
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

  // Drag and Drop
  const fileLabel = document.querySelector('.file-label');
  if (fileLabel) {
    fileLabel.addEventListener('dragover', handleDragOver);
    fileLabel.addEventListener('dragleave', handleDragLeave);
    fileLabel.addEventListener('drop', handleDrop);
  }

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
  const files = Array.from(event.target.files);

  if (files.length > 0) {
    // Add new files to the state
    AppState.selectedFiles = [...AppState.selectedFiles, ...files];

    // Update file name display
    const fileCount = AppState.selectedFiles.length;
    Elements.fileNameDisplay.textContent = fileCount === 1
      ? `${AppState.selectedFiles[0].name}`
      : `${fileCount} images selected`;

    // Update gallery display
    updateImageGallery();
  }
}

function updateImageGallery() {
  Elements.imageGallery.innerHTML = '';

  AppState.selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const galleryItem = document.createElement('div');
      galleryItem.className = 'gallery-item';
      galleryItem.innerHTML = `
        <img src="${e.target.result}" alt="${file.name}">
        <div class="gallery-item-info">${file.name} (${formatFileSize(file.size)})</div>
        <button class="gallery-item-remove" onclick="removeImage(${index})" title="Remove image">×</button>
      `;
      Elements.imageGallery.appendChild(galleryItem);
    };
    reader.readAsDataURL(file);
  });
}

function removeImage(index) {
  AppState.selectedFiles.splice(index, 1);

  // Update display
  if (AppState.selectedFiles.length === 0) {
    Elements.fileNameDisplay.textContent = 'Choose images or drag and drop here';
    Elements.imageGallery.innerHTML = '';
    Elements.imageUpload.value = ''; // Reset file input
  } else {
    const fileCount = AppState.selectedFiles.length;
    Elements.fileNameDisplay.textContent = fileCount === 1
      ? `${AppState.selectedFiles[0].name}`
      : `${fileCount} images selected`;
    updateImageGallery();
  }
}

// Make removeImage globally available
window.removeImage = removeImage;

// ==================== Drag and Drop ====================
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = 'var(--primary-color)';
  e.currentTarget.style.background = 'rgba(37, 99, 235, 0.1)';
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = '';
  e.currentTarget.style.background = '';
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.style.borderColor = '';
  e.currentTarget.style.background = '';

  const files = Array.from(e.dataTransfer.files).filter(file =>
    file.type.startsWith('image/') || file.type === 'application/pdf'
  );

  if (files.length > 0) {
    // Add dropped files to state
    AppState.selectedFiles = [...AppState.selectedFiles, ...files];

    // Update file name display
    const fileCount = AppState.selectedFiles.length;
    Elements.fileNameDisplay.textContent = fileCount === 1
      ? `${AppState.selectedFiles[0].name}`
      : `${fileCount} images selected`;

    // Update gallery display
    updateImageGallery();

    showToast(`${files.length} file(s) added!`, 'success');
  } else {
    showToast('Please drop valid image files', 'error');
  }
}

function clearInputs() {
  Elements.medicalText.value = '';
  Elements.imageUpload.value = '';
  Elements.fileNameDisplay.textContent = 'Choose images or drag and drop here';
  Elements.imageGallery.innerHTML = '';
  Elements.docType.selectedIndex = 0;
  AppState.selectedFiles = []; // Clear selected files array
}

// ==================== Analysis ====================
async function handleAnalyze() {
  const text = Elements.medicalText.value.trim();
  const files = AppState.selectedFiles;
  const docType = Elements.docType.value;

  // Validation
  if (!text && files.length === 0) {
    showToast('Please enter text or upload images', 'error');
    return;
  }

  try {
    showLoading(true);

    // Prepare payload
    const payload = {
      documentType: docType,
      username: AppState.user?.username || 'Guest'
    };

    // Handle images or text
    if (files.length > 0) {
      debugLog(`[Frontend] ${files.length} file(s) selected`);

      // Step 1: Upload images to Drive
      updateLoadingStep('upload', 'active');
      updateProgress(10);

      const fileIds = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        debugLog(`[Frontend] Uploading file ${i + 1}/${files.length}: ${file.name}, Size: ${file.size} bytes`);

        const base64Data = await fileToBase64(file);
        debugLog(`[Frontend] Base64 encoded. Length: ${base64Data.length}`);

        const uploadResponse = await callBackend('uploadImage', { image: base64Data });

        if (!uploadResponse.success) {
          throw new Error(`Failed to upload ${file.name}: ${uploadResponse.error}`);
        }

        debugLog(`[Frontend] Image ${i + 1} uploaded to Drive. FileId: ${uploadResponse.fileId}`);
        fileIds.push(uploadResponse.fileId);

        // Update progress
        updateProgress(10 + (i + 1) / files.length * 30);
      }

      updateLoadingStep('upload', 'completed');

      // Step 2: OCR processing
      updateLoadingStep('ocr', 'active');
      updateProgress(50);

      // For multiple files, we'll use the first one for now
      // In future, you could process all or combine them
      payload.fileId = fileIds[0];

      if (fileIds.length > 1) {
        updateLoadingMessage(`Processing ${fileIds.length} images with AI Vision...`);
      }

    } else {
      payload.text = text;
      updateLoadingStep('upload', 'completed');
      updateLoadingStep('ocr', 'active');
      updateProgress(40);
    }

    // Step 3: Analyze content
    updateLoadingStep('ocr', 'completed');
    updateLoadingStep('analyze', 'active');
    updateProgress(70);

    debugLog(`[Frontend] Calling interpret with payload. Keys: ${Object.keys(payload)}`);

    // Call backend for interpretation
    const response = await callBackend('interpret', payload);

    // Step 4: Generate results
    updateLoadingStep('analyze', 'completed');
    updateLoadingStep('results', 'active');
    updateProgress(90);

    if (response.success) {
      updateProgress(100);
      updateLoadingStep('results', 'completed');

      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

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

  debugLog(`[Frontend] callBackend - action: ${action}`);
  debugLog(`[Frontend] callBackend - payload keys: ${Object.keys(payload)}`);

  if (payload.image) {
    debugLog(`[Frontend] callBackend - payload.image type: ${typeof payload.image}`);
    debugLog(`[Frontend] callBackend - payload.image length: ${payload.image.length}`);
  }

  try {
    const payloadString = JSON.stringify(payload);
    debugLog(`[Frontend] callBackend - JSON.stringify length: ${payloadString.length}`);
    debugLog(`[Frontend] callBackend - JSON.stringify preview (first 200 chars): ${payloadString.substring(0, 200)}`);

    const response = await fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain' // Important: Avoids CORS preflight
      },
      body: payloadString
    });

    debugLog(`[Frontend] callBackend - fetch response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    debugLog(`[Frontend] Backend call error: ${error.message}`);
    console.error('Backend call error:', error);
    throw error;
  }
}

// ==================== Utilities ====================
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      debugLog(`[Frontend] FileReader completed. Result length: ${result.length}`);
      debugLog(`[Frontend] FileReader result type: ${typeof result}`);
      debugLog(`[Frontend] FileReader result preview: ${result.substring(0, 100)}`);
      resolve(result);
    };
    reader.onerror = (error) => {
      debugLog(`[Frontend] FileReader error: ${error.message}`);
      console.error('[Frontend] FileReader error:', error);
      reject(error);
    };
    debugLog(`[Frontend] Starting FileReader.readAsDataURL for file: ${file.name}, ${file.size} bytes`);
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
    // Reset loading state
    resetLoadingState();
  } else {
    Elements.analyzeBtn.innerHTML = '<span class="btn-icon">🔍</span> Analyze Report';
  }
}

function resetLoadingState() {
  // Reset progress bar
  updateProgress(0);

  // Reset all steps
  const steps = document.querySelectorAll('.step-item');
  steps.forEach(step => {
    step.classList.remove('active', 'completed');
  });

  // Reset messages
  updateLoadingMessage('Analyzing with AI Vision...');
  document.getElementById('loading-title').textContent = 'Processing Medical Report';
}

function updateProgress(percentage) {
  const progressFill = document.getElementById('progress-fill');
  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }
}

function updateLoadingStep(stepName, status) {
  const step = document.querySelector(`.step-item[data-step="${stepName}"]`);
  if (step) {
    step.classList.remove('active', 'completed');
    if (status === 'active') {
      step.classList.add('active');
    } else if (status === 'completed') {
      step.classList.add('completed');
    }
  }
}

function updateLoadingMessage(message) {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
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
