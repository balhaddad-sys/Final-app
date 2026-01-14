/**
 * MedWard Master - Frontend Application
 * Professional Medical Analysis Platform
 * With Image Compression & Advanced Error Handling
 */

// ==================== Configuration ====================
const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycby-3iNSD4CquZiyg0inXQ_sGs3IxNrSx1WzRREIv2ABKnyPP5GjvSYZdzClkZqWZ9M7Og/exec',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  COMPRESS_QUALITY: 0.8,
  COMPRESS_MAX_WIDTH: 1920,
  COMPRESS_MAX_HEIGHT: 1920,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // Reduced from 2000ms to 1000ms for faster retries
  CACHE_MAX_SIZE: 10, // Maximum cached results
  CACHE_TTL: 3600000  // 1 hour cache lifetime
};

// ==================== State ====================
const State = {
  user: null,
  files: [],
  currentAnalysis: null,
  wardPresentation: null,
  resultsCache: new Map() // LRU cache for analysis results
};

// ==================== DOM Elements ====================
const Elements = {
  // Screens
  loginScreen: document.getElementById('login-screen'),
  dashboardScreen: document.getElementById('dashboard-screen'),

  // Login
  usernameInput: document.getElementById('username-input'),
  loginBtn: document.getElementById('login-btn'),

  // Navigation
  navUser: document.getElementById('nav-user'),
  userInitial: document.getElementById('user-initial'),
  userName: document.getElementById('user-name'),
  logoutBtn: document.getElementById('logout-btn'),

  // Upload Tabs
  uploadTabs: document.querySelectorAll('.upload-tab'),
  uploadContents: document.querySelectorAll('.upload-content'),

  // Image Upload
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  fileList: document.getElementById('file-list'),
  reportType: document.getElementById('report-type'),
  analyzeBtn: document.getElementById('analyze-btn'),
  btnBrowse: document.querySelector('.btn-browse'),

  // Text Input
  textInput: document.getElementById('text-input'),
  reportTypeText: document.getElementById('report-type-text'),
  analyzeTextBtn: document.getElementById('analyze-text-btn'),

  // Processing
  processingOverlay: document.getElementById('processing-overlay'),
  processingTitle: document.getElementById('processing-title'),
  processingMessage: document.getElementById('processing-message'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  processSteps: document.querySelectorAll('.process-step'),

  // Results
  resultsPanel: document.getElementById('results-panel'),
  resultsContent: document.getElementById('results-content'),
  analysisTimestamp: document.getElementById('analysis-timestamp'),
  newAnalysisBtn: document.getElementById('new-analysis-btn'),
  printBtn: document.getElementById('print-btn'),

  // Toast
  toast: document.getElementById('toast')
};

// ==================== Initialization ====================
function init() {
  console.log('🚀 MedWard Master initializing...');

  // Event Listeners
  Elements.loginBtn?.addEventListener('click', handleLogin);
  Elements.usernameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  Elements.logoutBtn?.addEventListener('click', handleLogout);

  // Upload Tabs
  Elements.uploadTabs?.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // File Upload
  Elements.btnBrowse?.addEventListener('click', () => Elements.fileInput?.click());
  Elements.fileInput?.addEventListener('change', handleFileSelect);
  Elements.analyzeBtn?.addEventListener('click', () => handleAnalyze('image'));

  // Drag & Drop
  if (Elements.dropzone) {
    Elements.dropzone.addEventListener('click', () => Elements.fileInput?.click());
    Elements.dropzone.addEventListener('dragover', handleDragOver);
    Elements.dropzone.addEventListener('dragleave', handleDragLeave);
    Elements.dropzone.addEventListener('drop', handleDrop);
  }

  // Text Input
  Elements.textInput?.addEventListener('input', () => {
    Elements.analyzeTextBtn.disabled = !Elements.textInput.value.trim();
  });
  Elements.analyzeTextBtn?.addEventListener('click', () => handleAnalyze('text'));

  // Results
  Elements.newAnalysisBtn?.addEventListener('click', startNewAnalysis);
  Elements.printBtn?.addEventListener('click', () => window.print());

  // View Toggle
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleResultsView(btn.dataset.view));
  });

  // Export Ward Presentation
  const exportWardBtn = document.getElementById('export-ward-btn');
  if (exportWardBtn) {
    exportWardBtn.addEventListener('click', exportWardPresentation);
  }

  console.log('✅ Initialization complete');
}

