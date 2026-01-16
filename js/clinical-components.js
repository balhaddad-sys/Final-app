/**
 * MedWard Clinical Components v5.2 - Smart Separation Edition
 * Intelligently separates clinical findings from laboratory values
 * Handles mixed data from combined clinical notes + lab reports
 */

const ClinicalComponents = {
  
  renderDetailedView(results) {
    const container = document.getElementById('detailed-view');
    if (!container) return;
    if (!results) { container.innerHTML = this.renderEmpty(); return; }

    this.injectStyles();
    let html = '<div class="elite-report">';
    
    // SEVERITY HEADER
    const severity = this.determineSeverity(results);
    html += this.renderSeverityHeader(severity, results);
    
    // EXECUTIVE SUMMARY
    if (results.summary || results.rawResponse?.interpretation?.summary) {
      html += this.renderExecutiveSummary(results);
    }
    
    // CRITICAL ALERTS
    if (results.alerts && results.alerts.length > 0) {
      html += this.renderCriticalAlerts(results.alerts);
    }
    
    // Smart separation of lab values from clinical findings
    const { labValues, clinicalFindings } = this.smartSeparateFindings(results);
    
    // CLINICAL FINDINGS (symptoms, exam findings, impressions)
    if (clinicalFindings.length > 0) {
      html += this.renderClinicalFindings(clinicalFindings);
    }
    
    // LABORATORY VALUES (actual numeric results)
    if (labValues.length > 0) {
      html += this.renderLabValues(labValues);
    }
    
    // CLINICAL INTERPRETATION
    if (results.rawResponse?.interpretation) {
      html += this.renderClinicalInterpretation(results.rawResponse.interpretation);
    }
    
    // MANAGEMENT RECOMMENDATIONS
    if (results.recommendations && results.recommendations.length > 0) {
      html += this.renderManagementPlan(results.recommendations);
    }
    
    // CLINICAL PEARLS
    if (results.clinicalPearl) {
      html += this.renderClinicalPearl(results.clinicalPearl);
    }
    
    // PATIENT COMMUNICATION
    const patientExp = results.patientExplanation || results.rawResponse?.interpretation?.patientFriendly;
    if (patientExp) {
      html += this.renderPatientCommunication(patientExp);
    }
    
    // EXTRACTED DATA
    if (results.rawResponse?.extractedText) {
      html += this.renderExtractedData(results.rawResponse.extractedText);
    }
    
    // FOOTER
    html += this.renderReportFooter();
    html += '</div>';
    
    container.innerHTML = html;
    this.setupInteractions(container);
  },

  /**
   * SMART separation - handles mixed clinical + lab data
   */
  smartSeparateFindings(results) {
    const labValues = [];
    const clinicalFindings = [];
    
    // Strict lab patterns - must match these to be considered a lab
    const strictLabNames = [
      'glucose', 'gluc', 'urea', 'bun', 'creat', 'creatinine', 'egfr', 'gfr',
      'sodium', 'potassium', 'chloride', 'bicarbonate',
      'calcium', 'magnesium', 'phosphate', 'phosphorus', 'urate', 'uric',
      'alt', 'ast', 'ggt', 'alp', 'alk phos', 'alkaline', 'bilirubin', 'albumin', 'protein', 'globulin',
      'wbc', 'rbc', 'hemoglobin', 'hematocrit', 'platelet', 'plt', 'neutrophil', 'lymphocyte',
      'pt', 'ptt', 'aptt', 'inr', 'd-dimer', 'fibrinogen',
      'troponin', 'bnp', 'probnp', 'ck-mb', 'ck', 'ldh',
      'tsh', 't3', 't4', 'cortisol',
      'hba1c', 'a1c',
      'lactate', 'ammonia', 'lipase', 'amylase',
      'iron', 'ferritin', 'tibc', 'transferrin', 'b12', 'folate',
      'crp', 'esr', 'procalcitonin', 'pct'
    ];
    
    // ABG/VBG specific - only lab if in proper format
    const abgParams = ['ph', 'pco2', 'po2', 'hco3', 'sao2', 'fio2', 'base excess', 'be'];
    
    // Electrolyte abbreviations that need number context
    const electrolyteAbbrevs = ['na', 'k', 'cl', 'co2', 'ca', 'mg', 'phos'];
    
    // Clinical keywords - if text contains these, it's likely clinical
    const clinicalKeywords = [
      'dyspnea', 'orthopnea', 'pnd', 'edema', 'swelling', 'pain', 'discomfort',
      'nausea', 'vomiting', 'fever', 'cough', 'wheeze', 'crackles', 'rales',
      'murmur', 'gallop', 'jvp', 'jvd', 'hepatomegaly', 'ascites',
      'confusion', 'lethargy', 'weakness', 'fatigue', 'malaise',
      'examination', 'physical exam', 'on exam', 'inspection', 'palpation', 'auscultation',
      'history', 'presenting', 'complaint', 'symptom', 'sign',
      'diagnosis', 'impression', 'assessment', 'differential',
      'nyha', 'class', 'grade', 'stage', 'severity',
      'bilateral', 'unilateral', 'diffuse', 'localized',
      'acute', 'chronic', 'subacute', 'progressive',
      'decompensated', 'compensated', 'stable', 'unstable',
      'secondary to', 'due to', 'consistent with', 'suggestive of',
      'rule out', 'r/o', 'likely', 'possible', 'probable',
      'intervention', 'requiring', 'needs', 'recommend',
      'hypoxemia', 'hypoxia', 'hypotension', 'hypertension', 'tachycardia', 'bradycardia',
      'congestion', 'overload', 'failure', 'insufficiency', 'dysfunction'
    ];

    /**
     * Check if text is a lab value
     */
    const isLabValue = (text) => {
      const lower = text.toLowerCase();
      
      // Must have a number
      const hasNumber = /\d+(\.\d+)?/.test(text);
      if (!hasNumber) return false;
      
      // Check for strict lab names
      for (const labName of strictLabNames) {
        if (lower.includes(labName)) {
          // Make sure it's not buried in clinical context
          const clinicalScore = clinicalKeywords.filter(k => lower.includes(k)).length;
          if (clinicalScore <= 1) return true;
        }
      }
      
      // Check for electrolyte abbreviations with proper format (e.g., "Na 132" or "K: 4.5")
      for (const abbrev of electrolyteAbbrevs) {
        const pattern = new RegExp(`\\b${abbrev}\\s*[:\\*]?\\s*\\d`, 'i');
        if (pattern.test(text) && text.length < 50) return true;
      }
      
      // Check for ABG parameters with values
      for (const param of abgParams) {
        const pattern = new RegExp(`\\b${param}\\s*[:\\*]?\\s*\\d`, 'i');
        if (pattern.test(text) && text.length < 50) return true;
      }
      
      // Check for lab result format: "Name: Value Unit (Reference)" or "Name Value H/L"
      if (/^[A-Za-z\s\.\-]+\s*[:\*]?\s*[<>]?\d+(\.\d+)?\s*[A-Za-z\/\%]*\s*(H|HH|L|LL|High|Low|Normal)?\s*(\([^)]+\))?$/i.test(text)) {
        return text.length < 80; // Lab results are usually concise
      }
      
      return false;
    };

    /**
     * Check if text is clinical finding
     */
    const isClinicalFinding = (text) => {
      const lower = text.toLowerCase();
      
      // High clinical keyword density = clinical finding
      const clinicalScore = clinicalKeywords.filter(k => lower.includes(k)).length;
      if (clinicalScore >= 2) return true;
      
      // Long descriptive text is usually clinical
      if (text.length > 100) return true;
      
      // Contains clinical sentence patterns
      if (lower.includes(' with ') || lower.includes(' due to ') || lower.includes(' secondary to ')) return true;
      if (lower.includes(' - ') && lower.length > 50) return true; // "Finding - Interpretation" pattern
      
      return false;
    };

    /**
     * Parse a lab value from text
     */
    const parseLabFromText = (text) => {
      let name = '', value = '', reference = '-', status = 'normal', unit = '';
      
      // Try to extract reference range
      const refMatch = text.match(/\(([^)]+)\)/);
      if (refMatch) {
        const refText = refMatch[1].toLowerCase();
        if (refText.includes('markedly') || refText.includes('critical') || refText.includes('severe')) {
          status = 'critical';
        } else if (refText.includes('elevated') || refText.includes('high') || refText.includes('>')) {
          status = 'high';
        } else if (refText.includes('low') || refText.includes('decreased') || refText.includes('<')) {
          status = 'low';
        }
        // Check if it looks like a reference range (has numbers)
        if (/\d/.test(refMatch[1])) {
          reference = refMatch[1];
        }
      }
      
      // Check for H/L flags
      if (/\s(HH|H)\b/i.test(text)) status = status === 'normal' ? 'high' : status;
      if (/\s(LL|L)\b/i.test(text)) status = status === 'normal' ? 'low' : status;
      
      // Extract name and value
      // Pattern 1: "Name: Value Unit"
      let match = text.match(/^([A-Za-z][A-Za-z\s\.\-\/]*?)\s*[:\*]\s*([<>]?\d+(?:\.\d+)?)\s*([A-Za-z\/\%\^0-9]*)?/i);
      if (match) {
        name = match[1].trim();
        value = match[2];
        unit = match[3] || '';
      } else {
        // Pattern 2: "Name Value Unit"
        match = text.match(/^([A-Za-z][A-Za-z\s\.\-\/]*?)\s+([<>]?\d+(?:\.\d+)?)\s*([A-Za-z\/\%\^0-9]*)?/i);
        if (match) {
          name = match[1].trim();
          value = match[2];
          unit = match[3] || '';
        } else {
          // Fallback
          const numMatch = text.match(/([<>]?\d+(?:\.\d+)?)/);
          if (numMatch) {
            value = numMatch[1];
            name = text.replace(numMatch[0], '').replace(/\([^)]+\)/g, '').trim();
          }
        }
      }
      
      // Clean up name
      name = name.replace(/[:\*\s]+$/, '').trim();
      if (name.length > 40) name = name.substring(0, 40) + '...';
      
      // Format value with unit
      const displayValue = unit ? `${value} ${unit}`.trim() : value;
      
      return {
        name: name || 'Unknown',
        value: displayValue || '-',
        reference: reference,
        status: status,
        statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
        isAbnormal: status !== 'normal'
      };
    };

    // Process abnormalities from interpretation
    const abnormalities = results.rawResponse?.interpretation?.abnormalities || [];
    
    abnormalities.forEach(item => {
      const text = typeof item === 'string' ? item : (item.finding || item.text || '');
      if (!text) return;
      
      if (isLabValue(text) && !isClinicalFinding(text)) {
        labValues.push(parseLabFromText(text));
      } else {
        clinicalFindings.push({
          finding: text,
          type: this.classifyClinicalFinding(text)
        });
      }
    });
    
    // Process findings array
    if (results.findings) {
      results.findings.forEach(f => {
        const name = f.name || '';
        const value = f.value || '';
        const combined = value ? `${name}: ${value}` : name;
        
        if (isLabValue(combined) && !isClinicalFinding(combined)) {
          if (!labValues.find(l => l.name.toLowerCase() === name.toLowerCase())) {
            labValues.push({
              name: name,
              value: value || '-',
              reference: f.reference || '-',
              status: f.status || 'normal',
              statusLabel: f.status || 'Normal',
              isAbnormal: f.status?.toLowerCase() !== 'normal'
            });
          }
        } else if (name) {
          clinicalFindings.push({
            finding: name,
            value: value && value !== '-' ? value : null,
            type: this.classifyClinicalFinding(name)
          });
        }
      });
    }
    
    // Extract additional labs from raw text
    if (results.rawResponse?.extractedText) {
      const extractedLabs = this.extractLabsFromRawText(results.rawResponse.extractedText);
      extractedLabs.forEach(lab => {
        if (!labValues.find(l => l.name.toLowerCase() === lab.name.toLowerCase())) {
          labValues.push(lab);
        }
      });
    }
    
    return { labValues, clinicalFindings };
  },

  /**
   * Extract labs from raw text using pattern matching
   */
  extractLabsFromRawText(text) {
    const labs = [];
    
    // Define lab patterns with reference ranges
    const labDefs = [
      { name: 'Glucose', pattern: /glucose\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L|mg\/dL)?/i, ref: '4.1-5.6 mmol/L' },
      { name: 'Urea', pattern: /\burea\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '2.8-7.2 mmol/L' },
      { name: 'Creatinine', pattern: /creat(?:inine)?\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '64-104 μmol/L' },
      { name: 'Sodium', pattern: /\b(?:na|sodium)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '136-146 mmol/L' },
      { name: 'Potassium', pattern: /\b(?:k|potassium)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '3.5-5.1 mmol/L' },
      { name: 'Chloride', pattern: /\b(?:cl|chloride)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '98-107 mmol/L' },
      { name: 'CO2', pattern: /\bco2\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '22-29 mmol/L' },
      { name: 'Calcium', pattern: /\b(?:ca|calcium)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '2.1-2.6 mmol/L' },
      { name: 'Magnesium', pattern: /\b(?:mg|magnesium)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '0.73-1.06 mmol/L' },
      { name: 'Phosphate', pattern: /phos(?:phate)?\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '0.81-1.45 mmol/L' },
      { name: 'ALT', pattern: /\balt\s*[:\*]?\s*([<>]?\d+)/i, ref: '0-41 IU/L' },
      { name: 'AST', pattern: /\bast\s*[:\*]?\s*([<>]?\d+)/i, ref: '0-40 IU/L' },
      { name: 'GGT', pattern: /\bggt\s*[:\*]?\s*(\d+)/i, ref: '8-61 IU/L' },
      { name: 'Alk Phos', pattern: /alk(?:aline)?\.?\s*phos(?:phatase)?\s*[:\*]?\s*(\d+)/i, ref: '40-129 IU/L' },
      { name: 'Total Bilirubin', pattern: /t\.?\s*bil(?:irubin)?\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '5-21 μmol/L' },
      { name: 'Direct Bilirubin', pattern: /d\.?\s*bil(?:irubin)?\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '0-3.4 μmol/L' },
      { name: 'Albumin', pattern: /albumin\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '35-52 g/L' },
      { name: 'Total Protein', pattern: /t(?:otal)?\.?\s*protein\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '66-83 g/L' },
      { name: 'WBC', pattern: /\bwbc\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '4.5-11.0 ×10⁹/L' },
      { name: 'Hemoglobin', pattern: /\b(?:hb|hgb|hemoglobin)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '130-170 g/L' },
      { name: 'Platelets', pattern: /\b(?:plt|platelet)\s*[:\*]?\s*(\d+)/i, ref: '150-400 ×10⁹/L' },
      { name: 'PT', pattern: /\bpt\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(?:sec|seconds)?/i, ref: '9.6-13.6 sec' },
      { name: 'INR', pattern: /\binr\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '0.85-1.15' },
      { name: 'APTT', pattern: /\baptt\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '25-37 sec' },
      { name: 'Troponin', pattern: /troponin\s*[I]?\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '0-19.8 ng/L' },
      { name: 'NT-proBNP', pattern: /(?:nt-?)?probnp\s*[:\*]?\s*(\d+)/i, ref: 'Age-dependent' },
      { name: 'pH', pattern: /\bph\s*[:\*]?\s*(7\.\d+)/i, ref: '7.35-7.45' },
      { name: 'pCO2', pattern: /pco2\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '35-45 mmHg' },
      { name: 'HCO3', pattern: /hco3\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '22-26 mmol/L' },
      { name: 'Lactate', pattern: /lactate\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '0.5-2.2 mmol/L' },
      { name: 'eGFR', pattern: /egfr\s*[:\*]?\s*(\d+)/i, ref: '>60 mL/min' },
      { name: 'Anion Gap', pattern: /anion\s*gap\s*[:\*]?\s*(\d+(?:\.\d+)?)/i, ref: '8-16 mmol/L' },
      { name: 'Urate', pattern: /urate\s*[:\*]?\s*(\d+)/i, ref: '208-428 μmol/L' }
    ];
    
    labDefs.forEach(def => {
      const match = text.match(def.pattern);
      if (match) {
        const value = match[1];
        // Look for H/L flag near the match
        const context = text.substring(Math.max(0, match.index - 10), match.index + match[0].length + 10);
        let status = 'normal';
        if (/\sHH?\b/i.test(context)) status = 'high';
        else if (/\sLL?\b/i.test(context)) status = 'low';
        
        labs.push({
          name: def.name,
          value: value,
          reference: def.ref,
          status: status,
          statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
          isAbnormal: status !== 'normal'
        });
      }
    });
    
    return labs;
  },

  /**
   * Classify clinical finding type
   */
  classifyClinicalFinding(text) {
    const t = text.toLowerCase();
    if (t.includes('dyspnea') || t.includes('breath') || t.includes('resp') || t.includes('cough') || t.includes('wheez') || t.includes('crackle') || t.includes('spo2') || t.includes('hypox') || t.includes('pulmonary')) return 'respiratory';
    if (t.includes('chest') || t.includes('cardiac') || t.includes('heart') || t.includes('bp') || t.includes('pressure') || t.includes('nyha') || t.includes('edema') || t.includes('jvp') || t.includes('murmur')) return 'cardiovascular';
    if (t.includes('abdom') || t.includes('hepat') || t.includes('liver') || t.includes('nausea') || t.includes('vomit') || t.includes('oral') || t.includes('appetite') || t.includes('gi') || t.includes('bowel')) return 'gastrointestinal';
    if (t.includes('neuro') || t.includes('conscious') || t.includes('gcs') || t.includes('orient') || t.includes('mental')) return 'neurological';
    if (t.includes('renal') || t.includes('kidney') || t.includes('urin') || t.includes('aki') || t.includes('ckd') || t.includes('oligur')) return 'renal';
    if (t.includes('exam') || t.includes('physical') || t.includes('bilateral') || t.includes('pitting') || t.includes('inspect') || t.includes('auscult') || t.includes('palpat')) return 'examination';
    if (t.includes('impression') || t.includes('diagnosis') || t.includes('assessment') || t.includes('differential')) return 'impression';
    return 'general';
  },

  /**
   * Render clinical findings
   */
  renderClinicalFindings(findings) {
    const grouped = {};
    findings.forEach(f => {
      const type = f.type || 'general';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(f);
    });
    
    const typeConfig = {
      respiratory: { label: 'Respiratory', icon: '🫁', color: '#06b6d4' },
      cardiovascular: { label: 'Cardiovascular', icon: '❤️', color: '#ef4444' },
      gastrointestinal: { label: 'Gastrointestinal', icon: '🔶', color: '#f59e0b' },
      neurological: { label: 'Neurological', icon: '🧠', color: '#8b5cf6' },
      renal: { label: 'Renal', icon: '💧', color: '#3b82f6' },
      examination: { label: 'Physical Examination', icon: '🩺', color: '#10b981' },
      impression: { label: 'Clinical Impression', icon: '📋', color: '#f43f5e' },
      general: { label: 'General Findings', icon: '📝', color: '#6b7280' }
    };
    
    let html = `
      <div class="clinical-findings-section">
        <div class="section-header-bar">
          <div class="section-header-icon gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="2"/>
              <path d="M9 14l2 2 4-4"/>
            </svg>
          </div>
          <div>
            <h3>Clinical Assessment</h3>
            <span class="section-subtitle">${findings.length} findings documented</span>
          </div>
        </div>
        <div class="findings-grid">
    `;
    
    // Order: impression first, then by system
    const order = ['impression', 'cardiovascular', 'respiratory', 'renal', 'gastrointestinal', 'neurological', 'examination', 'general'];
    
    for (const type of order) {
      const items = grouped[type];
      if (!items || items.length === 0) continue;
      
      const config = typeConfig[type];
      
      html += `
        <div class="finding-category" style="border-left-color: ${config.color};">
          <div class="finding-category-header">
            <span class="finding-category-icon">${config.icon}</span>
            <span class="finding-category-label" style="color: ${config.color};">${config.label}</span>
          </div>
          <ul class="finding-list">
            ${items.map(item => `
              <li class="finding-item">
                <span class="finding-bullet" style="background: ${config.color};"></span>
                <div class="finding-content">
                  <span class="finding-text">${this.escapeHtml(item.finding)}</span>
                  ${item.value ? `<span class="finding-value">${this.escapeHtml(item.value)}</span>` : ''}
                </div>
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }
    
    html += '</div></div>';
    return html;
  },

  /**
   * Render laboratory values
   */
  renderLabValues(labs) {
    if (labs.length === 0) return '';
    
    const categories = this.categorizeLabData(labs);
    let html = '';
    
    // Order categories logically
    const order = ['Blood Gas', 'Cardiac Markers', 'Renal Function', 'Electrolytes', 'Liver Function', 'Hematology', 'Coagulation', 'Other'];
    
    for (const category of order) {
      const items = categories[category];
      if (!items || items.length === 0) continue;
      html += this.renderLabCategory(category, items);
    }
    
    return html;
  },

  /**
   * Categorize lab data
   */
  categorizeLabData(labs) {
    const categories = {
      'Renal Function': [],
      'Electrolytes': [],
      'Liver Function': [],
      'Cardiac Markers': [],
      'Hematology': [],
      'Coagulation': [],
      'Blood Gas': [],
      'Other': []
    };
    
    const map = {
      'urea': 'Renal Function', 'creat': 'Renal Function', 'egfr': 'Renal Function', 'gfr': 'Renal Function', 'bun': 'Renal Function',
      'sodium': 'Electrolytes', 'potassium': 'Electrolytes', 'chloride': 'Electrolytes', 'bicarbonate': 'Electrolytes',
      'calcium': 'Electrolytes', 'magnesium': 'Electrolytes', 'phosphate': 'Electrolytes', 'phosphorus': 'Electrolytes', 'anion': 'Electrolytes', 'urate': 'Electrolytes',
      'alt': 'Liver Function', 'ast': 'Liver Function', 'ggt': 'Liver Function', 'alk': 'Liver Function', 'phos': 'Liver Function',
      'bilirubin': 'Liver Function', 'albumin': 'Liver Function', 'protein': 'Liver Function', 'globulin': 'Liver Function',
      'troponin': 'Cardiac Markers', 'bnp': 'Cardiac Markers', 'probnp': 'Cardiac Markers', 'ck': 'Cardiac Markers', 'ldh': 'Cardiac Markers',
      'wbc': 'Hematology', 'rbc': 'Hematology', 'hemoglobin': 'Hematology', 'hematocrit': 'Hematology', 'platelet': 'Hematology', 'neutrophil': 'Hematology', 'lymphocyte': 'Hematology',
      'pt': 'Coagulation', 'inr': 'Coagulation', 'aptt': 'Coagulation', 'ptt': 'Coagulation', 'fibrinogen': 'Coagulation', 'd-dimer': 'Coagulation',
      'ph': 'Blood Gas', 'pco2': 'Blood Gas', 'po2': 'Blood Gas', 'hco3': 'Blood Gas', 'lactate': 'Blood Gas', 'sao2': 'Blood Gas', 'fio2': 'Blood Gas', 'base': 'Blood Gas'
    };
    
    labs.forEach(lab => {
      const nameLower = lab.name.toLowerCase();
      let assigned = false;
      for (const [key, category] of Object.entries(map)) {
        if (nameLower.includes(key)) {
          categories[category].push(lab);
          assigned = true;
          break;
        }
      }
      if (!assigned) categories['Other'].push(lab);
    });
    
    return categories;
  },

  /**
   * Render a lab category
   */
  renderLabCategory(category, labs) {
    const colors = {
      'Renal Function': { bg: '#3b82f6', light: 'rgba(59, 130, 246, 0.15)' },
      'Electrolytes': { bg: '#8b5cf6', light: 'rgba(139, 92, 246, 0.15)' },
      'Liver Function': { bg: '#f59e0b', light: 'rgba(245, 158, 11, 0.15)' },
      'Cardiac Markers': { bg: '#ef4444', light: 'rgba(239, 68, 68, 0.15)' },
      'Hematology': { bg: '#ec4899', light: 'rgba(236, 72, 153, 0.15)' },
      'Coagulation': { bg: '#14b8a6', light: 'rgba(20, 184, 166, 0.15)' },
      'Blood Gas': { bg: '#06b6d4', light: 'rgba(6, 182, 212, 0.15)' },
      'Other': { bg: '#6b7280', light: 'rgba(107, 114, 128, 0.15)' }
    };
    
    const color = colors[category] || colors['Other'];
    const abnormalCount = labs.filter(l => l.isAbnormal).length;
    
    return `
      <div class="lab-category-section">
        <div class="lab-category-header" style="border-left: 4px solid ${color.bg};">
          <div class="lab-category-title">
            <div class="lab-category-icon" style="background: ${color.light}; color: ${color.bg};">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <h3>${category}</h3>
              <span class="lab-category-count">${labs.length} tests${abnormalCount > 0 ? ` · <span class="abnormal-count">${abnormalCount} abnormal</span>` : ''}</span>
            </div>
          </div>
        </div>
        <table class="lab-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Result</th>
              <th>Reference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${labs.map(lab => {
              const sc = this.getStatusClass(lab.status);
              return `
                <tr class="${lab.isAbnormal ? 'abnormal-row' : ''}">
                  <td class="lab-name">${this.escapeHtml(lab.name)}</td>
                  <td class="lab-value ${sc}">${this.escapeHtml(lab.value)}</td>
                  <td class="lab-reference">${this.escapeHtml(lab.reference)}</td>
                  <td><span class="lab-status ${sc}">${sc === 'high' || sc === 'critical' ? '↑' : sc === 'low' ? '↓' : '•'} ${this.escapeHtml(lab.statusLabel)}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  injectStyles() {
    if (document.getElementById('elite-styles-v52')) return;
    const s = document.createElement('style');
    s.id = 'elite-styles-v52';
    s.textContent = `
      .elite-report{font-family:'Outfit',-apple-system,BlinkMacSystemFont,sans-serif;color:rgba(255,255,255,0.9);line-height:1.6}
      .severity-header{position:relative;padding:1.25rem 1.5rem;border-radius:14px;margin-bottom:1.25rem;overflow:hidden}
      .severity-header::before{content:'';position:absolute;inset:0;opacity:0.03;background:repeating-linear-gradient(-45deg,transparent,transparent 10px,currentColor 10px,currentColor 11px)}
      .severity-header.critical{background:linear-gradient(135deg,rgba(220,38,38,0.15) 0%,rgba(185,28,28,0.08) 100%);border:1px solid rgba(220,38,38,0.3);color:#fca5a5}
      .severity-header.abnormal{background:linear-gradient(135deg,rgba(217,119,6,0.12) 0%,rgba(180,83,9,0.06) 100%);border:1px solid rgba(217,119,6,0.3);color:#fcd34d}
      .severity-header.normal{background:linear-gradient(135deg,rgba(5,150,105,0.12) 0%,rgba(4,120,87,0.06) 100%);border:1px solid rgba(5,150,105,0.3);color:#6ee7b7}
      .severity-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.75rem;border-radius:100px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.6rem}
      .severity-header.critical .severity-badge{background:rgba(220,38,38,0.2);color:#fca5a5;animation:pulse 2s ease-in-out infinite}
      .severity-header.abnormal .severity-badge{background:rgba(217,119,6,0.2);color:#fcd34d}
      .severity-header.normal .severity-badge{background:rgba(5,150,105,0.2);color:#6ee7b7}
      @keyframes pulse{0%,100%{box-shadow:0 0 15px rgba(220,38,38,0.3)}50%{box-shadow:0 0 25px rgba(220,38,38,0.5)}}
      .severity-title{font-family:'Playfair Display',Georgia,serif;font-size:1.15rem;font-weight:600;margin:0;line-height:1.3}
      .exec-summary{background:linear-gradient(180deg,rgba(30,58,95,0.3) 0%,rgba(30,58,95,0.1) 100%);border:1px solid rgba(96,165,250,0.15);border-radius:14px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;position:relative}
      .exec-summary::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6 0%,#93c5fd 100%);border-radius:14px 14px 0 0}
      .section-label{display:flex;align-items:center;gap:0.4rem;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.5);margin-bottom:0.75rem}
      .section-label svg{width:13px;height:13px;opacity:0.7}
      .exec-summary-text{font-size:0.9rem;line-height:1.65;color:rgba(255,255,255,0.85)}
      .alert-section{margin-bottom:1.25rem}
      .elite-alert{display:flex;gap:0.875rem;padding:0.875rem 1rem;border-radius:10px;margin-bottom:0.5rem;position:relative;overflow:hidden}
      .elite-alert::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px}
      .elite-alert.critical{background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.2)}
      .elite-alert.critical::before{background:#dc2626}
      .elite-alert.warning{background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.2)}
      .elite-alert.warning::before{background:#d97706}
      .alert-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .elite-alert.critical .alert-icon{background:rgba(220,38,38,0.2);color:#fca5a5}
      .elite-alert.warning .alert-icon{background:rgba(217,119,6,0.2);color:#fcd34d}
      .alert-icon svg{width:16px;height:16px}
      .alert-body{flex:1;min-width:0}
      .alert-title{font-weight:600;font-size:0.85rem;margin-bottom:0.1rem}
      .elite-alert.critical .alert-title{color:#fca5a5}
      .elite-alert.warning .alert-title{color:#fcd34d}
      .alert-desc{font-size:0.8rem;color:rgba(255,255,255,0.7);line-height:1.4}
      .clinical-findings-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:1.25rem}
      .section-header-bar{display:flex;align-items:center;gap:0.65rem;padding:0.875rem 1.25rem;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.06)}
      .section-header-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center}
      .section-header-icon.gold{background:linear-gradient(135deg,#f0c674 0%,#d4a843 100%)}
      .section-header-icon svg{width:18px;height:18px;color:#0a0a0f}
      .section-header-bar h3{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;margin:0}
      .section-subtitle{font-size:0.7rem;color:rgba(255,255,255,0.5)}
      .findings-grid{padding:0.875rem;display:grid;gap:0.75rem}
      .finding-category{background:rgba(0,0,0,0.2);border-radius:10px;padding:0.875rem;border-left:3px solid #6b7280}
      .finding-category-header{display:flex;align-items:center;gap:0.4rem;margin-bottom:0.6rem}
      .finding-category-icon{font-size:0.9rem}
      .finding-category-label{font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em}
      .finding-list{list-style:none;margin:0;padding:0}
      .finding-item{display:flex;align-items:flex-start;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.04)}
      .finding-item:last-child{border-bottom:none}
      .finding-bullet{width:5px;height:5px;border-radius:50%;margin-top:0.45rem;flex-shrink:0}
      .finding-content{flex:1}
      .finding-text{font-size:0.85rem;color:rgba(255,255,255,0.85);line-height:1.45}
      .finding-value{display:inline-block;font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:#4ecdc4;margin-left:0.5rem;padding:0.1rem 0.4rem;background:rgba(78,205,196,0.1);border-radius:4px}
      .lab-category-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:1rem}
      .lab-category-header{display:flex;align-items:center;padding:0.875rem 1.25rem;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.06)}
      .lab-category-title{display:flex;align-items:center;gap:0.65rem}
      .lab-category-icon{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center}
      .lab-category-icon svg{width:18px;height:18px}
      .lab-category-title h3{font-family:'Playfair Display',Georgia,serif;font-size:0.95rem;font-weight:600;margin:0}
      .lab-category-count{font-size:0.65rem;color:rgba(255,255,255,0.5)}
      .abnormal-count{color:#fca5a5}
      .lab-table{width:100%;border-collapse:collapse}
      .lab-table thead th{padding:0.6rem 0.875rem;text-align:left;font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.4);background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.06)}
      .lab-table tbody tr{transition:background 0.15s ease}
      .lab-table tbody tr:hover{background:rgba(255,255,255,0.02)}
      .lab-table tbody tr.abnormal-row{background:rgba(239,68,68,0.04)}
      .lab-table tbody tr.abnormal-row:hover{background:rgba(239,68,68,0.07)}
      .lab-table tbody td{padding:0.55rem 0.875rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem}
      .lab-table tbody tr:last-child td{border-bottom:none}
      .lab-name{font-weight:500;color:rgba(255,255,255,0.9)}
      .lab-value{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:0.8rem}
      .lab-value.high,.lab-value.critical{color:#fca5a5}
      .lab-value.low{color:#93c5fd}
      .lab-value.normal{color:#6ee7b7}
      .lab-reference{font-size:0.65rem;color:rgba(255,255,255,0.4);font-family:monospace}
      .lab-status{display:inline-flex;align-items:center;gap:0.2rem;padding:0.15rem 0.4rem;border-radius:5px;font-size:0.55rem;font-weight:600;text-transform:uppercase}
      .lab-status.high,.lab-status.critical{background:rgba(220,38,38,0.15);color:#fca5a5}
      .lab-status.low{background:rgba(59,130,246,0.15);color:#93c5fd}
      .lab-status.normal{background:rgba(5,150,105,0.1);color:#6ee7b7}
      .interpretation-panel{background:linear-gradient(135deg,rgba(139,92,246,0.08) 0%,rgba(109,40,217,0.04) 100%);border:1px solid rgba(139,92,246,0.2);border-radius:14px;padding:1.25rem 1.5rem;margin-bottom:1.25rem;position:relative}
      .interpretation-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#8b5cf6 0%,#a78bfa 100%);border-radius:14px 14px 0 0}
      .interpretation-title{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;color:#c4b5fd;margin-bottom:0.875rem;display:flex;align-items:center;gap:0.5rem}
      .interpretation-title svg{width:18px;height:18px;opacity:0.8}
      .interpretation-content{font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.8)}
      .interpretation-action{margin-top:1rem;padding:0.875rem 1rem;background:rgba(139,92,246,0.1);border-radius:8px;border-left:3px solid #8b5cf6}
      .action-label{font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#a78bfa;margin-bottom:0.3rem}
      .action-text{font-size:0.8rem;color:rgba(255,255,255,0.85);line-height:1.45}
      .management-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:1.25rem}
      .management-header{display:flex;align-items:center;gap:0.65rem;padding:0.875rem 1.25rem;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.06)}
      .management-icon{width:36px;height:36px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:9px;display:flex;align-items:center;justify-content:center}
      .management-icon svg{width:18px;height:18px;color:white}
      .management-header h3{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;margin:0}
      .management-list{padding:0.4rem}
      .management-item{display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem 0.875rem;border-radius:8px;transition:all 0.15s ease;margin-bottom:0.2rem}
      .management-item:hover{background:rgba(255,255,255,0.02)}
      .management-item.priority{background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.12)}
      .management-num{width:24px;height:24px;background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0.05) 100%);border:1px solid rgba(255,255,255,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.7);flex-shrink:0}
      .management-item.priority .management-num{background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-color:transparent;color:white}
      .management-text{font-size:0.8rem;line-height:1.45;color:rgba(255,255,255,0.8);flex:1}
      .pearl-section{background:linear-gradient(135deg,rgba(251,191,36,0.08) 0%,rgba(245,158,11,0.04) 100%);border:1px solid rgba(251,191,36,0.2);border-radius:14px;padding:1rem 1.25rem;margin-bottom:1.25rem;position:relative}
      .pearl-section::before{content:'💎';position:absolute;top:-10px;left:1.25rem;font-size:1.1rem;background:var(--surface,#12121a);padding:0 0.4rem}
      .pearl-label{font-size:0.55rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#fbbf24;margin-bottom:0.4rem}
      .pearl-text{font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.85);font-style:italic}
      .patient-section{background:linear-gradient(135deg,rgba(6,182,212,0.08) 0%,rgba(8,145,178,0.04) 100%);border:1px solid rgba(6,182,212,0.2);border-radius:14px;padding:1.25rem 1.5rem;margin-bottom:1.25rem}
      .patient-header{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem}
      .patient-icon{width:28px;height:28px;background:rgba(6,182,212,0.2);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#22d3ee}
      .patient-icon svg{width:14px;height:14px}
      .patient-label{font-size:0.65rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#22d3ee}
      .patient-text{font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.8)}
      .extracted-section{border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;margin-bottom:1.25rem}
      .extracted-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;padding:0.875rem 1rem;background:rgba(255,255,255,0.02);border:none;color:rgba(255,255,255,0.6);font-family:inherit;font-size:0.8rem;cursor:pointer;transition:all 0.15s ease}
      .extracted-trigger:hover{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8)}
      .extracted-trigger svg{width:16px;height:16px;transition:transform 0.25s ease}
      .extracted-trigger.open svg{transform:rotate(180deg)}
      .extracted-content{display:none;padding:0.875rem 1rem;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06)}
      .extracted-content.show{display:block}
      .extracted-pre{font-family:monospace;font-size:0.65rem;line-height:1.5;color:rgba(255,255,255,0.6);white-space:pre-wrap;word-break:break-word;max-height:250px;overflow-y:auto;margin:0}
      .report-footer{display:flex;align-items:center;justify-content:space-between;padding:0.875rem 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:0.875rem}
      .footer-brand{display:flex;align-items:center;gap:0.4rem;font-size:0.65rem;color:rgba(255,255,255,0.4)}
      .footer-brand svg{width:14px;height:14px;opacity:0.5}
      .footer-timestamp{font-size:0.6rem;font-family:monospace;color:rgba(255,255,255,0.3)}
      @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      .elite-report>*{animation:fadeIn 0.35s ease forwards}
      .elite-report>*:nth-child(1){animation-delay:0s}
      .elite-report>*:nth-child(2){animation-delay:0.04s}
      .elite-report>*:nth-child(3){animation-delay:0.08s}
      .elite-report>*:nth-child(4){animation-delay:0.12s}
      .elite-report>*:nth-child(5){animation-delay:0.16s}
      .elite-report>*:nth-child(6){animation-delay:0.2s}
      .elite-report>*:nth-child(7){animation-delay:0.24s}
    `;
    document.head.appendChild(s);
  },

  determineSeverity(results) {
    const t = JSON.stringify(results).toLowerCase();
    if (t.includes('critical') || t.includes('emergency') || t.includes('immediate') || t.includes('severe')) return 'critical';
    if (t.includes('abnormal') || t.includes('elevated') || t.includes('high') || t.includes('low') || t.includes('decompensated')) return 'abnormal';
    return 'normal';
  },

  renderSeverityHeader(severity, results) {
    const icons = { critical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', abnormal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>', normal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' };
    const header = results.rawResponse?.interpretation?.header || results.diagnosis || 'Clinical Analysis';
    return `<div class="severity-header ${severity}"><div class="severity-badge">${icons[severity]} ${severity.toUpperCase()}</div><h2 class="severity-title">${this.escapeHtml(header)}</h2></div>`;
  },

  renderExecutiveSummary(results) {
    const summary = results.rawResponse?.interpretation?.summary || results.summary;
    return `<div class="exec-summary"><div class="section-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Executive Summary</div><p class="exec-summary-text">${this.escapeHtml(summary)}</p></div>`;
  },

  renderCriticalAlerts(alerts) {
    return `<div class="alert-section">${alerts.map(a => `<div class="elite-alert ${a.severity === 'critical' ? 'critical' : 'warning'}"><div class="alert-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${a.severity === 'critical' ? '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>'}</svg></div><div class="alert-body"><div class="alert-title">${this.escapeHtml(a.title || 'Alert')}</div><div class="alert-desc">${this.escapeHtml(a.text || '')}</div></div></div>`).join('')}</div>`;
  },

  renderClinicalInterpretation(interpretation) {
    const value = interpretation.value || '';
    const action = interpretation.action || '';
    if (!value && !action) return '';
    return `<div class="interpretation-panel"><div class="interpretation-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Clinical Interpretation</div>${value ? `<div class="interpretation-content">${this.escapeHtml(value)}</div>` : ''}${action ? `<div class="interpretation-action"><div class="action-label">Recommended Action</div><div class="action-text">${this.escapeHtml(action)}</div></div>` : ''}</div>`;
  },

  renderManagementPlan(recommendations) {
    return `<div class="management-section"><div class="management-header"><div class="management-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><h3>Management Plan</h3></div><div class="management-list">${recommendations.map((r, i) => {const text = typeof r === 'string' ? r : (r.text || r); const priority = i === 0; return `<div class="management-item ${priority ? 'priority' : ''}"><span class="management-num">${i + 1}</span><span class="management-text">${this.escapeHtml(text)}</span></div>`;}).join('')}</div></div>`;
  },

  renderClinicalPearl(pearl) {
    return `<div class="pearl-section"><div class="pearl-label">Clinical Pearl</div><p class="pearl-text">${this.escapeHtml(pearl)}</p></div>`;
  },

  renderPatientCommunication(text) {
    return `<div class="patient-section"><div class="patient-header"><div class="patient-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><span class="patient-label">Patient Communication</span></div><p class="patient-text">${this.escapeHtml(text)}</p></div>`;
  },

  renderExtractedData(text) {
    return `<div class="extracted-section"><button class="extracted-trigger"><span>📄 Source Data</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="extracted-content"><pre class="extracted-pre">${this.escapeHtml(text)}</pre></div></div>`;
  },

  renderReportFooter() {
    return `<div class="report-footer"><div class="footer-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10c0 5.5 3.8 9.7 10 11 6.2-1.3 10-5.5 10-11V7l-10-5z"/></svg>MedWard Clinical Intelligence</div><div class="footer-timestamp">${new Date().toLocaleString()}</div></div>`;
  },

  renderWardView(results) {
    const container = document.getElementById('ward-view');
    if (!container) return;
    this.injectStyles();
    if (!results) { container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:2rem;">No data</p>'; return; }
    const severity = this.determineSeverity(results);
    const { labValues, clinicalFindings } = this.smartSeparateFindings(results);
    let html = `<div class="elite-report" style="padding:0.875rem;">${this.renderSeverityHeader(severity, results)}`;
    if (clinicalFindings.length > 0) { html += `<div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.875rem;margin-bottom:0.875rem;"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.5);margin-bottom:0.6rem;">Key Findings</div>${clinicalFindings.slice(0,4).map(f => `<div style="padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.8rem;color:rgba(255,255,255,0.85);">• ${this.escapeHtml(f.finding.length > 60 ? f.finding.substring(0,60) + '...' : f.finding)}</div>`).join('')}</div>`; }
    if (labValues.length > 0) { const abnormal = labValues.filter(l => l.isAbnormal); if (abnormal.length > 0) { html += `<div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.875rem;margin-bottom:0.875rem;"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#fca5a5;margin-bottom:0.6rem;">Abnormal Labs (${abnormal.length})</div>${abnormal.slice(0,5).map(l => `<div style="display:flex;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.9);font-size:0.8rem;">${this.escapeHtml(l.name)}</span><span style="font-family:monospace;color:#fca5a5;font-weight:600;font-size:0.8rem;">${this.escapeHtml(l.value)}</span></div>`).join('')}</div>`; } }
    if (results.recommendations && results.recommendations.length > 0) { html += this.renderManagementPlan(results.recommendations.slice(0, 3)); }
    html += '</div>';
    container.innerHTML = html;
  },

  getStatusClass(status) {
    if (!status) return 'normal';
    const s = String(status).toLowerCase();
    if (s.includes('critical') || s.includes('high') || s.includes('elevated')) return 'high';
    if (s.includes('low') || s.includes('decreased')) return 'low';
    return 'normal';
  },

  renderEmpty() {
    return `<div style="text-align:center;padding:3rem 1.5rem;color:rgba(255,255,255,0.4);"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1.25rem;opacity:0.3;"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><p style="font-size:0.95rem;margin-bottom:0.4rem;">No Analysis Data</p><p style="font-size:0.8rem;opacity:0.7;">Upload a medical report to begin</p></div>`;
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  setupInteractions(container) {
    container.querySelectorAll('.extracted-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const content = trigger.nextElementSibling;
        trigger.classList.toggle('open', !content.classList.contains('show'));
        content.classList.toggle('show');
      });
    });
  }
};

if (typeof window !== 'undefined') window.ClinicalComponents = ClinicalComponents;
