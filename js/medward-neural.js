/**
 * MedWard Master v2.0 - Neural Intelligence Edition
 * Self-learning medical analysis with robust document parsing
 *
 * Components:
 * - MedicalDocumentParser: Robust parsing for cumulative lab reports
 * - PatternStore: LRU pattern storage with persistence
 * - MedWardNeural: Neural learning system with TensorFlow.js
 */

// ==================== Medical Document Parser ====================
/**
 * Robust parser for medical documents (especially cumulative lab reports)
 * Handles multi-column data, H/L flags, various reference range formats
 */
class MedicalDocumentParser {
  constructor(config = {}) {
    this.config = config;

    // Test name normalization map
    this.testNameMap = {
      'WBC': ['WBC', 'White Blood Cell', 'Leukocytes', 'White Cell Count'],
      'RBC': ['RBC', 'Red Blood Cell', 'Erythrocytes', 'Red Cell Count'],
      'Hb': ['Hb', 'HGB', 'Hemoglobin', 'Haemoglobin'],
      'Hct': ['Hct', 'HCT', 'Hematocrit', 'Haematocrit', 'PCV'],
      'Plt': ['Plt', 'PLT', 'Platelets', 'Platelet Count'],
      'Neutrophils': ['Neutrophils', 'Neutrophils.#', 'Neut#', 'Neutrophil Count'],
      'Lymphocytes': ['Lymphocytes', 'Lymphocytes.#', 'Lymph#', 'Lymphocyte Count'],
      'Monocytes': ['Monocytes', 'Monocytes.#', 'Mono#', 'Monocyte Count'],
      'Eosinophils': ['Eosinophils', 'Eosinophils.#', 'Eos#', 'Eosinophil Count'],
      'Basophils': ['Basophils', 'Basophils.#', 'Baso#', 'Basophil Count'],
      'MCV': ['MCV', 'Mean Corpuscular Volume'],
      'MCH': ['MCH', 'Mean Corpuscular Hemoglobin'],
      'MCHC': ['MCHC', 'Mean Corpuscular Hemoglobin Concentration'],
      'RDW': ['RDW', 'Red Cell Distribution Width'],
      'MPV': ['MPV', 'Mean Platelet Volume'],
      'PCT': ['PCT', 'Plateletcrit'],
      'Na': ['Na', 'Sodium', 'Serum Sodium'],
      'K': ['K', 'Potassium', 'Serum Potassium'],
      'Cr': ['Cr', 'Creatinine', 'Serum Creatinine'],
      'BUN': ['BUN', 'Urea', 'Blood Urea Nitrogen'],
      'Glucose': ['Glucose', 'FBS', 'RBS', 'Blood Sugar', 'Blood Glucose'],
    };

    // Reference ranges with critical thresholds
    this.referenceRanges = {
      'WBC': { min: 3.7, max: 10, critLow: 1.0, critHigh: 30, unit: '×10⁹/L' },
      'RBC': { min: 4.5, max: 5.5, critLow: 2.0, critHigh: 7.0, unit: '×10¹²/L' },
      'Hb': { min: 130, max: 170, critLow: 70, critHigh: 200, unit: 'g/L' },
      'Hct': { min: 0.40, max: 0.50, critLow: 0.20, critHigh: 0.60, unit: 'L/L' },
      'Plt': { min: 130, max: 430, critLow: 20, critHigh: 1000, unit: '×10⁹/L' },
      'Neutrophils': { min: 1.7, max: 6.0, critLow: 0.5, critHigh: 20, unit: '×10⁹/L' },
      'Lymphocytes': { min: 0.9, max: 2.9, critLow: 0.2, critHigh: 10, unit: '×10⁹/L' },
      'Na': { min: 136, max: 145, critLow: 120, critHigh: 160, unit: 'mmol/L' },
      'K': { min: 3.5, max: 5.0, critLow: 2.5, critHigh: 6.5, unit: 'mmol/L' },
      'Glucose': { min: 70, max: 100, critLow: 40, critHigh: 500, unit: 'mg/dL' },
    };
  }

