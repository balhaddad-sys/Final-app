/**
 * MedWard Master - Frontend Application
 * Professional Medical Analysis Platform
 * With Image Compression & Advanced Error Handling
 */

// ==================== Configuration ====================
const CONFIG = {
  BACKEND_URL: 'https://script.google.com/macros/s/AKfycby-3iNSD4CquZiyg0inXQ_sGs3IxNrSx1WzRREIv2ABKnyPP5GjvSYZdzClkZqWZ9M7Og/exec',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  COMPRESS_QUALITY: 0.6, // Reduced for faster compression
  COMPRESS_MAX_WIDTH: 1280, // Reduced for faster processing
  COMPRESS_MAX_HEIGHT: 1280, // Reduced for faster processing
  COMPRESS_THRESHOLD: 500 * 1024, // Skip compression for files < 500KB
  RETRY_ATTEMPTS: 2, // Reduced retry attempts
  RETRY_DELAY: 500, // Faster retries
  CACHE_MAX_SIZE: 20, // Increased cache size
  CACHE_TTL: 7200000  // 2 hour cache lifetime
};

// ==================== State ====================
const State = {
  user: null,
  files: [],
  currentAnalysis: null,
  wardPresentation: null,
  sourceData: null, // Store fileId or text for reuse
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

  // Copy to Clipboard
  const copyBtn = document.getElementById('copy-ward-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyToClipboard);
  }

  console.log('✅ MedWard Master initialized - Clinical Grade');
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
// Ultra-fast compression with smart skipping
async function compressImage(file) {
  // Skip compression for small files - faster!
  if (file.size < CONFIG.COMPRESS_THRESHOLD) {
    console.log(`⚡ Skipping compression for small file: ${file.name}`);
    return file;
  }

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
          ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
        } else {
          canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
        }

        // Fast rendering - medium quality for speed
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium'; // Changed from 'high' to 'medium' for speed
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        if (canvas.convertToBlob) {
          canvas.convertToBlob({
            type: 'image/jpeg', // JPEG is faster than PNG
            quality: CONFIG.COMPRESS_QUALITY
          }).then(resolve).catch(() => reject(new Error('Compression failed')));
        } else {
          canvas.toBlob(
            (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
            'image/jpeg', // JPEG is faster than PNG
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

  // Store source data for ward presentation reuse
  State.sourceData = {
    type: 'image',
    fileId: fileIds[0],
    documentType: docType
  };

  updateStep('ocr', 'completed', 'Text extracted');
  updateStep('analyze', 'completed', 'Analysis complete');
  updateProgress(100);

  // Show results immediately - no delay!
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

  // Store source data for ward presentation reuse
  State.sourceData = {
    type: 'text',
    text: text,
    documentType: docType
  };

  // Store in cache for future use
  addToCache(cacheKey, result);

  updateStep('ocr', 'completed', 'Text processed');
  updateStep('analyze', 'completed', 'Analysis complete');
  updateProgress(100);

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

  // Build results HTML with professional icons
  const sections = [
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="16" height="16" rx="2"/><path d="M6 10h8M10 6v8"/></svg>',
      title: 'Summary',
      content: data.interpretation?.summary || 'No summary available'
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><path d="M14 14l4 4"/></svg>',
      title: 'Key Findings',
      content: formatList(data.interpretation?.keyFindings)
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2l8 16H2L10 2z"/><path d="M10 8v4M10 14h.01"/></svg>',
      title: 'Abnormalities & Alerts',
      content: formatList(data.interpretation?.abnormalities, 'alert-item') || '<p>No abnormalities detected.</p>'
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M7 10l2 2 4-4"/></svg>',
      title: 'Normal Findings',
      content: formatList(data.interpretation?.normalFindings, 'success-item') || '<p>No normal findings listed.</p>'
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l2 2"/></svg>',
      title: 'Clinical Pearls',
      content: formatList(data.clinicalPearls) || '<p>No clinical pearls available.</p>'
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4h16M2 10h16M2 16h16"/></svg>',
      title: 'Discussion Points',
      content: formatList(data.potentialQuestions) || '<p>No specific discussion points.</p>'
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10" cy="6" r="3"/><path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>',
      title: 'Patient Explanation',
      content: data.presentation?.patientFriendly || 'No patient explanation available'
    },
    {
      icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8l6-6 6 6M10 2v12M4 16h12"/></svg>',
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

  // Clear state
  State.currentAnalysis = null;
  State.wardPresentation = null;
  State.sourceData = null;

  // Reset to detailed view
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === 'detailed');
  });
  const detailedView = document.getElementById('detailed-view');
  const wardView = document.getElementById('ward-view');
  const exportBtn = document.getElementById('export-ward-btn');
  const copyBtn = document.getElementById('copy-ward-btn');
  if (detailedView) detailedView.style.display = 'block';
  if (wardView) wardView.style.display = 'none';
  if (exportBtn) exportBtn.style.display = 'none';
  if (copyBtn) copyBtn.style.display = 'none';

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

  const copyBtn = document.getElementById('copy-ward-btn');

  if (view === 'ward') {
    if (detailedView) detailedView.style.display = 'none';
    if (wardView) wardView.style.display = 'block';
    if (exportBtn) exportBtn.style.display = 'inline-flex';
    if (copyBtn) copyBtn.style.display = 'inline-flex';

    // Generate ward presentation if not already generated
    if (!State.wardPresentation && State.currentAnalysis) {
      generateWardPresentation();
    }
  } else {
    if (detailedView) detailedView.style.display = 'block';
    if (wardView) wardView.style.display = 'none';
    if (exportBtn) exportBtn.style.display = 'none';
    if (copyBtn) copyBtn.style.display = 'none';
  }
}

async function generateWardPresentation() {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) return;

  console.log('🏥 Generating ward presentation...');
  console.log('📋 State.sourceData:', State.sourceData);
  console.log('📊 State.currentAnalysis:', State.currentAnalysis);

  // Show loading
  wardContent.innerHTML = '<div class="loading"><div class="processing-spinner"></div><p>Generating ward presentation...</p></div>';

  try {
    // Check if we have source data to reuse
    if (!State.sourceData) {
      throw new Error('No source data available. Please analyze a report first.');
    }

    const payload = {
      documentType: State.sourceData.documentType,
      username: State.user?.username || 'Guest',
      presentationFormat: 'ward'
    };

    // Use stored source data
    if (State.sourceData.type === 'image') {
      payload.fileId = State.sourceData.fileId;
      console.log('📷 Using stored fileId:', payload.fileId);
    } else {
      payload.text = State.sourceData.text;
      console.log('📝 Using stored text (length):', payload.text?.length);
    }

    console.log('🚀 Calling backend with payload:', { ...payload, text: payload.text ? '(text truncated)' : undefined });

    const result = await callBackendWithRetry('interpret', payload);
    console.log('✅ Backend response:', result);

    if (!result.success) {
      throw new Error(result.error || 'Failed to generate ward presentation');
    }

    // Check if backend returned ward presentation
    if (result.wardPresentation) {
      console.log('🎯 Ward presentation received from backend');
      State.wardPresentation = result.wardPresentation;
      displayWardPresentation(State.wardPresentation);
    } else if (hasWardFields(result)) {
      console.log('🎯 Result has ward fields directly');
      State.wardPresentation = result;
      displayWardPresentation(State.wardPresentation);
    } else {
      // Fallback: Convert detailed analysis to ward format
      console.log('⚠️ Backend did not return ward format, converting detailed analysis...');
      State.wardPresentation = convertToWardFormat(State.currentAnalysis || result);
      displayWardPresentation(State.wardPresentation);
    }

  } catch (error) {
    console.error('❌ Ward presentation error:', error);
    wardContent.innerHTML = `<div class="error-message" style="padding: 2rem; text-align: center;">
      <p style="color: #ef4444; font-size: 1.1rem; margin-bottom: 1rem;">⚠️ Failed to generate ward presentation</p>
      <p style="color: #666; margin-bottom: 1.5rem;">${escapeHtml(error.message)}</p>
      <button class="btn-secondary" onclick="generateWardPresentation()">Try Again</button>
    </div>`;
  }
}

