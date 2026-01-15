/**
 * MedWard Master v2.0 - Neural Intelligence Edition
 * Self-learning medical analysis with robust document parsing
 * 
 * A sophisticated clinical decision support system featuring:
 * - MedicalDocumentParser: Robust parsing for cumulative lab reports
 * - PatternStore: LRU pattern storage with persistence & scoring
 * - MedWardNeural: Neural learning system with TensorFlow.js embeddings
 * 
 * @author MedWard Team
 * @version 2.0.0
 * @license MIT
 */

'use strict';

// ==================== Medical Document Parser ====================
/**
 * Robust parser for medical documents (especially cumulative lab reports)
 * Handles multi-column data, H/L flags, various reference range formats
 */
class MedicalDocumentParser {
  constructor(config = {}) {
    this.config = {
      debug: false,
      strictMode: false,
      ...config
    };

    // Test name normalization map - comprehensive medical test aliases
    this.testNameMap = {
      // Hematology - Complete Blood Count
      'WBC': ['WBC', 'White Blood Cell', 'Leukocytes', 'White Cell Count', 'White Blood Cells', 'Leucocytes'],
      'RBC': ['RBC', 'Red Blood Cell', 'Erythrocytes', 'Red Cell Count', 'Red Blood Cells'],
      'Hb': ['Hb', 'HGB', 'Hemoglobin', 'Haemoglobin', 'Hgb'],
      'Hct': ['Hct', 'HCT', 'Hematocrit', 'Haematocrit', 'PCV', 'Packed Cell Volume'],
      'Plt': ['Plt', 'PLT', 'Platelets', 'Platelet Count', 'Thrombocytes'],
      'Neutrophils': ['Neutrophils', 'Neutrophils.#', 'Neut#', 'Neutrophil Count', 'Neut', 'Neutro', 'ANC'],
      'Lymphocytes': ['Lymphocytes', 'Lymphocytes.#', 'Lymph#', 'Lymphocyte Count', 'Lymph', 'Lympho'],
      'Monocytes': ['Monocytes', 'Monocytes.#', 'Mono#', 'Monocyte Count', 'Mono'],
      'Eosinophils': ['Eosinophils', 'Eosinophils.#', 'Eos#', 'Eosinophil Count', 'Eos', 'Eosino'],
      'Basophils': ['Basophils', 'Basophils.#', 'Baso#', 'Basophil Count', 'Baso'],
      'MCV': ['MCV', 'Mean Corpuscular Volume', 'Mean Cell Volume'],
      'MCH': ['MCH', 'Mean Corpuscular Hemoglobin', 'Mean Cell Hemoglobin'],
      'MCHC': ['MCHC', 'Mean Corpuscular Hemoglobin Concentration', 'Mean Cell Hb Conc'],
      'RDW': ['RDW', 'Red Cell Distribution Width', 'RDW-CV', 'RDW-SD'],
      'MPV': ['MPV', 'Mean Platelet Volume'],
      'PCT': ['PCT', 'Plateletcrit', 'Procalcitonin'],
      'PDW': ['PDW', 'Platelet Distribution Width'],
      
      // Electrolytes & Renal
      'Na': ['Na', 'Sodium', 'Serum Sodium', 'Na+'],
      'K': ['K', 'Potassium', 'Serum Potassium', 'K+'],
      'Cl': ['Cl', 'Chloride', 'Serum Chloride', 'Cl-'],
      'CO2': ['CO2', 'Bicarbonate', 'HCO3', 'Total CO2', 'TCO2'],
      'Cr': ['Cr', 'Creatinine', 'Serum Creatinine', 'Creat'],
      'BUN': ['BUN', 'Urea', 'Blood Urea Nitrogen', 'Serum Urea'],
      'eGFR': ['eGFR', 'GFR', 'Estimated GFR', 'Glomerular Filtration Rate'],
      'Ca': ['Ca', 'Calcium', 'Serum Calcium', 'Ca2+', 'Total Calcium'],
      'Mg': ['Mg', 'Magnesium', 'Serum Magnesium', 'Mg2+'],
      'Phosphate': ['Phosphate', 'Phosphorus', 'PO4', 'Serum Phosphate', 'Phos'],
      
      // Liver Function
      'ALT': ['ALT', 'SGPT', 'Alanine Aminotransferase', 'Alanine Transaminase'],
      'AST': ['AST', 'SGOT', 'Aspartate Aminotransferase', 'Aspartate Transaminase'],
      'ALP': ['ALP', 'Alkaline Phosphatase', 'Alk Phos'],
      'GGT': ['GGT', 'Gamma GT', 'Gamma-Glutamyl Transferase', 'GGTP'],
      'Bilirubin': ['Bilirubin', 'Total Bilirubin', 'T.Bili', 'TBIL'],
      'DirectBili': ['Direct Bilirubin', 'Conjugated Bilirubin', 'D.Bili', 'DBIL'],
      'Albumin': ['Albumin', 'Alb', 'Serum Albumin'],
      'TotalProtein': ['Total Protein', 'TP', 'Serum Protein'],
      
      // Metabolic
      'Glucose': ['Glucose', 'FBS', 'RBS', 'Blood Sugar', 'Blood Glucose', 'FBG', 'Fasting Glucose'],
      'HbA1c': ['HbA1c', 'A1c', 'Glycated Hemoglobin', 'Glycosylated Hb', 'Hemoglobin A1c'],
      'Cholesterol': ['Cholesterol', 'Total Cholesterol', 'TC', 'Chol'],
      'Triglycerides': ['Triglycerides', 'TG', 'Trigs', 'Triglyceride'],
      'HDL': ['HDL', 'HDL-C', 'HDL Cholesterol', 'Good Cholesterol'],
      'LDL': ['LDL', 'LDL-C', 'LDL Cholesterol', 'Bad Cholesterol'],
      'UricAcid': ['Uric Acid', 'UA', 'Serum Uric Acid'],
      
      // Cardiac
      'Troponin': ['Troponin', 'Troponin I', 'Troponin T', 'TnI', 'TnT', 'cTnI', 'cTnT', 'hs-Troponin'],
      'BNP': ['BNP', 'NT-proBNP', 'Brain Natriuretic Peptide', 'ProBNP'],
      'CK': ['CK', 'CPK', 'Creatine Kinase', 'Creatine Phosphokinase'],
      'CKMB': ['CK-MB', 'CKMB', 'CK MB'],
      'LDH': ['LDH', 'Lactate Dehydrogenase', 'LD'],
      
      // Coagulation
      'PT': ['PT', 'Prothrombin Time', 'Pro Time'],
      'INR': ['INR', 'International Normalized Ratio'],
      'PTT': ['PTT', 'aPTT', 'Partial Thromboplastin Time', 'Activated PTT'],
      'Fibrinogen': ['Fibrinogen', 'Fib'],
      'DDimer': ['D-Dimer', 'D Dimer', 'Fibrin Degradation'],
      
      // Thyroid
      'TSH': ['TSH', 'Thyroid Stimulating Hormone', 'Thyrotropin'],
      'T3': ['T3', 'Triiodothyronine', 'Total T3'],
      'T4': ['T4', 'Thyroxine', 'Total T4'],
      'FreeT3': ['Free T3', 'FT3'],
      'FreeT4': ['Free T4', 'FT4'],
      
      // Inflammatory
      'CRP': ['CRP', 'C-Reactive Protein', 'hs-CRP', 'High Sensitivity CRP'],
      'ESR': ['ESR', 'Sed Rate', 'Erythrocyte Sedimentation Rate'],
      'Ferritin': ['Ferritin', 'Serum Ferritin'],
      'Iron': ['Iron', 'Serum Iron', 'Fe'],
      'TIBC': ['TIBC', 'Total Iron Binding Capacity'],
      'Transferrin': ['Transferrin', 'Tf'],
    };

    // Reference ranges with critical thresholds (adult values)
    this.referenceRanges = {
      // Hematology
      'WBC': { min: 4.0, max: 11.0, critLow: 1.0, critHigh: 30, unit: '×10⁹/L' },
      'RBC': { min: 4.5, max: 5.5, critLow: 2.0, critHigh: 7.0, unit: '×10¹²/L' },
      'Hb': { min: 120, max: 170, critLow: 70, critHigh: 200, unit: 'g/L' },
      'Hct': { min: 0.36, max: 0.50, critLow: 0.20, critHigh: 0.60, unit: 'L/L' },
      'Plt': { min: 150, max: 400, critLow: 20, critHigh: 1000, unit: '×10⁹/L' },
      'Neutrophils': { min: 2.0, max: 7.5, critLow: 0.5, critHigh: 20, unit: '×10⁹/L' },
      'Lymphocytes': { min: 1.0, max: 4.0, critLow: 0.2, critHigh: 10, unit: '×10⁹/L' },
      'Monocytes': { min: 0.2, max: 1.0, critLow: null, critHigh: 3.0, unit: '×10⁹/L' },
      'Eosinophils': { min: 0.0, max: 0.5, critLow: null, critHigh: 5.0, unit: '×10⁹/L' },
      'Basophils': { min: 0.0, max: 0.1, critLow: null, critHigh: 2.0, unit: '×10⁹/L' },
      'MCV': { min: 80, max: 100, critLow: 50, critHigh: 130, unit: 'fL' },
      'MCH': { min: 27, max: 33, critLow: 15, critHigh: 45, unit: 'pg' },
      'MCHC': { min: 320, max: 360, critLow: 250, critHigh: 400, unit: 'g/L' },
      'RDW': { min: 11.5, max: 14.5, critLow: null, critHigh: 25, unit: '%' },
      
      // Electrolytes
      'Na': { min: 136, max: 145, critLow: 120, critHigh: 160, unit: 'mmol/L' },
      'K': { min: 3.5, max: 5.0, critLow: 2.5, critHigh: 6.5, unit: 'mmol/L' },
      'Cl': { min: 98, max: 106, critLow: 80, critHigh: 120, unit: 'mmol/L' },
      'CO2': { min: 22, max: 29, critLow: 10, critHigh: 40, unit: 'mmol/L' },
      'Ca': { min: 2.1, max: 2.6, critLow: 1.5, critHigh: 3.5, unit: 'mmol/L' },
      'Mg': { min: 0.7, max: 1.0, critLow: 0.4, critHigh: 2.0, unit: 'mmol/L' },
      'Phosphate': { min: 0.8, max: 1.5, critLow: 0.3, critHigh: 3.0, unit: 'mmol/L' },
      
      // Renal
      'Cr': { min: 60, max: 110, critLow: null, critHigh: 1000, unit: 'μmol/L' },
      'BUN': { min: 2.5, max: 7.1, critLow: null, critHigh: 50, unit: 'mmol/L' },
      'eGFR': { min: 90, max: 999, critLow: 15, critHigh: null, unit: 'mL/min/1.73m²' },
      
      // Liver
      'ALT': { min: 0, max: 40, critLow: null, critHigh: 1000, unit: 'U/L' },
      'AST': { min: 0, max: 40, critLow: null, critHigh: 1000, unit: 'U/L' },
      'ALP': { min: 40, max: 130, critLow: null, critHigh: 1000, unit: 'U/L' },
      'GGT': { min: 0, max: 60, critLow: null, critHigh: 1000, unit: 'U/L' },
      'Bilirubin': { min: 0, max: 21, critLow: null, critHigh: 300, unit: 'μmol/L' },
      'Albumin': { min: 35, max: 50, critLow: 15, critHigh: null, unit: 'g/L' },
      
      // Metabolic
      'Glucose': { min: 3.9, max: 5.6, critLow: 2.2, critHigh: 25, unit: 'mmol/L' },
      'HbA1c': { min: 4.0, max: 5.6, critLow: null, critHigh: 15, unit: '%' },
      'Cholesterol': { min: 0, max: 5.2, critLow: null, critHigh: 10, unit: 'mmol/L' },
      'Triglycerides': { min: 0, max: 1.7, critLow: null, critHigh: 10, unit: 'mmol/L' },
      'HDL': { min: 1.0, max: 999, critLow: 0.5, critHigh: null, unit: 'mmol/L' },
      'LDL': { min: 0, max: 3.4, critLow: null, critHigh: 5.0, unit: 'mmol/L' },
      
      // Cardiac
      'Troponin': { min: 0, max: 0.04, critLow: null, critHigh: 0.1, unit: 'ng/mL' },
      'BNP': { min: 0, max: 100, critLow: null, critHigh: 500, unit: 'pg/mL' },
      'CK': { min: 30, max: 200, critLow: null, critHigh: 1000, unit: 'U/L' },
      
      // Coagulation
      'PT': { min: 11, max: 13.5, critLow: null, critHigh: 30, unit: 'seconds' },
      'INR': { min: 0.8, max: 1.2, critLow: null, critHigh: 5.0, unit: '' },
      'PTT': { min: 25, max: 35, critLow: null, critHigh: 100, unit: 'seconds' },
      'DDimer': { min: 0, max: 0.5, critLow: null, critHigh: 10, unit: 'mg/L' },
      
      // Thyroid
      'TSH': { min: 0.4, max: 4.0, critLow: 0.01, critHigh: 100, unit: 'mIU/L' },
      'FreeT4': { min: 12, max: 22, critLow: 5, critHigh: 50, unit: 'pmol/L' },
      'FreeT3': { min: 3.1, max: 6.8, critLow: 1.5, critHigh: 15, unit: 'pmol/L' },
      
      // Inflammatory
      'CRP': { min: 0, max: 5, critLow: null, critHigh: 200, unit: 'mg/L' },
      'ESR': { min: 0, max: 20, critLow: null, critHigh: 100, unit: 'mm/hr' },
      'Ferritin': { min: 30, max: 400, critLow: 10, critHigh: 2000, unit: 'μg/L' },
    };

    // Clinical interpretation patterns
    this.clinicalPatterns = {
      'anemia': {
        tests: ['Hb', 'RBC', 'MCV', 'MCH', 'MCHC', 'RDW', 'Ferritin', 'Iron', 'TIBC'],
        conditions: {
          'microcytic': { MCV: 'low', tests: ['Ferritin', 'Iron'] },
          'macrocytic': { MCV: 'high', tests: ['B12', 'Folate'] },
          'normocytic': { MCV: 'normal', tests: ['Cr', 'CRP'] }
        }
      },
      'infection': {
        tests: ['WBC', 'Neutrophils', 'CRP', 'PCT'],
        severity: { mild: 'WBC < 15', moderate: 'WBC 15-25', severe: 'WBC > 25 or PCT > 2' }
      },
      'aki': {
        tests: ['Cr', 'BUN', 'eGFR', 'K'],
        staging: { stage1: 'Cr 1.5-1.9x', stage2: 'Cr 2-2.9x', stage3: 'Cr >= 3x or eGFR < 35' }
      },
      'dka': {
        tests: ['Glucose', 'K', 'Na', 'CO2', 'BUN'],
        criteria: { glucose: '> 14', bicarbonate: '< 18', potassium: 'variable' }
      },
      'liver_injury': {
        tests: ['ALT', 'AST', 'ALP', 'GGT', 'Bilirubin', 'Albumin', 'INR'],
        patterns: {
          'hepatocellular': { ALT: 'high', ALP: 'normal_or_mild' },
          'cholestatic': { ALP: 'high', ALT: 'normal_or_mild' },
          'mixed': { ALT: 'high', ALP: 'high' }
        }
      },
      'coagulopathy': {
        tests: ['PT', 'INR', 'PTT', 'Plt', 'Fibrinogen', 'DDimer'],
        patterns: {
          'dic': { DDimer: 'high', Plt: 'low', Fibrinogen: 'low' },
          'vitamin_k': { PT: 'high', PTT: 'normal_or_high' },
          'heparin': { PTT: 'high', PT: 'normal' }
        }
      }
    };
  }