  /**
   * Main parsing function - auto-detects input type
   */
  async parse(input, inputType = 'auto') {
    const start = performance.now();

    let text;
    if (inputType === 'image' || (inputType === 'auto' && input instanceof Blob)) {
      text = await this.extractTextFromImage(input);
    } else {
      text = typeof input === 'string' ? input : await input.text();
    }

    const docType = this.detectType(text);

    let result = docType === 'lab_cumulative'
      ? this.parseLabCumulative(text)
      : this.parseLabSingle(text);

    result = this.enrich(result);
    result.metadata = {
      parseTime: performance.now() - start,
      docType,
      parser: 'MedWardNeural v2.0'
    };

    return result;
  }

  /**
   * Detect document type
   */
  detectType(text) {
    const upper = text.toUpperCase();
    if (upper.includes('CUMULATIVE') || this.hasMultipleDates(text)) {
      return 'lab_cumulative';
    }
    return 'lab_single';
  }

  /**
   * Check if text contains multiple date/time stamps
   */
  hasMultipleDates(text) {
    const matches = text.match(/\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g);
    return matches && matches.length >= 2;
  }

  /**
   * Parse cumulative lab report (multi-column format)
   */
  parseLabCumulative(text) {
    const result = { type: 'lab_cumulative', dates: [], tests: {}, metadata: {} };

    // Extract dates
    const datePattern = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/g;
    let match;
    while ((match = datePattern.exec(text)) !== null) {
      result.dates.push({ date: match[1], time: match[2] });
    }
    result.dates = [...new Map(result.dates.map(d => [`${d.date}_${d.time}`, d])).values()];

    // Parse test lines
    const lines = text.split(/[\n\r]+/);
    for (const line of lines) {
      const parsed = this.parseTestLine(line);
      if (parsed) result.tests[parsed.name] = parsed;
    }

    return result;
  }

  /**
   * Parse individual test line (handles multi-column values with H/L flags)
   */
  parseTestLine(line) {
    if (this.isHeaderOrMeta(line)) return null;

    const parts = line.split(/\s+/);
    if (parts.length < 2) return null;

    // Find test name (everything before first numeric value)
    let nameParts = [], valueStart = 0;
    for (let i = 0; i < parts.length; i++) {
      if (/^[\d.]+[HL]?$/i.test(parts[i])) {
        valueStart = i;
        break;
      }
      nameParts.push(parts[i]);
    }

    const rawName = nameParts.join(' ');
    const name = this.normalizeName(rawName);
    if (!name) return null;

    // Parse values (handle attached H/L flags)
    const values = [];
    let current = null, reference = null;

    for (let i = valueStart; i < parts.length; i++) {
      const p = parts[i];

      if (/^[\d.]+$/.test(p)) {
        // Plain number
        if (current) values.push(current);
        current = { value: parseFloat(p), flag: null };
      } else if (/^[HL]$/i.test(p) && current) {
        // Separate H/L flag
        current.flag = p.toUpperCase();
      } else if (/^([\d.]+)([HL])$/i.test(p)) {
        // Value with attached flag (e.g., "8.5L")
        if (current) values.push(current);
        const m = p.match(/^([\d.]+)([HL])$/i);
        current = { value: parseFloat(m[1]), flag: m[2].toUpperCase() };
      } else if (/^[\d.]+-[\d.]+$/.test(p)) {
        // Reference range (e.g., "3.5-5.0")
        const [min, max] = p.split('-').map(Number);
        reference = { min, max };
      }
    }
    if (current) values.push(current);
    if (values.length === 0) return null;

    if (!reference) reference = this.referenceRanges[name];

    return {
      name,
      rawName,
      values,
      reference,
      trend: this.calcTrend(values)
    };
  }

  /**
   * Check if line is header/metadata (not a test result)
   */
  isHeaderOrMeta(line) {
    const kw = ['TEST', 'DESCRIPTION', 'REFERENCE', 'PRINTED', 'RELEASED', 'CUMULATIVE'];
    return kw.some(k => line.toUpperCase().includes(k));
  }

