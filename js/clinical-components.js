/**
 * MedWard Master - Clinical Components
 * Beautiful, animated medical report rendering
 */

const ClinicalComponents = {
  
  /**
   * Render the detailed analysis view with animations
   */
  renderDetailedView(data) {
    const container = document.getElementById('detailed-view');
    if (!container) {
      console.error('Detailed view container not found');
      return;
    }
    
    console.log('Rendering detailed view with data:', data);
    
    let html = '';
    let delay = 0;
    
    // 1. Summary Box
    if (data.summary) {
      html += `
        <div class="result-summary" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
          <div class="summary-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            Clinical Summary
          </div>
          <div class="summary-text">${this.escapeHtml(data.summary)}</div>
        </div>
      `;
      delay += 100;
    }
    
    // 2. Urgent Alerts
    if (data.alerts && data.alerts.length > 0) {
      data.alerts.forEach(alert => {
        const severity = alert.severity || 'warning';
        html += `
          <div class="alert-banner ${severity}" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
            <div class="alert-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div class="alert-content">
              <div class="alert-title">${this.escapeHtml(alert.title)}</div>
              <div class="alert-text">${this.escapeHtml(alert.text)}</div>
            </div>
          </div>
        `;
        delay += 100;
      });
    }
    
    // 3. Key Findings Table
    if (data.findings && data.findings.length > 0) {
      html += `
        <div class="findings-section" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
          <div class="section-header">
            <div class="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
              </svg>
            </div>
            <h3 class="section-title">Key Findings</h3>
          </div>
          <table class="findings-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      data.findings.forEach(finding => {
        const statusClass = this.getStatusClass(finding.status);
        const statusIcon = this.getStatusIcon(finding.status);
        html += `
          <tr>
            <td class="param-name">${this.escapeHtml(finding.name)}</td>
            <td class="param-value">${this.escapeHtml(finding.value)}</td>
            <td class="param-ref">${this.escapeHtml(finding.reference || '-')}</td>
            <td>
              <span class="status-badge ${statusClass}">
                ${statusIcon}
                ${this.escapeHtml(finding.status)}
              </span>
            </td>
          </tr>
        `;
      });
      
      html += `
            </tbody>
          </table>
        </div>
      `;
      delay += 100;
    }
    
    // 4. Clinical Pearl
    if (data.clinicalPearl) {
      html += `
        <div class="pearl-box" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
          <div class="pearl-header">
            <svg class="pearl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
            <span class="pearl-label">Clinical Pearl</span>
          </div>
          <div class="pearl-text">${this.escapeHtml(data.clinicalPearl)}</div>
        </div>
      `;
      delay += 100;
    }
    
    // 5. Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
      html += `
        <div class="recommendations-section" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
          <div class="section-header">
            <div class="section-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h3 class="section-title">Recommendations</h3>
          </div>
          <div class="rec-list">
      `;
      
      data.recommendations.forEach((rec, index) => {
        const isUrgent = rec.urgent || index === 0;
        const text = typeof rec === 'string' ? rec : rec.text;
        html += `
          <div class="rec-item ${isUrgent ? 'urgent' : ''}">
            <span class="rec-number">${index + 1}</span>
            <span class="rec-text">${this.escapeHtml(text)}</span>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
      delay += 100;
    }
    
    // 6. Patient Explanation
    if (data.patientExplanation) {
      html += `
        <div class="patient-box" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
          <div class="patient-header">
            <svg class="patient-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span class="patient-label">Patient Explanation</span>
          </div>
          <div class="patient-text">${this.escapeHtml(data.patientExplanation)}</div>
        </div>
      `;
      delay += 100;
    }
    
    // 7. Discussion Points (Collapsible)
    if (data.discussionPoints && data.discussionPoints.length > 0) {
      html += `
        <div class="discussion-accordion" style="animation: fadeSlideUp 0.5s ease ${delay}ms both;">
          <button class="discussion-trigger" onclick="this.classList.toggle('open'); this.nextElementSibling.classList.toggle('show');">
            <span>Discussion Points (${data.discussionPoints.length})</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          <div class="discussion-content">
      `;
      
      data.discussionPoints.forEach(point => {
        html += `<div class="discussion-item">${this.escapeHtml(point)}</div>`;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    // Add animation keyframes
    html += `
      <style>
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    `;
    
    container.innerHTML = html;
  },
  
  /**
   * Render the ward presentation view
   */
  renderWardView(data) {
    const container = document.getElementById('ward-view');
    if (!container) {
      console.error('Ward view container not found');
      return;
    }
    
    console.log('Rendering ward view with data:', data);
    
    let html = '<div class="ward-grid" style="display: grid; gap: 1rem;">';
    
    // Assessment Card
    html += `
      <div class="ward-card" style="animation: fadeSlideUp 0.4s ease both;">
        <div class="ward-card-header">Assessment</div>
        <div class="ward-card-body">
          <div class="ward-row">
            <span class="ward-label">Diagnosis</span>
            <span class="ward-value">${this.escapeHtml(data.diagnosis || data.summary || 'Pending')}</span>
          </div>
          ${data.severity ? `
          <div class="ward-row">
            <span class="ward-label">Severity</span>
            <span class="ward-value">${this.escapeHtml(data.severity)}</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
    
    // Abnormal Values Card
    if (data.findings && data.findings.length > 0) {
      const abnormal = data.findings.filter(f => 
        f.status && !f.status.toLowerCase().includes('normal')
      );
      
      if (abnormal.length > 0) {
        html += `
          <div class="ward-card" style="animation: fadeSlideUp 0.4s ease 0.1s both;">
            <div class="ward-card-header">Abnormal Values</div>
            <div class="ward-card-body">
        `;
        
        abnormal.slice(0, 6).forEach(finding => {
          html += `
            <div class="ward-row">
              <span class="ward-label">${this.escapeHtml(finding.name)}</span>
              <span class="ward-value"><strong style="color: var(--accent-gold);">${this.escapeHtml(finding.value)}</strong> <span style="color: var(--text-muted);">(${this.escapeHtml(finding.status)})</span></span>
            </div>
          `;
        });
        
        html += `
            </div>
          </div>
        `;
      }
    }
    
    // Plan Card
    if (data.recommendations && data.recommendations.length > 0) {
      html += `
        <div class="ward-card" style="animation: fadeSlideUp 0.4s ease 0.2s both;">
          <div class="ward-card-header">Plan</div>
          <div class="ward-card-body">
      `;
      
      data.recommendations.slice(0, 5).forEach((rec, i) => {
        const text = typeof rec === 'string' ? rec : rec.text;
        html += `
          <div class="ward-row">
            <span class="ward-label">${i + 1}.</span>
            <span class="ward-value">${this.escapeHtml(text)}</span>
          </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    }
    
    html += '</div>';
    container.innerHTML = html;
  },
  
  /**
   * Get CSS class for status
   */
  getStatusClass(status) {
    if (!status) return 'normal';
    const s = status.toLowerCase();
    if (s.includes('high') || s.includes('critical') || s.includes('elevated')) return 'high';
    if (s.includes('low') || s.includes('decreased')) return 'low';
    return 'normal';
  },
  
  /**
   * Get icon SVG for status
   */
  getStatusIcon(status) {
    const statusClass = this.getStatusClass(status);
    if (statusClass === 'high') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';
    }
    if (statusClass === 'low') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
  },
  
  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClinicalComponents;
}
