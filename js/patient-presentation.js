/**
 * MedWard Patient Presentation Module
 * Implements SBAR (Situation-Background-Assessment-Recommendation) format
 * for ward rounds and clinical communication
 */

const PatientPresentation = {

  /**
   * Generate SBAR presentation from parsed data and analysis results
   */
  generateSBARPresentation(parsedData, analysisResults) {
    return {
      situation: this.buildSituation(parsedData, analysisResults),
      background: this.buildBackground(parsedData, analysisResults),
      assessment: this.buildAssessment(parsedData, analysisResults),
      recommendation: this.buildRecommendation(analysisResults)
    };
  },

  /**
   * Build Situation section
   * Brief description of current patient status
   */
  buildSituation(data, results) {
    const parts = [];

    // Patient demographics if available
    const demographics = data.demographics || {};
    if (demographics.age || demographics.gender) {
      parts.push(`${demographics.age || ''}yo ${demographics.gender || 'patient'}`);
    }

    // Chief complaint
    if (data.chiefComplaint) {
      parts.push(`presenting with ${data.chiefComplaint}`);
    } else if (results.summary) {
      const summaryPreview = results.summary.substring(0, 80);
      parts.push(summaryPreview);
    }

    // Duration
    if (data.hpi?.duration) {
      parts.push(`for ${data.hpi.duration}`);
    }

    // Current stability from critical alerts
    const criticalCount = results.alerts?.filter(a => a.severity === 'critical').length || 0;
    if (criticalCount > 0) {
      parts.push(`Currently UNSTABLE (${criticalCount} critical findings)`);
    } else if (data.vitals) {
      const stability = this.assessStability(data.vitals);
      parts.push(`Currently ${stability}`);
    }

    return parts.join(', ');
  },

  /**
   * Build Background section
   * Relevant medical history and context
   */
  buildBackground(data, results) {
    const sections = [];

    // Past Medical History
    if (data.pmh?.conditions?.length > 0) {
      sections.push({
        label: 'PMH',
        content: data.pmh.conditions.join(', ')
      });
    }

    // Current medications
    if (data.medications?.length > 0) {
      const medList = data.medications
        .slice(0, 5)
        .map(m => typeof m === 'string' ? m : m.name)
        .join(', ');
      sections.push({
        label: 'Medications',
        content: medList + (data.medications.length > 5 ? ` (+${data.medications.length - 5} more)` : '')
      });
    }

    // Relevant history from HPI
    if (data.hpi?.symptoms?.length > 0) {
      sections.push({
        label: 'Symptoms',
        content: data.hpi.symptoms.join(', ')
      });
    }

    // Recent lab trends if available
    if (data.tests && Object.keys(data.tests).length > 0) {
      const trendingTests = Object.entries(data.tests)
        .filter(([, test]) => test.trend && test.trend !== 'unknown' && test.trend !== 'stable')
        .slice(0, 3);

      if (trendingTests.length > 0) {
        sections.push({
          label: 'Lab Trends',
          content: trendingTests.map(([name, test]) => `${name} ${test.trend}`).join(', ')
        });
      }
    }

    return sections;
  },

  /**
   * Build Assessment section
   * Clinical interpretation and diagnoses
   */
  buildAssessment(data, results) {
    const assessments = [];

    // Primary diagnosis from results
    if (results.diagnosis) {
      assessments.push({
        rank: 1,
        diagnosis: results.diagnosis,
        confidence: 'high',
        severity: results.severity || 'moderate'
      });
    }

    // Add AI-identified abnormalities
    if (results.interpretation?.abnormalities) {
      results.interpretation.abnormalities.forEach((abnl, i) => {
        const text = typeof abnl === 'string' ? abnl : (abnl.text || abnl);
        if (text && !assessments.find(a => a.diagnosis === text)) {
          assessments.push({
            rank: i + 2,
            diagnosis: text,
            confidence: 'medium'
          });
        }
      });
    }

    // Add clinical patterns from parser
    if (data.clinicalPatterns?.length > 0) {
      data.clinicalPatterns.forEach((pattern, i) => {
        if (!assessments.find(a => a.diagnosis.includes(pattern.name))) {
          assessments.push({
            rank: assessments.length + 1,
            diagnosis: pattern.name + (pattern.type ? ` (${pattern.type})` : ''),
            confidence: pattern.confidence >= 0.9 ? 'high' : 'medium',
            suggestion: pattern.suggestion
          });
        }
      });
    }

    return assessments.slice(0, 5); // Top 5 assessments
  },

  /**
   * Build Recommendation section
   * Actionable next steps
   */
  buildRecommendation(results) {
    const recs = [];

    // Urgent actions first (from critical alerts)
    if (results.criticalAlerts?.length > 0 || results.alerts?.some(a => a.severity === 'critical')) {
      const criticals = results.alerts?.filter(a => a.severity === 'critical') || results.criticalAlerts || [];
      criticals.forEach(alert => {
        recs.push({
          priority: 'urgent',
          action: typeof alert === 'string' ? alert : (alert.text || alert.title),
          rationale: 'Critical finding requiring immediate attention'
        });
      });
    }

    // Standard recommendations from AI
    if (results.recommendations) {
      results.recommendations.forEach((rec, i) => {
        const recText = typeof rec === 'string' ? rec : (rec.text || rec);
        recs.push({
          priority: i === 0 && recs.length === 0 ? 'high' : 'standard',
          action: recText,
          rationale: rec.rationale || ''
        });
      });
    } else if (results.presentation?.recommendations) {
      results.presentation.recommendations.forEach((rec, i) => {
        recs.push({
          priority: i === 0 && recs.length === 0 ? 'high' : 'standard',
          action: typeof rec === 'string' ? rec : rec.text,
          rationale: ''
        });
      });
    }

    // Add watch items if no recommendations
    if (recs.length === 0 && results.watchFor?.length > 0) {
      results.watchFor.forEach(item => {
        recs.push({
          priority: 'standard',
          action: `Monitor: ${item}`,
          rationale: ''
        });
      });
    }

    return recs;
  },

  /**
   * Assess patient stability from vital signs
   */
  assessStability(vitals) {
    let unstableCount = 0;

    // Check vital signs against normal ranges
    if (vitals.bp) {
      const [sys, dia] = vitals.bp.value.split('/').map(Number);
      if (sys < 90 || sys > 180 || dia < 60 || dia > 110) unstableCount++;
    }

    if (vitals.hr) {
      const hr = parseFloat(vitals.hr.value);
      if (hr < 50 || hr > 120) unstableCount++;
    }

    if (vitals.rr) {
      const rr = parseFloat(vitals.rr.value);
      if (rr < 12 || rr > 25) unstableCount++;
    }

    if (vitals.spo2) {
      const spo2 = parseFloat(vitals.spo2.value);
      if (spo2 < 92) unstableCount++;
    }

    if (vitals.temp) {
      const temp = parseFloat(vitals.temp.value);
      if (temp < 36 || temp > 38.5) unstableCount++;
    }

    if (unstableCount >= 2) return 'unstable';
    if (unstableCount === 1) return 'concerning';
    return 'stable';
  },

  /**
   * Render SBAR presentation as HTML
   */
  renderSBARPresentation(sbar) {
    return `
      <div class="sbar-presentation">
        <!-- SITUATION -->
        <div class="sbar-section situation">
          <div class="sbar-label">S</div>
          <div class="sbar-content">
            <h4>Situation</h4>
            <p>${this.escapeHtml(sbar.situation)}</p>
          </div>
        </div>

        <!-- BACKGROUND -->
        <div class="sbar-section background">
          <div class="sbar-label">B</div>
          <div class="sbar-content">
            <h4>Background</h4>
            ${sbar.background.map(b => `
              <div class="bg-item">
                <span class="bg-label">${this.escapeHtml(b.label)}:</span>
                <span class="bg-value">${this.escapeHtml(b.content)}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ASSESSMENT -->
        <div class="sbar-section assessment">
          <div class="sbar-label">A</div>
          <div class="sbar-content">
            <h4>Assessment</h4>
            ${sbar.assessment.map(a => `
              <div class="assessment-item ${a.confidence}">
                <span class="dx-rank">${a.rank}</span>
                <span class="dx-text">${this.escapeHtml(a.diagnosis)}</span>
                ${a.suggestion ? `<span class="dx-suggestion">${this.escapeHtml(a.suggestion)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- RECOMMENDATION -->
        <div class="sbar-section recommendation">
          <div class="sbar-label">R</div>
          <div class="sbar-content">
            <h4>Recommendation</h4>
            ${sbar.recommendation.map(r => `
              <div class="rec-item ${r.priority}">
                <span class="rec-priority">${r.priority === 'urgent' ? '🔴' : r.priority === 'high' ? '🟡' : '🟢'}</span>
                <div class="rec-details">
                  <span class="rec-action">${this.escapeHtml(r.action)}</span>
                  ${r.rationale ? `<span class="rec-rationale">${this.escapeHtml(r.rationale)}</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  /**
   * Generate Quick Glance Summary Card
   * One-glance summary for busy ward rounds
   */
  renderQuickGlance(data, results) {
    const criticals = results.alerts?.filter(a => a.severity === 'critical').length || 0;
    const abnormals = results.findings?.filter(f => f.status !== 'Normal').length || 0;

    // Calculate stability
    let stabilityClass = 'stable';
    let stabilityText = 'Stable';
    let stabilityIcon = '✓';

    if (criticals > 0) {
      stabilityClass = 'critical';
      stabilityText = 'Critical';
      stabilityIcon = '⚠️';
    } else if (abnormals > 0) {
      stabilityClass = 'abnormal';
      stabilityText = 'Abnormal';
      stabilityIcon = '⚡';
    }

    return `
      <div class="quick-glance ${stabilityClass}">
        <div class="qg-header">
          <span class="qg-icon">${stabilityIcon}</span>
          <div class="qg-patient">
            <span class="qg-demo">${data.demographics?.age || '?'}yo ${data.demographics?.gender || ''}</span>
            <span class="qg-cc">${data.chiefComplaint || results.diagnosis || 'Medical Analysis'}</span>
          </div>
          <span class="qg-status ${stabilityClass}">${stabilityText}</span>
        </div>

        <div class="qg-stats">
          ${criticals > 0 ? `<div class="qg-stat critical"><span class="qg-stat-num">${criticals}</span><span class="qg-stat-label">Critical</span></div>` : ''}
          ${abnormals > 0 ? `<div class="qg-stat abnormal"><span class="qg-stat-num">${abnormals}</span><span class="qg-stat-label">Abnormal</span></div>` : ''}
          ${criticals === 0 && abnormals === 0 ? '<div class="qg-stat stable"><span class="qg-stat-label">All values normal</span></div>' : ''}
        </div>

        ${data.vitals ? `
        <div class="qg-vitals">
          ${data.vitals.bp ? `<span class="qg-vital">BP: ${data.vitals.bp.value}</span>` : ''}
          ${data.vitals.hr ? `<span class="qg-vital">HR: ${data.vitals.hr.value}</span>` : ''}
          ${data.vitals.rr ? `<span class="qg-vital">RR: ${data.vitals.rr.value}</span>` : ''}
          ${data.vitals.temp ? `<span class="qg-vital">Temp: ${data.vitals.temp.value}</span>` : ''}
          ${data.vitals.spo2 ? `<span class="qg-vital">SpO2: ${data.vitals.spo2.value}%</span>` : ''}
        </div>
        ` : ''}
      </div>
    `;
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  /**
   * Inject SBAR styles into the page
   */
  injectStyles() {
    if (document.getElementById('sbar-styles')) return;

    const style = document.createElement('style');
    style.id = 'sbar-styles';
    style.textContent = `
      /* SBAR Presentation Styles */
      .sbar-presentation {
        display: grid;
        gap: 1rem;
        margin: 1rem 0;
      }

      .sbar-section {
        display: flex;
        gap: 1rem;
        background: rgba(15, 23, 42, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 1.25rem;
        transition: all 0.2s;
      }

      .sbar-section:hover {
        background: rgba(15, 23, 42, 0.7);
        border-color: rgba(255, 255, 255, 0.1);
      }

      .sbar-label {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      .sbar-section.situation .sbar-label {
        background: linear-gradient(135deg, #3b82f6, #2563eb);
        color: white;
      }

      .sbar-section.background .sbar-label {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
      }

      .sbar-section.assessment .sbar-label {
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: white;
      }

      .sbar-section.recommendation .sbar-label {
        background: linear-gradient(135deg, #10b981, #059669);
        color: white;
      }

      .sbar-content {
        flex: 1;
      }

      .sbar-content h4 {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 0.75rem 0;
        color: rgba(255, 255, 255, 0.9);
      }

      .sbar-content p {
        font-size: 0.9rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.8);
        margin: 0;
      }

      .bg-item {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        font-size: 0.85rem;
      }

      .bg-item:last-child {
        border-bottom: none;
      }

      .bg-label {
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        min-width: 100px;
      }

      .bg-value {
        color: rgba(255, 255, 255, 0.85);
      }

      .assessment-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        margin-bottom: 0.5rem;
        border-left: 3px solid;
      }

      .assessment-item.high {
        border-left-color: #10b981;
      }

      .assessment-item.medium {
        border-left-color: #f59e0b;
      }

      .dx-rank {
        width: 24px;
        height: 24px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: 700;
        flex-shrink: 0;
      }

      .dx-text {
        flex: 1;
        font-size: 0.85rem;
        color: rgba(255, 255, 255, 0.85);
      }

      .dx-suggestion {
        display: block;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 0.25rem;
        font-style: italic;
      }

      .rec-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        margin-bottom: 0.5rem;
      }

      .rec-item.urgent {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      .rec-priority {
        font-size: 1.25rem;
        flex-shrink: 0;
      }

      .rec-details {
        flex: 1;
      }

      .rec-action {
        display: block;
        font-size: 0.85rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.9);
        margin-bottom: 0.25rem;
      }

      .rec-rationale {
        display: block;
        font-size: 0.75rem;
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
      }

      /* Quick Glance Styles */
      .quick-glance {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6));
        border: 2px solid;
        border-radius: 14px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
      }

      .quick-glance.stable {
        border-color: #10b981;
      }

      .quick-glance.abnormal {
        border-color: #f59e0b;
      }

      .quick-glance.critical {
        border-color: #ef4444;
        animation: pulse-critical 2s ease-in-out infinite;
      }

      @keyframes pulse-critical {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
        50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
      }

      .qg-header {
        display: flex;
        align-items: center;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .qg-icon {
        font-size: 2rem;
      }

      .qg-patient {
        flex: 1;
      }

      .qg-demo {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.6);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .qg-cc {
        display: block;
        font-size: 1.1rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.95);
        margin-top: 0.25rem;
      }

      .qg-status {
        padding: 0.5rem 1rem;
        border-radius: 100px;
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .qg-status.stable {
        background: rgba(16, 185, 129, 0.2);
        color: #6ee7b7;
      }

      .qg-status.abnormal {
        background: rgba(245, 158, 11, 0.2);
        color: #fcd34d;
      }

      .qg-status.critical {
        background: rgba(239, 68, 68, 0.2);
        color: #fca5a5;
      }

      .qg-stats {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .qg-stat {
        flex: 1;
        text-align: center;
        padding: 0.75rem;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
      }

      .qg-stat-num {
        display: block;
        font-size: 1.5rem;
        font-weight: 700;
        font-family: 'IBM Plex Mono', monospace;
      }

      .qg-stat.critical .qg-stat-num {
        color: #fca5a5;
      }

      .qg-stat.abnormal .qg-stat-num {
        color: #fcd34d;
      }

      .qg-stat-label {
        display: block;
        font-size: 0.65rem;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 0.25rem;
      }

      .qg-vitals {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .qg-vital {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.8rem;
        color: rgba(255, 255, 255, 0.7);
      }
    `;

    document.head.appendChild(style);
  }
};

// Export
if (typeof window !== 'undefined') {
  window.PatientPresentation = PatientPresentation;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PatientPresentation;
}
