/**
 * MedWard Clinical Components v6.0 - Lab Differentiation Edition
 * Enhanced rendering with lab vs clinical data separation
 */

const ClinicalComponents = {
  
  labRanges: {
    glucose: { name: 'Glucose', min: 4.1, max: 5.6, unit: 'mmol/L', category: 'Metabolic' },
    urea: { name: 'Urea', min: 2.8, max: 7.2, unit: 'mmol/L', category: 'Renal Function' },
    creatinine: { name: 'Creatinine', min: 64, max: 104, unit: 'μmol/L', category: 'Renal Function' },
    sodium: { name: 'Sodium', min: 136, max: 146, unit: 'mmol/L', category: 'Electrolytes' },
    potassium: { name: 'Potassium', min: 3.5, max: 5.1, unit: 'mmol/L', category: 'Electrolytes' },
    chloride: { name: 'Chloride', min: 98, max: 107, unit: 'mmol/L', category: 'Electrolytes' },
    co2: { name: 'CO2', min: 22, max: 29, unit: 'mmol/L', category: 'Electrolytes' },
    calcium: { name: 'Calcium', min: 2.1, max: 2.6, unit: 'mmol/L', category: 'Electrolytes' },
    magnesium: { name: 'Magnesium', min: 0.73, max: 1.06, unit: 'mmol/L', category: 'Electrolytes' },
    phosphate: { name: 'Phosphate', min: 0.81, max: 1.45, unit: 'mmol/L', category: 'Electrolytes' },
    alt: { name: 'ALT', min: 0, max: 41, unit: 'IU/L', category: 'Liver Function', critical: 500 },
    ast: { name: 'AST', min: 0, max: 40, unit: 'IU/L', category: 'Liver Function', critical: 500 },
    ggt: { name: 'GGT', min: 8, max: 61, unit: 'IU/L', category: 'Liver Function' },
    alkphos: { name: 'Alk Phos', min: 40, max: 129, unit: 'IU/L', category: 'Liver Function' },
    tbilirubin: { name: 'T. Bilirubin', min: 5, max: 21, unit: 'μmol/L', category: 'Liver Function' },
    albumin: { name: 'Albumin', min: 35, max: 52, unit: 'g/L', category: 'Liver Function' },
    wbc: { name: 'WBC', min: 4.5, max: 11.0, unit: '×10⁹/L', category: 'Hematology' },
    hemoglobin: { name: 'Hemoglobin', min: 130, max: 170, unit: 'g/L', category: 'Hematology' },
    platelets: { name: 'Platelets', min: 150, max: 400, unit: '×10⁹/L', category: 'Hematology' },
    pt: { name: 'PT', min: 9.6, max: 13.6, unit: 'sec', category: 'Coagulation' },
    inr: { name: 'INR', min: 0.85, max: 1.15, unit: '', category: 'Coagulation' },
    aptt: { name: 'APTT', min: 25, max: 37, unit: 'sec', category: 'Coagulation' },
    troponin: { name: 'Troponin', min: 0, max: 19.8, unit: 'ng/L', category: 'Cardiac Markers', critical: 50 },
    egfr: { name: 'eGFR', min: 60, max: 999, unit: 'mL/min', category: 'Renal Function' },
    ph: { name: 'pH', min: 7.35, max: 7.45, unit: '', category: 'Blood Gas' },
    pco2: { name: 'pCO2', min: 35, max: 45, unit: 'mmHg', category: 'Blood Gas' },
    hco3: { name: 'HCO3', min: 22, max: 26, unit: 'mmol/L', category: 'Blood Gas' },
    lactate: { name: 'Lactate', min: 0.5, max: 2.2, unit: 'mmol/L', category: 'Blood Gas', critical: 4 }
  },

  currentLabValues: [],
  currentDataClassification: null,

  cleanText(text) {
    if (!text || typeof text !== 'string') return '';
    if (text.trim().startsWith('```json') || text.trim().startsWith('{')) {
      try {
        const jsonStr = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(jsonStr);
        if (parsed.interpretation?.summary) return parsed.interpretation.summary;
        if (parsed.summary) return parsed.summary;
      } catch (e) {}
    }
    return text;
  },

  /**
   * Strip raw filenames from text (e.g., [IMG_20260116_085213-1.jpg])
   * This removes meaningless filename references from display
   */
  stripFilenames(text) {
    if (!text || typeof text !== 'string') return '';
    // Remove patterns like [IMG_...jpg], [filename.png], etc.
    return text.replace(/\[[\w\-_.]+\.(jpg|jpeg|png|gif|pdf|txt)\]/gi, '').trim();
  },

  /**
   * Determine severity level of a finding based on keywords
   * Returns: 'critical' | 'warning' | 'abnormal' | 'normal'
   */
  determineFindingSeverity(text) {
    if (!text) return 'abnormal';
    const lowerText = text.toLowerCase();

    // Critical indicators
    const criticalKeywords = [
      'shock', 'hypotension', 'acute decompensated', 'critical', 'severe',
      'emergency', 'life-threatening', 'cardiogenic shock', 'septic shock',
      'acute mi', 'myocardial infarction', 'stroke', 'hemorrhage', 'acute kidney injury'
    ];

    if (criticalKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'critical';
    }

    // Warning indicators
    const warningKeywords = [
      'moderate', 'elevated', 'low ', 'dysfunction', 'failure',
      'decreased', 'reduced', 'impaired', 'concerning', 'significant'
    ];

    if (warningKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'warning';
    }

    // Normal indicators
    const normalKeywords = [
      'normal', 'stable', 'excellent', 'good', 'adequate', 'appropriate',
      'within normal limits', 'wnl', 'unremarkable', 'no acute'
    ];

    if (normalKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'normal';
    }

    return 'abnormal';
  },

  /**
   * Categorize finding by medical system/category
   */
  categorizeFinding(text) {
    if (!text) return 'General';
    const lowerText = text.toLowerCase();

    // Cardiac / Cardiovascular
    if (lowerText.match(/cardiac|ventricular|heart|valve|ef |echo|cardiomyopathy|atrial|myocardial|coronary/)) {
      return 'Cardiac';
    }

    // Respiratory / Pulmonary
    if (lowerText.match(/pulmonary|lung|respiratory|spo2|oxygen|ventilation|breath|pneumonia|copd|asthma/)) {
      return 'Respiratory';
    }

    // Renal / Kidney
    if (lowerText.match(/creatinine|bun|renal|kidney|egfr|urea|dialysis|arf/)) {
      return 'Renal';
    }

    // Hematology / Blood
    if (lowerText.match(/hemoglobin|anemia|hematocrit|wbc|platelet|coagulation|bleeding/)) {
      return 'Hematology';
    }

    // Neurological / Mental Status
    if (lowerText.match(/gcs|alert|oriented|mental|neuro|consciousness|seizure|stroke/)) {
      return 'Neurological';
    }

    // Vitals / Hemodynamic
    if (lowerText.match(/\bbp\b|blood pressure|\bhr\b|heart rate|hemodynamic|vital sign|temperature|pulse/)) {
      return 'Vitals';
    }

    // Hepatic / Liver
    if (lowerText.match(/liver|hepat|bilirubin|ast|alt|cirrhosis/)) {
      return 'Hepatic';
    }

    // Electrolytes
    if (lowerText.match(/sodium|potassium|electrolyte|calcium|magnesium|phosphate/)) {
      return 'Electrolytes';
    }

    // Metabolic / Endocrine
    if (lowerText.match(/glucose|diabete|thyroid|metabolic|insulin/)) {
      return 'Metabolic';
    }

    return 'General';
  },

  getInterpretation(results) {
    if (results.interpretation && typeof results.interpretation === 'object') return results.interpretation;
    if (results.rawResponse?.interpretation && typeof results.rawResponse.interpretation === 'object') return results.rawResponse.interpretation;
    if (typeof results.interpretation === 'string') {
      try { return JSON.parse(results.interpretation); } catch (e) {}
    }
    return {};
  },

  renderDetailedView(results, isImage = false) {
    const container = document.getElementById('detailed-view');
    const labsContainer = document.getElementById('labs-view');
    
    if (!container) return;
    if (!results) { 
      container.innerHTML = this.renderEmpty(); 
      if (labsContainer) labsContainer.innerHTML = this.renderEmpty();
      return; 
    }

    console.log('[MedWard v6.0] Rendering with data classification');
    this.injectStyles();
    
    const extractedText = results.extractedText || results.rawResponse?.extractedText || '';
    
    if (typeof MedWardDataClassifier !== 'undefined') {
      this.currentDataClassification = MedWardDataClassifier.classify(extractedText, isImage);
      console.log('[MedWard v6.0] Data classification:', this.currentDataClassification);
    }

    const interp = this.getInterpretation(results);
    const aggressiveLabValues = this.aggressiveLabExtraction(extractedText);
    const { clinicalFindings, aiLabValues } = this.separateAIInterpretation(results, interp);
    const finalLabValues = this.mergeLabValues(aggressiveLabValues, aiLabValues);
    
    // Store labs and render Labs tab IMMEDIATELY
    this.currentLabValues = finalLabValues;
    this.renderLabsView(finalLabValues);
    this.updateLabsTabBadge(finalLabValues);
    
    console.log('[MedWard v6.0] Labs rendered:', finalLabValues.length);

    let html = '<div class="elite-report">';

    if (this.currentDataClassification) {
      html += this.renderDataTypeIndicator(this.currentDataClassification);
    }

    const severity = this.determineSeverity(results, finalLabValues, interp);
    const header = this.cleanText(interp.header) || this.cleanText(interp.summary)?.substring(0, 80) || 'Clinical Analysis';
    html += this.renderSeverityHeader(severity, header);

    // Add modern summary banner with severity counts
    if (clinicalFindings.length > 0 || finalLabValues.length > 0) {
      html += this.renderAnalysisSummaryBanner(clinicalFindings, finalLabValues);
    }

    const summary = this.cleanText(interp.summary);
    if (summary) html += this.renderExecutiveSummary(summary);

    const alerts = this.buildAlerts(interp, finalLabValues);
    if (alerts.length > 0) html += this.renderCriticalAlerts(alerts);

    if (clinicalFindings.length > 0) html += this.renderClinicalFindings(clinicalFindings);
    
    if (finalLabValues.length > 0) html += this.renderLabSummaryCard(finalLabValues);
    
    const recs = interp.presentation?.recommendations || results.presentation?.recommendations || results.recommendations || [];
    if (recs.length > 0) html += this.renderManagementPlan(recs);
    
    const pearls = results.clinicalPearls || [];
    if (pearls.length > 0) html += this.renderClinicalPearl(pearls[0]);
    
    const patientExp = interp.presentation?.patientFriendly || results.presentation?.patientFriendly;
    if (patientExp) html += this.renderPatientCommunication(patientExp);
    
    if (extractedText) html += this.renderExtractedData(extractedText);
    
    html += this.renderReportFooter();
    html += '</div>';
    
    container.innerHTML = html;
  },

  renderLabsView(labValues) {
    const container = document.getElementById('labs-view');
    if (!container) return;
    
    // Render immediately - no delay
    if (!labValues || labValues.length === 0) {
      container.innerHTML = `
        <div class="labs-panel">
          <div class="labs-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:48px;height:48px;margin-bottom:1rem;opacity:0.4">
              <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <h4 style="font-size:1rem;margin-bottom:0.5rem;color:rgba(255,255,255,0.7)">No Lab Values Detected</h4>
            <p style="font-size:0.85rem;color:rgba(255,255,255,0.4)">Upload a lab report image or paste lab values to see analysis</p>
          </div>
        </div>
      `;
      return;
    }
    
    if (typeof LabTrendsPanel !== 'undefined') {
      container.innerHTML = LabTrendsPanel.render(labValues, []);
    } else {
      container.innerHTML = this.renderLabValues(labValues);
    }
  },

  updateLabsTabBadge(labValues) {
    const labsTab = document.querySelector('.modal-tab[data-view="labs"]');
    if (!labsTab) return;
    
    const abnormalCount = labValues.filter(l => l.isAbnormal).length;
    const criticalCount = labValues.filter(l => l.status === 'critical').length;
    
    let badgeText = `${labValues.length}`;
    let badgeClass = '';
    
    if (criticalCount > 0) {
      badgeText = `${criticalCount} critical`;
      badgeClass = 'critical';
    } else if (abnormalCount > 0) {
      badgeText = `${abnormalCount} abnl`;
      badgeClass = 'abnormal';
    }
    
    labsTab.innerHTML = `Labs & Trends <span class="pres-tab-badge ${badgeClass}">${badgeText}</span>`;
  },

  renderDataTypeIndicator(classification) {
    if (!classification || classification.type === 'unknown') return '';
    
    const badges = {
      lab: { label: 'Lab Report', icon: '🧪', class: 'lab' },
      clinical: { label: 'Clinical Note', icon: '📋', class: 'clinical' },
      imaging: { label: 'Imaging Report', icon: '🔬', class: 'imaging' },
      mixed: { label: 'Mixed Data', icon: '📊', class: 'lab' }
    };
    
    const badge = badges[classification.type] || badges.mixed;
    
    return `
      <div class="data-type-indicator">
        <span class="data-type-badge ${badge.class}">${badge.icon} ${badge.label}</span>
        <span class="data-type-confidence">${classification.confidence}% confidence</span>
      </div>
    `;
  },

  renderLabSummaryCard(labs) {
    const total = labs.length;
    const abnormal = labs.filter(l => l.isAbnormal).length;
    const critical = labs.filter(l => l.status === 'critical').length;
    const topAbnormal = labs.filter(l => l.isAbnormal).slice(0, 4);
    
    return `
      <div class="lab-summary-card">
        <div class="lab-summary-header">
          <div class="lab-summary-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            Laboratory Values
          </div>
          <button class="lab-summary-btn" onclick="document.querySelector('.modal-tab[data-view=\\'labs\\']').click()">View All →</button>
        </div>
        <div class="lab-summary-stats">
          <div class="lab-stat"><span class="lab-stat-value total">${total}</span><span class="lab-stat-label">Total</span></div>
          ${critical > 0 ? `<div class="lab-stat"><span class="lab-stat-value critical">${critical}</span><span class="lab-stat-label">Critical</span></div>` : ''}
          ${abnormal > 0 ? `<div class="lab-stat"><span class="lab-stat-value abnormal">${abnormal}</span><span class="lab-stat-label">Abnormal</span></div>` : ''}
          <div class="lab-stat"><span class="lab-stat-value normal">${total - abnormal}</span><span class="lab-stat-label">Normal</span></div>
        </div>
        ${topAbnormal.length > 0 ? `
        <div class="lab-summary-abnormal">
          ${topAbnormal.map(l => `
            <div class="lab-summary-item ${l.status}">
              <span class="lab-item-name">${this.esc(l.name)}</span>
              <span class="lab-item-value">${this.esc(l.value)}</span>
            </div>
          `).join('')}
        </div>
        ` : `<div class="lab-summary-normal"><span>✓ All values within normal limits</span></div>`}
      </div>
    `;
  },

  buildAlerts(interp, labs) {
    const alerts = [];
    labs.filter(l => l.status === 'critical').forEach(l => {
      alerts.push({ severity: 'critical', title: `Critical: ${l.name}`, text: `${l.value} (Reference: ${l.reference})` });
    });
    (interp.abnormalities || []).forEach(item => {
      const text = typeof item === 'string' ? item : (item.finding || item.text || '');
      if (text && !alerts.find(a => a.text.includes(text.substring(0, 20)))) {
        alerts.push({ severity: 'warning', title: 'Abnormal Finding', text: text });
      }
    });
    return alerts.slice(0, 5);
  },

  aggressiveLabExtraction(text) {
    if (!text) return [];
    const labs = [];
    const foundLabs = new Set();
    const normalized = text.replace(/\s+/g, ' ');
    
    const patterns = [
      { key: 'glucose', regex: /gluc(?:ose)?\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'urea', regex: /\burea\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'creatinine', regex: /creat(?:inine)?\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'sodium', regex: /\b(?:na|sodium)\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'potassium', regex: /\b(?:k|potassium)\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'chloride', regex: /\b(?:cl|chloride)\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'co2', regex: /\bco2\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'calcium', regex: /\bca(?:lcium)?\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'magnesium', regex: /\bmg\s*\*?\s*[:\s]*(0\.\d+|\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'phosphate', regex: /phos(?:phate)?\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'alt', regex: /\balt\s*\*?\s*[:\s]*([>]?\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'ast', regex: /\bast\s*\*?\s*[:\s]*([>]?\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'ggt', regex: /\bggt\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'alkphos', regex: /alk\.?\s*phos\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'tbilirubin', regex: /t\.?\s*bil(?:irubin)?\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'albumin', regex: /albumin\s*\*?\s*[:\s]*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'wbc', regex: /\bwbc\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'hemoglobin', regex: /\b(?:hb|hgb|hemoglobin)\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'platelets', regex: /\b(?:plt|platelet)s?\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'pt', regex: /\bpt\s+(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'inr', regex: /\binr\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'aptt', regex: /\baptt\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'troponin', regex: /troponin\s*[I1]?\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(H|HH|L|LL)?/gi },
      { key: 'egfr', regex: /egfr\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'lactate', regex: /\b(?:lac|lactate)\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'ph', regex: /\bph\s*[:\*]?\s*(7\.\d+)/gi },
      { key: 'pco2', regex: /pco2\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi },
      { key: 'hco3', regex: /hco3\s*[:\*]?\s*(\d+(?:\.\d+)?)/gi }
    ];
    
    patterns.forEach(p => {
      let match;
      while ((match = p.regex.exec(normalized)) !== null) {
        if (foundLabs.has(p.key)) continue;
        const valueStr = match[1];
        const flag = match[2] ? match[2].toUpperCase() : null;
        const ref = this.labRanges[p.key];
        if (!ref) continue;
        
        let numericValue = parseFloat(valueStr.replace('>', ''));
        let status = 'normal';
        if (flag === 'HH' || (ref.critical && numericValue >= ref.critical)) status = 'critical';
        else if (flag === 'H' || numericValue > ref.max) status = 'high';
        else if (flag === 'LL' || flag === 'L' || numericValue < ref.min) status = 'low';
        
        foundLabs.add(p.key);
        labs.push({
          name: ref.name, value: valueStr + ' ' + ref.unit, valueDisplay: valueStr + ' ' + ref.unit,
          reference: ref.min + '-' + ref.max + ' ' + ref.unit, referenceDisplay: ref.min + '-' + ref.max + ' ' + ref.unit,
          status, statusLabel: status.charAt(0).toUpperCase() + status.slice(1),
          category: ref.category, isAbnormal: status !== 'normal', isCritical: status === 'critical'
        });
      }
    });
    return labs;
  },

  separateAIInterpretation(results, interp) {
    const clinicalFindings = [];
    const aiLabValues = [];
    const findingsSet = new Set(); // Avoid duplicates

    // Process keyFindings
    (interp.keyFindings || []).forEach(item => {
      const rawText = typeof item === 'string' ? item : (item.finding || item.text || '');
      if (rawText) {
        const cleanedText = this.stripFilenames(rawText);
        if (cleanedText && !findingsSet.has(cleanedText)) {
          findingsSet.add(cleanedText);
          clinicalFindings.push({
            id: `finding-${clinicalFindings.length}`,
            finding: cleanedText,
            severity: this.determineFindingSeverity(cleanedText),
            category: this.categorizeFinding(cleanedText),
            type: this.classifyClinicalFinding(cleanedText) // Keep for backward compatibility
          });
        }
      }
    });

    // Process abnormalities
    (interp.abnormalities || []).forEach(item => {
      const rawText = typeof item === 'string' ? item : (item.finding || item.text || '');
      if (rawText) {
        const cleanedText = this.stripFilenames(rawText);
        if (cleanedText && !findingsSet.has(cleanedText)) {
          findingsSet.add(cleanedText);
          clinicalFindings.push({
            id: `finding-${clinicalFindings.length}`,
            finding: cleanedText,
            severity: this.determineFindingSeverity(cleanedText),
            category: this.categorizeFinding(cleanedText),
            type: this.classifyClinicalFinding(cleanedText)
          });
        }
      }
    });

    // Sort findings: critical first, then by severity
    const severityOrder = { 'critical': 0, 'warning': 1, 'abnormal': 2, 'normal': 3 };
    clinicalFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return { clinicalFindings, aiLabValues };
  },

  mergeLabValues(aggressive, ai) {
    const merged = [...aggressive];
    const names = new Set(aggressive.map(l => l.name.toLowerCase()));
    ai.forEach(l => { if (!names.has(l.name.toLowerCase())) merged.push(l); });
    return merged;
  },

  classifyClinicalFinding(text) {
    const t = text.toLowerCase();
    if (t.includes('liver') || t.includes('hepat')) return 'hepatic';
    if (t.includes('kidney') || t.includes('renal')) return 'renal';
    if (t.includes('electrolyte') || t.includes('sodium') || t.includes('potassium')) return 'electrolytes';
    if (t.includes('cardiac') || t.includes('heart')) return 'cardiovascular';
    if (t.includes('glucose') || t.includes('diabete')) return 'metabolic';
    if (t.includes('emergency') || t.includes('critical')) return 'critical';
    return 'general';
  },

  determineSeverity(results, labs, interp) {
    if (labs.some(l => l.status === 'critical')) return 'critical';
    const summaryText = (interp.summary || '').toLowerCase();
    if (summaryText.includes('critical') || summaryText.includes('emergency')) return 'critical';
    if (labs.some(l => l.isAbnormal)) return 'abnormal';
    if (summaryText.includes('abnormal') || summaryText.includes('elevated')) return 'abnormal';
    return 'normal';
  },

  renderSeverityHeader(severity, header) {
    const config = {
      critical: { icon: '🔴', label: 'Critical', gradient: 'from-red-950 to-red-900', border: 'border-red-800', text: 'text-red-200' },
      abnormal: { icon: '🟡', label: 'Abnormal', gradient: 'from-yellow-950/50 to-yellow-900/30', border: 'border-yellow-700', text: 'text-yellow-200' },
      warning: { icon: '🟠', label: 'Warning', gradient: 'from-amber-950 to-amber-900', border: 'border-amber-700', text: 'text-amber-200' },
      normal: { icon: '🟢', label: 'Normal', gradient: 'from-slate-900 to-slate-800', border: 'border-slate-700', text: 'text-slate-200' }
    };
    const cfg = config[severity] || config.normal;

    return `
      <div class="severity-header-v7 ${severity}" style="background: linear-gradient(135deg, var(--${severity}-bg-start), var(--${severity}-bg-end)); border: 1px solid var(--${severity}-border);">
        <div class="severity-badge-v7">
          <span class="severity-icon">${cfg.icon}</span>
          <span class="severity-text">${cfg.label.toUpperCase()}</span>
        </div>
        <h2 class="severity-title-v7">${this.esc(header)}</h2>
      </div>
    `;
  },

  /**
   * Render modern summary banner with severity counts
   */
  renderAnalysisSummaryBanner(findings, labs) {
    const counts = {
      critical: findings.filter(f => f.severity === 'critical').length + labs.filter(l => l.status === 'critical').length,
      warning: findings.filter(f => f.severity === 'warning').length,
      abnormal: findings.filter(f => f.severity === 'abnormal').length,
      normal: findings.filter(f => f.severity === 'normal').length
    };

    const hasCritical = counts.critical > 0;
    const totalAbnormal = counts.critical + counts.warning + counts.abnormal;

    return `
      <div class="analysis-summary-banner ${hasCritical ? 'critical-banner' : 'normal-banner'}">
        <div class="banner-content">
          <div class="banner-left">
            <h3 class="banner-title">
              ${hasCritical ? '⚠️ Immediate Attention Required' : '✓ Analysis Complete'}
            </h3>
            <p class="banner-subtitle">
              ${totalAbnormal > 0 ? `${totalAbnormal} abnormalit${totalAbnormal === 1 ? 'y' : 'ies'} detected` : 'No significant abnormalities'}
            </p>
          </div>
          <div class="banner-right">
            ${counts.critical > 0 ? `<div class="count-badge critical-badge"><span class="badge-count">${counts.critical}</span><span class="badge-label">Critical</span></div>` : ''}
            ${counts.warning > 0 ? `<div class="count-badge warning-badge"><span class="badge-count">${counts.warning}</span><span class="badge-label">Warning</span></div>` : ''}
            ${counts.abnormal > 0 ? `<div class="count-badge abnormal-badge"><span class="badge-count">${counts.abnormal}</span><span class="badge-label">Abnormal</span></div>` : ''}
            ${counts.normal > 0 ? `<div class="count-badge normal-badge"><span class="badge-count">${counts.normal}</span><span class="badge-label">Normal</span></div>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  renderExecutiveSummary(summary) {
    return `<div class="exec-summary"><div class="section-label">📋 EXECUTIVE SUMMARY</div><p class="exec-summary-text">${this.esc(summary)}</p></div>`;
  },

  renderCriticalAlerts(alerts) {
    return `<div class="alert-section">${alerts.map(a => `<div class="elite-alert ${a.severity}"><div class="alert-body"><div class="alert-title">${this.esc(a.title)}</div><div class="alert-desc">${this.esc(a.text)}</div></div></div>`).join('')}</div>`;
  },

  /**
   * Render individual finding card with severity styling
   */
  renderFindingCard(finding) {
    const severityConfig = {
      critical: {
        bg: 'rgba(127, 29, 29, 0.3)',
        border: '#ef4444',
        badgeBg: '#dc2626',
        textColor: '#fca5a5',
        icon: '🔴'
      },
      warning: {
        bg: 'rgba(120, 53, 15, 0.3)',
        border: '#f59e0b',
        badgeBg: '#d97706',
        textColor: '#fcd34d',
        icon: '🟠'
      },
      abnormal: {
        bg: 'rgba(113, 113, 23, 0.2)',
        border: '#eab308',
        badgeBg: '#ca8a04',
        textColor: '#fef08a',
        icon: '🟡'
      },
      normal: {
        bg: 'rgba(15, 23, 42, 0.4)',
        border: '#64748b',
        badgeBg: '#475569',
        textColor: '#cbd5e1',
        icon: '🟢'
      }
    };

    const config = severityConfig[finding.severity] || severityConfig.abnormal;

    return `
      <div class="finding-card-v7" style="background: ${config.bg}; border-left: 4px solid ${config.border};">
        <div class="finding-card-header">
          <span class="finding-severity-badge" style="background: ${config.badgeBg};">
            ${config.icon} ${finding.severity.toUpperCase()}
          </span>
          <span class="finding-category-label">${this.esc(finding.category)}</span>
        </div>
        <p class="finding-text" style="color: ${config.textColor};">${this.esc(finding.finding)}</p>
      </div>
    `;
  },

  /**
   * Render clinical findings with modern card-based layout grouped by category
   */
  renderClinicalFindings(findings) {
    if (!findings || findings.length === 0) return '';

    // Group by category
    const grouped = {};
    findings.forEach(f => {
      const cat = f.category || 'General';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(f);
    });

    // Sort each category by severity
    const severityOrder = { 'critical': 0, 'warning': 1, 'abnormal': 2, 'normal': 3 };
    Object.values(grouped).forEach(group => {
      group.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    });

    // Critical findings - always display first if present
    const criticalFindings = findings.filter(f => f.severity === 'critical');

    let html = `<div class="clinical-findings-section-v7">`;

    // Critical section (if any)
    if (criticalFindings.length > 0) {
      html += `
        <div class="critical-findings-section">
          <h2 class="findings-section-header critical-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block;vertical-align:middle;margin-right:0.5rem;">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Critical Findings (${criticalFindings.length})
          </h2>
          <div class="findings-cards-grid">
            ${criticalFindings.map(f => this.renderFindingCard(f)).join('')}
          </div>
        </div>
      `;
    }

    // Category sections
    const categoryOrder = ['Cardiac', 'Respiratory', 'Renal', 'Neurological', 'Vitals', 'Hepatic', 'Hematology', 'Electrolytes', 'Metabolic', 'General'];
    for (const category of categoryOrder) {
      const items = grouped[category];
      if (!items || items.length === 0) continue;

      // Skip critical items in category sections (already shown above)
      const nonCriticalItems = items.filter(f => f.severity !== 'critical');
      if (nonCriticalItems.length === 0) continue;

      html += `
        <div class="category-findings-section">
          <h3 class="findings-category-header">${category}</h3>
          <div class="findings-cards-grid">
            ${nonCriticalItems.map(f => this.renderFindingCard(f)).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  },

  renderLabValues(labs) {
    if (!labs.length) return '';
    const cats = {};
    labs.forEach(l => { const c = l.category || 'Other'; if (!cats[c]) cats[c] = []; cats[c].push(l); });
    const colors = { 'Renal Function': '#3b82f6', 'Electrolytes': '#8b5cf6', 'Liver Function': '#f59e0b', 'Cardiac Markers': '#ef4444', 'Hematology': '#ec4899', 'Coagulation': '#14b8a6', 'Blood Gas': '#06b6d4', 'Metabolic': '#22c55e', 'Other': '#6b7280' };
    const order = ['Blood Gas','Cardiac Markers','Renal Function','Electrolytes','Liver Function','Hematology','Coagulation','Metabolic','Other'];
    let html = '';
    for (const cat of order) {
      const items = cats[cat];
      if (!items) continue;
      const col = colors[cat] || '#6b7280';
      const abn = items.filter(i => i.isAbnormal).length;
      html += `<div class="lab-category-section"><div class="lab-category-header" style="border-left:4px solid ${col}"><h3>${cat}</h3><span class="lab-count">${items.length} tests${abn ? ' · <span style="color:#fca5a5">' + abn + ' abnormal</span>' : ''}</span></div><table class="lab-table"><thead><tr><th>Parameter</th><th>Result</th><th>Reference</th><th>Status</th></tr></thead><tbody>${items.map(l => `<tr class="${l.isAbnormal ? 'abnormal-row' : ''}"><td>${this.esc(l.name)}</td><td class="lab-value ${l.status}">${this.esc(l.value)}</td><td class="lab-ref">${this.esc(l.reference)}</td><td><span class="lab-status ${l.status}">${l.status === 'high' || l.status === 'critical' ? '↑' : l.status === 'low' ? '↓' : '•'} ${this.esc(l.statusLabel)}</span></td></tr>`).join('')}</tbody></table></div>`;
    }
    return html;
  },

  renderManagementPlan(recs) {
    return `<div class="management-section"><div class="management-header"><h3>✅ Management Plan</h3></div><div class="management-list">${recs.map((r, i) => `<div class="management-item ${i === 0 ? 'priority' : ''}"><span class="management-num">${i + 1}</span><span>${this.esc(typeof r === 'string' ? r : r.text)}</span></div>`).join('')}</div></div>`;
  },

  renderClinicalPearl(pearl) {
    return `<div class="pearl-section"><div class="pearl-label">💎 Clinical Pearl</div><p class="pearl-text">${this.esc(typeof pearl === 'string' ? pearl : JSON.stringify(pearl))}</p></div>`;
  },

  renderPatientCommunication(text) {
    return `<div class="patient-section"><div class="patient-header">👤 Patient Communication</div><p class="patient-text">${this.esc(text)}</p></div>`;
  },

  renderExtractedData(text) {
    return `<div class="extracted-section"><button class="extracted-trigger" onclick="this.nextElementSibling.classList.toggle('show');this.classList.toggle('open')">📄 Source OCR Data ▼</button><div class="extracted-content"><pre class="extracted-pre">${this.esc(text)}</pre></div></div>`;
  },

  renderReportFooter() {
    return `<div class="report-footer"><span>🛡️ MedWard v6.0</span><span>${new Date().toLocaleString()}</span></div>`;
  },

  renderEmpty() {
    return '<div style="text-align:center;padding:3rem;color:rgba(255,255,255,0.4)"><p>📄 No Analysis Data</p></div>';
  },

  esc(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  },

  renderWardView(results) {
    const container = document.getElementById('ward-view');
    if (!container) return;
    this.injectStyles();
    if (!results) { container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:2rem;">No data</p>'; return; }
    
    const interp = this.getInterpretation(results);
    const extractedText = results.extractedText || results.rawResponse?.extractedText || '';
    const labs = this.aggressiveLabExtraction(extractedText);
    const { clinicalFindings } = this.separateAIInterpretation(results, interp);
    const severity = this.determineSeverity(results, labs, interp);
    const header = this.cleanText(interp.header) || this.cleanText(interp.summary)?.substring(0, 50) || 'Analysis';
    
    let html = `<div class="elite-report" style="padding:1rem">${this.renderSeverityHeader(severity, header)}`;
    
    if (clinicalFindings.length > 0) {
      html += `<div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:1rem;margin-bottom:1rem"><div style="font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.5);margin-bottom:0.5rem">KEY FINDINGS</div>${clinicalFindings.slice(0, 4).map(f => `<div style="padding:0.3rem 0;font-size:0.85rem;color:rgba(255,255,255,0.85)">• ${this.esc(f.finding.substring(0, 80))}</div>`).join('')}</div>`;
    }
    
    const abnormalLabs = labs.filter(l => l.isAbnormal);
    if (abnormalLabs.length > 0) {
      html += `<div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:1rem;margin-bottom:1rem"><div style="font-size:0.7rem;font-weight:700;color:#fca5a5;margin-bottom:0.5rem">ABNORMAL LABS (${abnormalLabs.length})</div>${abnormalLabs.slice(0, 6).map(l => `<div style="display:flex;justify-content:space-between;padding:0.3rem 0"><span style="color:rgba(255,255,255,0.9)">${this.esc(l.name)}</span><span style="font-family:monospace;color:#fca5a5;font-weight:600">${this.esc(l.value)}</span></div>`).join('')}</div>`;
    }
    
    const recs = interp.presentation?.recommendations || results.recommendations || [];
    if (recs.length > 0) html += this.renderManagementPlan(recs.slice(0, 3));
    
    html += '</div>';
    container.innerHTML = html;
  },

  injectStyles() {
    if (document.getElementById('elite-styles-v70')) return;
    const s = document.createElement('style');
    s.id = 'elite-styles-v70';
    s.textContent = `
/* ===============================================
   MedWard Analysis Results v7.0 - Modern UI
   Clinical Precision meets Dashboard Clarity
   =============================================== */

/* CSS Variables */
:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: #1a1a24;
  --bg-card-hover: #22222e;
  --border-subtle: #2a2a38;
  --border-default: #3a3a4a;
  --text-primary: #f0f0f5;
  --text-secondary: #a0a0b0;
  --text-muted: #606075;

  /* Severity Colors */
  --critical-bg-start: rgba(127, 29, 29, 0.4);
  --critical-bg-end: rgba(127, 29, 29, 0.2);
  --critical-border: #ef4444;
  --critical-text: #fca5a5;

  --warning-bg-start: rgba(120, 53, 15, 0.35);
  --warning-bg-end: rgba(120, 53, 15, 0.15);
  --warning-border: #f59e0b;
  --warning-text: #fcd34d;

  --abnormal-bg-start: rgba(113, 113, 23, 0.3);
  --abnormal-bg-end: rgba(113, 113, 23, 0.1);
  --abnormal-border: #eab308;
  --abnormal-text: #fef08a;

  --normal-bg-start: rgba(15, 23, 42, 0.6);
  --normal-bg-end: rgba(15, 23, 42, 0.3);
  --normal-border: #64748b;
  --normal-text: #cbd5e1;
}

/* Base Report Container */
.elite-report {
  font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--text-primary);
  line-height: 1.6;
  max-width: 100%;
}

/* ===============================================
   Severity Header v7
   =============================================== */
.severity-header-v7 {
  padding: 1.5rem;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.severity-badge-v7 {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.9rem;
  border-radius: 50px;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.severity-icon {
  font-size: 0.9rem;
}

.severity-title-v7 {
  font-size: 1.4rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.3;
}

/* ===============================================
   Analysis Summary Banner
   =============================================== */
.analysis-summary-banner {
  margin: 0 0 1.5rem 0;
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-default);
  transition: all 0.3s ease;
}

.critical-banner {
  background: linear-gradient(135deg, rgba(127, 29, 29, 0.25), rgba(127, 29, 29, 0.1));
  border-color: var(--critical-border);
}

.normal-banner {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.2));
  border-color: var(--normal-border);
}

.banner-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.banner-left {
  flex: 1;
  min-width: 200px;
}

.banner-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 0.4rem 0;
  color: var(--text-primary);
}

.critical-banner .banner-title {
  color: var(--critical-text);
}

.banner-subtitle {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.banner-right {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.count-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(5px);
  min-width: 60px;
  transition: all 0.2s ease;
}

.count-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.badge-count {
  font-size: 1.4rem;
  font-weight: 700;
  font-family: 'IBM Plex Mono', 'Consolas', monospace;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.badge-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.8;
}

.critical-badge {
  border: 1px solid var(--critical-border);
}

.critical-badge .badge-count {
  color: #ef4444;
}

.warning-badge {
  border: 1px solid var(--warning-border);
}

.warning-badge .badge-count {
  color: #f59e0b;
}

.abnormal-badge {
  border: 1px solid var(--abnormal-border);
}

.abnormal-badge .badge-count {
  color: #eab308;
}

.normal-badge {
  border: 1px solid var(--normal-border);
}

.normal-badge .badge-count {
  color: #22c55e;
}

/* ===============================================
   Clinical Findings Section v7
   =============================================== */
.clinical-findings-section-v7 {
  margin-bottom: 1.5rem;
}

.critical-findings-section {
  margin-bottom: 2rem;
}

.findings-section-header {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.85rem;
}

.critical-header {
  color: var(--critical-text);
}

.category-findings-section {
  margin-bottom: 1.5rem;
}

.findings-category-header {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-secondary);
  margin: 0 0 0.75rem 0;
}

.findings-cards-grid {
  display: grid;
  gap: 0.75rem;
}

/* ===============================================
   Finding Card v7
   =============================================== */
.finding-card-v7 {
  padding: 1rem;
  border-radius: 10px;
  backdrop-filter: blur(5px);
  transition: all 0.2s ease;
  position: relative;
}

.finding-card-v7:hover {
  transform: translateX(4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.finding-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}

.finding-severity-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: white;
}

.finding-category-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.finding-text {
  font-size: 0.9rem;
  line-height: 1.5;
  margin: 0;
  font-weight: 500;
}

/* ===============================================
   Executive Summary
   =============================================== */
.exec-summary {
  background: linear-gradient(180deg, rgba(30, 58, 95, 0.25), rgba(30, 58, 95, 0.1));
  border: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.section-label {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  margin-bottom: 0.75rem;
}

.exec-summary-text {
  font-size: 0.9rem;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
}

/* ===============================================
   Alert Section
   =============================================== */
.alert-section {
  margin-bottom: 1.5rem;
}

.elite-alert {
  display: flex;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  margin-bottom: 0.6rem;
  border-left: 3px solid;
  backdrop-filter: blur(5px);
  transition: all 0.2s ease;
}

.elite-alert:hover {
  transform: translateX(4px);
}

.elite-alert.critical {
  background: rgba(220, 38, 38, 0.1);
  border-left-color: #dc2626;
}

.elite-alert.warning {
  background: rgba(217, 119, 6, 0.1);
  border-left-color: #d97706;
}

.alert-title {
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 0.2rem;
}

.elite-alert.critical .alert-title {
  color: #fca5a5;
}

.elite-alert.warning .alert-title {
  color: #fcd34d;
}

.alert-desc {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1.5;
}

/* ===============================================
   Lab Summary Card
   =============================================== */
.lab-summary-card {
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.08), rgba(30, 58, 95, 0.15));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
  transition: all 0.3s ease;
}

.lab-summary-card:hover {
  border-color: rgba(59, 130, 246, 0.35);
}

.lab-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.lab-summary-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
}

.lab-summary-title svg {
  stroke: #60a5fa;
}

.lab-summary-btn {
  background: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.lab-summary-btn:hover {
  background: rgba(59, 130, 246, 0.25);
  color: #60a5fa;
  transform: translateY(-2px);
}

.lab-summary-stats {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.lab-stat {
  text-align: center;
  flex: 1;
  min-width: 70px;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.lab-stat:hover {
  background: rgba(0, 0, 0, 0.35);
  transform: translateY(-2px);
}

.lab-stat-value {
  font-family: 'IBM Plex Mono', 'Consolas', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  display: block;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.lab-stat-value.total {
  color: #f0c674;
}

.lab-stat-value.critical {
  color: #ef4444;
}

.lab-stat-value.abnormal {
  color: #fca5a5;
}

.lab-stat-value.normal {
  color: #6ee7b7;
}

.lab-stat-label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.5);
}

.lab-summary-abnormal {
  display: grid;
  gap: 0.5rem;
}

.lab-summary-item {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 0.9rem;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  border-left: 3px solid;
  transition: all 0.2s ease;
}

.lab-summary-item:hover {
  background: rgba(0, 0, 0, 0.25);
  transform: translateX(4px);
}

.lab-summary-item.high,
.lab-summary-item.critical {
  border-left-color: #ef4444;
}

.lab-summary-item.low {
  border-left-color: #3b82f6;
}

.lab-item-name {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}

.lab-item-value {
  font-family: 'IBM Plex Mono', 'Consolas', monospace;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fca5a5;
}

.lab-summary-normal {
  text-align: center;
  padding: 1rem;
  color: #6ee7b7;
  font-size: 0.9rem;
  font-weight: 500;
}

/* ===============================================
   Lab Category Sections
   =============================================== */
.lab-category-section {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1rem;
  transition: all 0.3s ease;
}

.lab-category-section:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.lab-category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.lab-category-header h3 {
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
}

.lab-count {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.5);
}

.lab-table {
  width: 100%;
  border-collapse: collapse;
}

.lab-table thead th {
  padding: 0.7rem 0.875rem;
  text-align: left;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.2);
}

.lab-table tbody tr {
  transition: background 0.15s ease;
}

.lab-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.03);
}

.lab-table tbody tr.abnormal-row {
  background: rgba(239, 68, 68, 0.05);
}

.lab-table tbody td {
  padding: 0.65rem 0.875rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.8rem;
}

.lab-value {
  font-family: 'IBM Plex Mono', 'Consolas', monospace;
  font-weight: 600;
}

.lab-value.high,
.lab-value.critical {
  color: #fca5a5;
}

.lab-value.low {
  color: #93c5fd;
}

.lab-value.normal {
  color: #6ee7b7;
}

.lab-ref {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  font-family: 'IBM Plex Mono', 'Consolas', monospace;
}

.lab-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lab-status.high,
.lab-status.critical {
  background: rgba(220, 38, 38, 0.15);
  color: #fca5a5;
}

.lab-status.low {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

.lab-status.normal {
  background: rgba(5, 150, 105, 0.12);
  color: #6ee7b7;
}

/* ===============================================
   Management Section
   =============================================== */
.management-section {
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.management-header {
  padding: 0.875rem 1.25rem;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.management-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.management-list {
  padding: 0.5rem;
}

.management-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 0.3rem;
  transition: all 0.2s ease;
}

.management-item:hover {
  background: rgba(255, 255, 255, 0.03);
  transform: translateX(4px);
}

.management-item.priority {
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.15);
}

.management-num {
  width: 26px;
  height: 26px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.management-item.priority .management-num {
  background: #dc2626;
  color: white;
}

/* ===============================================
   Clinical Pearl & Patient Communication
   =============================================== */
.pearl-section {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.08), rgba(245, 158, 11, 0.04));
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.pearl-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #fbbf24;
  margin-bottom: 0.5rem;
  letter-spacing: 0.05em;
}

.pearl-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.85);
  font-style: italic;
  margin: 0;
}

.patient-section {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.08), rgba(8, 145, 178, 0.04));
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1.5rem;
}

.patient-header {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  color: #22d3ee;
  margin-bottom: 0.75rem;
  letter-spacing: 0.05em;
}

.patient-text {
  font-size: 0.85rem;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

/* ===============================================
   Data Type Indicator & Other Components
   =============================================== */
.data-type-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding: 0.5rem 0;
}

.data-type-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 50px;
  font-size: 0.7rem;
  font-weight: 600;
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.data-type-badge.lab svg {
  stroke: #60a5fa;
}

.data-type-badge.clinical {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
  border-color: rgba(16, 185, 129, 0.3);
}

.data-type-badge.imaging {
  background: rgba(168, 85, 247, 0.15);
  color: #c4b5fd;
  border-color: rgba(168, 85, 247, 0.3);
}

.data-type-confidence {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.extracted-section {
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.extracted-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: rgba(255, 255, 255, 0.02);
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.extracted-trigger:hover {
  background: rgba(255, 255, 255, 0.05);
}

.extracted-content {
  display: none;
  padding: 0.875rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.extracted-content.show {
  display: block;
}

.extracted-pre {
  font-family: 'IBM Plex Mono', 'Consolas', monospace;
  font-size: 0.7rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.6);
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
  margin: 0;
}

.report-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 1rem;
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ===============================================
   Tab Badge Styles
   =============================================== */
.pres-tab-badge {
  font-size: 0.65rem;
  padding: 0.2rem 0.5rem;
  border-radius: 50px;
  margin-left: 0.4rem;
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
  font-weight: 600;
}

.pres-tab-badge.critical {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
}

.pres-tab-badge.abnormal {
  background: rgba(245, 158, 11, 0.2);
  color: #fcd34d;
}

/* ===============================================
   Labs Panel (empty state)
   =============================================== */
.labs-panel {
  padding: 2rem;
}

.labs-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: rgba(255, 255, 255, 0.4);
}

/* ===============================================
   Backward Compatibility Styles
   (Legacy class names for smooth transition)
   =============================================== */
.elite-report{font-family:'Outfit',-apple-system,sans-serif;color:rgba(255,255,255,0.9);line-height:1.6}
.data-type-indicator{display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;padding:0.5rem 0}
.data-type-confidence{font-size:0.7rem;color:rgba(255,255,255,0.4)}
.severity-header{padding:1.25rem 1.5rem;border-radius:14px;margin-bottom:1.25rem}
.severity-header.critical{background:linear-gradient(135deg,rgba(220,38,38,0.15),rgba(185,28,28,0.08));border:1px solid rgba(220,38,38,0.3);color:#fca5a5}
.severity-header.abnormal{background:linear-gradient(135deg,rgba(217,119,6,0.12),rgba(180,83,9,0.06));border:1px solid rgba(217,119,6,0.3);color:#fcd34d}
.severity-header.normal{background:linear-gradient(135deg,rgba(5,150,105,0.12),rgba(4,120,87,0.06));border:1px solid rgba(5,150,105,0.3);color:#6ee7b7}
.severity-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.3rem 0.75rem;border-radius:100px;font-size:0.65rem;font-weight:700;text-transform:uppercase;margin-bottom:0.6rem}
.severity-header.critical .severity-badge{background:rgba(220,38,38,0.2)}
.severity-header.abnormal .severity-badge{background:rgba(217,119,6,0.2)}
.severity-header.normal .severity-badge{background:rgba(5,150,105,0.2)}
.severity-title{font-family:'Playfair Display',Georgia,serif;font-size:1.15rem;font-weight:600;margin:0}
.exec-summary{background:linear-gradient(180deg,rgba(30,58,95,0.3),rgba(30,58,95,0.1));border:1px solid rgba(96,165,250,0.15);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem}
.section-label{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin-bottom:0.75rem}
.exec-summary-text{font-size:0.9rem;line-height:1.65;color:rgba(255,255,255,0.85)}
.alert-section{margin-bottom:1.25rem}
.elite-alert{display:flex;gap:0.875rem;padding:0.875rem 1rem;border-radius:10px;margin-bottom:0.5rem;border-left:3px solid}
.elite-alert.critical{background:rgba(220,38,38,0.08);border-left-color:#dc2626}
.elite-alert.warning{background:rgba(217,119,6,0.08);border-left-color:#d97706}
.alert-title{font-weight:600;font-size:0.85rem;margin-bottom:0.1rem}
.elite-alert.critical .alert-title{color:#fca5a5}
.elite-alert.warning .alert-title{color:#fcd34d}
.alert-desc{font-size:0.8rem;color:rgba(255,255,255,0.7)}
.clinical-findings-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:1.25rem}
.section-header-bar{padding:0.875rem 1.25rem;background:linear-gradient(180deg,rgba(255,255,255,0.03),transparent);border-bottom:1px solid rgba(255,255,255,0.06)}
.section-header-bar h3{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;margin:0}
.findings-grid{padding:0.875rem;display:grid;gap:0.75rem}
.finding-category{background:rgba(0,0,0,0.2);border-radius:10px;padding:0.875rem;border-left:3px solid #6b7280}
.finding-category-header{display:flex;align-items:center;gap:0.4rem;margin-bottom:0.6rem;font-size:0.7rem;font-weight:700;text-transform:uppercase}
.finding-list{list-style:none;margin:0;padding:0}
.finding-item{padding:0.4rem 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.85rem;color:rgba(255,255,255,0.85)}
.lab-summary-card{background:linear-gradient(180deg,rgba(59,130,246,0.08),rgba(30,58,95,0.15));border:1px solid rgba(59,130,246,0.2);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem}
.lab-summary-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem}
.lab-summary-title{display:flex;align-items:center;gap:0.5rem;font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600}
.lab-summary-title svg{stroke:#60a5fa}
.lab-summary-btn{background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;transition:all 0.2s}
.lab-summary-btn:hover{background:rgba(59,130,246,0.25);color:#60a5fa}
.lab-summary-stats{display:flex;gap:1rem;margin-bottom:1rem}
.lab-stat{text-align:center;flex:1;padding:0.75rem;background:rgba(0,0,0,0.2);border-radius:8px}
.lab-stat-value{font-family:'IBM Plex Mono',monospace;font-size:1.25rem;font-weight:700;display:block}
.lab-stat-value.total{color:#f0c674}
.lab-stat-value.critical{color:#ef4444}
.lab-stat-value.abnormal{color:#fca5a5}
.lab-stat-value.normal{color:#6ee7b7}
.lab-stat-label{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.5)}
.lab-summary-abnormal{display:grid;gap:0.35rem}
.lab-summary-item{display:flex;justify-content:space-between;padding:0.5rem 0.75rem;background:rgba(0,0,0,0.15);border-radius:6px;border-left:2px solid}
.lab-summary-item.high,.lab-summary-item.critical{border-left-color:#ef4444}
.lab-summary-item.low{border-left-color:#3b82f6}
.lab-item-name{font-size:0.8rem;color:rgba(255,255,255,0.85)}
.lab-item-value{font-family:'IBM Plex Mono',monospace;font-size:0.8rem;font-weight:600;color:#fca5a5}
.lab-summary-normal{text-align:center;padding:1rem;color:#6ee7b7;font-size:0.85rem}
.lab-category-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:1rem}
.lab-category-header{display:flex;align-items:center;justify-content:space-between;padding:0.875rem 1.25rem;background:linear-gradient(180deg,rgba(255,255,255,0.03),transparent);border-bottom:1px solid rgba(255,255,255,0.06)}
.lab-category-header h3{font-family:'Playfair Display',Georgia,serif;font-size:0.95rem;font-weight:600;margin:0}
.lab-count{font-size:0.65rem;color:rgba(255,255,255,0.5)}
.lab-table{width:100%;border-collapse:collapse}
.lab-table thead th{padding:0.6rem 0.875rem;text-align:left;font-size:0.55rem;font-weight:700;text-transform:uppercase;color:rgba(255,255,255,0.4);background:rgba(0,0,0,0.2)}
.lab-table tbody tr{transition:background 0.15s}
.lab-table tbody tr:hover{background:rgba(255,255,255,0.02)}
.lab-table tbody tr.abnormal-row{background:rgba(239,68,68,0.04)}
.lab-table tbody td{padding:0.55rem 0.875rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem}
.lab-value{font-family:'IBM Plex Mono',monospace;font-weight:600}
.lab-value.high,.lab-value.critical{color:#fca5a5}
.lab-value.low{color:#93c5fd}
.lab-value.normal{color:#6ee7b7}
.lab-ref{font-size:0.65rem;color:rgba(255,255,255,0.4);font-family:monospace}
.lab-status{display:inline-flex;align-items:center;gap:0.2rem;padding:0.15rem 0.4rem;border-radius:5px;font-size:0.55rem;font-weight:600;text-transform:uppercase}
.lab-status.high,.lab-status.critical{background:rgba(220,38,38,0.15);color:#fca5a5}
.lab-status.low{background:rgba(59,130,246,0.15);color:#93c5fd}
.lab-status.normal{background:rgba(5,150,105,0.1);color:#6ee7b7}
.management-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:14px;overflow:hidden;margin-bottom:1.25rem}
.management-header{padding:0.875rem 1.25rem;background:linear-gradient(180deg,rgba(255,255,255,0.03),transparent);border-bottom:1px solid rgba(255,255,255,0.06)}
.management-header h3{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;margin:0}
.management-list{padding:0.4rem}
.management-item{display:flex;align-items:flex-start;gap:0.75rem;padding:0.75rem;border-radius:8px;margin-bottom:0.2rem}
.management-item:hover{background:rgba(255,255,255,0.02)}
.management-item.priority{background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.12)}
.management-num{width:24px;height:24px;background:rgba(255,255,255,0.1);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:rgba(255,255,255,0.7);flex-shrink:0}
.management-item.priority .management-num{background:#dc2626;color:white}
.pearl-section{background:linear-gradient(135deg,rgba(251,191,36,0.08),rgba(245,158,11,0.04));border:1px solid rgba(251,191,36,0.2);border-radius:14px;padding:1rem;margin-bottom:1.25rem}
.pearl-label{font-size:0.65rem;font-weight:700;text-transform:uppercase;color:#fbbf24;margin-bottom:0.4rem}
.pearl-text{font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.85);font-style:italic}
.patient-section{background:linear-gradient(135deg,rgba(6,182,212,0.08),rgba(8,145,178,0.04));border:1px solid rgba(6,182,212,0.2);border-radius:14px;padding:1.25rem;margin-bottom:1.25rem}
.patient-header{font-size:0.65rem;font-weight:600;text-transform:uppercase;color:#22d3ee;margin-bottom:0.75rem}
.patient-text{font-size:0.85rem;line-height:1.6;color:rgba(255,255,255,0.8)}
.extracted-section{border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;margin-bottom:1.25rem}
.extracted-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;padding:0.875rem 1rem;background:rgba(255,255,255,0.02);border:none;color:rgba(255,255,255,0.6);font-family:inherit;font-size:0.8rem;cursor:pointer}
.extracted-trigger:hover{background:rgba(255,255,255,0.04)}
.extracted-content{display:none;padding:0.875rem;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06)}
.extracted-content.show{display:block}
.extracted-pre{font-family:monospace;font-size:0.65rem;line-height:1.5;color:rgba(255,255,255,0.6);white-space:pre-wrap;max-height:250px;overflow-y:auto;margin:0}
.report-footer{display:flex;align-items:center;justify-content:space-between;padding:0.875rem 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:0.875rem;font-size:0.65rem;color:rgba(255,255,255,0.4)}
.pres-tab-badge{font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:100px;margin-left:0.35rem;background:rgba(78,205,196,0.2);color:#4ecdc4}
.pres-tab-badge.critical{background:rgba(239,68,68,0.2);color:#fca5a5}
.pres-tab-badge.abnormal{background:rgba(245,158,11,0.2);color:#fcd34d}
/* Lab vs Clinical Visual Differentiation */
.lab-section{background:linear-gradient(180deg,rgba(59,130,246,0.08),rgba(30,58,95,0.15));border:1px solid rgba(59,130,246,0.2);border-radius:14px;margin-bottom:1.5rem;overflow:hidden}
.clinical-section{background:linear-gradient(180deg,rgba(16,185,129,0.08),rgba(6,78,59,0.15));border:1px solid rgba(16,185,129,0.2);border-radius:14px;margin-bottom:1.5rem;overflow:hidden}
.section-header{display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.2)}
.section-icon{font-size:1.25rem}
.section-badge{font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:100px;background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);margin-left:auto}
.lab-header{color:#60a5fa}
.lab-header .section-badge{background:rgba(59,130,246,0.2);color:#93c5fd}
.clinical-header{color:#34d399}
.clinical-header .section-badge{background:rgba(16,185,129,0.2);color:#6ee7b7}
.separated-analysis{margin-top:1rem}
.data-type-badge{display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 0.75rem;border-radius:100px;font-size:0.7rem;font-weight:600;background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3)}
.data-type-badge.lab svg{stroke:#60a5fa}
.data-type-badge.clinical{background:rgba(16,185,129,0.15);color:#6ee7b7;border-color:rgba(16,185,129,0.3)}
.data-type-badge.clinical svg{stroke:#34d399}
.data-type-badge.imaging{background:rgba(168,85,247,0.15);color:#c4b5fd;border-color:rgba(168,85,247,0.3)}
.data-type-badge.imaging svg{stroke:#a78bfa}
`;
    document.head.appendChild(s);
  }
};

if (typeof window !== 'undefined') window.ClinicalComponents = ClinicalComponents;