// ==================== Authentication ====================
async function handleLogin() {
  const username = Elements.usernameInput?.value.trim();

  if (!username) {
    showToast('Please enter a username', 'error');
    return;
  }

  try {
    const response = await callBackend('login', { username });

    if (response.success) {
      State.user = response.user;

      // Update UI
      Elements.userInitial.textContent = username.charAt(0).toUpperCase();
      Elements.userName.textContent = username;
      Elements.navUser.style.display = 'flex';

      // Switch screens
      Elements.loginScreen?.classList.remove('active');
      Elements.dashboardScreen?.classList.add('active');

      showToast(`Welcome, ${username}!`, 'success');
    } else {
      showToast(response.error || 'Login failed', 'error');
    }
  } catch (error) {
    showToast(`Login error: ${error.message}`, 'error');
  }
}

function handleLogout() {
  State.user = null;
  State.files = [];

  // Reset UI
  Elements.navUser.style.display = 'none';
  Elements.loginScreen?.classList.add('active');
  Elements.dashboardScreen?.classList.remove('active');
  Elements.usernameInput.value = '';

  clearFiles();
  hideResults();

  showToast('Logged out successfully', 'success');
}

// ==================== Tab Switching ====================
function switchTab(tabName) {
  // Update tabs
  Elements.uploadTabs?.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update content
  Elements.uploadContents?.forEach(content => {
    content.classList.toggle('active', content.dataset.content === tabName);
  });
}

// ==================== File Handling ====================
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  addFiles(files);
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  Elements.dropzone?.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  Elements.dropzone?.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  Elements.dropzone?.classList.remove('dragover');

  const files = Array.from(e.dataTransfer.files).filter(file =>
    file.type.startsWith('image/') || file.type === 'application/pdf'
  );

  if (files.length > 0) {
    addFiles(files);
  } else {
    showToast('Please drop valid image files', 'error');
  }
}