  /**
   * Main parsing function - auto-detects input type
   * @param {string|Blob|File} input - Text content or image file
   * @param {string} inputType - 'auto', 'text', or 'image'
   * @returns {Promise<Object>} Parsed and enriched medical data
   */
  async parse(input, inputType = 'auto') {
    const start = performance.now();

    let text;
    if (inputType === 'image' || (inputType === 'auto' && input instanceof Blob)) {
      text = await this.extractTextFromImage(input);
    } else {
      text = typeof input === 'string' ? input : await input.text();
    }

    if (!text || text.trim().length === 0) {
      throw new Error('No text content to parse');
    }

    const docType = this.detectType(text);

    let result;
    switch (docType) {
      case 'lab_cumulative':
        result = this.parseLabCumulative(text);
        break;
      case 'lab_single':
        result = this.parseLabSingle(text);
        break;
      default:
        result = this.parseGeneric(text);
    }

    result = this.enrich(result);
    result.clinicalPatterns = this.detectClinicalPatterns(result);
    result.metadata = {
      parseTime: Math.round(performance.now() - start),
      docType,
      parser: 'MedWardNeural v2.0',
      timestamp: new Date().toISOString(),
      testCount: Object.keys(result.tests || {}).length
    };

    if (this.config.debug) {
      console.log('[Parser] Completed in', result.metadata.parseTime, 'ms');
      console.log('[Parser] Found', result.metadata.testCount, 'tests');
    }

    return result;
  }