// Check if result has ward presentation fields
function hasWardFields(data) {
  return data && (data.header || data.status || data.activeIssues || data.todaysPlan);
}

// Convert detailed analysis to ward format (fallback)
function convertToWardFormat(analysis) {
  console.log('🔄 Converting detailed analysis to ward format');

  if (!analysis || !analysis.interpretation) {
    return {
      header: 'Medical Report Analysis',
      status: [{domain: 'Analysis', indicator: 'yellow', value: 'Limited data available'}],
      activeIssues: ['Detailed analysis format detected - limited ward presentation'],
      todaysPlan: ['Review full detailed analysis'],
      watchFor: ['Check detailed report for complete information']
    };
  }

  const interp = analysis.interpretation;

  // Build ward presentation from detailed analysis
  const ward = {
    header: 'Medical Report | Analysis Summary',
    status: [],
    activeIssues: [],
    todaysPlan: [],
    watchFor: []
  };

  // Extract status from abnormalities
  if (interp.abnormalities && interp.abnormalities.length > 0) {
    ward.status.push({
      domain: 'Abnormalities',
      indicator: 'red',
      value: `${interp.abnormalities.length} findings require attention`
    });

    // Add abnormalities as active issues
    interp.abnormalities.slice(0, 5).forEach(abn => {
      ward.activeIssues.push({
        issue: 'Abnormal Finding',
        status: abn,
        action: 'Review and assess clinical significance'
      });
    });
  } else {
    ward.status.push({
      domain: 'Results',
      indicator: 'green',
      value: 'No abnormalities detected'
    });
  }

  // Add key findings to plan
  if (interp.keyFindings && interp.keyFindings.length > 0) {
    interp.keyFindings.slice(0, 4).forEach(finding => {
      ward.todaysPlan.push(`Review: ${finding}`);
    });
  }

  // Add recommendations to watch for
  if (analysis.presentation?.recommendations && analysis.presentation.recommendations.length > 0) {
    analysis.presentation.recommendations.slice(0, 4).forEach(rec => {
      ward.watchFor.push(rec);
    });
  }

  // Fallback content
  if (ward.activeIssues.length === 0) {
    ward.activeIssues.push('Review complete analysis for detailed findings');
  }
  if (ward.todaysPlan.length === 0) {
    ward.todaysPlan.push('Review detailed analysis report');
    ward.todaysPlan.push('Correlate with clinical presentation');
  }
  if (ward.watchFor.length === 0) {
    ward.watchFor.push('Clinical correlation recommended');
  }

  console.log('✅ Converted ward format:', ward);
  return ward;
}