function addFiles(files) {
  // Validate file sizes
  const validFiles = files.filter(file => {
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      showToast(`${file.name} is too large (max 10MB)`, 'error');
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  State.files = [...State.files, ...validFiles];
  updateFileList();
  Elements.analyzeBtn.disabled = false;
}

function updateFileList() {
  if (State.files.length === 0) {
    Elements.fileList?.classList.remove('has-files');
    Elements.fileList.innerHTML = '';
    Elements.analyzeBtn.disabled = true;
    return;
  }

  Elements.fileList?.classList.add('has-files');
  Elements.fileList.innerHTML = State.files.map((file, index) => `
    <div class="file-item">
      <img src="${URL.createObjectURL(file)}" class="file-preview" alt="${file.name}">
      <div class="file-info">
        <span class="file-name">${file.name}</span>
        <span class="file-size">${formatFileSize(file.size)}</span>
      </div>
      <button class="file-remove" onclick="removeFile(${index})" title="Remove">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M6 6L14 14M6 14L14 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  `).join('');
}

function removeFile(index) {
  State.files.splice(index, 1);
  updateFileList();
}

function clearFiles() {
  State.files = [];
  updateFileList();
  if (Elements.fileInput) Elements.fileInput.value = '';
}

// Make removeFile globally available
window.removeFile = removeFile;

// ==================== Image Compression ====================
// Optimized with OffscreenCanvas support and faster processing
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > CONFIG.COMPRESS_MAX_WIDTH || height > CONFIG.COMPRESS_MAX_HEIGHT) {
          const ratio = Math.min(
            CONFIG.COMPRESS_MAX_WIDTH / width,
            CONFIG.COMPRESS_MAX_HEIGHT / height
          );
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Use OffscreenCanvas if available (faster, runs off main thread)
        let canvas;
        let ctx;

        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(width, height);
          ctx = canvas.getContext('2d', { alpha: false }); // Disable alpha for faster rendering
        } else {
          canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          ctx = canvas.getContext('2d', { alpha: false });
        }

        // Draw image with optimized settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        if (canvas.convertToBlob) {
          // OffscreenCanvas API
          canvas.convertToBlob({
            type: file.type,
            quality: CONFIG.COMPRESS_QUALITY
          }).then(blob => {
            console.log(`📦 Compressed ${file.name}: ${formatFileSize(file.size)} → ${formatFileSize(blob.size)}`);
            resolve(blob);
          }).catch(() => reject(new Error('Compression failed')));
        } else {
          // Standard Canvas API
          canvas.toBlob(
            (blob) => {
              if (blob) {
                console.log(`📦 Compressed ${file.name}: ${formatFileSize(file.size)} → ${formatFileSize(blob.size)}`);
                resolve(blob);
              } else {
                reject(new Error('Compression failed'));
              }
            },
            file.type,
            CONFIG.COMPRESS_QUALITY
          );
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ==================== Analysis ====================
async function handleAnalyze(mode) {
  try {
    showProcessing();

    const docType = mode === 'image'
      ? Elements.reportType?.value
      : Elements.reportTypeText?.value;

    if (mode === 'image') {
      await analyzeImages(docType);
    } else {
      await analyzeText(docType);
    }

  } catch (error) {
    console.error('Analysis error:', error);
    showToast(error.message || 'Analysis failed', 'error');
    hideProcessing();
  }
}

async function analyzeImages(docType) {
  if (State.files.length === 0) {
    throw new Error('No files selected');
  }

  // Step 1: Compress images IN PARALLEL for faster processing
  updateStep('compress', 'active', 'Compressing images...');
  updateProgress(10);

  const compressionPromises = State.files.map(file =>
    compressImage(file).catch(error => {
      console.warn(`Failed to compress ${file.name}, using original`);
      return file; // Fallback to original on error
    })
  );

  const compressedFiles = await Promise.all(compressionPromises);
  updateProgress(30);
  updateStep('compress', 'completed', 'Compression complete');

  // Step 2: Upload to cloud IN PARALLEL for faster uploads
  updateStep('upload', 'active', 'Uploading to cloud...');
  updateProgress(35);

  const uploadPromises = compressedFiles.map(async (file, index) => {
    const base64 = await fileToBase64(file);
    const uploadResult = await callBackendWithRetry('uploadImage', { image: base64 });

    if (!uploadResult.success) {
      throw new Error(`Failed to upload ${State.files[index].name}`);
    }

    return uploadResult.fileId;
  });

  const fileIds = await Promise.all(uploadPromises);
  updateProgress(60);
  updateStep('upload', 'completed', 'Upload complete');

  // Step 3: OCR processing
  updateStep('ocr', 'active', 'Extracting text with AI...');
  updateProgress(65);

  // Step 4: AI Analysis
  updateStep('analyze', 'active', 'Analyzing with AI...');
  updateProgress(80);

  const payload = {
    fileId: fileIds[0], // Use first file for now
    documentType: docType,
    username: State.user?.username || 'Guest'
  };

  const result = await callBackendWithRetry('interpret', payload);

  if (!result.success) {
    throw new Error(result.error || 'Analysis failed');
  }

  updateStep('ocr', 'completed', 'Text extracted');
  updateStep('analyze', 'completed', 'Analysis complete');
  updateProgress(100);

  // Show results after brief delay
  await new Promise(resolve => setTimeout(resolve, 500));
  displayResults(result);

}

async function analyzeText(docType) {
  const text = Elements.textInput?.value.trim();

  if (!text) {
    throw new Error('Please enter medical report text');
  }

  // Check cache first for instant results
  const cacheKey = generateCacheKey(text, docType);
  const cachedResult = getFromCache(cacheKey);

  if (cachedResult) {
    console.log('✓ Cache hit - using cached analysis');
    updateStep('compress', 'completed', 'Not needed');
    updateStep('upload', 'completed', 'Not needed');
    updateStep('ocr', 'completed', 'Cached');
    updateStep('analyze', 'completed', 'Cached result');
    updateProgress(100);
    await new Promise(resolve => setTimeout(resolve, 300));
    displayResults(cachedResult);
    showToast('Using cached result (instant!)', 'success');
    return;
  }

  // Cache miss - perform analysis
  updateStep('compress', 'completed', 'Not needed');
  updateStep('upload', 'completed', 'Not needed');
  updateProgress(40);

  updateStep('ocr', 'active', 'Processing text...');
  updateProgress(60);

  updateStep('analyze', 'active', 'Analyzing with AI...');
  updateProgress(80);

  const payload = {
    text: text,
    documentType: docType,
    username: State.user?.username || 'Guest'
  };

  const result = await callBackendWithRetry('interpret', payload);

  if (!result.success) {
    throw new Error(result.error || 'Analysis failed');
  }

  // Store in cache for future use
  addToCache(cacheKey, result);

  updateStep('ocr', 'completed', 'Text processed');
  updateStep('analyze', 'completed', 'Analysis complete');
  updateProgress(100);

  await new Promise(resolve => setTimeout(resolve, 500));
  displayResults(result);
}

// ==================== Caching Utilities ====================
// Generate cache key for text-based analysis
function generateCacheKey(text, docType) {
  const normalized = text.trim().toLowerCase().substring(0, 5000);
  return `${docType}:${hashString(normalized)}`;
}

// Simple hash function for cache keys
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// LRU cache management - configurable size and TTL
function addToCache(key, value) {
  if (State.resultsCache.size >= CONFIG.CACHE_MAX_SIZE) {
    // Remove oldest entry
    const firstKey = State.resultsCache.keys().next().value;
    State.resultsCache.delete(firstKey);
  }
  State.resultsCache.set(key, {
    data: value,
    timestamp: Date.now()
  });
}

function getFromCache(key) {
  const cached = State.resultsCache.get(key);
  if (!cached) return null;

  // Check cache expiration
  const age = Date.now() - cached.timestamp;
  if (age > CONFIG.CACHE_TTL) {
    State.resultsCache.delete(key);
    return null;
  }

  return cached.data;
}

// ==================== Backend Communication ====================
async function callBackend(action, data = {}) {
  const payload = { action, ...data };

  try {
    const response = await fetch(CONFIG.BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();

    // Try to parse JSON, handle errors gracefully
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text:', text);
      throw new Error('Invalid response from server. Please try again.');
    }

  } catch (error) {
    console.error('Backend call error:', error);
    throw error;
  }
}

async function callBackendWithRetry(action, data, attempt = 1) {
  try {
    return await callBackend(action, data);
  } catch (error) {
    if (attempt < CONFIG.RETRY_ATTEMPTS) {
      console.log(`⚠️ Retry attempt ${attempt}/${CONFIG.RETRY_ATTEMPTS}...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY * attempt));
      return callBackendWithRetry(action, data, attempt + 1);
    }
    throw error;
  }
}

// ==================== Processing UI ====================
function showProcessing() {
  Elements.processingOverlay?.classList.add('active');
  resetProcessing();
}

function hideProcessing() {
  Elements.processingOverlay?.classList.remove('active');
}

function resetProcessing() {
  updateProgress(0);
  Elements.processSteps?.forEach(step => {
    step.classList.remove('active', 'completed', 'error');
    const status = step.querySelector('.step-status');
    if (status) status.textContent = 'Pending';
  });

  if (Elements.processingTitle) Elements.processingTitle.textContent = 'Processing Report';
  if (Elements.processingMessage) Elements.processingMessage.textContent = 'Initializing AI analysis...';
}

function updateProgress(percentage) {
  if (Elements.progressFill) {
    Elements.progressFill.style.width = `${percentage}%`;
  }
  if (Elements.progressText) {
    Elements.progressText.textContent = `${Math.round(percentage)}%`;
  }
}

function updateStep(stepName, state, statusText) {
  const step = document.querySelector(`.process-step[data-step="${stepName}"]`);
  if (!step) return;

  step.classList.remove('active', 'completed', 'error');
  step.classList.add(state);

  const status = step.querySelector('.step-status');
  if (status && statusText) {
    status.textContent = statusText;
  }
}

// ==================== Results Display ====================
function displayResults(data) {
  hideProcessing();

  // Store analysis in state
  State.currentAnalysis = data;
  State.wardPresentation = null; // Reset ward presentation

  // Show results panel
  Elements.resultsPanel?.classList.add('active');

  // Set timestamp
  if (Elements.analysisTimestamp) {
    const now = new Date();
    Elements.analysisTimestamp.textContent = `Completed at ${now.toLocaleTimeString()}`;
  }

  // Build results HTML
  const sections = [
    {
      icon: '📊',
      title: 'Summary',
      content: data.interpretation?.summary || 'No summary available'
    },
    {
      icon: '🔍',
      title: 'Key Findings',
      content: formatList(data.interpretation?.keyFindings)
    },
    {
      icon: '⚠️',
      title: 'Abnormalities & Alerts',
      content: formatList(data.interpretation?.abnormalities, 'alert-item') || '<p>No abnormalities detected.</p>'
    },
    {
      icon: '✅',
      title: 'Normal Findings',
      content: formatList(data.interpretation?.normalFindings, 'success-item') || '<p>No normal findings listed.</p>'
    },
    {
      icon: '💡',
      title: 'Clinical Pearls',
      content: formatList(data.clinicalPearls) || '<p>No clinical pearls available.</p>'
    },
    {
      icon: '💬',
      title: 'Discussion Points',
      content: formatList(data.potentialQuestions) || '<p>No specific discussion points.</p>'
    },
    {
      icon: '👤',
      title: 'Patient Explanation',
      content: data.presentation?.patientFriendly || 'No patient explanation available'
    },
    {
      icon: '📝',
      title: 'Recommendations',
      content: formatList(data.presentation?.recommendations) || '<p>No specific recommendations.</p>'
    }
  ];

  Elements.resultsContent.innerHTML = sections.map(section => `
    <div class="result-card">
      <div class="result-card-header">
        <span class="result-card-icon">${section.icon}</span>
        <h4>${section.title}</h4>
      </div>
      <div class="result-card-body">
        ${section.content}
      </div>
    </div>
  `).join('');

  // Scroll to results
  Elements.resultsPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatList(items, className = '') {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return null;
  }

  const listItems = items.map(item =>
    `<li class="${className}">${escapeHtml(item)}</li>`
  ).join('');

  return `<ul>${listItems}</ul>`;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function hideResults() {
  Elements.resultsPanel?.classList.remove('active');
  if (Elements.resultsContent) Elements.resultsContent.innerHTML = '';
}

function startNewAnalysis() {
  hideResults();
  clearFiles();
  if (Elements.textInput) Elements.textInput.value = '';
  Elements.analyzeTextBtn.disabled = true;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== Utilities ====================
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function showToast(message, type = 'info') {
  if (!Elements.toast) return;

  Elements.toast.textContent = message;
  Elements.toast.className = `toast ${type} show`;

  setTimeout(() => {
    Elements.toast.classList.remove('show');
  }, 4000);
}

// ==================== Ward Presentation ====================
function toggleResultsView(view) {
  // Update toggle buttons
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  // Show/hide views
  const detailedView = document.getElementById('detailed-view');
  const wardView = document.getElementById('ward-view');
  const exportBtn = document.getElementById('export-ward-btn');

  if (view === 'ward') {
    if (detailedView) detailedView.style.display = 'none';
    if (wardView) wardView.style.display = 'block';
    if (exportBtn) exportBtn.style.display = 'inline-flex';

    // Generate ward presentation if not already generated
    if (!State.wardPresentation && State.currentAnalysis) {
      generateWardPresentation();
    }
  } else {
    if (detailedView) detailedView.style.display = 'block';
    if (wardView) wardView.style.display = 'none';
    if (exportBtn) exportBtn.style.display = 'none';
  }
}

async function generateWardPresentation() {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) return;

  // Show loading
  wardContent.innerHTML = '<div class="loading"><div class="processing-spinner"></div><p>Generating ward presentation...</p></div>';

  try {
    const files = State.files;
    const docType = Elements.reportType?.value || Elements.reportTypeText?.value;

    const payload = {
      documentType: docType,
      username: State.user?.username || 'Guest',
      presentationFormat: 'ward'
    };

    // Handle images or text
    if (files && files.length > 0) {
      // Use existing file upload logic
      const compressedFile = await compressImage(files[0]);
      const base64 = await fileToBase64(compressedFile);
      const uploadResult = await callBackendWithRetry('uploadImage', { image: base64 });

      if (!uploadResult.success) {
        throw new Error('Failed to upload image');
      }

      payload.fileId = uploadResult.fileId;
    } else {
      payload.text = Elements.textInput?.value.trim();
    }

    const result = await callBackendWithRetry('interpret', payload);

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate ward presentation');
    }

    State.wardPresentation = result.wardPresentation || result;
    displayWardPresentation(State.wardPresentation);

  } catch (error) {
    console.error('Ward presentation error:', error);
    wardContent.innerHTML = `<div class="error-message">
      <p>⚠️ Failed to generate ward presentation: ${error.message}</p>
      <button class="btn-secondary" onclick="generateWardPresentation()">Try Again</button>
    </div>`;
  }
}

// Make generateWardPresentation globally available
window.generateWardPresentation = generateWardPresentation;

function displayWardPresentation(data) {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) return;

  // Handle both ward format and detailed format
  const ward = data.wardPresentation || data;

  let html = '';

  // Header
  if (ward.header) {
    html += `<div class="ward-header">${escapeHtml(ward.header)}</div>`;
  }

  html += '<hr class="ward-divider">';

  // Status Table
  if (ward.status && ward.status.length > 0) {
    html += '<div class="ward-section">';
    html += '<div class="ward-section-title">STATUS</div>';
    html += '<table class="status-table">';
    html += '<thead><tr><th>Domain</th><th>Status</th><th>Value</th></tr></thead>';
    html += '<tbody>';

    ward.status.forEach(item => {
      const indicatorClass = `status-${item.indicator || 'green'}`;
      html += `<tr>
        <td><strong>${escapeHtml(item.domain)}</strong></td>
        <td><span class="status-indicator ${indicatorClass}"></span></td>
        <td>${escapeHtml(item.value)}</td>
      </tr>`;
    });

    html += '</tbody></table>';
    html += '</div>';
  }

  // Active Issues
  if (ward.activeIssues && ward.activeIssues.length > 0) {
    html += '<div class="ward-section">';
    html += '<div class="ward-section-title">ACTIVE ISSUES</div>';
    html += '<ul class="issue-list">';

    ward.activeIssues.forEach(issue => {
      if (typeof issue === 'string') {
        html += `<li class="issue-item">${escapeHtml(issue)}</li>`;
      } else {
        html += `<li class="issue-item">
          <div class="issue-name">${escapeHtml(issue.issue)}</div>
          <div class="issue-details">
            ${escapeHtml(issue.status)}
            <span class="issue-arrow">→</span>
            ${escapeHtml(issue.action)}
          </div>
        </li>`;
      }
    });

    html += '</ul>';
    html += '</div>';
  }

  // Today's Plan
  if (ward.todaysPlan && ward.todaysPlan.length > 0) {
    html += '<div class="ward-section">';
    html += '<div class="ward-section-title">TODAY\'S PLAN</div>';
    html += '<ul class="plan-list">';

    ward.todaysPlan.forEach(item => {
      html += `<li class="plan-item">${escapeHtml(item)}</li>`;
    });

    html += '</ul>';
    html += '</div>';
  }

  // Watch For
  if (ward.watchFor && ward.watchFor.length > 0) {
    html += '<div class="ward-section">';
    html += '<div class="ward-section-title">WATCH FOR</div>';
    html += '<ul class="watchfor-list">';

    ward.watchFor.forEach(item => {
      html += `<li class="watchfor-item">${escapeHtml(item)}</li>`;
    });

    html += '</ul>';
    html += '</div>';
  }

  html += '<hr class="ward-divider">';

  wardContent.innerHTML = html;
}

function exportWardPresentation() {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) return;

  // Create a printable version
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ward Presentation - MedWard Master</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          font-size: 12pt;
          line-height: 1.6;
          margin: 1in;
        }
        .ward-header {
          font-size: 14pt;
          font-weight: bold;
          text-align: center;
          border-top: 3px solid #000;
          border-bottom: 3px solid #000;
          padding: 0.5in 0;
          margin-bottom: 0.5in;
        }
        .ward-section-title {
          font-weight: bold;
          margin-top: 0.3in;
          margin-bottom: 0.1in;
        }
        .status-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0.2in;
        }
        .status-table th, .status-table td {
          border: 1px solid #000;
          padding: 0.1in;
          text-align: left;
        }
        .issue-list, .plan-list, .watchfor-list {
          list-style: none;
          padding-left: 0;
        }
        .issue-item, .plan-item, .watchfor-item {
          margin-bottom: 0.1in;
        }
        .ward-divider {
          border: none;
          border-top: 2px solid #000;
          margin: 0.3in 0;
        }
        @page {
          margin: 0.5in;
        }
      </style>
    </head>
    <body>
      ${wardContent.innerHTML}
      <script>
        window.onload = function() {
          window.print();
          window.close();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ==================== Start App ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