  /**
   * Extract text from image using OCR (placeholder - requires backend)
   */
  async extractTextFromImage(blob) {
    // This would normally call an OCR service
    // For now, return empty to trigger API-based extraction
    console.warn('[Parser] Image OCR requires backend processing');
    return '';
  }

  /**
   * Detect document type from text content
   */
  detectType(text) {
    const upper = text.toUpperCase();
    
    // Check for cumulative report markers
    if (upper.includes('CUMULATIVE') || this.hasMultipleDates(text)) {
      return 'lab_cumulative';
    }
    
    // Check for single lab report
    if (this.hasLabMarkers(text)) {
      return 'lab_single';
    }
    
    return 'general';
  }

  /**
   * Check if text contains multiple date/time stamps
   */
  hasMultipleDates(text) {
    const patterns = [
      /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g,
      /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/g,
      /\d{2}-\w{3}-\d{4}/g
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches && matches.length >= 2) return true;
    }
    return false;
  }

  /**
   * Check for laboratory report markers
   */
  hasLabMarkers(text) {
    const markers = ['REFERENCE', 'NORMAL', 'RANGE', 'RESULT', 'UNIT', 'FLAG', 'H/L'];
    const upper = text.toUpperCase();
    return markers.filter(m => upper.includes(m)).length >= 2;
  }

  /**
   * Parse cumulative lab report (multi-column format)
   */
  parseLabCumulative(text) {
    const result = { 
      type: 'lab_cumulative', 
      dates: [], 
      tests: {}, 
      rawText: text 
    };

    // Extract dates from various formats
    const datePatterns = [
      /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/g,
      /(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/g,
      /(\d{2}-\w{3}-\d{4})\s+(\d{2}:\d{2})/g
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        result.dates.push({ date: match[1], time: match[2] || '00:00:00' });
      }
    }
    
    // Deduplicate dates
    result.dates = [...new Map(result.dates.map(d => [`${d.date}_${d.time}`, d])).values()];

    // Parse test lines
    const lines = text.split(/[\n\r]+/);
    for (const line of lines) {
      const parsed = this.parseTestLine(line);
      if (parsed) {
        result.tests[parsed.name] = parsed;
      }
    }

    return result;
  }

  /**
   * Parse single lab report
   */
  parseLabSingle(text) {
    const result = { 
      type: 'lab_single', 
      date: null,
      tests: {}, 
      rawText: text 
    };

    // Try to extract date
    const dateMatch = text.match(/(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      result.date = dateMatch[1];
    }

    // Parse test lines
    const lines = text.split(/[\n\r]+/);
    for (const line of lines) {
      const parsed = this.parseTestLine(line);
      if (parsed) {
        result.tests[parsed.name] = parsed;
      }
    }

    return result;
  }

  /**
   * Parse generic medical text
   */
  parseGeneric(text) {
    return {
      type: 'general',
      tests: {},
      rawText: text,
      extracted: this.extractKeyValuePairs(text)
    };
  }

  /**
   * Extract key-value pairs from text
   */
  extractKeyValuePairs(text) {
    const pairs = {};
    const patterns = [
      /([A-Za-z\s]+):\s*([\d.]+)\s*([A-Za-z/%²³⁹¹]+)?/g,
      /([A-Za-z\s]+)\s*=\s*([\d.]+)\s*([A-Za-z/%²³⁹¹]+)?/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const key = match[1].trim();
        const value = parseFloat(match[2]);
        const unit = match[3] || '';
        if (!isNaN(value)) {
          pairs[key] = { value, unit };
        }
      }
    }

    return pairs;
  }

  /**
   * Parse individual test line (handles multi-column values with H/L flags)
   */
  parseTestLine(line) {
    if (this.isHeaderOrMeta(line)) return null;

    const parts = line.split(/\s+/).filter(p => p.length > 0);
    if (parts.length < 2) return null;

    // Find test name (everything before first numeric value)
    let nameParts = [];
    let valueStart = 0;
    
    for (let i = 0; i < parts.length; i++) {
      if (/^[\d.]+[HL]?$/i.test(parts[i]) || /^[<>]?[\d.]+$/i.test(parts[i])) {
        valueStart = i;
        break;
      }
      nameParts.push(parts[i]);
    }

    if (nameParts.length === 0) return null;

    const rawName = nameParts.join(' ');
    const name = this.normalizeName(rawName);
    if (!name) return null;

    // Parse values (handle attached H/L flags)
    const values = [];
    let current = null;
    let reference = null;
    let unit = null;

    for (let i = valueStart; i < parts.length; i++) {
      const p = parts[i];

      // Plain number
      if (/^[\d.]+$/.test(p)) {
        if (current) values.push(current);
        current = { value: parseFloat(p), flag: null };
      }
      // Number with < or > prefix
      else if (/^[<>][\d.]+$/.test(p)) {
        if (current) values.push(current);
        const val = parseFloat(p.substring(1));
        current = { value: val, flag: p[0] === '<' ? 'LOW' : 'HIGH', modifier: p[0] };
      }
      // Separate H/L flag
      else if (/^[HL]$/i.test(p) && current) {
        current.flag = p.toUpperCase();
      }
      // Value with attached flag (e.g., "8.5L")
      else if (/^([\d.]+)([HL])$/i.test(p)) {
        if (current) values.push(current);
        const m = p.match(/^([\d.]+)([HL])$/i);
        current = { value: parseFloat(m[1]), flag: m[2].toUpperCase() };
      }
      // Reference range (e.g., "3.5-5.0")
      else if (/^[\d.]+-[\d.]+$/.test(p)) {
        const [min, max] = p.split('-').map(Number);
        reference = { min, max, raw: p };
      }
      // Reference range in parentheses
      else if (/^\([\d.]+-[\d.]+\)$/.test(p)) {
        const range = p.replace(/[()]/g, '');
        const [min, max] = range.split('-').map(Number);
        reference = { min, max, raw: p };
      }
      // Unit detection
      else if (/^[a-zA-Z/%×⁹¹²³]+\/?(L|dL|mL)?$/.test(p) && !unit) {
        unit = p;
      }
    }
    
    if (current) values.push(current);
    if (values.length === 0) return null;

    // Use default reference if not found
    if (!reference) {
      reference = this.referenceRanges[name];
    }

    return {
      name,
      rawName,
      values,
      latestValue: values[0]?.value,
      flag: values[0]?.flag,
      reference,
      unit: unit || reference?.unit || null,
      trend: this.calcTrend(values)
    };
  }

  /**
   * Check if line is header/metadata (not a test result)
   */
  isHeaderOrMeta(line) {
    const keywords = [
      'TEST', 'DESCRIPTION', 'REFERENCE', 'PRINTED', 'RELEASED', 
      'CUMULATIVE', 'PATIENT', 'DOB', 'MRN', 'ACCESSION', 'COLLECTED',
      'SPECIMEN', 'RECEIVED', 'REPORTED', 'PHYSICIAN', 'LOCATION',
      'PAGE', 'CONFIDENTIAL', 'LABORATORY', 'HOSPITAL'
    ];
    const upper = line.toUpperCase().trim();
    
    // Skip empty or very short lines
    if (upper.length < 3) return true;
    
    // Skip header lines
    if (keywords.some(k => upper.startsWith(k))) return true;
    
    // Skip lines that are mostly dashes or equals
    if (/^[-=_*]{5,}$/.test(upper.replace(/\s/g, ''))) return true;
    
    return false;
  }

  /**
   * Normalize test name to standard format
   */
  normalizeName(raw) {
    if (!raw) return null;
    
    const clean = raw
      .replace(/[.#%*()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    if (clean.length < 2) return null;

    // Check against known test names
    for (const [std, variants] of Object.entries(this.testNameMap)) {
      for (const variant of variants) {
        if (variant.toLowerCase().replace(/[.#%]/g, '') === clean) {
          return std;
        }
      }
    }

    // Return capitalized version if not found
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  }

  /**
   * Calculate trend from multiple values
   */
  calcTrend(values) {
    if (!values || values.length < 2) return 'unknown';
    
    const latest = values[0]?.value;
    const previous = values[1]?.value;
    
    if (typeof latest !== 'number' || typeof previous !== 'number') {
      return 'unknown';
    }
    
    if (previous === 0) return latest > 0 ? 'rising' : 'stable';
    
    const pct = ((latest - previous) / Math.abs(previous)) * 100;
    
    if (pct > 50) return 'rising_rapid';
    if (pct > 15) return 'rising_fast';
    if (pct > 5) return 'rising';
    if (pct < -50) return 'falling_rapid';
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
      const val = test.latestValue ?? test.values?.[0]?.value;
      const ref = test.reference || this.referenceRanges[name];
      
      if (val === undefined || val === null || !ref) {
        test.status = 'unknown';
        test.severity = 'unknown';
        continue;
      }

      // Determine status
      if (val < ref.min) {
        test.status = 'low';
      } else if (val > ref.max) {
        test.status = 'high';
      } else {
        test.status = 'normal';
        normal++;
      }

      // Determine severity
      if (ref.critLow !== null && val <= ref.critLow) {
        test.severity = 'critical';
        test.alert = `CRITICAL LOW: ${name} = ${val}`;
        critical++;
      } else if (ref.critHigh !== null && val >= ref.critHigh) {
        test.severity = 'critical';
        test.alert = `CRITICAL HIGH: ${name} = ${val}`;
        critical++;
      } else if (test.status !== 'normal') {
        test.severity = 'abnormal';
        abnormal++;
      } else {
        test.severity = 'normal';
      }

      // Calculate deviation from normal
      if (ref.min !== undefined && ref.max !== undefined) {
        const midpoint = (ref.min + ref.max) / 2;
        const range = ref.max - ref.min;
        test.deviation = range > 0 ? ((val - midpoint) / (range / 2)) : 0;
      }
    }

    // Summary statistics
    data.summary = {
      total: Object.keys(data.tests || {}).length,
      normal,
      abnormal,
      critical,
      hasCritical: critical > 0,
      hasAbnormal: abnormal > 0
    };

    return data;
  }

  /**
   * Detect clinical patterns from test results
   */
  detectClinicalPatterns(data) {
    const detected = [];
    const tests = data.tests || {};

    // Check for anemia pattern
    const hb = tests['Hb'];
    if (hb && hb.status === 'low') {
      const mcv = tests['MCV'];
      const pattern = {
        name: 'Anemia',
        confidence: 0.9,
        type: mcv?.status === 'low' ? 'microcytic' : 
              mcv?.status === 'high' ? 'macrocytic' : 'normocytic',
        relatedTests: ['Hb', 'RBC', 'MCV', 'MCH', 'MCHC', 'RDW'],
        suggestion: mcv?.status === 'low' ? 
          'Consider iron studies (Ferritin, Iron, TIBC)' :
          mcv?.status === 'high' ?
          'Consider B12, Folate, reticulocyte count' :
          'Consider reticulocyte count, peripheral smear'
      };
      detected.push(pattern);
    }

    // Check for infection/inflammation
    const wbc = tests['WBC'];
    const crp = tests['CRP'];
    if ((wbc && wbc.status === 'high') || (crp && crp.status === 'high')) {
      detected.push({
        name: 'Infection/Inflammation',
        confidence: wbc?.status === 'high' && crp?.status === 'high' ? 0.95 : 0.7,
        relatedTests: ['WBC', 'Neutrophils', 'CRP', 'ESR'],
        suggestion: 'Correlate with clinical presentation, consider cultures if indicated'
      });
    }

    // Check for acute kidney injury
    const cr = tests['Cr'];
    if (cr && cr.status === 'high') {
      const bun = tests['BUN'];
      detected.push({
        name: 'Elevated Creatinine',
        confidence: 0.85,
        relatedTests: ['Cr', 'BUN', 'eGFR', 'K'],
        bunCrRatio: bun ? (bun.latestValue / cr.latestValue).toFixed(1) : null,
        suggestion: 'Assess volume status, review medications, check for obstruction'
      });
    }

    // Check for hyperkalemia
    const k = tests['K'];
    if (k && k.status === 'high') {
      detected.push({
        name: 'Hyperkalemia',
        confidence: 0.95,
        severity: k.severity,
        relatedTests: ['K', 'Cr', 'CO2'],
        suggestion: k.severity === 'critical' ? 
          'URGENT: ECG, cardiac monitoring, consider emergent treatment' :
          'Repeat to confirm, ECG if symptomatic, review medications'
      });
    }

    // Check for hyponatremia
    const na = tests['Na'];
    if (na && na.status === 'low') {
      detected.push({
        name: 'Hyponatremia',
        confidence: 0.9,
        severity: na.severity,
        relatedTests: ['Na', 'K', 'Glucose', 'Cr'],
        suggestion: 'Assess volume status, check serum/urine osmolality'
      });
    }

    // Check for liver injury
    const alt = tests['ALT'];
    const ast = tests['AST'];
    const alp = tests['ALP'];
    if ((alt && alt.status === 'high') || (ast && ast.status === 'high')) {
      const pattern = alp?.status === 'high' ? 'mixed' :
                     (alt?.latestValue || 0) > (alp?.latestValue || 0) ? 'hepatocellular' : 'cholestatic';
      detected.push({
        name: 'Liver Injury',
        confidence: 0.85,
        pattern,
        relatedTests: ['ALT', 'AST', 'ALP', 'GGT', 'Bilirubin', 'Albumin', 'INR'],
        astAltRatio: (alt && ast) ? (ast.latestValue / alt.latestValue).toFixed(2) : null,
        suggestion: `${pattern} pattern - review medications, hepatitis serologies if indicated`
      });
    }

    // Check for coagulopathy
    const inr = tests['INR'];
    const pt = tests['PT'];
    if ((inr && inr.status === 'high') || (pt && pt.status === 'high')) {
      detected.push({
        name: 'Coagulopathy',
        confidence: 0.85,
        relatedTests: ['PT', 'INR', 'PTT', 'Plt', 'Fibrinogen'],
        suggestion: 'Review anticoagulants, check liver function, consider vitamin K'
      });
    }

    return detected;
  }

  /**
   * Convert parsed data to AI-friendly prompt format
   */
  toAIPrompt(data) {
    let prompt = `MEDICAL LAB ANALYSIS\n`;
    prompt += `Document Type: ${data.type}\n`;
    prompt += `Date: ${data.date || data.dates?.[0]?.date || 'Not specified'}\n\n`;

    // Summary
    const s = data.summary;
    prompt += `SUMMARY: ${s.total} tests - ${s.normal} normal, ${s.abnormal} abnormal, ${s.critical} critical\n\n`;

    // Critical values first
    if (s.critical > 0) {
      prompt += `⚠️ CRITICAL VALUES:\n`;
      for (const [name, test] of Object.entries(data.tests)) {
        if (test.severity === 'critical') {
          prompt += `- ${name}: ${test.latestValue} ${test.unit || ''} (${test.alert})\n`;
        }
      }
      prompt += '\n';
    }

    // Abnormal values
    if (s.abnormal > 0) {
      prompt += `ABNORMAL VALUES:\n`;
      for (const [name, test] of Object.entries(data.tests)) {
        if (test.severity === 'abnormal') {
          const ref = test.reference;
          const refStr = ref ? `[${ref.min}-${ref.max}]` : '';
          prompt += `- ${name}: ${test.latestValue} ${test.unit || ''} ${refStr} (${test.status.toUpperCase()})`;
          if (test.trend !== 'unknown') prompt += ` - Trend: ${test.trend}`;
          prompt += '\n';
        }
      }
      prompt += '\n';
    }

    // Clinical patterns
    if (data.clinicalPatterns?.length > 0) {
      prompt += `DETECTED PATTERNS:\n`;
      for (const pattern of data.clinicalPatterns) {
        prompt += `- ${pattern.name}`;
        if (pattern.type) prompt += ` (${pattern.type})`;
        prompt += ` - ${pattern.suggestion}\n`;
      }
      prompt += '\n';
    }

    // All test values
    prompt += `ALL TEST VALUES:\n`;
    for (const [name, test] of Object.entries(data.tests)) {
      const ref = test.reference;
      const refStr = ref ? `[${ref.min}-${ref.max}]` : '';
      const flag = test.flag ? ` ${test.flag}` : '';
      prompt += `${name}: ${test.latestValue}${flag} ${test.unit || ''} ${refStr}\n`;
    }

    return prompt;
  }
}


// ==================== Pattern Store ====================
/**
 * LRU-based pattern storage with persistence and scoring
 * Manages learned patterns for the neural inference system
 */
class PatternStore {
  constructor(maxSize = 10000) {
    this.maxSize = maxSize;
    this.patterns = new Map();
    this.accessOrder = [];
    this.typeIndex = new Map(); // Index patterns by type for faster lookup
  }

  /**
   * Add a pattern with LRU eviction
   */
  add(pattern) {
    if (!pattern || !pattern.id) {
      throw new Error('Pattern must have an id');
    }

    // Check if already exists
    if (this.patterns.has(pattern.id)) {
      this.recordUsage(pattern.id);
      this.patterns.set(pattern.id, { ...this.patterns.get(pattern.id), ...pattern });
      return;
    }

    // Evict if at capacity
    while (this.patterns.size >= this.maxSize) {
      this.evict();
    }

    // Add pattern
    pattern.addedAt = pattern.addedAt || Date.now();
    pattern.lastUsed = Date.now();
    pattern.usageCount = pattern.usageCount || 0;
    pattern.successRate = pattern.successRate ?? 1.0;

    this.patterns.set(pattern.id, pattern);
    this.accessOrder.push(pattern.id);

    // Update type index
    if (pattern.type) {
      if (!this.typeIndex.has(pattern.type)) {
        this.typeIndex.set(pattern.type, new Set());
      }
      this.typeIndex.get(pattern.type).add(pattern.id);
    }
  }

  /**
   * Add pattern directly without LRU processing (for loading from DB)
   */
  addDirect(pattern) {
    if (!pattern || !pattern.id) return;
    
    this.patterns.set(pattern.id, pattern);
    
    if (!this.accessOrder.includes(pattern.id)) {
      this.accessOrder.push(pattern.id);
    }

    if (pattern.type) {
      if (!this.typeIndex.has(pattern.type)) {
        this.typeIndex.set(pattern.type, new Set());
      }
      this.typeIndex.get(pattern.type).add(pattern.id);
    }
  }

  /**
   * Get pattern by ID
   */
  get(id) {
    const pattern = this.patterns.get(id);
    if (pattern) {
      this.recordUsage(id);
    }
    return pattern || null;
  }

  /**
   * Get all patterns of a specific type
   */
  getByType(type) {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    
    return Array.from(ids)
      .map(id => this.patterns.get(id))
      .filter(p => p !== undefined)
      .sort((a, b) => {
        // Sort by success rate * usage count (weighted relevance)
        const scoreA = a.successRate * Math.log(a.usageCount + 1);
        const scoreB = b.successRate * Math.log(b.usageCount + 1);
        return scoreB - scoreA;
      });
  }

  /**
   * Get all patterns
   */
  getAll() {
    return Array.from(this.patterns.values());
  }

  /**
   * Record pattern usage (updates LRU order)
   */
  recordUsage(id) {
    const pattern = this.patterns.get(id);
    if (!pattern) return;

    pattern.lastUsed = Date.now();
    pattern.usageCount = (pattern.usageCount || 0) + 1;

    // Move to end of access order (most recently used)
    const idx = this.accessOrder.indexOf(id);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
    }
    this.accessOrder.push(id);
  }

  /**
   * Update pattern success rate
   */
  updateSuccessRate(id, success, boost = 0.05, penalty = 0.1) {
    const pattern = this.patterns.get(id);
    if (!pattern) return;

    if (success) {
      pattern.successRate = Math.min(1.0, pattern.successRate + boost);
    } else {
      pattern.successRate = Math.max(0.1, pattern.successRate - penalty);
    }
  }

  /**
   * Evict lowest-scoring pattern
   */
  evict() {
    if (this.patterns.size === 0) return;

    // Score patterns: lower is worse (candidates for eviction)
    // Score = successRate * recency * log(usageCount + 1)
    const now = Date.now();
    let worstId = null;
    let worstScore = Infinity;

    for (const [id, pattern] of this.patterns) {
      const ageMs = now - (pattern.lastUsed || pattern.addedAt || now);
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-ageDays / 30); // Decay over 30 days
      const usageFactor = Math.log((pattern.usageCount || 0) + 1) + 1;
      const score = (pattern.successRate || 0.5) * recencyFactor * usageFactor;

      if (score < worstScore) {
        worstScore = score;
        worstId = id;
      }
    }

    if (worstId) {
      this.remove(worstId);
    }
  }

  /**
   * Remove a pattern
   */
  remove(id) {
    const pattern = this.patterns.get(id);
    if (!pattern) return;

    // Remove from type index
    if (pattern.type && this.typeIndex.has(pattern.type)) {
      this.typeIndex.get(pattern.type).delete(id);
    }

    // Remove from access order
    const idx = this.accessOrder.indexOf(id);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
    }

    this.patterns.delete(id);
  }

  /**
   * Clear all patterns
   */
  clear() {
    this.patterns.clear();
    this.accessOrder = [];
    this.typeIndex.clear();
  }

  /**
   * Get store size
   */
  size() {
    return this.patterns.size;
  }

  /**
   * Get store statistics
   */
  getStats() {
    const patterns = Array.from(this.patterns.values());
    const avgSuccessRate = patterns.length > 0 
      ? patterns.reduce((sum, p) => sum + (p.successRate || 0), 0) / patterns.length 
      : 0;
    const totalUsage = patterns.reduce((sum, p) => sum + (p.usageCount || 0), 0);

    return {
      totalPatterns: this.patterns.size,
      maxSize: this.maxSize,
      utilizationPct: ((this.patterns.size / this.maxSize) * 100).toFixed(1),
      avgSuccessRate: avgSuccessRate.toFixed(3),
      totalUsage,
      typeBreakdown: Object.fromEntries(
        Array.from(this.typeIndex.entries()).map(([type, ids]) => [type, ids.size])
      )
    };
  }

  /**
   * Export patterns for persistence
   */
  export() {
    return {
      version: '2.0',
      exportedAt: Date.now(),
      patterns: Array.from(this.patterns.values())
    };
  }

  /**
   * Import patterns from persistence
   */
  import(data) {
    if (!data || !data.patterns) return;

    for (const pattern of data.patterns) {
      this.addDirect(pattern);
    }
  }
}