// Make generateWardPresentation globally available
window.generateWardPresentation = generateWardPresentation;

function displayWardPresentation(data) {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) return;

  // Handle both ward format and detailed format
  const ward = data.wardPresentation || data;

  let html = '';

  // Document Header
  html += `
    <header class="document-header">
      <div class="document-header__title">
        <span class="document-header__icon">MED</span>
        <h1>${escapeHtml(ward.header || 'Ward Round Summary')}</h1>
      </div>
      <div class="document-header__meta">
        <time class="document-header__date" datetime="${new Date().toISOString()}">${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</time>
        <span class="document-header__time">${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </div>
    </header>
  `;

  // Patient Banner (placeholder)
  html += `
    <section class="patient-banner" aria-label="Patient Information">
      <div class="patient-banner__bed">Bed --</div>
      <div class="patient-banner__info">
        <span class="patient-banner__demographics">-- / --</span>
        <span class="patient-banner__admission">Day -- of Admission</span>
      </div>
      <div class="patient-banner__diagnosis">
        <span class="patient-banner__dx-label">Primary Dx:</span>
        <span class="patient-banner__dx-value">--</span>
      </div>
    </section>
  `;

  // Vitals Strip (placeholder)
  html += `
    <section class="vitals-strip" aria-label="Vital Signs">
      <div class="vital"><span class="vital__label">T:</span><span class="vital__value">--</span></div>
      <div class="vital"><span class="vital__label">HR:</span><span class="vital__value">--</span></div>
      <div class="vital"><span class="vital__label">BP:</span><span class="vital__value">--</span></div>
      <div class="vital"><span class="vital__label">RR:</span><span class="vital__value">--</span></div>
      <div class="vital"><span class="vital__label">SpO2:</span><span class="vital__value">--</span></div>
    </section>
  `;

  // Status Summary
  if (ward.status && ward.status.length > 0) {
    html += '<section class="ward-section status-summary">';
    html += '<h2 class="ward-section__header"><span class="section-badge section-badge--alert">!</span>Status Overview</h2>';
    html += '<table class="status-table">';
    html += '<thead><tr><th scope="col">Domain</th><th scope="col">Status</th><th scope="col">Details</th></tr></thead>';
    html += '<tbody>';

    ward.status.forEach(item => {
      const indicatorClass = `status-${item.indicator || 'green'}`;
      html += `<tr>
        <td><strong>${escapeHtml(item.domain)}</strong></td>
        <td><span class="status-indicator ${indicatorClass}"></span></td>
        <td>${escapeHtml(item.value)}</td>
      </tr>`;
    });

    html += '</tbody></table></section>';
  }

  // Active Issues/Problems
  if (ward.activeIssues && ward.activeIssues.length > 0) {
    html += '<section class="ward-section">';
    html += '<h2 class="ward-section__header"><span class="section-badge">1</span>Active Issues</h2>';
    html += '<ol class="problem-list" role="list">';

    ward.activeIssues.forEach(issue => {
      if (typeof issue === 'string') {
        // Parse for severity indicators
        const isCritical = issue.toLowerCase().includes('critical') || issue.toLowerCase().includes('acute') || issue.toLowerCase().includes('urgent');
        const itemClass = isCritical ? 'problem-item--critical' : '';
        html += `<li class="problem-item ${itemClass}">${escapeHtml(issue)}</li>`;
      } else {
        const itemClass = issue.severity === 'critical' ? 'problem-item--critical' : '';
        html += `<li class="problem-item ${itemClass}">
          <div class="problem-item__title">${escapeHtml(issue.issue || issue.title || '')}</div>
          <div class="problem-item__detail">${escapeHtml(issue.status || '')}</div>
          ${issue.action ? `<div class="problem-item__action">${escapeHtml(issue.action)}</div>` : ''}
        </li>`;
      }
    });

    html += '</ol></section>';
  }

  // Today's Plan
  if (ward.todaysPlan && ward.todaysPlan.length > 0) {
    html += '<section class="ward-section">';
    html += '<h2 class="ward-section__header"><span class="section-badge section-badge--plan">P</span>Today\'s Plan</h2>';
    html += '<ul class="plan-list" role="list">';

    ward.todaysPlan.forEach((item, index) => {
      html += `<li class="plan-item" data-index="${index}">
        <span class="plan-item__checkbox" role="checkbox" aria-checked="false"></span>
        <span class="plan-item__text">${escapeHtml(item)}</span>
      </li>`;
    });

    html += '</ul></section>';
  }

  // Watch For
  if (ward.watchFor && ward.watchFor.length > 0) {
    html += '<section class="watchfor-section" aria-label="Red Flags">';
    html += '<h2 class="watchfor-section__header"><span class="watchfor-icon" aria-hidden="true">⚑</span>Watch For</h2>';
    html += '<ul class="watchfor-list" role="list">';

    ward.watchFor.forEach(item => {
      // Clean up item text - remove prefixes
      const cleanText = item.replace(/^(REQUEST|OBTAIN|VERIFY|CLARIFY|ENSURE|DOCUMENT|MONITOR|WATCH):\s*/i, '').trim();
      html += `<li class="watchfor-item">${escapeHtml(cleanText)}</li>`;
    });

    html += '</ul></section>';
  }

  // Document Footer
  html += `
    <footer class="document-footer">
      <p class="document-footer__disclaimer">AI-generated summary for clinical review. Verify all information against source documentation.</p>
      <p class="document-footer__timestamp">Generated: <time datetime="${new Date().toISOString()}">${new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time></p>
    </footer>
  `;

  wardContent.innerHTML = html;

  // Add click handlers for checkboxes
  attachPlanCheckboxHandlers();
}

