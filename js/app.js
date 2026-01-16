/**
 * MedWard Master - Main Application
 * Handles UI interactions, file uploads, and analysis flow
 */

(function() {
  'use strict';

  // State
  let currentUser = null;
  let uploadedFiles = [];
  let analysisHistory = [];
  let metrics = {
    total: 0,
    cacheHits: 0,
    totalTime: 0,
    patterns: 0
  };
  
  // Batch processing state
  let batchMode = false;
  let batchResults = [];

  // DOM Elements - will be populated on init
  let elements = {};

  // Initialize
  function init() {
    // Get DOM elements after DOM is ready
    elements = {
      loginScreen: document.getElementById('login-screen'),
      dashboardScreen: document.getElementById('dashboard-screen'),
      usernameInput: document.getElementById('username-input'),
      loginBtn: document.getElementById('login-btn'),
      navUser: document.getElementById('nav-user'),
      userInitial: document.getElementById('user-initial'),
      userName: document.getElementById('user-name'),
      logoutBtn: document.getElementById('logout-btn'),
      dropzone: document.getElementById('dropzone'),
      fileInput: document.getElementById('file-input'),
      fileList: document.getElementById('file-list'),
      analyzeBtn: document.getElementById('analyze-btn'),
      textInput: document.getElementById('text-input'),
      analyzeTextBtn: document.getElementById('analyze-text-btn'),
      activityList: document.getElementById('activity-list'),
      resultsModal: document.getElementById('results-modal'),
      modalClose: document.getElementById('modal-close'),
      modalTimestamp: document.getElementById('modal-timestamp'),
      newAnalysisBtn: document.getElementById('new-analysis-btn'),
      detailedView: document.getElementById('detailed-view'),
      wardView: document.getElementById('ward-view'),
      processingOverlay: document.getElementById('processing-overlay'),
      processingText: document.getElementById('processing-text'),
      toast: document.getElementById('toast'),
      toastMessage: document.getElementById('toast-message'),
      metricTotal: document.getElementById('metric-total'),
      metricCache: document.getElementById('metric-cache'),
      metricSpeed: document.getElementById('metric-speed'),
      metricPatterns: document.getElementById('metric-patterns')
    };

    setupEventListeners();
    checkSession();
  }

  // Safe event listener helper
  function addEvent(element, event, handler) {
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Login
    addEvent(elements.loginBtn, 'click', handleLogin);
    addEvent(elements.usernameInput, 'keypress', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
    
    // Logout
    addEvent(elements.logoutBtn, 'click', handleLogout);
    
    // Upload Tabs
    document.querySelectorAll('.upload-tab').forEach(tab => {
      tab.addEventListener('click', () => switchUploadTab(tab.dataset.tab));
    });
    
    // Dropzone
    addEvent(elements.dropzone, 'click', () => {
      if (elements.fileInput) elements.fileInput.click();
    });
    addEvent(elements.dropzone, 'dragover', handleDragOver);
    addEvent(elements.dropzone, 'dragleave', handleDragLeave);
    addEvent(elements.dropzone, 'drop', handleDrop);
    addEvent(elements.fileInput, 'change', handleFileSelect);
    
    // Analyze buttons
    addEvent(elements.analyzeBtn, 'click', () => runAnalysis('image'));
    addEvent(elements.analyzeTextBtn, 'click', () => runAnalysis('text'));
    
    // Modal
    addEvent(elements.modalClose, 'click', closeModal);
    addEvent(elements.newAnalysisBtn, 'click', () => {
      closeModal();
      resetUpload();
      // Clear the modal content for next time
      if (elements.detailedView) elements.detailedView.innerHTML = '';
      if (elements.wardView) elements.wardView.innerHTML = '';
      // Scroll to top
      window.scrollTo(0, 0);
    });
    addEvent(elements.resultsModal, 'click', (e) => {
      if (e.target === elements.resultsModal) closeModal();
    });
    
    // Modal tabs
    document.querySelectorAll('.modal-tab').forEach(tab => {
      tab.addEventListener('click', () => switchModalView(tab.dataset.view));
    });
    
    // Add Labs tab click handler - ensure content is rendered
    const labsTab = document.querySelector('.modal-tab[data-view="labs"]');
    if (labsTab) {
      labsTab.addEventListener('click', () => {
        const labsView = document.getElementById('labs-view');
        // If still showing loading text, force re-render
        if (labsView && labsView.innerHTML.includes('Loading lab values')) {
          if (typeof ClinicalComponents !== 'undefined') {
            const labs = ClinicalComponents.currentLabValues || [];
            ClinicalComponents.renderLabsView(labs);
          }
        }
      });
    }
    
    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elements.resultsModal && elements.resultsModal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // Session Management
  function checkSession() {
    try {
      const saved = localStorage.getItem('medward_user');
      if (saved) {
        currentUser = JSON.parse(saved);
        showDashboard();
      }
      
      // Load metrics
      const savedMetrics = localStorage.getItem('medward_metrics');
      if (savedMetrics) {
        metrics = JSON.parse(savedMetrics);
        updateMetricsDisplay();
      }
      
      // Load history
      const savedHistory = localStorage.getItem('medward_history');
      if (savedHistory) {
        analysisHistory = JSON.parse(savedHistory);
        renderActivityList();
      }
    } catch (e) {
      console.error('Session check error:', e);
    }
  }

  // Login
  function handleLogin() {
    if (!elements.usernameInput) return;
    
    const username = elements.usernameInput.value.trim();
    if (!username) {
      showToast('Please enter a username', 'error');
      return;
    }
    
    currentUser = { name: username, initial: username[0].toUpperCase() };
    
    try {
      localStorage.setItem('medward_user', JSON.stringify(currentUser));
    } catch (e) {
      console.error('localStorage error:', e);
    }
    
    showDashboard();
    showToast(`Welcome, ${username}!`, 'success');
  }

  function handleLogout() {
    currentUser = null;
    try {
      localStorage.removeItem('medward_user');
    } catch (e) {}
    showScreen('login');
    if (elements.navUser) elements.navUser.hidden = true;
    if (elements.usernameInput) elements.usernameInput.value = '';
  }

  function showDashboard() {
    if (elements.userInitial) elements.userInitial.textContent = currentUser.initial;
    if (elements.userName) elements.userName.textContent = currentUser.name;
    if (elements.navUser) elements.navUser.hidden = false;

    // Show navigation tabs
    const navTabs = document.getElementById('main-nav-tabs');
    if (navTabs) navTabs.style.display = 'flex';

    showScreen('dashboard');
  }

  function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetScreen = document.getElementById(`${screen}-screen`);
    if (targetScreen) {
      targetScreen.classList.add('active');
    }
  }

  // Upload Tab Switching
  function switchUploadTab(tab) {
    document.querySelectorAll('.upload-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    document.querySelectorAll('.upload-content').forEach(c => {
      c.classList.toggle('active', c.dataset.content === tab);
    });
  }

  // Drag & Drop
  function handleDragOver(e) {
    e.preventDefault();
    if (elements.dropzone) elements.dropzone.classList.add('dragover');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    if (elements.dropzone) elements.dropzone.classList.remove('dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    if (elements.dropzone) elements.dropzone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
  }

  function processFiles(files) {
    const fileArray = Array.from(files);
    
    // Check if batch mode needed (more than 1 file)
    batchMode = fileArray.length > 1;
    
    fileArray.forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`${file.name} is too large (max 10MB)`, 'error');
        return;
      }
      
      if (!file.type.match(/^image\/|application\/pdf/)) {
        showToast(`${file.name} is not a supported format`, 'error');
        return;
      }
      
      uploadedFiles.push(file);
    });
    
    // If batch mode and MedWardBatch available, add to batch queue
    if (batchMode && typeof MedWardBatch !== 'undefined') {
      MedWardBatch.clearQueue();
      MedWardBatch.addFiles(uploadedFiles);
    }
    
    renderFileList();
    updateAnalyzeButton();
  }
  
  function updateAnalyzeButton() {
    if (!elements.analyzeBtn) return;
    
    elements.analyzeBtn.disabled = uploadedFiles.length === 0;
    
    // Update button text for batch mode
    if (uploadedFiles.length > 1) {
      elements.analyzeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
        </svg>
        Analyze ${uploadedFiles.length} Images
      `;
    } else {
      elements.analyzeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
        </svg>
        Analyze
      `;
    }
  }

  function renderFileList() {
    if (!elements.fileList) return;
    
    if (uploadedFiles.length === 0) {
      elements.fileList.innerHTML = '';
      return;
    }
    
    // Show batch header if multiple files
    let html = '';
    if (uploadedFiles.length > 1) {
      html += `
        <div class="batch-header">
          <div class="batch-info">
            <span class="batch-count">${uploadedFiles.length} files</span>
            <span class="batch-size">${formatFileSize(uploadedFiles.reduce((a, f) => a + f.size, 0))} total</span>
          </div>
          <button class="batch-clear" onclick="window.MedWard.resetUpload()">Clear All</button>
        </div>
        <div class="batch-progress" id="batch-progress" style="display:none;">
          <div class="batch-progress-bar"><div class="batch-progress-fill" id="batch-progress-fill"></div></div>
          <div class="batch-progress-text" id="batch-progress-text">0 / ${uploadedFiles.length}</div>
        </div>
      `;
    }
    
    // Show files (limit display for large batches)
    const displayFiles = uploadedFiles.length > 10 ? uploadedFiles.slice(0, 8) : uploadedFiles;
    const hiddenCount = uploadedFiles.length - displayFiles.length;
    
    html += displayFiles.map((file, index) => `
      <div class="file-preview">
        <div class="file-thumb">
          ${file.type.startsWith('image/') 
            ? `<img src="${URL.createObjectURL(file)}" alt="${file.name}">`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <path d="M14 2v6h6"/>
              </svg>`
          }
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatFileSize(file.size)}</div>
        </div>
        <button class="file-remove" onclick="window.MedWard.removeFile(${index})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');
    
    // Show hidden count
    if (hiddenCount > 0) {
      html += `<div class="file-preview more">+ ${hiddenCount} more files</div>`;
    }
    
    elements.fileList.innerHTML = html;
  }

  function removeFile(index) {
    uploadedFiles.splice(index, 1);
    batchMode = uploadedFiles.length > 1;
    
    // Update batch queue if available
    if (typeof MedWardBatch !== 'undefined') {
      MedWardBatch.clearQueue();
      if (uploadedFiles.length > 0) {
        MedWardBatch.addFiles(uploadedFiles);
      }
    }
    
    renderFileList();
    updateAnalyzeButton();
  }

  function resetUpload() {
    uploadedFiles = [];
    batchMode = false;
    batchResults = [];
    
    // Clear batch queue
    if (typeof MedWardBatch !== 'undefined') {
      MedWardBatch.clearQueue();
    }
    
    if (elements.fileList) elements.fileList.innerHTML = '';
    if (elements.fileInput) elements.fileInput.value = '';
    if (elements.textInput) elements.textInput.value = '';
    updateAnalyzeButton();
  }

  // Neural system instance
  let neural = null;
  
  // Backend URL - set this to your Google Apps Script deployment URL
  const BACKEND_URL = window.MEDWARD_BACKEND_URL || localStorage.getItem('medward_backend_url') || '';

  // Initialize neural system
  async function initNeural() {
    if (typeof MedWardNeural !== 'undefined' && !neural) {
      try {
        neural = new MedWardNeural({
          debug: true,
          confidenceThreshold: 0.7,
          backendUrl: BACKEND_URL
        });
        await neural.init();
        console.log('[App] Neural system initialized');
      } catch (e) {
        console.error('[App] Neural init failed:', e);
      }
    }
  }

  // Convert file to base64 data URL
  async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Upload image to backend (Google Drive) and get fileId
  async function uploadImageToBackend(file) {
    if (!BACKEND_URL) {
      throw new Error('Backend URL not configured. Set MEDWARD_BACKEND_URL.');
    }

    if (elements.processingText) elements.processingText.textContent = 'Uploading image...';
    
    const base64Data = await fileToBase64(file);
    
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'uploadImage',
        image: base64Data
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Image upload failed');
    }
    
    console.log('[App] Image uploaded, fileId:', result.fileId);
    return result.fileId;
  }

  // OPTIMIZED: Combined upload + analyze in single request
  async function uploadAndAnalyzeImage(file, documentType = 'lab') {
    if (!BACKEND_URL) {
      throw new Error('Backend URL not configured');
    }

    if (elements.processingText) elements.processingText.textContent = 'Processing image with enhanced vision...';

    const base64Data = await fileToBase64(file);

    // Single request that uploads AND analyzes (50% faster)
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'uploadAndInterpret', // Combined action
        image: base64Data,
        documentType: documentType,
        username: currentUser?.name || 'User',
        provider: 'claude'
      })
    });

    const result = await response.json();

    // Fallback to legacy two-step if combined not supported
    if (result.error === 'Unknown action' || result.error?.includes('action')) {
      console.log('[App] Falling back to two-step upload+analyze');
      const fileId = await uploadImageToBackend(file);
      return await analyzeImageViaBackend(fileId, documentType);
    }

    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }

    // Process lab/clinical separation if classifier available
    if (typeof MedWardDataClassifier !== 'undefined' && result.extractedText) {
      const separated = MedWardDataClassifier.separateLabFromClinical(
        result.extractedText,
        result
      );
      result.separatedData = separated;
      console.log('[App] Data separated:', separated.labData.values.length, 'labs,',
                  separated.clinicalData.history.length, 'history items');
    }

    return result;
  }

  // Analyze image via backend (Claude Vision) - kept for fallback
  async function analyzeImageViaBackend(fileId, documentType = 'lab') {
    if (!BACKEND_URL) {
      throw new Error('Backend URL not configured');
    }

    if (elements.processingText) elements.processingText.textContent = 'Analyzing with Claude Vision...';
    
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'interpret',
        fileId: fileId,
        documentType: documentType,
        username: currentUser?.name || 'User',
        provider: 'claude'
      })
    });

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Analysis failed');
    }
    
    return result;
  }

  // Analysis - handles both text and images (including batch)
  async function runAnalysis(type) {
    // Close any open modal first
    closeModal();
    
    // Clear previous results - show modal immediately with loading state
    if (elements.detailedView) elements.detailedView.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">Analyzing...</p>';
    if (elements.wardView) elements.wardView.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">Analyzing...</p>';
    const labsView = document.getElementById('labs-view');
    if (labsView) labsView.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align: center; padding: 2rem;">Analyzing...</p>';
    
    const startTime = Date.now();
    let results = null;
    let inputText = '';
    
    // Show processing
    showProcessing(true);
    
    try {
      if (type === 'image' && uploadedFiles.length > 0) {
        // IMAGE WORKFLOW
        if (!BACKEND_URL) {
          showProcessing(false);
          showToast('Backend not configured. Please set up Google Apps Script backend.', 'error');
          return;
        }
        
        // Check if batch mode (multiple files)
        if (uploadedFiles.length > 1 && typeof MedWardBatch !== 'undefined') {
          // BATCH PROCESSING
          await runBatchAnalysis();
          return;
        }
        
        // SINGLE IMAGE PROCESSING
        
        // Step 1: Upload image to Google Drive
        const fileId = await uploadImageToBackend(uploadedFiles[0]);
        
        // Step 2: Analyze with Claude Vision via backend
        const backendResult = await analyzeImageViaBackend(fileId);
        
        // Convert backend response to display format
        results = convertBackendToDisplay(backendResult);
        inputText = backendResult.extractedText || '[Image Analysis]';
        
      } else if (type === 'text') {
        // TEXT WORKFLOW: Use local neural system
        inputText = elements.textInput ? elements.textInput.value.trim() : '';
        
        if (!inputText) {
          showProcessing(false);
          showToast('Please enter medical report text to analyze', 'error');
          return;
        }
        
        // Initialize neural if needed (cached after first init)
        await initNeural();
        
        if (neural) {
          if (elements.processingText) elements.processingText.textContent = 'Processing with Neural AI...';
          
          const analysisResult = await neural.analyze(inputText, 'lab');
          results = convertNeuralToDisplay(analysisResult, inputText);
          
          // Update metrics from neural system
          const neuralMetrics = neural.getMetrics();
          metrics.total = neuralMetrics.total || metrics.total + 1;
          metrics.patterns = neuralMetrics.patterns || 0;
          metrics.cacheHits = neuralMetrics.local || 0;
          
        } else {
          // Fast fallback - no artificial delay
          if (elements.processingText) elements.processingText.textContent = 'Parsing medical data...';
          results = parseBasicLabResults(inputText);
          metrics.total++;
        }
      } else {
        showProcessing(false);
        showToast('Please upload an image or enter text to analyze', 'error');
        return;
      }
      
      metrics.totalTime += (Date.now() - startTime);
      console.log('[App] Analysis completed in', Date.now() - startTime, 'ms');
      
    } catch (error) {
      console.error('[App] Analysis error:', error);
      showProcessing(false);
      showToast('Analysis failed: ' + error.message, 'error');
      return;
    }
    
    // Hide processing immediately
    showProcessing(false);
    
    saveMetrics();
    updateMetricsDisplay();
    
    // Add to history
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: type === 'image' ? 'Image Analysis' : 'Text Analysis',
      summary: results.diagnosis || 'Medical Report Analysis',
      inputText: inputText.substring(0, 200),
      results: results
    };
    analysisHistory.unshift(historyItem);
    if (analysisHistory.length > 10) analysisHistory.pop();
    if (analysisHistory.length > 10) analysisHistory.pop();
    
    try {
      localStorage.setItem('medward_history', JSON.stringify(analysisHistory));
    } catch (e) {}
    
    renderActivityList();
    
    // Hide processing, show results
    showProcessing(false);
    showResults(results);
  }

  /**
   * Run batch analysis for multiple images
   */
  async function runBatchAnalysis() {
    console.log(`[App] Starting batch analysis of ${uploadedFiles.length} files`);
    
    batchResults = [];
    const startTime = Date.now();
    
    // Show batch progress UI
    const progressEl = document.getElementById('batch-progress');
    const progressFill = document.getElementById('batch-progress-fill');
    const progressText = document.getElementById('batch-progress-text');
    if (progressEl) progressEl.style.display = 'block';
    
    // Configure batch processor
    MedWardBatch.config.maxConcurrent = 3; // Process 3 at a time
    
    // Set up progress callback
    MedWardBatch.onProgress = (progress) => {
      const percent = Math.round((progress.completed / progress.total) * 100);
      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${progress.completed} / ${progress.total} - ${progress.current}`;
      if (elements.processingText) {
        elements.processingText.textContent = `Analyzing ${progress.completed + 1} of ${progress.total}: ${progress.current}`;
      }
    };
    
    // Set up completion callback
    MedWardBatch.onComplete = (result) => {
      console.log(`[App] Batch complete:`, result);
      
      batchResults = result.results;
      
      // Hide progress
      if (progressEl) progressEl.style.display = 'none';
      showProcessing(false);
      
      // Calculate metrics
      const totalTime = Date.now() - startTime;
      metrics.total += result.completed;
      metrics.totalTime += totalTime;
      
      // Show combined results
      showBatchResults(result);
      
      // Learn patterns from results
      if (typeof MedWardBatch !== 'undefined' && MedWardBatch.config.learningEnabled) {
        const patternStats = MedWardBatch.getStats().patterns;
        metrics.patterns = patternStats.labValues + patternStats.abnormalities;
        updateMetricsDisplay();
      }
      
      showToast(`Analyzed ${result.completed} images (${result.failed} failed) in ${(totalTime/1000).toFixed(1)}s`, 'success');
    };
    
    // Set up error callback
    MedWardBatch.onError = (error) => {
      console.error('[App] Batch error:', error);
      showProcessing(false);
      if (progressEl) progressEl.style.display = 'none';
      showToast('Batch analysis failed: ' + error.message, 'error');
    };
    
    // Clear and add files to queue
    MedWardBatch.clearQueue();
    MedWardBatch.addFiles(uploadedFiles);
    
    // Start processing
    await MedWardBatch.startProcessing({
      backendUrl: BACKEND_URL,
      documentType: 'lab'
    });
  }

  /**
   * Show batch results in a combined view
   */
  function showBatchResults(batchResult) {
    // Combine all results
    const combinedFindings = [];
    const combinedAlerts = [];
    const allLabValues = [];
    const allExtractedText = [];
    
    for (const result of batchResult.results) {
      // Collect extracted text
      if (result.extractedText) {
        allExtractedText.push(`--- ${result.file} ---\n${result.extractedText}`);
      }
      
      // Collect abnormalities
      const interp = result.interpretation || {};
      if (interp.abnormalities) {
        interp.abnormalities.forEach(a => {
          const text = typeof a === 'string' ? a : a.text || '';
          combinedAlerts.push({
            severity: 'warning',
            title: result.file,
            text: text
          });
        });
      }
      
      // Collect key findings
      if (interp.keyFindings) {
        interp.keyFindings.forEach(f => {
          combinedFindings.push({
            file: result.file,
            finding: typeof f === 'string' ? f : f.text || ''
          });
        });
      }
    }
    
    // Create combined display result
    const combinedResult = {
      diagnosis: `Batch Analysis: ${batchResult.completed} images`,
      summary: `Analyzed ${batchResult.completed} medical reports. Found ${combinedAlerts.length} abnormalities across all images.`,
      extractedText: allExtractedText.join('\n\n'),
      interpretation: {
        summary: `Batch analysis of ${batchResult.completed} images completed. ${combinedAlerts.length} abnormalities found.`,
        keyFindings: combinedFindings.map(f => `[${f.file}] ${f.finding}`),
        abnormalities: combinedAlerts.map(a => `[${a.title}] ${a.text}`)
      },
      presentation: {
        recommendations: [
          'Review each image individually for detailed findings',
          'Critical values require immediate attention',
          'Compare trends across multiple reports'
        ]
      },
      alerts: combinedAlerts,
      batchMode: true,
      batchResults: batchResult.results
    };
    
    // Show results
    showResults(combinedResult);
    
    // Add to history
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      type: `Batch Analysis (${batchResult.completed} images)`,
      summary: combinedResult.summary,
      results: combinedResult
    };
    analysisHistory.unshift(historyItem);
    if (analysisHistory.length > 10) analysisHistory.pop();
    
    try {
      localStorage.setItem('medward_history', JSON.stringify(analysisHistory));
    } catch (e) {}
    
    renderActivityList();
  }

  /**
   * Convert backend (Claude Vision) response to display format
   */
  function convertBackendToDisplay(backendResult) {
    const interpretation = backendResult.interpretation || {};
    const wardPresentation = backendResult.wardPresentation || {};
    
    // Extract findings from interpretation
    const findings = [];
    const alerts = [];
    
    // Process abnormalities
    if (interpretation.abnormalities) {
      interpretation.abnormalities.forEach(item => {
        const text = typeof item === 'string' ? item : item.finding || item.text || '';
        findings.push({
          name: text.split(':')[0] || text.substring(0, 30),
          value: text.split(':')[1] || '',
          reference: '-',
          status: 'Abnormal'
        });
        alerts.push({
          severity: 'warning',
          title: 'Abnormal Finding',
          text: text
        });
      });
    }
    
    // Process key findings
    if (interpretation.keyFindings) {
      interpretation.keyFindings.forEach(item => {
        const text = typeof item === 'string' ? item : item.finding || item.text || '';
        if (!findings.find(f => f.name.includes(text.substring(0, 15)))) {
          findings.push({
            name: text.split(':')[0] || text.substring(0, 30),
            value: text.split(':')[1] || '',
            reference: '-',
            status: 'See details'
          });
        }
      });
    }
    
    // Process critical alerts from ward presentation
    if (wardPresentation.status) {
      wardPresentation.status.forEach(s => {
        if (s.indicator === 'red') {
          alerts.unshift({
            severity: 'critical',
            title: s.domain,
            text: s.value
          });
        } else if (s.indicator === 'yellow') {
          alerts.push({
            severity: 'warning',
            title: s.domain,
            text: s.value
          });
        }
      });
    }
    
    // Build recommendations from ward presentation
    const recommendations = [];
    if (wardPresentation.todaysPlan) {
      wardPresentation.todaysPlan.forEach((item, i) => {
        recommendations.push({
          text: typeof item === 'string' ? item : item.text || item,
          urgent: i === 0
        });
      });
    }
    
    // Add active issues as recommendations if no plan
    if (recommendations.length === 0 && wardPresentation.activeIssues) {
      wardPresentation.activeIssues.forEach((issue, i) => {
        recommendations.push({
          text: `${issue.issue}: ${issue.action}`,
          urgent: i === 0
        });
      });
    }
    
    // Extract clinical pearls
    let clinicalPearl = null;
    if (interpretation.clinicalPearls && interpretation.clinicalPearls.length > 0) {
      clinicalPearl = interpretation.clinicalPearls[0];
      if (typeof clinicalPearl === 'object') {
        clinicalPearl = clinicalPearl.pearl || clinicalPearl.text || JSON.stringify(clinicalPearl);
      }
    }
    
    return {
      summary: interpretation.summary || wardPresentation.header || 'Analysis complete',
      diagnosis: interpretation.primaryDiagnosis || 
                 (wardPresentation.activeIssues?.[0]?.issue) || 
                 'See findings below',
      severity: alerts.some(a => a.severity === 'critical') ? 'Critical' : 
                alerts.length > 0 ? 'Abnormal' : 'Normal',
      alerts: alerts.slice(0, 5),
      findings: findings,
      recommendations: recommendations.length > 0 ? recommendations : [
        { text: 'Review findings with clinical context', urgent: false },
        { text: 'Correlate with patient history', urgent: false }
      ],
      clinicalPearl: clinicalPearl,
      patientExplanation: interpretation.presentation?.patientFriendly || 
                          'Your test results have been analyzed. Please discuss with your healthcare provider.',
      watchFor: wardPresentation.watchFor || [],
      source: 'backend-claude',
      rawResponse: backendResult
    };
  }

  /**
   * Convert neural system output to display format
   */
  function convertNeuralToDisplay(neuralResult, inputText) {
    if (!neuralResult) {
      return parseBasicLabResults(inputText);
    }
    
    const findings = [];
    const alerts = [];
    const recommendations = [];
    
    // Extract findings from neural result
    if (neuralResult.findings) {
      for (const [name, data] of Object.entries(neuralResult.findings)) {
        findings.push({
          name: name,
          value: data.value + ' ' + (data.unit || ''),
          reference: data.reference || '-',
          status: data.flag || 'Normal'
        });
        
        // Add alerts for critical values
        if (data.flag === 'Critical High' || data.flag === 'Critical Low') {
          alerts.push({
            severity: 'critical',
            title: `Critical: ${name}`,
            text: `${name} is ${data.value} ${data.unit || ''} (${data.flag})`
          });
        } else if (data.flag === 'High' || data.flag === 'Low') {
          alerts.push({
            severity: 'warning',
            title: `Abnormal: ${name}`,
            text: `${name} is ${data.value} ${data.unit || ''} (${data.flag})`
          });
        }
      }
    }
    
    // Extract recommendations
    if (neuralResult.recommendations) {
      neuralResult.recommendations.forEach((rec, i) => {
        recommendations.push({
          text: typeof rec === 'string' ? rec : rec.text || rec,
          urgent: i === 0
        });
      });
    }
    
    return {
      summary: neuralResult.summary || neuralResult.interpretation || 'Analysis complete',
      diagnosis: neuralResult.diagnosis || neuralResult.primaryDiagnosis || 'See findings below',
      severity: neuralResult.severity || 'See individual values',
      alerts: alerts.slice(0, 5),
      findings: findings,
      recommendations: recommendations.length > 0 ? recommendations : [
        { text: 'Review abnormal values with clinical context', urgent: false },
        { text: 'Correlate with patient symptoms and history', urgent: false },
        { text: 'Consider repeat testing if values unexpected', urgent: false }
      ],
      clinicalPearl: neuralResult.clinicalPearl || null,
      patientExplanation: neuralResult.patientExplanation || 'Your test results have been analyzed. Please discuss any abnormal values with your healthcare provider.',
      source: neuralResult.source || 'neural'
    };
  }

  /**
   * Basic lab result parser (fallback when neural not available)
   */
  function parseBasicLabResults(text) {
    const findings = [];
    const alerts = [];
    
    // Common lab patterns
    const patterns = [
      { regex: /K\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(mmol\/L)?/i, name: 'Potassium', unit: 'mmol/L', min: 3.5, max: 5.0 },
      { regex: /Na\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(mmol\/L)?/i, name: 'Sodium', unit: 'mmol/L', min: 136, max: 145 },
      { regex: /Cl\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(mmol\/L)?/i, name: 'Chloride', unit: 'mmol/L', min: 98, max: 106 },
      { regex: /CO2\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(mmol\/L)?/i, name: 'CO2', unit: 'mmol/L', min: 22, max: 29 },
      { regex: /Cr\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(μmol\/L|umol\/L)?/i, name: 'Creatinine', unit: 'μmol/L', min: 60, max: 110 },
      { regex: /BUN\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(mmol\/L)?/i, name: 'BUN', unit: 'mmol/L', min: 2.5, max: 7.1 },
      { regex: /Hb\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(g\/L)?/i, name: 'Hemoglobin', unit: 'g/L', min: 120, max: 170 },
      { regex: /WBC\s*[:\s]+(\d+\.?\d*)\s*(H|L)?/i, name: 'WBC', unit: '×10⁹/L', min: 4.0, max: 11.0 },
      { regex: /Plt\s*[:\s]+(\d+\.?\d*)\s*(H|L)?/i, name: 'Platelets', unit: '×10⁹/L', min: 150, max: 400 },
      { regex: /Glucose\s*[:\s]+(\d+\.?\d*)\s*(H|L)?\s*(mmol\/L)?/i, name: 'Glucose', unit: 'mmol/L', min: 3.9, max: 5.6 },
      { regex: /eGFR\s*[:\s]+(\d+\.?\d*)/i, name: 'eGFR', unit: 'mL/min', min: 90, max: 999 },
    ];
    
    patterns.forEach(p => {
      const match = text.match(p.regex);
      if (match) {
        const value = parseFloat(match[1]);
        const flag = match[2] ? match[2].toUpperCase() : null;
        
        let status = 'Normal';
        if (flag === 'H' || value > p.max) status = 'High';
        else if (flag === 'L' || value < p.min) status = 'Low';
        
        findings.push({
          name: p.name,
          value: `${value} ${p.unit}`,
          reference: `${p.min}-${p.max}`,
          status: status
        });
        
        if (status !== 'Normal') {
          alerts.push({
            severity: status === 'High' && value > p.max * 1.5 ? 'critical' : 'warning',
            title: `${status}: ${p.name}`,
            text: `${p.name} is ${value} ${p.unit} (Reference: ${p.min}-${p.max})`
          });
        }
      }
    });
    
    // Generate summary based on findings
    const abnormalCount = findings.filter(f => f.status !== 'Normal').length;
    let summary = `Analysis identified ${findings.length} parameters. `;
    if (abnormalCount > 0) {
      summary += `${abnormalCount} value(s) outside normal range require attention.`;
    } else {
      summary += 'All values within normal limits.';
    }
    
    return {
      summary: summary,
      diagnosis: abnormalCount > 0 ? 'Abnormal lab values detected' : 'Lab values within normal limits',
      severity: abnormalCount > 3 ? 'Moderate' : abnormalCount > 0 ? 'Mild' : 'Normal',
      alerts: alerts.slice(0, 5),
      findings: findings,
      recommendations: [
        { text: 'Review abnormal values in clinical context', urgent: abnormalCount > 0 },
        { text: 'Correlate with patient symptoms and examination', urgent: false },
        { text: 'Consider repeat testing if results unexpected', urgent: false }
      ],
      patientExplanation: abnormalCount > 0 
        ? 'Some of your test results are outside the normal range. Please discuss these with your healthcare provider.'
        : 'Your test results are within normal limits.',
      source: 'basic-parser'
    };
  }

  function showResults(results) {
    if (elements.modalTimestamp) {
      elements.modalTimestamp.textContent = new Date().toLocaleTimeString();
    }

    // Determine if this was from an image upload
    const isImage = uploadedFiles.length > 0;

    // Generate SBAR presentation if PatientPresentation is available
    if (typeof PatientPresentation !== 'undefined' && results) {
      try {
        const parsedData = results.parsed || results.rawResponse || {};
        const sbar = PatientPresentation.generateSBARPresentation(parsedData, results);
        results.sbar = sbar;

        // Generate quick glance
        results.quickGlance = PatientPresentation.renderQuickGlance(parsedData, results);

        // Inject SBAR styles
        PatientPresentation.injectStyles();

        console.log('[App] SBAR presentation generated');
      } catch (error) {
        console.warn('[App] Failed to generate SBAR:', error);
      }
    }

    // Render views
    if (typeof ClinicalComponents !== 'undefined') {
      ClinicalComponents.renderDetailedView(results, isImage);
      ClinicalComponents.renderWardView(results);
      // Labs view is rendered inside renderDetailedView
    } else {
      renderFallbackContent(results);
    }

    // Show modal
    if (elements.resultsModal) {
      elements.resultsModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    // Activate detailed tab by default
    switchModalView('detailed');
  }

  function renderFallbackContent(results) {
    const detailedView = document.getElementById('detailed-view');
    const wardView = document.getElementById('ward-view');
    
    if (detailedView) {
      detailedView.innerHTML = `
        <div style="padding: 1rem;">
          <div style="background: linear-gradient(135deg, #1a1a25 0%, #22222f 100%); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; border-top: 3px solid #f0c674;">
            <div style="color: #f0c674; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem; font-weight: 600;">Clinical Summary</div>
            <div style="color: rgba(255,255,255,0.8); line-height: 1.7;">${results.summary || 'No summary available'}</div>
          </div>
          
          ${results.alerts && results.alerts.length > 0 ? results.alerts.map(alert => `
            <div style="background: ${alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}; border-left: 3px solid ${alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
              <div style="font-weight: 600; color: ${alert.severity === 'critical' ? '#ef4444' : '#f59e0b'}; margin-bottom: 0.25rem;">${alert.title}</div>
              <div style="color: rgba(255,255,255,0.7); font-size: 0.875rem;">${alert.text}</div>
            </div>
          `).join('') : ''}
          
          ${results.findings && results.findings.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
              <h3 style="color: #fff; font-size: 1rem; margin-bottom: 1rem;">Key Findings</h3>
              <div style="background: #1a1a25; border-radius: 8px; overflow: hidden;">
                ${results.findings.map(f => `
                  <div style="display: flex; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-weight: 500;">${f.name}</span>
                    <span style="color: #f0c674; font-family: monospace;">${f.value}</span>
                    <span style="color: ${f.status.toLowerCase().includes('high') ? '#ef4444' : f.status.toLowerCase().includes('low') ? '#f59e0b' : '#10b981'}; font-size: 0.75rem; font-weight: 600;">${f.status}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          ${results.recommendations && results.recommendations.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
              <h3 style="color: #fff; font-size: 1rem; margin-bottom: 1rem;">Recommendations</h3>
              ${results.recommendations.map((rec, i) => `
                <div style="display: flex; gap: 1rem; padding: 0.75rem; background: #1a1a25; border-radius: 8px; margin-bottom: 0.5rem;">
                  <span style="width: 24px; height: 24px; background: ${i === 0 ? '#ef4444' : '#f0c674'}; color: #0a0a0f; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0;">${i + 1}</span>
                  <span style="color: rgba(255,255,255,0.8); font-size: 0.9rem; line-height: 1.5;">${typeof rec === 'string' ? rec : rec.text}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${results.patientExplanation ? `
            <div style="background: #1a1a25; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
              <div style="color: #4ecdc4; font-size: 0.8rem; font-weight: 600; margin-bottom: 0.5rem;">Patient Explanation</div>
              <div style="color: rgba(255,255,255,0.7); font-size: 0.9rem; line-height: 1.6;">${results.patientExplanation}</div>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    if (wardView) {
      wardView.innerHTML = `
        <div style="padding: 1rem; display: grid; gap: 1rem;">
          <div style="border: 2px solid #f0c674; border-radius: 12px; overflow: hidden;">
            <div style="background: #f0c674; color: #0a0a0f; padding: 0.75rem 1rem; font-weight: 600;">Assessment</div>
            <div style="padding: 1rem;">
              <div style="display: flex; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                <span style="width: 100px; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 600;">Diagnosis</span>
                <span style="flex: 1;">${results.diagnosis || results.summary || 'Pending'}</span>
              </div>
              ${results.severity ? `
              <div style="display: flex; padding: 0.5rem 0;">
                <span style="width: 100px; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 600;">Severity</span>
                <span style="flex: 1;">${results.severity}</span>
              </div>
              ` : ''}
            </div>
          </div>
          
          ${results.findings && results.findings.filter(f => !f.status.toLowerCase().includes('normal')).length > 0 ? `
          <div style="border: 2px solid #f0c674; border-radius: 12px; overflow: hidden;">
            <div style="background: #f0c674; color: #0a0a0f; padding: 0.75rem 1rem; font-weight: 600;">Abnormal Values</div>
            <div style="padding: 1rem;">
              ${results.findings.filter(f => !f.status.toLowerCase().includes('normal')).slice(0, 6).map(f => `
                <div style="display: flex; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                  <span style="width: 100px; color: rgba(255,255,255,0.5); font-size: 0.8rem; font-weight: 600;">${f.name}</span>
                  <span style="flex: 1;"><strong style="color: #f0c674;">${f.value}</strong> <span style="color: rgba(255,255,255,0.5);">(${f.status})</span></span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
          
          ${results.recommendations && results.recommendations.length > 0 ? `
          <div style="border: 2px solid #f0c674; border-radius: 12px; overflow: hidden;">
            <div style="background: #f0c674; color: #0a0a0f; padding: 0.75rem 1rem; font-weight: 600;">Plan</div>
            <div style="padding: 1rem;">
              ${results.recommendations.slice(0, 5).map((rec, i) => `
                <div style="display: flex; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.06);">
                  <span style="width: 30px; color: rgba(255,255,255,0.5); font-weight: 600;">${i + 1}.</span>
                  <span style="flex: 1; font-size: 0.9rem;">${typeof rec === 'string' ? rec : rec.text}</span>
                </div>
              `).join('')}
            </div>
          </div>
          ` : ''}
        </div>
      `;
    }
  }

  function closeModal(clearContent = false) {
    if (elements.resultsModal) {
      elements.resultsModal.classList.remove('active');
    }
    document.body.style.overflow = '';
    
    if (clearContent) {
      if (elements.detailedView) elements.detailedView.innerHTML = '';
      if (elements.wardView) elements.wardView.innerHTML = '';
    }
  }

  function switchModalView(view) {
    document.querySelectorAll('.modal-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.view === view);
    });
    document.querySelectorAll('.modal-view').forEach(v => {
      v.classList.toggle('active', v.id === `${view}-view`);
    });
  }

  // Activity List
  function renderActivityList() {
    if (!elements.activityList) return;
    
    if (analysisHistory.length === 0) {
      elements.activityList.innerHTML = `
        <div class="activity-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
          <p>No analyses yet</p>
          <p style="font-size: 0.8rem;">Upload a report to get started</p>
        </div>
      `;
      return;
    }
    
    elements.activityList.innerHTML = analysisHistory.slice(0, 5).map(item => {
      const date = new Date(item.timestamp);
      const timeAgo = getTimeAgo(date);
      
      return `
        <div class="activity-item" onclick="window.MedWard.showHistoryItem(${item.id})">
          <div class="activity-icon success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div class="activity-text">
            <div class="activity-title">${item.type}</div>
            <div class="activity-time">${timeAgo}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function showHistoryItem(id) {
    const item = analysisHistory.find(h => h.id === id);
    if (item && item.results) {
      showResults(item.results);
    }
  }

  // Metrics
  function updateMetricsDisplay() {
    if (elements.metricTotal) elements.metricTotal.textContent = metrics.total;
    if (elements.metricCache) {
      elements.metricCache.textContent = metrics.total > 0 
        ? Math.round((metrics.cacheHits / metrics.total) * 100) + '%' 
        : '0%';
    }
    if (elements.metricSpeed) {
      elements.metricSpeed.textContent = metrics.total > 0 
        ? Math.round(metrics.totalTime / metrics.total) + 'ms' 
        : '0ms';
    }
    if (elements.metricPatterns) elements.metricPatterns.textContent = metrics.patterns;
  }

  function saveMetrics() {
    try {
      localStorage.setItem('medward_metrics', JSON.stringify(metrics));
    } catch (e) {}
  }

  // Processing Overlay
  function showProcessing(show) {
    if (!elements.processingOverlay) return;
    if (show) {
      elements.processingOverlay.classList.add('active');
    } else {
      elements.processingOverlay.classList.remove('active');
    }
  }

  // Toast
  function showToast(message, type = 'success') {
    if (!elements.toast || !elements.toastMessage) return;
    elements.toast.className = `toast ${type}`;
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 3000);
  }

  // Utilities
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hours ago';
    return Math.floor(seconds / 86400) + ' days ago';
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API
  window.MedWard = {
    removeFile,
    showHistoryItem
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
