/**
 * MedWard Clinical Components v5.1 - Comprehensive Edition
 * Properly separates clinical findings from laboratory values
 * Professional medical institution styling
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
    
    // Separate lab values from clinical findings
    const { labValues, clinicalFindings } = this.separateFindings(results);
    
    // CLINICAL FINDINGS (symptoms, exam findings, etc.)
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
   * Separate lab values from clinical findings
   */
  separateFindings(results) {
    const labValues = [];
    const clinicalFindings = [];
    
    // Lab name patterns (must have numeric values)
    const labPatterns = /^(glucose|gluc|urea|creat|creatinine|na|sodium|k|potassium|cl|chloride|co2|hco3|ca|calcium|mg|magnesium|phos|phosphate|alt|ast|ggt|alk|bil|bilirubin|albumin|protein|wbc|hb|hgb|plt|platelet|pt|inr|aptt|ptt|ph|pco2|po2|lactate|lac|troponin|trop|bnp|probnp|egfr|anion|neutro)/i;
    
    // Process abnormalities from interpretation
    const abnormalities = results.rawResponse?.interpretation?.abnormalities || [];
    abnormalities.forEach(item => {
      const text = typeof item === 'string' ? item : (item.finding || item.text || '');
      
      // Check if it looks like a lab value (has numbers and lab name)
      const hasNumber = /\d+(\.\d+)?/.test(text);
      const hasLabName = labPatterns.test(text);
      
      if (hasNumber && hasLabName) {
        labValues.push(this.parseLabValue(text));
      } else {
        // It's a clinical finding
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
        
        // Check if it's a lab value
        const hasNumber = /\d+(\.\d+)?/.test(value);
        const hasLabName = labPatterns.test(name);
        
        if (hasNumber && hasLabName) {
          if (!labValues.find(l => l.name.toLowerCase() === name.toLowerCase())) {
            labValues.push({
              name: name,
              value: value,
              reference: f.reference || '-',
              status: f.status || 'normal',
              statusLabel: f.status || 'Normal',
              isAbnormal: f.status?.toLowerCase() !== 'normal'
            });
          }
        } else if (name && value !== '-' && value !== '') {
          // Clinical finding with a value
          clinicalFindings.push({
            finding: name,
            value: value,
            type: this.classifyClinicalFinding(name)
          });
        } else if (name) {
          // Clinical finding without value
          clinicalFindings.push({
            finding: name,
            type: this.classifyClinicalFinding(name)
          });
        }
      });
    }
    
    // Try to extract labs from extracted text
    if (results.rawResponse?.extractedText) {
      const extractedLabs = this.parseLabsFromText(results.rawResponse.extractedText);
      extractedLabs.forEach(lab => {
        if (!labValues.find(l => l.name.toLowerCase() === lab.name.toLowerCase())) {
          labValues.push(lab);
        }
      });
    }
    
    return { labValues, clinicalFindings };
  },

  /**
   * Classify clinical finding type
   */
  classifyClinicalFinding(text) {
    const t = text.toLowerCase();
    if (t.includes('dyspnea') || t.includes('breath') || t.includes('resp') || t.includes('cough') || t.includes('wheez') || t.includes('crackle') || t.includes('spo2') || t.includes('hypox')) return 'respiratory';
    if (t.includes('chest') || t.includes('cardiac') || t.includes('heart') || t.includes('bp') || t.includes('pressure') || t.includes('nyha') || t.includes('edema') || t.includes('jvp')) return 'cardiovascular';
    if (t.includes('abdom') || t.includes('hepat') || t.includes('liver') || t.includes('nausea') || t.includes('vomit') || t.includes('oral') || t.includes('appetite')) return 'gastrointestinal';
    if (t.includes('neuro') || t.includes('conscious') || t.includes('gcs') || t.includes('orient')) return 'neurological';
    if (t.includes('renal') || t.includes('kidney') || t.includes('urin') || t.includes('aki') || t.includes('ckd')) return 'renal';
    if (t.includes('exam') || t.includes('physical') || t.includes('bilateral') || t.includes('pitting')) return 'examination';
    return 'general';
  },

  /**
   * Render clinical findings (non-lab)
   */
  renderClinicalFindings(findings) {
    // Group by type
    const grouped = {};
    findings.forEach(f => {
      const type = f.type || 'general';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(f);
    });
    
    const typeLabels = {
      respiratory: { label: 'Respiratory', icon: '🫁', color: '#06b6d4' },
      cardiovascular: { label: 'Cardiovascular', icon: '❤️', color: '#ef4444' },
      gastrointestinal: { label: 'Gastrointestinal', icon: '🔶', color: '#f59e0b' },
      neurological: { label: 'Neurological', icon: '🧠', color: '#8b5cf6' },
      renal: { label: 'Renal', icon: '💧', color: '#3b82f6' },
      examination: { label: 'Physical Examination', icon: '🩺', color: '#10b981' },
      general: { label: 'Clinical Findings', icon: '📋', color: '#6b7280' }
    };
    
    let html = `
      <div class="clinical-findings-section">
        <div class="section-header-bar">
          <div class="section-header-icon" style="background: linear-gradient(135deg, #f0c674 0%, #d4a843 100%);">
            <svg viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="2"/>
              <path d="M9 14l2 2 4-4"/>
            </svg>
          </div>
          <div>
            <h3>Clinical Assessment</h3>
            <span class="section-subtitle">${findings.length} findings identified</span>
          </div>
        </div>
        <div class="findings-grid">
    `;
    
    for (const [type, items] of Object.entries(grouped)) {
      const meta = typeLabels[type] || typeLabels.general;
      
      html += `
        <div class="finding-category" style="border-left-color: ${meta.color};">
          <div class="finding-category-header">
            <span class="finding-category-icon">${meta.icon}</span>
            <span class="finding-category-label">${meta.label}</span>
          </div>
          <ul class="finding-list">
            ${items.map(item => `
              <li class="finding-item">
                <span class="finding-bullet" style="background: ${meta.color};"></span>
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
    
    // Group by category
    const categories = this.categorizeLabData(labs);
    let html = '';
    
    for (const [category, items] of Object.entries(categories)) {
      if (items.length === 0) continue;
      html += this.renderLabCategory(category, items);
    }
    
    return html;
  },

  /**
   * Parse labs from extracted text
   */
  parseLabsFromText(text) {
    const labs = [];
    
    // Common lab patterns with values
    const patterns = [
      { name: 'Glucose', regex: /(?:glucose|gluc)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L|mg\/dL)?/i },
      { name: 'Urea', regex: /urea\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'Creatinine', regex: /(?:creat|creatinine)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(μmol\/L|umol\/L|mg\/dL)?/i },
      { name: 'Sodium', regex: /(?:na|sodium)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'Potassium', regex: /(?:k|potassium)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'Chloride', regex: /(?:cl|chloride)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'CO2', regex: /co2\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'Calcium', regex: /(?:ca|calcium)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'Magnesium', regex: /(?:mg|magnesium)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'Phosphate', regex: /(?:phos|phosphate)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(mmol\/L)?/i },
      { name: 'ALT', regex: /alt\s*[:\*]?\s*([>]?\d+(?:\.\d+)?)\s*(IU\/L|U\/L)?/i },
      { name: 'AST', regex: /ast\s*[:\*]?\s*([>]?\d+(?:\.\d+)?)\s*(IU\/L|U\/L)?/i },
      { name: 'GGT', regex: /ggt\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(IU\/L|U\/L)?/i },
      { name: 'Alk Phos', regex: /(?:alk|alkaline)\s*(?:phos)?\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(IU\/L|U\/L)?/i },
      { name: 'Bilirubin', regex: /(?:t\.?\s*bil|bilirubin)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(μmol\/L|umol\/L)?/i },
      { name: 'Albumin', regex: /albumin\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(g\/L)?/i },
      { name: 'WBC', regex: /wbc\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'Hemoglobin', regex: /(?:hb|hgb|hemoglobin)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(g\/L|g\/dL)?/i },
      { name: 'Platelets', regex: /(?:plt|platelet)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'PT', regex: /\bpt\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(sec|seconds)?/i },
      { name: 'INR', regex: /inr\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'APTT', regex: /aptt\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(sec|seconds)?/i },
      { name: 'Troponin', regex: /troponin\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(ng\/L)?/i },
      { name: 'NT-proBNP', regex: /(?:nt-?probnp|probnp|bnp)\s*[:\*]?\s*(\d+(?:\.\d+)?)\s*(pg\/ml)?/i },
      { name: 'pH', regex: /\bph\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'pCO2', regex: /pco2\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'HCO3', regex: /hco3\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'Lactate', regex: /(?:lactate|lac)\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'eGFR', regex: /egfr\s*[:\*]?\s*(\d+(?:\.\d+)?)/i },
      { name: 'Anion Gap', regex: /anion\s*(?:gap)?\s*[:\*]?\s*(\d+(?:\.\d+)?)/i }
    ];
    
    patterns.forEach(p => {
      const match = text.match(p.regex);
      if (match) {
        const value = match[1] + (match[2] ? ' ' + match[2] : '');
        const hasFlag = text.includes(match[0] + ' H') || text.includes(match[0] + ' L');
        labs.push({
          name: p.name,
          value: value.trim(),
          reference: '-',
          status: hasFlag ? (text.includes(' H') ? 'high' : 'low') : 'normal',
          statusLabel: hasFlag ? (text.includes(' H') ? 'High' : 'Low') : 'Normal',
          isAbnormal: hasFlag
        });
      }
    });
    
    return labs;
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
    
    const categoryMap = {
      'urea': 'Renal Function', 'creat': 'Renal Function', 'creatinine': 'Renal Function', 'egfr': 'Renal Function', 'bun': 'Renal Function',
      'na': 'Electrolytes', 'sodium': 'Electrolytes', 'k': 'Electrolytes', 'potassium': 'Electrolytes', 'cl': 'Electrolytes', 'chloride': 'Electrolytes',
      'co2': 'Electrolytes', 'bicarbonate': 'Electrolytes', 'ca': 'Electrolytes', 'calcium': 'Electrolytes', 'mg': 'Electrolytes', 'magnesium': 'Electrolytes',
      'phos': 'Electrolytes', 'phosphate': 'Electrolytes', 'anion': 'Electrolytes',
      'alt': 'Liver Function', 'ast': 'Liver Function', 'ggt': 'Liver Function', 'alk': 'Liver Function', 'bil': 'Liver Function', 'bilirubin': 'Liver Function', 'albumin': 'Liver Function', 'protein': 'Liver Function',
      'troponin': 'Cardiac Markers', 'trop': 'Cardiac Markers', 'bnp': 'Cardiac Markers', 'probnp': 'Cardiac Markers', 'ck': 'Cardiac Markers',
      'wbc': 'Hematology', 'hb': 'Hematology', 'hgb': 'Hematology', 'hemoglobin': 'Hematology', 'plt': 'Hematology', 'platelet': 'Hematology', 'neutro': 'Hematology', 'rbc': 'Hematology',
      'pt': 'Coagulation', 'inr': 'Coagulation', 'aptt': 'Coagulation', 'ptt': 'Coagulation',
      'ph': 'Blood Gas', 'pco2': 'Blood Gas', 'po2': 'Blood Gas', 'hco3': 'Blood Gas', 'lactate': 'Blood Gas', 'lac': 'Blood Gas'
    };
    
    labs.forEach(lab => {
      const nameLower = lab.name.toLowerCase();
      let assigned = false;
      for (const [key, category] of Object.entries(categoryMap)) {
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
   * Render a lab category section
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
              <span class="lab-category-count">${labs.length} tests${abnormalCount > 0 ? ` • <span style="color: #fca5a5;">${abnormalCount} abnormal</span>` : ''}</span>
            </div>
          </div>
        </div>
        <table class="lab-table">
          <thead>
            <tr>
              <th style="width: 35%;">Parameter</th>
              <th style="width: 25%;">Result</th>
              <th style="width: 25%;">Reference</th>
              <th style="width: 15%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${labs.map(lab => {
              const sc = this.getStatusClass(lab.status);
              return `
                <tr class="${lab.isAbnormal ? 'abnormal-row' : ''}">
                  <td class="lab-name">${this.escapeHtml(lab.name)}</td>
                  <td class="lab-value ${sc}">${this.escapeHtml(lab.value)}</td>
                  <td class="lab-reference">${this.escapeHtml(lab.reference || '-')}</td>
                  <td><span class="lab-status ${sc}">${sc === 'high' ? '↑' : sc === 'low' ? '↓' : '•'} ${this.escapeHtml(lab.statusLabel || 'Normal')}</span></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  injectStyles() {
    if (document.getElementById('elite-styles-v51')) return;
    const s = document.createElement('style');
    s.id = 'elite-styles-v51';
    s.textContent = `
      .elite-report{font-family:'Outfit',-apple-system,BlinkMacSystemFont,sans-serif;color:rgba(255,255,255,0.9);line-height:1.6}
      
      /* Severity Header */
      .severity-header{position:relative;padding:1.5rem 1.75rem;border-radius:16px;margin-bottom:1.5rem;overflow:hidden}
      .severity-header::before{content:'';position:absolute;inset:0;opacity:0.03;background:repeating-linear-gradient(-45deg,transparent,transparent 10px,currentColor 10px,currentColor 11px)}
      .severity-header.critical{background:linear-gradient(135deg,rgba(220,38,38,0.15) 0%,rgba(185,28,28,0.08) 100%);border:1px solid rgba(220,38,38,0.3);color:#fca5a5}
      .severity-header.abnormal{background:linear-gradient(135deg,rgba(217,119,6,0.12) 0%,rgba(180,83,9,0.06) 100%);border:1px solid rgba(217,119,6,0.3);color:#fcd34d}
      .severity-header.normal{background:linear-gradient(135deg,rgba(5,150,105,0.12) 0%,rgba(4,120,87,0.06) 100%);border:1px solid rgba(5,150,105,0.3);color:#6ee7b7}
      .severity-badge{display:inline-flex;align-items:center;gap:0.5rem;padding:0.375rem 0.875rem;border-radius:100px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.75rem}
      .severity-header.critical .severity-badge{background:rgba(220,38,38,0.2);color:#fca5a5;box-shadow:0 0 20px rgba(220,38,38,0.3);animation:pulse 2s ease-in-out infinite}
      .severity-header.abnormal .severity-badge{background:rgba(217,119,6,0.2);color:#fcd34d}
      .severity-header.normal .severity-badge{background:rgba(5,150,105,0.2);color:#6ee7b7}
      @keyframes pulse{0%,100%{box-shadow:0 0 20px rgba(220,38,38,0.3)}50%{box-shadow:0 0 30px rgba(220,38,38,0.5)}}
      .severity-title{font-family:'Playfair Display',Georgia,serif;font-size:1.25rem;font-weight:600;margin:0;line-height:1.3}
      
      /* Executive Summary */
      .exec-summary{background:linear-gradient(180deg,rgba(30,58,95,0.3) 0%,rgba(30,58,95,0.1) 100%);border:1px solid rgba(96,165,250,0.15);border-radius:16px;padding:1.5rem 1.75rem;margin-bottom:1.5rem;position:relative}
      .exec-summary::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#3b82f6 0%,#60a5fa 50%,#93c5fd 100%);border-radius:16px 16px 0 0}
      .section-label{display:flex;align-items:center;gap:0.5rem;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.5);margin-bottom:0.875rem}
      .section-label svg{width:14px;height:14px;opacity:0.7}
      .exec-summary-text{font-size:0.95rem;line-height:1.7;color:rgba(255,255,255,0.85)}
      
      /* Alerts */
      .alert-section{margin-bottom:1.5rem}
      .elite-alert{display:flex;gap:1rem;padding:1rem 1.25rem;border-radius:12px;margin-bottom:0.625rem;position:relative;overflow:hidden}
      .elite-alert::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px}
      .elite-alert.critical{background:rgba(220,38,38,0.08);border:1px solid rgba(220,38,38,0.2)}
      .elite-alert.critical::before{background:#dc2626;box-shadow:0 0 12px rgba(220,38,38,0.5)}
      .elite-alert.warning{background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.2)}
      .elite-alert.warning::before{background:#d97706}
      .alert-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .elite-alert.critical .alert-icon{background:rgba(220,38,38,0.2);color:#fca5a5}
      .elite-alert.warning .alert-icon{background:rgba(217,119,6,0.2);color:#fcd34d}
      .alert-icon svg{width:18px;height:18px}
      .alert-body{flex:1;min-width:0}
      .alert-title{font-weight:600;font-size:0.9rem;margin-bottom:0.125rem}
      .elite-alert.critical .alert-title{color:#fca5a5}
      .elite-alert.warning .alert-title{color:#fcd34d}
      .alert-desc{font-size:0.85rem;color:rgba(255,255,255,0.7);line-height:1.5}
      
      /* Clinical Findings Section */
      .clinical-findings-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;margin-bottom:1.5rem}
      .section-header-bar{display:flex;align-items:center;gap:0.75rem;padding:1rem 1.5rem;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.06)}
      .section-header-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center}
      .section-header-icon svg{width:20px;height:20px}
      .section-header-bar h3{font-family:'Playfair Display',Georgia,serif;font-size:1.05rem;font-weight:600;margin:0}
      .section-subtitle{font-size:0.75rem;color:rgba(255,255,255,0.5)}
      .findings-grid{padding:1rem;display:grid;gap:1rem}
      .finding-category{background:rgba(0,0,0,0.2);border-radius:12px;padding:1rem;border-left:3px solid #6b7280}
      .finding-category-header{display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem}
      .finding-category-icon{font-size:1rem}
      .finding-category-label{font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.6)}
      .finding-list{list-style:none;margin:0;padding:0}
      .finding-item{display:flex;align-items:flex-start;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.04)}
      .finding-item:last-child{border-bottom:none}
      .finding-bullet{width:6px;height:6px;border-radius:50%;margin-top:0.5rem;flex-shrink:0}
      .finding-content{flex:1}
      .finding-text{font-size:0.9rem;color:rgba(255,255,255,0.85);line-height:1.5}
      .finding-value{display:block;font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:#4ecdc4;margin-top:0.25rem}
      
      /* Lab Category Sections */
      .lab-category-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;margin-bottom:1.25rem}
      .lab-category-header{display:flex;align-items:center;justify-content:space-between;padding:1rem 1.5rem;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.06)}
      .lab-category-title{display:flex;align-items:center;gap:0.75rem}
      .lab-category-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center}
      .lab-category-icon svg{width:20px;height:20px}
      .lab-category-title h3{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;margin:0}
      .lab-category-count{font-size:0.7rem;color:rgba(255,255,255,0.5)}
      
      /* Lab Table */
      .lab-table{width:100%;border-collapse:collapse}
      .lab-table thead th{padding:0.75rem 1rem;text-align:left;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.4);background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.06)}
      .lab-table tbody tr{transition:background 0.2s ease}
      .lab-table tbody tr:hover{background:rgba(255,255,255,0.02)}
      .lab-table tbody tr.abnormal-row{background:rgba(239,68,68,0.03)}
      .lab-table tbody tr.abnormal-row:hover{background:rgba(239,68,68,0.06)}
      .lab-table tbody td{padding:0.625rem 1rem;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle;font-size:0.85rem}
      .lab-table tbody tr:last-child td{border-bottom:none}
      .lab-name{font-weight:500;color:rgba(255,255,255,0.9)}
      .lab-value{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:0.85rem}
      .lab-value.high{color:#fca5a5}
      .lab-value.low{color:#93c5fd}
      .lab-value.normal{color:#6ee7b7}
      .lab-reference{font-size:0.7rem;color:rgba(255,255,255,0.4);font-family:monospace}
      .lab-status{display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.5rem;border-radius:6px;font-size:0.6rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em}
      .lab-status.high{background:rgba(220,38,38,0.15);color:#fca5a5}
      .lab-status.low{background:rgba(59,130,246,0.15);color:#93c5fd}
      .lab-status.normal{background:rgba(5,150,105,0.1);color:#6ee7b7}
      
      /* Interpretation Panel */
      .interpretation-panel{background:linear-gradient(135deg,rgba(139,92,246,0.08) 0%,rgba(109,40,217,0.04) 100%);border:1px solid rgba(139,92,246,0.2);border-radius:16px;padding:1.5rem 1.75rem;margin-bottom:1.5rem;position:relative}
      .interpretation-panel::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#8b5cf6 0%,#a78bfa 100%);border-radius:16px 16px 0 0}
      .interpretation-title{font-family:'Playfair Display',Georgia,serif;font-size:1.05rem;font-weight:600;color:#c4b5fd;margin-bottom:1rem;display:flex;align-items:center;gap:0.625rem}
      .interpretation-title svg{width:20px;height:20px;opacity:0.8}
      .interpretation-content{font-size:0.9rem;line-height:1.7;color:rgba(255,255,255,0.8)}
      .interpretation-action{margin-top:1.25rem;padding:1rem 1.25rem;background:rgba(139,92,246,0.1);border-radius:10px;border-left:3px solid #8b5cf6}
      .action-label{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#a78bfa;margin-bottom:0.375rem}
      .action-text{font-size:0.85rem;color:rgba(255,255,255,0.85);line-height:1.5}
      
      /* Management Section */
      .management-section{background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:16px;overflow:hidden;margin-bottom:1.5rem}
      .management-header{display:flex;align-items:center;gap:0.75rem;padding:1rem 1.5rem;background:linear-gradient(180deg,rgba(255,255,255,0.03) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.06)}
      .management-icon{width:40px;height:40px;background:linear-gradient(135deg,#10b981 0%,#059669 100%);border-radius:10px;display:flex;align-items:center;justify-content:center}
      .management-icon svg{width:20px;height:20px;color:white}
      .management-header h3{font-family:'Playfair Display',Georgia,serif;font-size:1rem;font-weight:600;margin:0}
      .management-list{padding:0.5rem}
      .management-item{display:flex;align-items:flex-start;gap:1rem;padding:0.875rem 1rem;border-radius:10px;transition:all 0.2s ease;margin-bottom:0.25rem}
      .management-item:hover{background:rgba(255,255,255,0.02)}
      .management-item.priority{background:rgba(220,38,38,0.06);border:1px solid rgba(220,38,38,0.15)}
      .management-num{width:26px;height:26px;background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,rgba(255,255,255,0.05) 100%);border:1px solid rgba(255,255,255,0.1);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:rgba(255,255,255,0.7);flex-shrink:0}
      .management-item.priority .management-num{background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-color:transparent;color:white;box-shadow:0 0 12px rgba(220,38,38,0.4)}
      .management-text{font-size:0.85rem;line-height:1.5;color:rgba(255,255,255,0.8);flex:1}
      
      /* Clinical Pearl */
      .pearl-section{background:linear-gradient(135deg,rgba(251,191,36,0.08) 0%,rgba(245,158,11,0.04) 100%);border:1px solid rgba(251,191,36,0.2);border-radius:16px;padding:1.25rem 1.5rem;margin-bottom:1.5rem;position:relative}
      .pearl-section::before{content:'💎';position:absolute;top:-12px;left:1.5rem;font-size:1.25rem;background:var(--surface,#12121a);padding:0 0.5rem}
      .pearl-label{font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#fbbf24;margin-bottom:0.5rem}
      .pearl-text{font-size:0.9rem;line-height:1.7;color:rgba(255,255,255,0.85);font-style:italic}
      
      /* Patient Communication */
      .patient-section{background:linear-gradient(135deg,rgba(6,182,212,0.08) 0%,rgba(8,145,178,0.04) 100%);border:1px solid rgba(6,182,212,0.2);border-radius:16px;padding:1.5rem 1.75rem;margin-bottom:1.5rem}
      .patient-header{display:flex;align-items:center;gap:0.625rem;margin-bottom:0.875rem}
      .patient-icon{width:32px;height:32px;background:rgba(6,182,212,0.2);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#22d3ee}
      .patient-icon svg{width:16px;height:16px}
      .patient-label{font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#22d3ee}
      .patient-text{font-size:0.9rem;line-height:1.7;color:rgba(255,255,255,0.8)}
      
      /* Extracted Data */
      .extracted-section{border:1px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;margin-bottom:1.5rem}
      .extracted-trigger{width:100%;display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;background:rgba(255,255,255,0.02);border:none;color:rgba(255,255,255,0.6);font-family:inherit;font-size:0.85rem;cursor:pointer;transition:all 0.2s ease}
      .extracted-trigger:hover{background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.8)}
      .extracted-trigger svg{width:18px;height:18px;transition:transform 0.3s ease}
      .extracted-trigger.open svg{transform:rotate(180deg)}
      .extracted-content{display:none;padding:1rem 1.25rem;background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06)}
      .extracted-content.show{display:block}
      .extracted-pre{font-family:monospace;font-size:0.7rem;line-height:1.6;color:rgba(255,255,255,0.6);white-space:pre-wrap;word-break:break-word;max-height:300px;overflow-y:auto;margin:0}
      
      /* Footer */
      .report-footer{display:flex;align-items:center;justify-content:space-between;padding:1rem 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:1rem}
      .footer-brand{display:flex;align-items:center;gap:0.5rem;font-size:0.7rem;color:rgba(255,255,255,0.4)}
      .footer-brand svg{width:16px;height:16px;opacity:0.5}
      .footer-timestamp{font-size:0.65rem;font-family:monospace;color:rgba(255,255,255,0.3)}
      
      /* Animations */
      @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      .elite-report>*{animation:fadeIn 0.4s ease forwards}
      .elite-report>*:nth-child(1){animation-delay:0s}
      .elite-report>*:nth-child(2){animation-delay:0.05s}
      .elite-report>*:nth-child(3){animation-delay:0.1s}
      .elite-report>*:nth-child(4){animation-delay:0.15s}
      .elite-report>*:nth-child(5){animation-delay:0.2s}
      .elite-report>*:nth-child(6){animation-delay:0.25s}
      .elite-report>*:nth-child(7){animation-delay:0.3s}
    `;
    document.head.appendChild(s);
  },

  determineSeverity(results) {
    const t = JSON.stringify(results).toLowerCase();
    if (t.includes('critical') || t.includes('emergency') || t.includes('immediate')) return 'critical';
    if (t.includes('abnormal') || t.includes('elevated') || t.includes('high') || t.includes('low')) return 'abnormal';
    return 'normal';
  },

  renderSeverityHeader(severity, results) {
    const icons = {
      critical: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      abnormal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      normal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    };
    const header = results.rawResponse?.interpretation?.header || results.diagnosis || 'Analysis Complete';
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
    return `<div class="management-section"><div class="management-header"><div class="management-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><h3>Management Plan</h3></div><div class="management-list">${recommendations.map((r, i) => {const text = typeof r === 'string' ? r : (r.text || r); const priority = i === 0 || (typeof r === 'object' && r.urgent); return `<div class="management-item ${priority ? 'priority' : ''}"><span class="management-num">${i + 1}</span><span class="management-text">${this.escapeHtml(text)}</span></div>`;}).join('')}</div></div>`;
  },

  renderClinicalPearl(pearl) {
    return `<div class="pearl-section"><div class="pearl-label">Clinical Pearl</div><p class="pearl-text">${this.escapeHtml(pearl)}</p></div>`;
  },

  renderPatientCommunication(text) {
    return `<div class="patient-section"><div class="patient-header"><div class="patient-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><span class="patient-label">Patient Communication</span></div><p class="patient-text">${this.escapeHtml(text)}</p></div>`;
  },

  renderExtractedData(text) {
    return `<div class="extracted-section"><button class="extracted-trigger"><span>📄 Source Document Data</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button><div class="extracted-content"><pre class="extracted-pre">${this.escapeHtml(text)}</pre></div></div>`;
  },

  renderReportFooter() {
    return `<div class="report-footer"><div class="footer-brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7v10c0 5.5 3.8 9.7 10 11 6.2-1.3 10-5.5 10-11V7l-10-5z"/></svg>MedWard Clinical Intelligence</div><div class="footer-timestamp">Generated ${new Date().toLocaleString()}</div></div>`;
  },

  renderWardView(results) {
    const container = document.getElementById('ward-view');
    if (!container) return;
    this.injectStyles();
    if (!results) { container.innerHTML = '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:3rem;">No data</p>'; return; }
    
    const severity = this.determineSeverity(results);
    const { labValues, clinicalFindings } = this.separateFindings(results);
    
    let html = `<div class="elite-report" style="padding:1rem;">${this.renderSeverityHeader(severity, results)}`;
    
    if (clinicalFindings.length > 0) {
      html += `<div style="background:rgba(0,0,0,0.2);border-radius:12px;padding:1rem;margin-bottom:1rem;"><div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin-bottom:0.75rem;">Key Findings</div>${clinicalFindings.slice(0,5).map(f => `<div style="padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.85rem;color:rgba(255,255,255,0.85);">• ${this.escapeHtml(f.finding)}${f.value ? `<span style="color:#4ecdc4;margin-left:0.5rem;">${this.escapeHtml(f.value)}</span>` : ''}</div>`).join('')}</div>`;
    }
    
    if (labValues.length > 0) {
      const abnormal = labValues.filter(l => l.isAbnormal);
      if (abnormal.length > 0) {
        html += `<div style="background:rgba(0,0,0,0.2);border-radius:12px;padding:1rem;margin-bottom:1rem;"><div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#fca5a5;margin-bottom:0.75rem;">Abnormal Labs</div>${abnormal.slice(0,6).map(l => `<div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.9);font-size:0.85rem;">${this.escapeHtml(l.name)}</span><span style="font-family:monospace;color:#fca5a5;font-weight:600;">${this.escapeHtml(l.value)}</span></div>`).join('')}</div>`;
      }
    }
    
    if (results.recommendations && results.recommendations.length > 0) {
      html += this.renderManagementPlan(results.recommendations.slice(0, 4));
    }
    
    html += '</div>';
    container.innerHTML = html;
  },

  parseLabValue(text) {
    if (!text) return { name: 'Unknown', value: '-', reference: '-', status: 'abnormal', statusLabel: 'Abnormal', isAbnormal: true };
    
    let name = text, value = '-', reference = '-', status = 'abnormal', statusLabel = 'Abnormal';
    
    const refMatch = text.match(/\(([^)]+)\)/);
    if (refMatch) {
      reference = refMatch[1];
      const refLower = reference.toLowerCase();
      if (refLower.includes('markedly') || refLower.includes('critical')) { status = 'high'; statusLabel = 'Critical'; }
      else if (refLower.includes('elevated') || refLower.includes('high') || refLower.includes('>')) { status = 'high'; statusLabel = 'High'; }
      else if (refLower.includes('low') || refLower.includes('decreased') || refLower.includes('<')) { status = 'low'; statusLabel = 'Low'; }
    }
    
    const valueMatch = text.match(/^([A-Za-z\s\.\-\/]+?)\s*[:\*]?\s*([>]?\d+(?:\.\d+)?)\s*([A-Za-z\/%\/×\^0-9]*)/i);
    if (valueMatch) {
      name = valueMatch[1].trim();
      value = valueMatch[2] + (valueMatch[3] ? ' ' + valueMatch[3] : '');
    } else {
      const parenIndex = text.indexOf('(');
      if (parenIndex > 0) name = text.substring(0, parenIndex).trim();
    }
    
    if (text.match(/\sH[H]?\s*[)\s]|H$/i)) { status = 'high'; if (statusLabel === 'Abnormal') statusLabel = 'High'; }
    else if (text.match(/\sL[L]?\s*[)\s]|L$/i)) { status = 'low'; if (statusLabel === 'Abnormal') statusLabel = 'Low'; }
    
    return { name, value, reference, status, statusLabel, isAbnormal: true };
  },

  getStatusClass(status) {
    if (!status) return 'normal';
    const s = String(status).toLowerCase();
    if (s.includes('critical') || s.includes('high') || s.includes('elevated') || s === 'h' || s === 'hh') return 'high';
    if (s.includes('low') || s.includes('decreased') || s === 'l' || s === 'll') return 'low';
    if (s.includes('abnormal')) return 'high';
    return 'normal';
  },

  renderEmpty() {
    return `<div style="text-align:center;padding:4rem 2rem;color:rgba(255,255,255,0.4);"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom:1.5rem;opacity:0.3;"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg><p style="font-size:1rem;margin-bottom:0.5rem;">No Analysis Data</p><p style="font-size:0.85rem;opacity:0.7;">Upload a medical report to begin</p></div>`;
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