// Attach checkbox handlers for plan items
function attachPlanCheckboxHandlers() {
  document.querySelectorAll('.plan-item__checkbox').forEach(checkbox => {
    checkbox.addEventListener('click', function() {
      const planItem = this.closest('.plan-item');
      const isCompleted = planItem.classList.contains('plan-item--completed');

      if (isCompleted) {
        planItem.classList.remove('plan-item--completed');
        this.setAttribute('aria-checked', 'false');
      } else {
        planItem.classList.add('plan-item--completed');
        this.setAttribute('aria-checked', 'true');
      }
    });
  });
}

// ==================== Export Functions ====================
function exportWardPresentation() {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) {
    showToast('No ward presentation to export', 'error');
    return;
  }

  // Create a clinical-grade printable version
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ward Round Summary - MedWard Master</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Source+Sans+Pro:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
      <style>
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: 'Source Sans Pro', sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          margin: 0.75in;
          color: #1A1A1A;
          background: white;
        }
        .document-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 3px solid #495057;
        }
        .document-header__title h1 {
          font-family: 'Crimson Pro', serif;
          font-size: 20pt;
          font-weight: 700;
          margin: 0;
        }
        .document-header__meta {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9pt;
          color: #6C757D;
        }
        .patient-banner {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 1rem;
          padding: 0.5rem 0.75rem;
          background: #E9ECEF;
          border-left: 4px solid #1565C0;
          margin-bottom: 1rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9pt;
        }
        .vitals-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 0.25rem 1rem;
          padding: 0.5rem 0.75rem;
          background: #F8F9FA;
          border: 1px solid #DEE2E6;
          margin-bottom: 1rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9pt;
        }
        .ward-section {
          margin-bottom: 1rem;
          page-break-inside: avoid;
        }
        .ward-section__header, h2 {
          font-family: 'Crimson Pro', serif;
          font-size: 14pt;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          border-bottom: 2px solid #495057;
          padding-bottom: 0.25rem;
          margin-bottom: 0.5rem;
        }
        .status-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
          font-size: 10pt;
        }
        .status-table th {
          background: #E9ECEF;
          padding: 0.35rem 0.5rem;
          border: 1px solid #DEE2E6;
          text-align: left;
          font-weight: 600;
          font-size: 9pt;
        }
        .status-table td {
          padding: 0.35rem 0.5rem;
          border: 1px solid #DEE2E6;
        }
        .status-indicator {
          display: inline-block;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          margin-right: 0.35rem;
        }
        .status-red { background: #C62828; }
        .status-yellow { background: #E65100; }
        .status-green { background: #2E7D32; }
        .problem-list, .issue-list {
          list-style: none;
          counter-reset: problem;
          margin: 0;
          padding: 0;
        }
        .problem-item, .issue-item {
          counter-increment: problem;
          padding: 0.5rem 0.75rem 0.5rem 2rem;
          margin-bottom: 0.35rem;
          background: #F8F9FA;
          border-left: 3px solid #1565C0;
          position: relative;
          page-break-inside: avoid;
          font-size: 10pt;
        }
        .problem-item::before, .issue-item::before {
          content: counter(problem) ".";
          position: absolute;
          left: 0.5rem;
          font-weight: 700;
          color: #1565C0;
          font-family: 'JetBrains Mono', monospace;
        }
        .problem-item--critical {
          border-left-color: #C62828;
          background: #FFEBEE;
        }
        .plan-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .plan-item {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.35rem 0;
          border-bottom: 1px solid #DEE2E6;
          font-size: 10pt;
        }
        .plan-item__checkbox {
          flex-shrink: 0;
          width: 14px;
          height: 14px;
          border: 2px solid #ADB5BD;
          border-radius: 2px;
          margin-top: 0.1rem;
        }
        .watchfor-section {
          background: #FFEBEE;
          border: 1px solid #C62828;
          border-radius: 3px;
          padding: 0.75rem;
          margin-bottom: 1rem;
          page-break-inside: avoid;
        }
        .watchfor-section__header {
          font-weight: 700;
          color: #C62828;
          margin-bottom: 0.5rem;
          font-size: 10pt;
          text-transform: uppercase;
          border: none;
          padding: 0;
        }
        .watchfor-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .watchfor-item {
          padding: 0.25rem 0;
          font-size: 10pt;
        }
        .watchfor-item::before {
          content: "⚑ ";
          color: #C62828;
          font-weight: 700;
        }
        .document-footer {
          margin-top: 1.5rem;
          padding-top: 0.75rem;
          border-top: 1px solid #DEE2E6;
          font-size: 8pt;
          color: #6C757D;
          text-align: center;
        }
        @page {
          margin: 0.75in;
          size: A4;
        }
      </style>
    </head>
    <body>
      ${wardContent.innerHTML}
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// Copy ward summary to clipboard (for pasting into EMR)
async function copyToClipboard() {
  const wardContent = document.getElementById('ward-content');
  if (!wardContent) {
    showToast('No ward presentation to copy', 'error');
    return;
  }

  // Convert to plain text format suitable for EMR
  const plainText = convertToPlainText(wardContent);

  try {
    await navigator.clipboard.writeText(plainText);
    showToast('Copied to clipboard', 'success');
  } catch (err) {
    showToast('Failed to copy', 'error');
  }
}

// Convert ward HTML to plain text for EMR systems
function convertToPlainText(element) {
  let text = '';

  // Header
  text += '═══════════════════════════════════════════════════════════════\n';
  text += '                    WARD ROUND SUMMARY\n';
  text += `                    ${new Date().toLocaleDateString()}\n`;
  text += '═══════════════════════════════════════════════════════════════\n\n';

  // Process each section
  const sections = element.querySelectorAll('.ward-section, .watchfor-section, .medications-section');
  sections.forEach(section => {
    const header = section.querySelector('h2, .ward-section__header, .watchfor-section__header');
    if (header) {
      text += header.textContent.toUpperCase().trim() + '\n';
      text += '───────────────────────────────────────────────────────────────\n';
    }

    // Process lists
    const listItems = section.querySelectorAll('li');
    listItems.forEach((item, index) => {
      const itemText = item.textContent.trim();
      text += `  ${index + 1}. ${itemText}\n`;
    });

    // Process tables
    const tables = section.querySelectorAll('table');
    tables.forEach(table => {
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const rowText = Array.from(cells).map(cell => cell.textContent.trim()).join(' | ');
        text += `  ${rowText}\n`;
      });
    });

    text += '\n';
  });

  // Footer
  text += '═══════════════════════════════════════════════════════════════\n';
  text += 'AI-generated summary. Verify against source documentation.\n';

  return text;
}

// ==================== Start App ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