  /**
   * Normalize test name to standard format
   */
  normalizeName(raw) {
    const clean = raw.replace(/[.#%]/g, '').trim().toLowerCase();
    for (const [std, vars] of Object.entries(this.testNameMap)) {
      if (vars.some(v => v.toLowerCase().replace(/[.#%]/g, '') === clean)) return std;
    }
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : null;
  }

  /**
   * Calculate trend from multiple values
   */
  calcTrend(values) {
    if (values.length < 2) return 'unknown';
    const [latest, prev] = [values[0].value, values[1].value];
    const pct = ((latest - prev) / prev) * 100;
    if (pct > 15) return 'rising_fast';
    if (pct > 5) return 'rising';
    if (pct < -15) return 'falling_fast';
    if (pct < -5) return 'falling';
    return 'stable';
  }

  /**
   * Enrich parsed data with status and severity
   */
  enrich(data) {
    let normal = 0, abnormal = 0, critical = 0;

    for (const [name, test] of Object.entries(data.tests || {})) {
      const val = test.values[0]?.value;
      const ref = test.reference || this.referenceRanges[name];
      if (!val || !ref) { test.status = 'unknown'; continue; }

      // Status
      test.status = val < ref.min ? 'low' : val > ref.max ? 'high' : 'normal';

      // Severity
      if (ref.critLow && val <= ref.critLow) { test.severity = 'critical'; critical++; }
      else if (ref.critHigh && val >= ref.critHigh) { test.severity = 'critical'; critical++; }
      else if (test.status !== 'normal') { test.severity = 'abnormal'; abnormal++; }
      else { test.severity = 'normal'; normal++; }
    }

    data.summary = { total: Object.keys(data.tests).length, normal, abnormal, critical };
    return data;
  }

  /**
   * Parse single lab report
   */
  parseLabSingle(text) {
    return this.parseLabCumulative(text);
  }

  /**
   * Extract text from image using Vision API
   */
  async extractTextFromImage(input) {
    const base64 = input instanceof Blob
      ? btoa(String.fromCharCode(...new Uint8Array(await input.arrayBuffer())))
      : input;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: input.type || 'image/png', data: base64 }},
            { type: 'text', text: 'Extract ALL text from this lab report. Preserve tabular structure. Include H/L flags. Include reference ranges.' }
          ]
        }]
      })
    });
    return (await resp.json()).content[0].text;
  }

  /**
   * Convert parsed data to AI-friendly prompt format
   */
  toAIPrompt(data) {
    let p = `LAB DATA\n${'='.repeat(40)}\n`;
    if (data.summary) p += `${data.summary.total} tests, ${data.summary.abnormal} abnormal, ${data.summary.critical} critical\n\n`;
    p += `| Test | Value | Flag | Reference | Trend | Status |\n|------|-------|------|-----------|-------|--------|\n`;
    for (const [n, d] of Object.entries(data.tests || {})) {
      const v = d.values[0];
      p += `| ${n} | ${v?.value||'--'} | ${v?.flag||''} | ${d.reference?`${d.reference.min}-${d.reference.max}`:'--'} | ${d.trend||'--'} | ${d.status||'--'} |\n`;
    }
    return p;
  }
}

// ==================== Pattern Store ====================
/**
 * LRU pattern storage with persistence
 */
class PatternStore {
  constructor(max = 10000) {
    this.max = max;
    this.patterns = new Map();
    this.typeIndex = new Map();
  }

  add(p) {
    if (this.patterns.size >= this.max) this.evict();
    this.patterns.set(p.id, p);
    if (!this.typeIndex.has(p.type)) this.typeIndex.set(p.type, new Set());
    this.typeIndex.get(p.type).add(p.id);
  }

  addDirect(p) {
    this.patterns.set(p.id, p);
    if (!this.typeIndex.has(p.type)) this.typeIndex.set(p.type, new Set());
    this.typeIndex.get(p.type).add(p.id);
  }

  get(id) { return this.patterns.get(id); }

  getByType(type) {
    return Array.from(this.typeIndex.get(type) || []).map(id => this.patterns.get(id)).filter(Boolean);
  }

  getAll() { return Array.from(this.patterns.values()); }

  size() { return this.patterns.size; }

  recordUsage(id) {
    const p = this.patterns.get(id);
    if (p) { p.usageCount++; p.lastUsed = Date.now(); }
  }

