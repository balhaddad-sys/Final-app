/**
 * MedWard Batch Processor & Pattern Learning System
 * Handles multiple images efficiently with queuing and learns patterns over time
 * 
 * Features:
 * - Batch upload queue with progress tracking
 * - Concurrent processing with configurable parallelism
 * - Pattern learning from analyzed results
 * - Local caching to avoid re-analyzing similar images
 * - Memory-efficient chunked processing for large batches
 */

const MedWardBatch = {
  
  // Configuration
  config: {
    maxConcurrent: 3,        // Process 3 images at a time
    maxBatchSize: 100,       // Maximum images per batch
    chunkSize: 10,           // Process in chunks of 10
    retryAttempts: 2,        // Retry failed analyses
    cacheEnabled: true,      // Enable result caching
    learningEnabled: true,   // Enable pattern learning
    compressionQuality: 0.8, // Image compression quality
    maxImageSize: 1024       // Max dimension for resize
  },

  // State
  queue: [],
  processing: false,
  results: [],
  progress: { total: 0, completed: 0, failed: 0, current: '' },
  abortController: null,
  
  // Callbacks
  onProgress: null,
  onComplete: null,
  onError: null,

  /**
   * Add files to the processing queue
   * @param {FileList|Array} files - Files to process
   * @returns {number} Number of files added
   */
  addFiles(files) {
    const fileArray = Array.from(files);
    let added = 0;
    
    for (const file of fileArray) {
      if (this.queue.length >= this.config.maxBatchSize) {
        console.warn(`[Batch] Max batch size (${this.config.maxBatchSize}) reached`);
        break;
      }
      
      if (this.isValidImage(file)) {
        this.queue.push({
          id: this.generateId(),
          file: file,
          status: 'pending', // pending, processing, completed, failed
          result: null,
          error: null,
          attempts: 0
        });
        added++;
      }
    }
    
    this.progress.total = this.queue.length;
    console.log(`[Batch] Added ${added} files, queue size: ${this.queue.length}`);
    return added;
  },

  /**
   * Start processing the queue
   * @param {Object} options - Processing options
   */
  async startProcessing(options = {}) {
    if (this.processing) {
      console.warn('[Batch] Already processing');
      return;
    }
    
    if (this.queue.length === 0) {
      console.warn('[Batch] Queue is empty');
      return;
    }
    
    this.processing = true;
    this.abortController = new AbortController();
    this.results = [];
    this.progress = { total: this.queue.length, completed: 0, failed: 0, current: '' };
    
    const backendUrl = options.backendUrl || window.MEDWARD_BACKEND_URL;
    const documentType = options.documentType || 'lab';
    
    console.log(`[Batch] Starting processing of ${this.queue.length} files`);
    
    try {
      // Process in chunks
      const chunks = this.chunkArray(this.queue, this.config.chunkSize);
      
      for (const chunk of chunks) {
        if (this.abortController.signal.aborted) break;
        
        // Process chunk with concurrency limit
        await this.processChunk(chunk, backendUrl, documentType);
      }
      
      // All done
      this.processing = false;
      
      if (this.onComplete) {
        this.onComplete({
          total: this.progress.total,
          completed: this.progress.completed,
          failed: this.progress.failed,
          results: this.results
        });
      }
      
      // Learn patterns from results
      if (this.config.learningEnabled) {
        this.learnFromResults(this.results);
      }
      
    } catch (error) {
      console.error('[Batch] Processing error:', error);
      this.processing = false;
      if (this.onError) this.onError(error);
    }
  },

  /**
   * Process a chunk of files with concurrency control
   */
  async processChunk(chunk, backendUrl, documentType) {
    const concurrentLimit = this.config.maxConcurrent;
    const executing = [];
    
    for (const item of chunk) {
      if (this.abortController.signal.aborted) break;
      
      const promise = this.processItem(item, backendUrl, documentType)
        .then(() => {
          executing.splice(executing.indexOf(promise), 1);
        });
      
      executing.push(promise);
      
      if (executing.length >= concurrentLimit) {
        await Promise.race(executing);
      }
    }
    
    // Wait for remaining
    await Promise.all(executing);
  },

  /**
   * Process a single item
   */
  async processItem(item, backendUrl, documentType) {
    item.status = 'processing';
    this.progress.current = item.file.name;
    this.updateProgress();
    
    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.checkCache(item.file);
        if (cached) {
          item.status = 'completed';
          item.result = cached;
          this.results.push({ file: item.file.name, ...cached, fromCache: true });
          this.progress.completed++;
          this.updateProgress();
          return;
        }
      }
      
      // Compress image if needed
      const imageData = await this.prepareImage(item.file);
      
      // Upload and analyze
      const result = await this.analyzeImage(imageData, backendUrl, documentType);
      
      item.status = 'completed';
      item.result = result;
      this.results.push({ file: item.file.name, ...result });
      this.progress.completed++;
      
      // Cache result
      if (this.config.cacheEnabled) {
        this.cacheResult(item.file, result);
      }
      
    } catch (error) {
      item.attempts++;
      
      if (item.attempts < this.config.retryAttempts) {
        // Retry
        console.log(`[Batch] Retrying ${item.file.name} (attempt ${item.attempts + 1})`);
        return this.processItem(item, backendUrl, documentType);
      }
      
      item.status = 'failed';
      item.error = error.message;
      this.progress.failed++;
      console.error(`[Batch] Failed: ${item.file.name}`, error);
    }
    
    this.updateProgress();
  },

  /**
   * Analyze image via backend
   */
  async analyzeImage(imageData, backendUrl, documentType) {
    // Step 1: Upload
    const uploadResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'uploadImage',
        image: imageData
      }),
      signal: this.abortController.signal
    });
    
    const uploadResult = await uploadResponse.json();
    if (!uploadResult.success) throw new Error(uploadResult.error || 'Upload failed');
    
    // Step 2: Analyze
    const analyzeResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'interpret',
        fileId: uploadResult.fileId,
        documentType: documentType,
        provider: 'claude'
      }),
      signal: this.abortController.signal
    });
    
    const analyzeResult = await analyzeResponse.json();
    if (!analyzeResult.success) throw new Error(analyzeResult.error || 'Analysis failed');
    
    return analyzeResult;
  },

  /**
   * Prepare image - compress and resize if needed
   */
  async prepareImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        const dataUrl = e.target.result;
        
        // Check if compression needed
        if (file.size > 500000) { // > 500KB
          try {
            const compressed = await this.compressImage(dataUrl);
            resolve(compressed);
          } catch (err) {
            resolve(dataUrl); // Fallback to original
          }
        } else {
          resolve(dataUrl);
        }
      };
      
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  /**
   * Compress image using canvas
   */
  compressImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Resize if too large
        const maxSize = this.config.maxImageSize;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', this.config.compressionQuality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  },

  /**
   * Stop processing
   */
  stopProcessing() {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.processing = false;
    console.log('[Batch] Processing stopped');
  },

  /**
   * Clear the queue
   */
  clearQueue() {
    this.queue = [];
    this.results = [];
    this.progress = { total: 0, completed: 0, failed: 0, current: '' };
  },

  /**
   * Update progress callback
   */
  updateProgress() {
    if (this.onProgress) {
      this.onProgress({ ...this.progress });
    }
  },

  // === PATTERN LEARNING ===
  
  patterns: {
    labValues: new Map(),     // test name -> { values: [], ranges: [], patterns: [] }
    abnormalities: new Map(), // pattern -> { count, examples }
    correlations: [],         // co-occurring abnormalities
    lastUpdated: null
  },

  /**
   * Learn patterns from analysis results
   */
  learnFromResults(results) {
    if (!results || results.length === 0) return;
    
    console.log(`[Learning] Processing ${results.length} results`);
    
    for (const result of results) {
      if (!result.extractedText) continue;
      
      // Extract lab values
      const labValues = this.extractLabValuesForLearning(result.extractedText);
      this.updateLabPatterns(labValues);
      
      // Extract abnormalities
      const abnormalities = result.interpretation?.abnormalities || [];
      this.updateAbnormalityPatterns(abnormalities);
      
      // Find correlations
      if (abnormalities.length > 1) {
        this.updateCorrelations(abnormalities);
      }
    }
    
    this.patterns.lastUpdated = new Date().toISOString();
    this.savePatterns();
    
    console.log(`[Learning] Patterns updated:`, {
      labValues: this.patterns.labValues.size,
      abnormalities: this.patterns.abnormalities.size,
      correlations: this.patterns.correlations.length
    });
  },

  /**
   * Extract lab values for learning
   */
  extractLabValuesForLearning(text) {
    const labValues = [];
    const patterns = [
      /(\w+(?:\s+\w+)?)\s*[:=]\s*([\d.]+)\s*([a-zA-Z/%]+)?\s*\(?(\d+\.?\d*\s*-\s*\d+\.?\d*)?\)?/gi
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [, name, value, unit, range] = match;
        if (name && value) {
          labValues.push({
            name: name.trim().toLowerCase(),
            value: parseFloat(value),
            unit: unit?.trim() || '',
            range: range?.trim() || ''
          });
        }
      }
    }
    
    return labValues;
  },

  /**
   * Update lab value patterns
   */
  updateLabPatterns(labValues) {
    for (const lab of labValues) {
      if (!this.patterns.labValues.has(lab.name)) {
        this.patterns.labValues.set(lab.name, {
          values: [],
          units: new Set(),
          ranges: new Set(),
          count: 0
        });
      }
      
      const pattern = this.patterns.labValues.get(lab.name);
      pattern.values.push(lab.value);
      if (lab.unit) pattern.units.add(lab.unit);
      if (lab.range) pattern.ranges.add(lab.range);
      pattern.count++;
      
      // Keep only last 100 values for memory efficiency
      if (pattern.values.length > 100) {
        pattern.values = pattern.values.slice(-100);
      }
    }
  },

  /**
   * Update abnormality patterns
   */
  updateAbnormalityPatterns(abnormalities) {
    for (const abnormality of abnormalities) {
      const text = typeof abnormality === 'string' ? abnormality : abnormality.text || '';
      const key = this.normalizeAbnormality(text);
      
      if (!key) continue;
      
      if (!this.patterns.abnormalities.has(key)) {
        this.patterns.abnormalities.set(key, {
          count: 0,
          examples: [],
          severity: this.detectSeverity(text)
        });
      }
      
      const pattern = this.patterns.abnormalities.get(key);
      pattern.count++;
      if (pattern.examples.length < 5) {
        pattern.examples.push(text);
      }
    }
  },

  /**
   * Update correlation patterns
   */
  updateCorrelations(abnormalities) {
    const keys = abnormalities
      .map(a => this.normalizeAbnormality(typeof a === 'string' ? a : a.text || ''))
      .filter(k => k);
    
    // Generate pairs
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pair = [keys[i], keys[j]].sort().join('|');
        
        let correlation = this.patterns.correlations.find(c => c.pair === pair);
        if (!correlation) {
          correlation = { pair, count: 0, keys: [keys[i], keys[j]] };
          this.patterns.correlations.push(correlation);
        }
        correlation.count++;
      }
    }
    
    // Keep only top 50 correlations
    this.patterns.correlations.sort((a, b) => b.count - a.count);
    this.patterns.correlations = this.patterns.correlations.slice(0, 50);
  },

  /**
   * Normalize abnormality text for pattern matching
   */
  normalizeAbnormality(text) {
    if (!text) return null;
    return text
      .toLowerCase()
      .replace(/[\d.]+/g, '#') // Replace numbers with #
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50);
  },

  /**
   * Detect severity from text
   */
  detectSeverity(text) {
    const t = text.toLowerCase();
    if (t.includes('critical') || t.includes('severe') || t.includes('emergency')) return 'critical';
    if (t.includes('high') || t.includes('elevated') || t.includes('increased')) return 'high';
    if (t.includes('low') || t.includes('decreased') || t.includes('deficient')) return 'low';
    return 'abnormal';
  },

  /**
   * Get learned insights for a lab value
   */
  getLabInsights(testName) {
    const pattern = this.patterns.labValues.get(testName.toLowerCase());
    if (!pattern || pattern.values.length < 3) return null;
    
    const values = pattern.values;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return {
      testName,
      sampleSize: pattern.count,
      average: avg.toFixed(2),
      range: `${min.toFixed(2)} - ${max.toFixed(2)}`,
      units: Array.from(pattern.units),
      referenceRanges: Array.from(pattern.ranges)
    };
  },

  /**
   * Get common abnormalities
   */
  getCommonAbnormalities(limit = 10) {
    return Array.from(this.patterns.abnormalities.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([key, data]) => ({
        pattern: key,
        count: data.count,
        severity: data.severity,
        example: data.examples[0]
      }));
  },

  /**
   * Get correlated abnormalities
   */
  getCorrelations(limit = 10) {
    return this.patterns.correlations
      .slice(0, limit)
      .map(c => ({
        abnormality1: c.keys[0],
        abnormality2: c.keys[1],
        coOccurrences: c.count
      }));
  },

  /**
   * Save patterns to localStorage
   */
  savePatterns() {
    try {
      const data = {
        labValues: Array.from(this.patterns.labValues.entries()),
        abnormalities: Array.from(this.patterns.abnormalities.entries()),
        correlations: this.patterns.correlations,
        lastUpdated: this.patterns.lastUpdated
      };
      localStorage.setItem('medward_patterns', JSON.stringify(data));
    } catch (e) {
      console.warn('[Learning] Failed to save patterns:', e);
    }
  },

  /**
   * Load patterns from localStorage
   */
  loadPatterns() {
    try {
      const data = JSON.parse(localStorage.getItem('medward_patterns'));
      if (data) {
        this.patterns.labValues = new Map(data.labValues || []);
        this.patterns.abnormalities = new Map(data.abnormalities || []);
        this.patterns.correlations = data.correlations || [];
        this.patterns.lastUpdated = data.lastUpdated;
        console.log('[Learning] Patterns loaded:', {
          labValues: this.patterns.labValues.size,
          abnormalities: this.patterns.abnormalities.size
        });
      }
    } catch (e) {
      console.warn('[Learning] Failed to load patterns:', e);
    }
  },

  // === CACHING ===
  
  cache: new Map(),
  
  /**
   * Generate cache key from file
   */
  async generateCacheKey(file) {
    const buffer = await file.slice(0, 1024).arrayBuffer(); // First 1KB
    const hashArray = new Uint8Array(buffer);
    let hash = 0;
    for (let i = 0; i < hashArray.length; i++) {
      hash = ((hash << 5) - hash) + hashArray[i];
      hash = hash & hash;
    }
    return `${file.name}_${file.size}_${hash}`;
  },

  /**
   * Check cache for result
   */
  async checkCache(file) {
    const key = await this.generateCacheKey(file);
    return this.cache.get(key) || null;
  },

  /**
   * Cache result
   */
  async cacheResult(file, result) {
    const key = await this.generateCacheKey(file);
    this.cache.set(key, result);
    
    // Limit cache size
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  },

  // === UTILITIES ===
  
  isValidImage(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    return validTypes.includes(file.type);
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      progress: { ...this.progress },
      cacheSize: this.cache.size,
      patterns: {
        labValues: this.patterns.labValues.size,
        abnormalities: this.patterns.abnormalities.size,
        correlations: this.patterns.correlations.length,
        lastUpdated: this.patterns.lastUpdated
      }
    };
  },

  /**
   * Initialize - load saved patterns
   */
  init() {
    this.loadPatterns();
    console.log('[Batch] Initialized with pattern learning');
  }
};

// Initialize on load
if (typeof window !== 'undefined') {
  window.MedWardBatch = MedWardBatch;
  MedWardBatch.init();
}

if (typeof module !== 'undefined') {
  module.exports = MedWardBatch;
}
