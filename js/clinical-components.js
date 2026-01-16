/**
 * MedWard Clinical Components v3.1
 * Renders AI analysis results in a clean, professional format
 * Handles image-based lab report analysis with proper rendering
 */

const ClinicalComponents = {
  
  /**
   * Main render function - takes AI analysis result and renders to container
   */
  render(result, container) {
    if (!container) return;
    
    console.log('[ClinicalComponents] Raw input:', result);
    
    // Unwrap nested data structures
    let data = this.unwrapData(result);
    
    console.log('[ClinicalComponents] Unwrapped data:', data);
    
    if (!data) {
      container.innerHTML = this.renderEmpty();
      return;
    }

    // Build the HTML
    let html = '';
    
    // 1. Critical Alert Banner (if critical/emergency)
    const isCritical = this.checkCritical(data);
    if (isCritical) {
      html += this.renderCriticalBanner(data);
    }
    
    // 2. Summary Section (most important)
    if (data.summary) {
      html += this.renderSummary(data);
    }
    
    // 3. Extracted Text (collapsible, for image-based analysis)
    if (data.extractedText) {
      html += this.renderExtractedText(data.extractedText);
    }
    
    // 4. Abnormalities - render as nice table
    if (data.abnormalities && data.abnormalities.length > 0) {
      html += this.renderAbnormalities(data.abnormalities);
    }
    
    // 5. Actions/Recommendations
    const actions = data.action || data.actions || data.recommendations;
    if (actions) {
      html += this.renderActions(actions);
    }
    
    // 6. Clinical Discussion/Analysis
    const discussion = data.discussion || data.clinicalDiscussion || data.analysis || data.interpretation_details;
    if (discussion) {
      html += this.renderDiscussion(discussion);
    }
    
    // 7. Patient-Friendly Explanation
    if (data.patientFriendly) {
      html += this.renderPatientFriendly(data.patientFriendly);
    }
    
    // 8. Status/Value (if not already shown)
    if (data.status && !data.summary) {
      html += this.renderStatus(data.status);
    }
    
    // If nothing was rendered, show fallback
    if (!html) {
      html = this.renderFallback(data);
    }
    
    container.innerHTML = html;
    
    // Setup interactions
    this.setupAccordions(container);
  },

  /**
   * Unwrap potentially nested data structures
   */
  unwrapData(result) {
    if (!result) return null;
    
    let data = result;
    
    // Keep unwrapping common wrapper patterns
    const wrapperKeys = ['interpretation', 'result', 'analysis', 'data', 'response'];
    let maxDepth = 5;
    
    while (maxDepth > 0 && typeof data === 'object' && data !== null) {
      let unwrapped = false;
      
      for (const key of wrapperKeys) {
        if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
          // Check if the nested object has meaningful content
          if (data[key].summary || data[key].abnormalities || data[key].extractedText || data[key].header) {
            data = data[key];
            unwrapped = true;
            break;
          }
        }
      }
      
      if (!unwrapped) break;
      maxDepth--;
    }
    
    // If data is a string, try to parse as JSON
    if (typeof data === 'string') {
      try {
        data = data.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
        data = JSON.parse(data);
      } catch (e) {
        return { rawText: data };
      }
    }
    
    return data;
  },

  /**
   * Check if result indicates critical/emergency status
   */
  checkCritical(data) {
    const text = JSON.stringify(data).toLowerCase();
    return text.includes('critical') || 
           text.includes('emergency') || 
           text.includes('urgent') ||
           text.includes('immediate');
  },

  /**
   * Render critical alert banner
   */
  renderCriticalBanner(data) {
    const value = data.value || data.header || 'Critical findings detected - immediate clinical evaluation required';
    return `
      <div class="alert-banner critical">
        <div class="alert-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <div class="alert-content">
          <div class="alert-title">⚠️ Medical Emergency</div>
          <div class="alert-text">${this.escapeHtml(value)}</div>
        </div>
      </div>
    `;
  },

  /**
   * Render summary section
   */
  renderSummary(data) {
    const header = data.header || 'Analysis Summary';
    const summary = data.summary || '';
    
    let badgeClass = 'normal';
    let badgeText = 'Normal';
    const headerLower = header.toLowerCase();
    
    if (headerLower.includes('critical') || headerLower.includes('emergency')) {
      badgeClass = 'critical';
      badgeText = 'Critical';
    } else if (headerLower.includes('abnormal')) {
      badgeClass = 'abnormal';
      badgeText = 'Abnormal';
    }
    
    const cleanHeader = header
      .replace(/critical/gi, '')
      .replace(/abnormal/gi, '')
      .replace(/normal/gi, '')
      .replace(/-/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Lab Analysis';
    
    return `
      <div class="result-summary">
        <div class="summary-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          <span class="status-badge ${badgeClass}">${badgeText}</span>
          ${cleanHeader}
        </div>
        <p class="summary-text">${this.escapeHtml(summary)}</p>
      </div>
    `;
  },

  /**
   * Render extracted text from OCR (collapsible)
   */
  renderExtractedText(text) {
    if (!text) return '';
    
    return `
      <div class="discussion-accordion">
        <button class="discussion-trigger">
          <span>📄 Extracted Text from Report</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="discussion-content">
          <pre style="font-family:var(--font-mono,monospace);font-size:0.8rem;color:var(--text-secondary,rgba(255,255,255,0.7));white-space:pre-wrap;word-break:break-word;background:var(--surface,#1a1a25);padding:1rem;border-radius:8px;max-height:300px;overflow-y:auto;">${this.escapeHtml(text)}</pre>
        </div>
      </div>
    `;
  },

  /**
   * Render abnormalities as a professional table
   */
  renderAbnormalities(abnormalities) {
    if (!abnormalities || abnormalities.length === 0) return '';
    
    const items = abnormalities.map(item => {
      if (typeof item === 'string') {
        return this.parseAbnormalityString(item);
      }
      return {
        name: item.name || item.parameter || item.test || 'Unknown',
        value: item.value || item.result || '-',
        reference: item.reference || item.normal || item.ref || '-',
        status: this.determineStatus(item)
      };
    });
    
    return `
      <div class="findings-section">
        <div class="section-header">
          <div class="section-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h3 class="section-title">Abnormal Findings (${items.length})</h3>
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
            ${items.map(item => `
              <tr>
                <td class="param-name">${this.escapeHtml(item.name)}</td>
                <td class="param-value">${this.escapeHtml(String(item.value))}</td>
                <td class="param-ref">${this.escapeHtml(String(item.reference))}</td>
                <td>
                  <span class="status-badge ${item.status}">
                    ${item.status === 'high' ? '↑' : item.status === 'low' ? '↓' : '•'}
                    ${item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  /**
   * Parse an abnormality string
   */
  parseAbnormalityString(str) {
    let name = str;
    let value = '-';
    let reference = '-';
    let status = 'abnormal';
    
    const valueMatch = str.match(/(\d+(?:\.\d+)?)\s*([A-Za-z/%\/]+)?/);
    if (valueMatch) {
      value = valueMatch[1] + (valueMatch[2] ? ' ' + valueMatch[2] : '');
      name = str.substring(0, valueMatch.index).trim();
    }
    
    const refMatch = str.match(/\(([^)]+)\)/);
    if (refMatch) {
      reference = refMatch[1];
    }
    
    const strLower = str.toLowerCase();
    if (strLower.includes('high') || strLower.includes('elevated') || strLower.includes('>') || str.includes(' H)') || str.includes(' HH')) {
      status = 'high';
    } else if (strLower.includes('low') || strLower.includes('decreased') || strLower.includes('<') || str.includes(' L)') || str.includes(' LL')) {
      status = 'low';
    }
    
    name = name.replace(/["',]+/g, '').trim();
    if (!name) name = str.substring(0, 50);
    
    return { name, value, reference, status };
  },

  /**
   * Determine status from item data
   */
  determineStatus(item) {
    const text = JSON.stringify(item).toLowerCase();
    
    if (text.includes('critical') || text.includes('severe') || text.includes('markedly')) {
      return 'high';
    }
    if (text.includes('elevated') || text.includes('high') || text.includes('hh') || text.includes(' h)') || text.includes(' h"')) {
      return 'high';
    }
    if (text.includes('decreased') || text.includes('low') || text.includes('ll') || text.includes(' l)') || text.includes(' l"')) {
      return 'low';
    }
    return 'abnormal';
  },

  /**
   * Render actions/recommendations
   */
  renderActions(actions) {
    let items = [];
    
    if (typeof actions === 'string') {
      items = actions.split(/[,;]|\n|•/).map(s => s.trim()).filter(s => s && s.length > 3);
    } else if (Array.isArray(actions)) {
      items = actions.map(a => typeof a === 'string' ? a : (a.action || a.text || JSON.stringify(a)));
    } else {
      items = [String(actions)];
    }
    
    if (items.length === 0) return '';
    
    return `
      <div class="recommendations-section">
        <div class="section-header">
          <div class="section-icon" style="background:var(--accent-teal-dim,rgba(78,205,196,0.15));color:var(--accent-teal,#4ecdc4);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <h3 class="section-title">Recommended Actions</h3>
        </div>
        <div class="rec-list">
          ${items.map((item, i) => {
            const isUrgent = item.toLowerCase().includes('urgent') || 
                             item.toLowerCase().includes('immediate') ||
                             item.toLowerCase().includes('stat');
            return `
              <div class="rec-item ${isUrgent ? 'urgent' : ''}">
                <div class="rec-number">${i + 1}</div>
                <div class="rec-text">${this.escapeHtml(item)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render clinical discussion
   */
  renderDiscussion(discussion) {
    let items = [];
    
    if (typeof discussion === 'string') {
      items = discussion.split(/\n/).map(s => s.trim()).filter(s => s && s.length > 5);
      if (items.length === 0) items = [discussion];
    } else if (Array.isArray(discussion)) {
      items = discussion.map(d => typeof d === 'string' ? d : (d.text || d.point || JSON.stringify(d)));
    }
    
    if (items.length === 0) return '';
    
    return `
      <div class="discussion-accordion">
        <button class="discussion-trigger">
          <span>🔬 Clinical Discussion</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div class="discussion-content">
          ${items.map(item => `<div class="discussion-item">${this.escapeHtml(item)}</div>`).join('')}
        </div>
      </div>
    `;
  },

  /**
   * Render patient-friendly explanation
   */
  renderPatientFriendly(text) {
    if (!text) return '';
    
    return `
      <div class="patient-box">
        <div class="patient-header">
          <svg class="patient-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="patient-label">Patient-Friendly Explanation</span>
        </div>
        <p class="patient-text">${this.escapeHtml(text)}</p>
      </div>
    `;
  },

  /**
   * Render status section
   */
  renderStatus(status) {
    return `
      <div class="pearl-box">
        <div class="pearl-header">
          <svg class="pearl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span class="pearl-label">Status</span>
        </div>
        <p class="pearl-text">${this.escapeHtml(String(status))}</p>
      </div>
    `;
  },

  /**
   * Render raw text fallback
   */
  renderRawText(text) {
    return `
      <div class="result-summary">
        <div class="summary-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Analysis Result
        </div>
        <p class="summary-text" style="white-space:pre-wrap;font-family:var(--font-mono,monospace);font-size:0.85rem;">${this.escapeHtml(String(text))}</p>
      </div>
    `;
  },

  /**
   * Render empty state
   */
  renderEmpty() {
    return `
      <div style="text-align:center;padding:3rem;color:var(--text-muted,rgba(255,255,255,0.4));">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:1rem;opacity:0.5;">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <p>No analysis data available</p>
      </div>
    `;
  },

  /**
   * Render fallback for unrecognized structure
   */
  renderFallback(data) {
    if (!data || typeof data !== 'object') {
      return this.renderRawText(String(data));
    }
    
    let html = '<div class="result-summary"><div class="summary-label">Analysis Results</div>';
    
    const renderValue = (key, value, depth = 0) => {
      if (depth > 2 || value === null || value === undefined) return '';
      
      const label = this.formatKey(key);
      
      if (typeof value === 'string' && value.trim()) {
        return `
          <div style="margin:0.75rem 0;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle,rgba(255,255,255,0.06));">
            <div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent-gold,#f0c674);margin-bottom:0.25rem;">${label}</div>
            <div style="color:var(--text-secondary,rgba(255,255,255,0.7));line-height:1.6;">${this.escapeHtml(value)}</div>
          </div>
        `;
      }
      
      if (Array.isArray(value) && value.length > 0) {
        const items = value.map(v => typeof v === 'object' ? JSON.stringify(v) : v);
        return `
          <div style="margin:0.75rem 0;padding-bottom:0.75rem;border-bottom:1px solid var(--border-subtle,rgba(255,255,255,0.06));">
            <div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--accent-gold,#f0c674);margin-bottom:0.25rem;">${label}</div>
            <ul style="margin:0.5rem 0 0 1rem;padding:0;color:var(--text-secondary,rgba(255,255,255,0.7));">
              ${items.map(item => `<li style="margin-bottom:0.25rem;">${this.escapeHtml(String(item))}</li>`).join('')}
            </ul>
          </div>
        `;
      }
      
      if (typeof value === 'object' && Object.keys(value).length > 0) {
        let nested = '';
        for (const [k, v] of Object.entries(value)) {
          nested += renderValue(k, v, depth + 1);
        }
        if (nested) {
          return `
            <div style="margin:1rem 0;padding:1rem;background:var(--surface-2,#1a1a25);border-radius:8px;">
              <div style="font-weight:600;color:var(--text-primary,#fff);margin-bottom:0.5rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border-subtle,rgba(255,255,255,0.06));">${label}</div>
              ${nested}
            </div>
          `;
        }
      }
      
      return '';
    };
    
    for (const [key, value] of Object.entries(data)) {
      html += renderValue(key, value);
    }
    
    html += '</div>';
    return html;
  },

  /**
   * Format key for display
   */
  formatKey(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  },

  /**
   * Escape HTML
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  /**
   * Setup accordion interactions
   */
  setupAccordions(container) {
    const triggers = container.querySelectorAll('.discussion-trigger');
    triggers.forEach(trigger => {
      const newTrigger = trigger.cloneNode(true);
      trigger.parentNode.replaceChild(newTrigger, trigger);
      
      newTrigger.addEventListener('click', () => {
        const content = newTrigger.nextElementSibling;
        const isOpen = content.classList.contains('show');
        
        newTrigger.classList.toggle('open', !isOpen);
        content.classList.toggle('show', !isOpen);
      });
    });
  },

  /**
   * Render Ward View (simplified format)
   */
  renderWardView(result, container) {
    if (!container) return;
    
    let data = this.unwrapData(result);
    
    if (!data) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No data for ward view</p>';
      return;
    }

    let html = `
      <div class="ward-grid">
        <div class="ward-card">
          <div class="ward-card-header">Lab Analysis Summary</div>
          <div class="ward-card-body">
    `;
    
    const rows = [
      { label: 'Status', value: data.header || 'Analysis Complete' },
      { label: 'Summary', value: data.summary || '-' },
      { label: 'Action', value: data.action || '-' }
    ];
    
    rows.forEach(row => {
      if (row.value && row.value !== '-') {
        html += `
          <div class="ward-row">
            <div class="ward-label">${row.label}</div>
            <div class="ward-value">${this.escapeHtml(String(row.value))}</div>
          </div>
        `;
      }
    });
    
    if (data.abnormalities && data.abnormalities.length > 0) {
      html += `
        <div class="ward-row">
          <div class="ward-label">Abnormals</div>
          <div class="ward-value">
            ${data.abnormalities.slice(0, 5).map(a => {
              const text = typeof a === 'string' ? a : (a.name || JSON.stringify(a));
              return `<div style="margin-bottom:0.25rem;">• ${this.escapeHtml(text.substring(0, 60))}</div>`;
            }).join('')}
            ${data.abnormalities.length > 5 ? `<div style="color:var(--text-muted);">...and ${data.abnormalities.length - 5} more</div>` : ''}
          </div>
        </div>
      `;
    }
    
    html += `
          </div>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
  }
};

// Export
if (typeof window !== 'undefined') {
  window.ClinicalComponents = ClinicalComponents;
}