  evict() {
    let lowest = Infinity, lowestId = null;
    for (const [id, p] of this.patterns) {
      const score = p.successRate / (1 + (Date.now() - (p.lastUsed || p.createdAt)) / 604800000);
      if (score < lowest) { lowest = score; lowestId = id; }
    }
    if (lowestId) {
      const p = this.patterns.get(lowestId);
      this.patterns.delete(lowestId);
      if (p) this.typeIndex.get(p.type)?.delete(lowestId);
    }
  }
}

// ==================== MedWard Neural System ====================
/**
 * Neural learning system with TensorFlow.js
 * Enables local, offline, self-learning analysis
 */
class MedWardNeural {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey,
      embeddingDim: 256,
      vocabSize: 15000,
      maxSeqLength: 512,
      confidenceThreshold: 0.85,
      criticalThreshold: 0.95,
      positiveBoost: 0.10,
      negativePenalty: 0.20,
      maxPatterns: 10000,
      debug: config.debug || false,
      ...config
    };

    this.encoder = null;
    this.patternStore = null;
    this.embeddingCache = null;
    this.metrics = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Wait for TensorFlow.js to load
    if (typeof tf === 'undefined') {
      await this.loadTensorFlow();
    }

    this.patternStore = new PatternStore(this.config.maxPatterns);
    this.embeddingCache = new Map();
    this.metrics = { total: 0, local: 0, api: 0, localTime: 0, apiTime: 0 };

    // Create encoder model
    this.encoder = tf.sequential();
    this.encoder.add(tf.layers.embedding({
      inputDim: this.config.vocabSize,
      outputDim: 64,
      inputLength: this.config.maxSeqLength
    }));
    this.encoder.add(tf.layers.conv1d({ filters: 128, kernelSize: 5, activation: 'relu' }));
    this.encoder.add(tf.layers.globalMaxPooling1d());
    this.encoder.add(tf.layers.dense({ units: this.config.embeddingDim, activation: 'relu' }));
    this.encoder.add(tf.layers.dense({ units: this.config.embeddingDim, activation: 'tanh' }));
    this.encoder.compile({ optimizer: 'adam', loss: 'meanSquaredError' });

    // Load saved patterns
    await this.loadKnowledge();

    this.initialized = true;
    if (this.config.debug) console.log(`Neural system ready. ${this.patternStore.size()} patterns loaded.`);
  }

  /**
   * Load TensorFlow.js library
   */
  async loadTensorFlow() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * Process parsed data - uses local patterns or falls back to API
   */
  async process(parsedData, type = 'lab') {
    await this.initialize();
    const start = performance.now();

    // Generate signature & embedding
    const sig = this.signature(parsedData);
    const emb = await this.embed(sig);

    // Find matches
    const matches = this.findMatches(emb, type);
    const best = matches[0];

    // Decide: local or API?
    const hasCrit = Object.values(parsedData.tests || {}).some(t => t.severity === 'critical');
    const threshold = hasCrit ? this.config.criticalThreshold : this.config.confidenceThreshold;

    let result, source;

    if (best && best.confidence >= threshold) {
      // LOCAL - Fast & Free
      result = this.applyPattern(parsedData, best.pattern);
      source = 'local';
      this.patternStore.recordUsage(best.pattern.id);
      this.metrics.local++;
      this.metrics.localTime += performance.now() - start;
    } else {
      // API - Learn from response
      result = await this.callAPI(parsedData, type);
      source = 'api';
      await this.learn(parsedData, emb, result, type, sig);
      this.metrics.api++;
      this.metrics.apiTime += performance.now() - start;
    }

    this.metrics.total++;

    const time = performance.now() - start;
    if (this.config.debug) console.log(`${source.toUpperCase()} in ${time.toFixed(0)}ms`);

    return { result, meta: { source, time, confidence: best?.confidence || 0, patternId: best?.pattern.id } };
  }

  /**
   * Generate signature from parsed data
   */
  signature(data) {
    const tests = Object.keys(data.tests || {}).sort();
    const abn = tests.filter(t => data.tests[t].status !== 'normal');
    const crit = tests.filter(t => data.tests[t].severity === 'critical');
    return `tests:${tests.join(',')}|abn:${abn.join(',')}|crit:${crit.join(',')}`;
  }

  /**
   * Generate embedding from text using neural encoder
   */
  async embed(text) {
    if (this.embeddingCache.has(text)) return this.embeddingCache.get(text);

    // Tokenize
    const tokens = text.toLowerCase().split(/\s+/).map(w => {
      let h = 0;
      for (let i = 0; i < w.length; i++) h = ((h << 5) - h) + w.charCodeAt(i);
      return Math.abs(h) % this.config.vocabSize;
    });

    // Pad
    const padded = tokens.length >= this.config.maxSeqLength
      ? tokens.slice(0, this.config.maxSeqLength)
      : [...tokens, ...Array(this.config.maxSeqLength - tokens.length).fill(0)];

    // Generate
    const input = tf.tensor2d([padded], [1, this.config.maxSeqLength]);
    const output = this.encoder.predict(input);
    const emb = Array.from(await output.data());
    input.dispose(); output.dispose();

    this.embeddingCache.set(text, emb);
    return emb;
  }

  /**
   * Find matching patterns using cosine similarity
   */
  findMatches(emb, type) {
    const patterns = this.patternStore.getByType(type);
    const matches = [];

    for (const p of patterns) {
      let dot = 0, nA = 0, nB = 0;
      for (let i = 0; i < emb.length; i++) {
        dot += emb[i] * p.embedding[i];
        nA += emb[i] ** 2;
        nB += p.embedding[i] ** 2;
      }
      const sim = dot / (Math.sqrt(nA * nB) || 1);

      if (sim > 0.5) {
        const age = Date.now() - (p.lastUsed || p.createdAt);
        const recency = Math.max(0.7, 1 - (age / 604800000) * 0.3);
        matches.push({ pattern: p, confidence: sim * p.successRate * recency });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Apply pattern to parsed data (local inference)
   */
  applyPattern(data, pattern) {
    const result = { problems: [], interpretations: {}, plan: [], watchFor: [], source: 'local' };
    const tmpl = pattern.template;

    for (const [name, test] of Object.entries(data.tests || {})) {
      if (tmpl.interpretations?.[name]) {
        result.interpretations[name] = { ...tmpl.interpretations[name], value: test.values[0]?.value };
        if (test.status !== 'normal') {
          result.problems.push({
            title: `${name}: ${test.status.toUpperCase()}`,
            severity: test.severity,
            action: tmpl.interpretations[name].action || ''
          });
        }
      }
    }

    if (tmpl.plan) result.plan = tmpl.plan;
    if (tmpl.watchFor) result.watchFor = tmpl.watchFor;

    return result;
  }

  /**
   * Call API for analysis (fallback when no pattern match)
   */
  async callAPI(data, type) {
    const parser = new MedicalDocumentParser({ apiKey: this.config.apiKey });
    const prompt = parser.toAIPrompt(data);

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `Analyze lab results. Use format:
===PROBLEMS===
1. TITLE (SEVERITY) → ACTION
===INTERPRETATIONS===
TEST: STATUS - EXPLANATION
===PLAN===
[P1] Action
===WATCH_FOR===
- Item`,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const text = (await resp.json()).content[0].text;
    return this.parseAPIResponse(text);
  }

  /**
   * Parse API response into structured format
   */
  parseAPIResponse(text) {
    const result = { problems: [], interpretations: {}, plan: [], watchFor: [], source: 'api' };

    // Problems
    const pm = text.match(/===PROBLEMS===([\s\S]*?)(?====|$)/);
    if (pm) {
      for (const line of pm[1].trim().split('\n')) {
        const m = line.match(/^\d+\.\s*(.+?)\s*\((\w+)\)\s*[→->]\s*(.+)$/);
        if (m) result.problems.push({ title: m[1], severity: m[2].toLowerCase(), action: m[3] });
      }
    }

    // Interpretations
    const im = text.match(/===INTERPRETATIONS===([\s\S]*?)(?====|$)/);
    if (im) {
      for (const line of im[1].trim().split('\n')) {
        const m = line.match(/^(\w+):\s*(\w+)\s*[-–]\s*(.+)$/);
        if (m) result.interpretations[m[1]] = { status: m[2].toLowerCase(), explanation: m[3] };
      }
    }

    // Plan
    const plm = text.match(/===PLAN===([\s\S]*?)(?====|$)/);
    if (plm) {
      for (const line of plm[1].trim().split('\n')) {
        const m = line.match(/^\[P(\d+)\]\s*(.+)$/);
        if (m) result.plan.push({ problemRef: parseInt(m[1]), text: m[2] });
      }
    }

    // Watch for
    const wm = text.match(/===WATCH_FOR===([\s\S]*?)(?====|$)/);
    if (wm) {
      for (const line of wm[1].trim().split('\n')) {
        const clean = line.replace(/^[-•*]\s*/, '').trim();
        if (clean) result.watchFor.push(clean);
      }
    }

    return result;
  }

  /**
   * Learn from API response - extract and store patterns
   */
  async learn(data, emb, result, type, sig) {
    if (this.config.debug) console.log('Learning new patterns...');

    const patterns = [];

    // Pattern per interpretation
    for (const [name, interp] of Object.entries(result.interpretations || {})) {
      const test = data.tests[name];
      if (test) {
        patterns.push({
          signature: `${name}:${test.status}:${test.trend}`,
          template: {
            interpretations: { [name]: { ...interp, action: result.problems.find(p => p.title.includes(name))?.action } }
          }
        });
      }
    }

    // Overall pattern
    if (Object.keys(data.tests).length >= 3) {
      patterns.push({
        signature: sig,
        template: { interpretations: result.interpretations, plan: result.plan, watchFor: result.watchFor }
      });
    }

    // Store
    for (const p of patterns) {
      const patEmb = await this.embed(p.signature);
      this.patternStore.add({
        id: `pat_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
        type,
        signature: p.signature,
        embedding: patEmb,
        template: p.template,
        successRate: 1.0,
        usageCount: 0,
        createdAt: Date.now(),
        lastUsed: Date.now()
      });
    }

    await this.saveKnowledge();
    if (this.config.debug) console.log(`Learned ${patterns.length} patterns. Total: ${this.patternStore.size()}`);
  }

  /**
   * Process feedback to adjust pattern success rates
   */
  async processFeedback(patternId, positive, correction = null) {
    const p = this.patternStore.get(patternId);
    if (!p) return;

    p.successRate = positive
      ? Math.min(1.0, p.successRate + this.config.positiveBoost)
      : Math.max(0.1, p.successRate - this.config.negativePenalty);

    if (!positive && correction) {
      const corrEmb = await this.embed(`${p.signature}:corrected`);
      this.patternStore.add({
        id: `pat_${Date.now()}_${Math.random().toString(36).slice(2,9)}`,
        type: p.type,
        signature: `${p.signature}:corrected`,
        embedding: corrEmb,
        template: { ...p.template, correction },
        successRate: 0.9,
        usageCount: 0,
        createdAt: Date.now(),
        lastUsed: Date.now()
      });
    }

    await this.saveKnowledge();
  }

  /**
   * Load knowledge from IndexedDB
   */
  async loadKnowledge() {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('MedWardNeural', 1);
        r.onerror = () => rej(r.error);
        r.onsuccess = () => res(r.result);
        r.onupgradeneeded = e => e.target.result.createObjectStore('patterns', { keyPath: 'id' });
      });
      const patterns = await new Promise((res, rej) => {
        const r = db.transaction('patterns', 'readonly').objectStore('patterns').getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      for (const p of patterns) this.patternStore.addDirect(p);
      db.close();
    } catch (e) {
      console.warn('Could not load patterns:', e);
    }
  }

  /**
   * Save knowledge to IndexedDB
   */
  async saveKnowledge() {
    try {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('MedWardNeural', 1);
        r.onerror = () => rej(r.error);
        r.onsuccess = () => res(r.result);
      });
      const store = db.transaction('patterns', 'readwrite').objectStore('patterns');
      for (const p of this.patternStore.getAll()) store.put(p);
      db.close();
    } catch (e) {
      console.warn('Could not save patterns:', e);
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      total: this.metrics.total,
      cacheHitRate: this.metrics.total ? ((this.metrics.local / this.metrics.total) * 100).toFixed(1) + '%' : '0%',
      avgLocalMs: this.metrics.local ? (this.metrics.localTime / this.metrics.local).toFixed(0) : 0,
      avgApiMs: this.metrics.api ? (this.metrics.apiTime / this.metrics.api).toFixed(0) : 0,
      patterns: this.patternStore.size()
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MedicalDocumentParser, PatternStore, MedWardNeural };
}