// ==================== MedWard Neural ====================
/**
 * Neural learning system with TensorFlow.js for medical analysis
 * Provides pattern matching, local inference, and continuous learning
 */
class MedWardNeural {
  constructor(config = {}) {
    this.config = {
      // API Configuration
      backendUrl: config.backendUrl || null,
      apiKey: config.apiKey || null,
      
      // Embedding Configuration
      embeddingDim: config.embeddingDim || 256,
      vocabSize: config.vocabSize || 15000,
      maxSeqLength: config.maxSeqLength || 512,
      
      // Confidence Thresholds (lowered for better cache utilization)
      confidenceThreshold: config.confidenceThreshold || 0.70,
      criticalThreshold: config.criticalThreshold || 0.90,
      
      // Learning Parameters
      positiveBoost: config.positiveBoost || 0.05,
      negativePenalty: config.negativePenalty || 0.15,
      learningRate: config.learningRate || 0.01,
      
      // Storage
      maxPatterns: config.maxPatterns || 10000,
      dbName: config.dbName || 'MedWardNeural',
      
      // Debug
      debug: config.debug || false,
      
      ...config
    };

    // Initialize components
    this.patternStore = new PatternStore(this.config.maxPatterns);
    this.parser = new MedicalDocumentParser({ debug: this.config.debug });
    
    // TensorFlow model reference
    this.model = null;
    this.tokenizer = null;
    this.initialized = false;
    
    // Metrics tracking
    this.metrics = {
      total: 0,
      local: 0,
      api: 0,
      localTime: 0,
      apiTime: 0,
      errors: 0,
      lastAnalysis: null
    };

    // Vocabulary for tokenization
    this.vocabulary = new Map();
    this.inverseVocab = new Map();
    this.vocabBuilt = false;
  }

