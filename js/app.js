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
  if (detailedView) detailedView.style.display = 'block';
  if (wardView) wardView.style.display = 'none';
  if (exportBtn) exportBtn.style.display = 'none';

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