  /**
   * Initialize the neural system
   */
  async initialize() {
    if (this.initialized) return true;

    const start = performance.now();

    try {
      // Check TensorFlow availability
      if (typeof tf === 'undefined') {
        console.warn('[Neural] TensorFlow.js not loaded, using fallback mode');
        this.initialized = true;
        await this.loadKnowledge();
        return true;
      }

      // Build vocabulary
      this.buildVocabulary();

      // Create embedding model
      await this.createEmbeddingModel();

      // Load persisted knowledge
      await this.loadKnowledge();

      this.initialized = true;

      if (this.config.debug) {
        console.log(`[Neural] Initialized in ${Math.round(performance.now() - start)}ms`);
        console.log(`[Neural] Loaded ${this.patternStore.size()} patterns`);
      }

      return true;

    } catch (error) {
      console.error('[Neural] Initialization failed:', error);
      this.initialized = true; // Allow fallback operation
      return false;
    }
  }

  /**
   * Build vocabulary for tokenization
   */
  buildVocabulary() {
    // Medical vocabulary - common terms
    const medicalTerms = [
      // General
      'patient', 'result', 'test', 'value', 'normal', 'abnormal', 'critical',
      'high', 'low', 'elevated', 'decreased', 'stable', 'improving', 'worsening',
      
      // Tests (from parser)
      ...Object.keys(this.parser.testNameMap),
      ...Object.values(this.parser.testNameMap).flat(),
      
      // Clinical terms
      'anemia', 'infection', 'inflammation', 'injury', 'failure', 'insufficiency',
      'acute', 'chronic', 'severe', 'mild', 'moderate',
      'hyper', 'hypo', 'increased', 'decreased',
      
      // Actions
      'monitor', 'repeat', 'check', 'review', 'consider', 'evaluate', 'assess',
      'correlate', 'recommend', 'suggest', 'urgent', 'routine',
      
      // Units
      'mmol', 'mg', 'dl', 'ml', 'ul', 'ng', 'pg', 'iu', 'units',
      
      // Patterns
      'trend', 'rising', 'falling', 'rapid', 'fast', 'slow', 'stable'
    ];

    // Add special tokens
    this.vocabulary.set('<PAD>', 0);
    this.vocabulary.set('<UNK>', 1);
    this.vocabulary.set('<START>', 2);
    this.vocabulary.set('<END>', 3);

    // Add medical terms
    let idx = 4;
    for (const term of medicalTerms) {
      const lower = term.toLowerCase();
      if (!this.vocabulary.has(lower)) {
        this.vocabulary.set(lower, idx);
        this.inverseVocab.set(idx, lower);
        idx++;
      }
    }

    // Add numbers and common characters
    for (let i = 0; i <= 9; i++) {
      this.vocabulary.set(String(i), idx++);
    }
    for (const char of '.:-+/<>[]()') {
      this.vocabulary.set(char, idx++);
    }

    this.vocabBuilt = true;

    if (this.config.debug) {
      console.log(`[Neural] Built vocabulary with ${this.vocabulary.size} tokens`);
    }
  }

  /**
   * Create TensorFlow embedding model
   */
  async createEmbeddingModel() {
    if (typeof tf === 'undefined') return;

    try {
      // Simple embedding model using dense layers
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [this.config.maxSeqLength],
            units: 512,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({
            units: this.config.embeddingDim,
            activation: 'tanh'
          })
        ]
      });

      // Compile model
      this.model.compile({
        optimizer: tf.train.adam(this.config.learningRate),
        loss: 'meanSquaredError'
      });

      if (this.config.debug) {
        console.log('[Neural] Embedding model created');
      }

    } catch (error) {
      console.error('[Neural] Failed to create embedding model:', error);
      this.model = null;
    }
  }

  /**
   * Tokenize text into indices
   */
  tokenize(text) {
    if (!text) return new Array(this.config.maxSeqLength).fill(0);

    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s.:\-+/<>[\]()]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    const indices = tokens.map(token => 
      this.vocabulary.get(token) ?? this.vocabulary.get('<UNK>')
    );

    // Pad or truncate to max length
    const padded = new Array(this.config.maxSeqLength).fill(0);
    for (let i = 0; i < Math.min(indices.length, this.config.maxSeqLength); i++) {
      padded[i] = indices[i];
    }

    return padded;
  }

  /**
   * Generate embedding for text
   */
  async embed(text) {
    const tokenized = this.tokenize(text);

    if (this.model && typeof tf !== 'undefined') {
      try {
        const input = tf.tensor2d([tokenized]);
        const embedding = this.model.predict(input);
        const result = await embedding.data();
        
        input.dispose();
        embedding.dispose();
        
        return Array.from(result);
      } catch (error) {
        console.warn('[Neural] Embedding failed, using hash:', error);
      }
    }

    // Fallback: simple hash-based embedding
    return this.hashEmbed(text);
  }

  /**
   * Fallback hash-based embedding
   */
  hashEmbed(text) {
    const embedding = new Array(this.config.embeddingDim).fill(0);
    const tokens = this.tokenize(text);

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === 0) continue;
      
      // Distribute token influence across embedding dimensions
      for (let j = 0; j < this.config.embeddingDim; j++) {
        const hash = ((token * 31 + j * 17) % 1000) / 1000;
        embedding[j] += (hash - 0.5) * Math.exp(-i / 100);
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Generate signature for parsed data
   */
  generateSignature(data) {
    const tests = Object.entries(data.tests || {})
      .sort(([a], [b]) => a.localeCompare(b));

    const parts = [];

    // Test names
    parts.push('tests:' + tests.map(([name]) => name).join(','));

    // Abnormal tests
    const abnormal = tests
      .filter(([, t]) => t.severity === 'abnormal' || t.severity === 'critical')
      .map(([name]) => name);
    if (abnormal.length > 0) {
      parts.push('abn:' + abnormal.join(','));
    }

    // Critical tests
    const critical = tests
      .filter(([, t]) => t.severity === 'critical')
      .map(([name]) => name);
    parts.push('crit:' + (critical.length > 0 ? critical.join(',') : 'none'));

    // Patterns
    const patterns = (data.clinicalPatterns || []).map(p => p.name.toLowerCase());
    if (patterns.length > 0) {
      parts.push('pat:' + patterns.join(','));
    }

    return parts.join('|');
  }

  /**
   * Find matching patterns for given data
   */
  async findMatches(data, type = 'lab') {
    const signature = this.generateSignature(data);
    const embedding = await this.embed(signature);
    
    const candidates = this.patternStore.getByType(type);
    const matches = [];

    if (this.config.debug) {
      console.log('[Neural] Finding matches for signature:', signature);
      console.log('[Neural] Candidates in store:', candidates.length);
    }

    for (const pattern of candidates) {
      if (!pattern.embedding) {
        if (this.config.debug) {
          console.log('[Neural] Skipping pattern without embedding:', pattern.id);
        }
        continue;
      }

      const similarity = this.cosineSimilarity(embedding, pattern.embedding);
      const adjustedScore = similarity * (pattern.successRate || 0.5);

      if (this.config.debug && similarity > 0.3) {
        console.log(`[Neural] Pattern ${pattern.id}: similarity=${similarity.toFixed(3)}, adjusted=${adjustedScore.toFixed(3)}, threshold=${this.config.confidenceThreshold}`);
        console.log(`[Neural]   Pattern signature: ${pattern.signature}`);
      }

      if (adjustedScore >= this.config.confidenceThreshold * 0.5) { // Lower threshold for candidates
        matches.push({
          pattern,
          similarity,
          adjustedScore,
          confidence: adjustedScore
        });
      }
    }

    // Sort by adjusted score
    matches.sort((a, b) => b.adjustedScore - a.adjustedScore);

    if (this.config.debug) {
      console.log(`[Neural] Found ${matches.length} candidate matches, best confidence: ${matches[0]?.confidence?.toFixed(3) || 'none'}`);
    }

    return {
      signature,
      embedding,
      matches: matches.slice(0, 5), // Top 5 matches
      bestMatch: matches[0] || null
    };
  }

  /**
   * Main processing function
   */
  async process(input, type = 'lab') {
    await this.initialize();

    const startTime = performance.now();
    this.metrics.total++;

    try {
      // Parse input if needed
      let parsedData;
      if (typeof input === 'string' || input instanceof Blob) {
        parsedData = await this.parser.parse(input);
      } else {
        parsedData = input;
      }

      // Check for critical values - require higher confidence
      const hasCritical = parsedData.summary?.critical > 0;
      const threshold = hasCritical 
        ? this.config.criticalThreshold 
        : this.config.confidenceThreshold;

      // Find matching patterns
      const { signature, embedding, bestMatch } = await this.findMatches(parsedData, type);

      // Decide: local inference or API call
      if (bestMatch && bestMatch.confidence >= threshold) {
        // Use local inference
        const result = await this.localInference(parsedData, bestMatch);
        
        const elapsed = performance.now() - startTime;
        this.metrics.local++;
        this.metrics.localTime += elapsed;
        this.metrics.lastAnalysis = Date.now();

        // Record pattern usage
        this.patternStore.recordUsage(bestMatch.pattern.id);

        if (this.config.debug) {
          console.log(`[Neural] Local inference (${Math.round(elapsed)}ms, confidence: ${bestMatch.confidence.toFixed(2)})`);
        }

        return {
          result,
          meta: {
            source: 'local',
            confidence: bestMatch.confidence,
            patternId: bestMatch.pattern.id,
            time: Math.round(elapsed),
            signature
          },
          parsed: parsedData
        };

      } else {
        // Use API call
        const result = await this.apiInference(parsedData, type);
        
        const elapsed = performance.now() - startTime;
        this.metrics.api++;
        this.metrics.apiTime += elapsed;
        this.metrics.lastAnalysis = Date.now();

        // Learn from API response
        if (result && !result.error) {
          await this.learn(parsedData, embedding, result, type, signature);
        }

        if (this.config.debug) {
          console.log(`[Neural] API inference (${Math.round(elapsed)}ms)`);
        }

        return {
          result,
          meta: {
            source: 'api',
            confidence: bestMatch?.confidence || 0,
            time: Math.round(elapsed),
            signature,
            learned: true
          },
          parsed: parsedData
        };
      }

    } catch (error) {
      this.metrics.errors++;
      console.error('[Neural] Processing error:', error);
      
      return {
        result: null,
        error: error.message,
        meta: {
          source: 'error',
          time: Math.round(performance.now() - startTime)
        }
      };
    }
  }

  /**
   * Perform local inference using matched pattern
   */
  async localInference(data, match) {
    const template = match.pattern.template;
    const result = {
      problems: [],
      interpretations: {},
      plan: [],
      watchFor: [],
      source: 'local'
    };

    // Copy template interpretations
    if (template.interpretations) {
      result.interpretations = { ...template.interpretations };
    }

    // Generate problems from abnormal tests
    for (const [name, test] of Object.entries(data.tests || {})) {
      if (test.severity === 'critical' || test.severity === 'abnormal') {
        const templateInterp = template.interpretations?.[name];
        
        result.problems.push({
          title: `${name} ${test.status}`,
          severity: test.severity,
          value: test.latestValue,
          unit: test.unit,
          reference: test.reference,
          trend: test.trend,
          action: templateInterp?.action || this.getDefaultAction(name, test)
        });
      }
    }

    // Copy template plan or generate default
    if (template.plan?.length > 0) {
      result.plan = template.plan.map((item, idx) => ({
        problemRef: idx + 1,
        text: item.text || item
      }));
    } else {
      result.plan = result.problems.map((prob, idx) => ({
        problemRef: idx + 1,
        text: prob.action
      }));
    }

    // Copy template watch items or generate from clinical patterns
    if (template.watchFor?.length > 0) {
      result.watchFor = [...template.watchFor];
    } else if (data.clinicalPatterns?.length > 0) {
      result.watchFor = data.clinicalPatterns.map(p => p.suggestion);
    }

    return result;
  }

  /**
   * Get default action for a test abnormality
   */
  getDefaultAction(name, test) {
    const actions = {
      'critical': `URGENT: Address ${name} immediately, repeat stat`,
      'abnormal': `Monitor ${name}, repeat in 24-48 hours, correlate clinically`
    };

    return actions[test.severity] || `Review ${name} result`;
  }

  /**
   * Perform API inference (calls backend)
   */
  async apiInference(data, type) {
    if (!this.config.backendUrl) {
      // Return structured response from parsed data when no backend
      return this.generateLocalResponse(data);
    }

    try {
      const response = await fetch(this.config.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'interpret',
          text: this.parser.toAIPrompt(data),
          documentType: type,
          parsedData: data
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        return this.convertBackendResponse(result);
      } else {
        throw new Error(result.error || 'API request failed');
      }

    } catch (error) {
      console.error('[Neural] API call failed:', error);
      // Fallback to local response generation
      return this.generateLocalResponse(data);
    }
  }

  /**
   * Generate response locally when API unavailable
   * Enhanced to generate interpretations for ALL tests (not just abnormal)
   */
  generateLocalResponse(data) {
    const result = {
      problems: [],
      interpretations: {},
      plan: [],
      watchFor: [],
      source: 'local_generated'
    };

    // Generate interpretations for ALL tests (enables learning from normal values too)
    for (const [name, test] of Object.entries(data.tests || {})) {
      // Always create interpretation for learning purposes
      result.interpretations[name] = {
        status: test.status,
        severity: test.severity || 'normal',
        explanation: this.generateExplanation(name, test),
        value: test.latestValue,
        unit: test.unit,
        reference: test.reference,
        trend: test.trend
      };

      // Only add to problems if abnormal/critical
      if (test.severity === 'critical' || test.severity === 'abnormal') {
        result.problems.push({
          title: `${name} ${test.status}`,
          severity: test.severity,
          value: test.latestValue,
          unit: test.unit,
          reference: test.reference,
          trend: test.trend,
          action: this.getDefaultAction(name, test)
        });
      }
    }

    // Generate plan
    result.plan = result.problems.map((prob, idx) => ({
      problemRef: idx + 1,
      text: prob.action
    }));

    // Generate watch items from clinical patterns
    if (data.clinicalPatterns?.length > 0) {
      result.watchFor = data.clinicalPatterns.map(p => 
        `${p.name}: ${p.suggestion}`
      );
    }

    return result;
  }

  /**
   * Generate explanation for a test result
   * Enhanced to handle all statuses including normal
   */
  generateExplanation(name, test) {
    const status = test.status || 'normal';
    const severity = test.severity;
    const trend = test.trend;

    let explanation = '';
    
    if (status === 'normal') {
      explanation = `${name} is within normal range`;
    } else {
      explanation = `${name} is ${status}`;
    }
    
    if (severity === 'critical') {
      explanation += ' at critical levels requiring immediate attention';
    } else if (severity === 'abnormal') {
      explanation += ' and should be monitored';
    }
    
    if (trend && trend !== 'unknown' && trend !== 'stable') {
      const trendText = trend.replace('_', ' ');
      explanation += `, trending ${trendText}`;
    } else if (trend === 'stable') {
      explanation += ', stable';
    }

    return explanation;
  }

  /**
   * Convert backend response to standard format
   */
  convertBackendResponse(backendResult) {
    const result = {
      problems: [],
      interpretations: {},
      plan: [],
      watchFor: [],
      source: 'api'
    };

    // Handle ward presentation format
    if (backendResult.wardPresentation) {
      const wp = backendResult.wardPresentation;
      
      // Convert active issues to problems
      if (wp.activeIssues) {
        result.problems = wp.activeIssues.map(issue => ({
          title: issue.issue,
          severity: 'abnormal',
          status: issue.status,
          action: issue.action
        }));
      }

      // Convert today's plan
      if (wp.todaysPlan) {
        result.plan = wp.todaysPlan.map((item, idx) => ({
          problemRef: idx + 1,
          text: typeof item === 'string' ? item : item.text
        }));
      }

      // Convert watch for
      if (wp.watchFor) {
        result.watchFor = wp.watchFor;
      }

      return result;
    }

    // Handle standard interpretation format
    if (backendResult.interpretation) {
      // Extract problems from abnormalities
      if (backendResult.interpretation.abnormalities) {
        backendResult.interpretation.abnormalities.forEach((abn) => {
          const match = abn.match(/^(.+?)\s*\((\w+)\)\s*(?:→|->)\s*(.+)$/);
          if (match) {
            result.problems.push({
              title: match[1],
              severity: match[2].toLowerCase(),
              action: match[3]
            });
          } else {
            result.problems.push({
              title: abn,
              severity: 'moderate',
              action: 'Review and correlate clinically'
            });
          }
        });
      }

      // Extract interpretations from key findings
      if (backendResult.interpretation.keyFindings) {
        backendResult.interpretation.keyFindings.forEach(finding => {
          const match = finding.match(/^(\w+):\s*(.+?)\s*\((\w+)\)\s*-\s*(.+)$/);
          if (match) {
            result.interpretations[match[1]] = {
              value: match[2],
              status: match[3].toLowerCase(),
              explanation: match[4]
            };
          }
        });
      }
    }

    // Extract plan from recommendations
    if (backendResult.presentation?.recommendations) {
      result.plan = backendResult.presentation.recommendations.map((rec, idx) => ({
        problemRef: idx + 1,
        text: rec
      }));
    }

    // Extract watch for from clinical pearls
    if (backendResult.clinicalPearls) {
      result.watchFor = backendResult.clinicalPearls
        .filter(pearl => pearl.toLowerCase().includes('monitor') || pearl.toLowerCase().includes('watch'))
        .map(pearl => pearl.replace(/^(Monitor|Watch):\s*/i, ''));
    }

    return result;
  }

  /**
   * Learn from API response - extract and store patterns
   * Enhanced to learn from ALL tests with CONSISTENT signature format
   */
  async learn(data, embedding, result, type, signature) {
    if (this.config.debug) {
      console.log('[Neural] Learning new patterns...');
      console.log('[Neural] Overall signature:', signature);
      console.log('[Neural] Tests available:', Object.keys(data.tests || {}));
    }

    const patterns = [];
    const tests = data.tests || {};
    const interpretations = result.interpretations || {};

    // ALWAYS create the overall pattern FIRST - this is what will be matched
    // Using the SAME signature generated by generateSignature()
    const testCount = Object.keys(tests).length;
    if (testCount > 0) {
      // Build comprehensive interpretations from all tests
      const allInterpretations = {};
      for (const [name, test] of Object.entries(tests)) {
        allInterpretations[name] = interpretations[name] || {
          status: test.status,
          severity: test.severity || 'normal',
          explanation: this.generateExplanation(name, test)
        };
      }

      patterns.push({
        id: `pat_overall_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type,
        signature,  // Using the EXACT same signature from generateSignature()
        embedding,  // Using the EXACT same embedding
        template: {
          interpretations: allInterpretations,
          plan: result.plan || [],
          watchFor: result.watchFor || [],
          summary: data.summary
        },
        successRate: 1.0,
        usageCount: 0,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isOverallPattern: true,
        testCount
      });

      if (this.config.debug) {
        console.log('[Neural] Created overall pattern with signature:', signature);
      }
    }

    // Store patterns
    let storedCount = 0;
    for (const pattern of patterns) {
      try {
        this.patternStore.add(pattern);
        storedCount++;
      } catch (err) {
        console.warn(`[Neural] Failed to store pattern ${pattern.id}:`, err);
      }
    }

    // Persist to IndexedDB
    await this.saveKnowledge();

    if (this.config.debug) {
      console.log(`[Neural] Learned ${storedCount}/${patterns.length} patterns. Total in store: ${this.patternStore.size()}`);
    }
  }

  /**
   * Process feedback to adjust pattern success rates
   */
  async processFeedback(patternId, positive, correction = null) {
    const pattern = this.patternStore.get(patternId);
    if (!pattern) return;

    // Update success rate
    this.patternStore.updateSuccessRate(
      patternId, 
      positive, 
      this.config.positiveBoost, 
      this.config.negativePenalty
    );

    // If negative feedback with correction, create new pattern
    if (!positive && correction) {
      const correctedSig = `${pattern.signature}:corrected`;
      const correctedEmb = await this.embed(correctedSig);
      
      this.patternStore.add({
        id: `pat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: pattern.type,
        signature: correctedSig,
        embedding: correctedEmb,
        template: { 
          ...pattern.template, 
          ...correction,
          correctionOf: patternId
        },
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
      const db = await this.openDatabase();
      
      const patterns = await new Promise((resolve, reject) => {
        const transaction = db.transaction('patterns', 'readonly');
        const store = transaction.objectStore('patterns');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      for (const pattern of patterns) {
        this.patternStore.addDirect(pattern);
      }

      db.close();

      if (this.config.debug) {
        console.log(`[Neural] Loaded ${patterns.length} patterns from IndexedDB`);
      }

    } catch (error) {
      console.warn('[Neural] Could not load patterns:', error);
    }
  }

  /**
   * Save knowledge to IndexedDB
   */
  async saveKnowledge() {
    try {
      const db = await this.openDatabase();
      
      const transaction = db.transaction('patterns', 'readwrite');
      const store = transaction.objectStore('patterns');

      // Clear existing and add all current patterns
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = resolve;
        clearRequest.onerror = reject;
      });

      for (const pattern of this.patternStore.getAll()) {
        store.put(pattern);
      }

      await new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      });

      db.close();

    } catch (error) {
      console.warn('[Neural] Could not save patterns:', error);
    }
  }

  /**
   * Open IndexedDB database
   */
  openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('patterns')) {
          db.createObjectStore('patterns', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Clear all learned patterns
   */
  async clearKnowledge() {
    this.patternStore.clear();
    
    try {
      const db = await this.openDatabase();
      const transaction = db.transaction('patterns', 'readwrite');
      await new Promise((resolve, reject) => {
        const request = transaction.objectStore('patterns').clear();
        request.onsuccess = resolve;
        request.onerror = reject;
      });
      db.close();
    } catch (error) {
      console.warn('[Neural] Could not clear database:', error);
    }

    this.metrics = {
      total: 0,
      local: 0,
      api: 0,
      localTime: 0,
      apiTime: 0,
      errors: 0,
      lastAnalysis: null
    };

    if (this.config.debug) {
      console.log('[Neural] Knowledge cleared');
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const storeStats = this.patternStore.getStats();
    
    return {
      total: this.metrics.total,
      local: this.metrics.local,
      api: this.metrics.api,
      cacheHitRate: this.metrics.total > 0 
        ? ((this.metrics.local / this.metrics.total) * 100).toFixed(1) + '%' 
        : '0%',
      avgLocalMs: this.metrics.local > 0 
        ? Math.round(this.metrics.localTime / this.metrics.local) 
        : 0,
      avgApiMs: this.metrics.api > 0 
        ? Math.round(this.metrics.apiTime / this.metrics.api) 
        : 0,
      patterns: this.patternStore.size(),
      errors: this.metrics.errors,
      lastAnalysis: this.metrics.lastAnalysis,
      estimatedSavings: `$${(this.metrics.local * 0.003).toFixed(2)}`,
      ...storeStats
    };
  }

  /**
   * Export system state for debugging
   */
  exportState() {
    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      config: { ...this.config, apiKey: '[REDACTED]' },
      metrics: this.getMetrics(),
      patterns: this.patternStore.export()
    };
  }
}


// ==================== Exports ====================
// Browser global exports
if (typeof window !== 'undefined') {
  window.MedicalDocumentParser = MedicalDocumentParser;
  window.PatternStore = PatternStore;
  window.MedWardNeural = MedWardNeural;
}

// CommonJS exports for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    MedicalDocumentParser, 
    PatternStore, 
    MedWardNeural 
  };
}
