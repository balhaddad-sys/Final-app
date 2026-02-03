// services/ai/context-engine.js
// Context Engine - Delta Analysis & Trend Detection
//
// This is the "contextSection" builder from v11.0 analyzeLabs
// "It doesn't just report 'Creatinine 120.' It reports
// 'Creatinine 120 (Up from 80 yesterday).'"

import { KUWAIT_REFERENCE_RANGES } from '../../../data/reference-ranges.js';

export const ContextEngine = {
  /**
   * Build context with delta analysis
   *
   * @param {object} currentLabs - Current lab values {name: value}
   * @param {object[]} labHistory - Previous results [{timestamp, values: {name: value}}]
   * @returns {object} - Context with deltas and trends
   */
  buildLabContext(currentLabs, labHistory = []) {
    const context = {
      current: {},
      deltas: {},
      trends: {},
      alerts: [],
      abnormals: []
    };

    // Sort history newest first
    const sorted = [...labHistory].sort((a, b) => b.timestamp - a.timestamp);
    const previous = sorted[0]?.values || {};
    const older = sorted[1]?.values || {};

    for (const [name, value] of Object.entries(currentLabs)) {
      context.current[name] = value;

      // Check if abnormal
      const range = KUWAIT_REFERENCE_RANGES[name];
      if (range) {
        if (value < range.low) {
          context.abnormals.push(`low_${name.toLowerCase().replace(/\s+/g, '_')}`);
        } else if (value > range.high) {
          context.abnormals.push(`high_${name.toLowerCase().replace(/\s+/g, '_')}`);
        }
        if (range.criticalLow && value < range.criticalLow) {
          context.abnormals.push(`critical_low_${name.toLowerCase().replace(/\s+/g, '_')}`);
          context.alerts.push(`CRITICAL: ${name} ${value} (Critical low <${range.criticalLow})`);
        }
        if (range.criticalHigh && value > range.criticalHigh) {
          context.abnormals.push(`critical_high_${name.toLowerCase().replace(/\s+/g, '_')}`);
          context.alerts.push(`CRITICAL: ${name} ${value} (Critical high >${range.criticalHigh})`);
        }
      }

      // Calculate delta if previous exists
      const prevValue = previous[name];
      if (prevValue !== undefined && prevValue !== null) {
        const delta = value - prevValue;
        const deltaPercent = prevValue !== 0 ? (delta / prevValue) * 100 : 0;

        context.deltas[name] = {
          absolute: delta,
          percent: deltaPercent,
          direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'stable',
          previous: prevValue,
          timeSince: this._formatTimeSince(sorted[0]?.timestamp)
        };

        // Calculate trend if we have 3+ data points
        const olderValue = older[name];
        if (olderValue !== undefined) {
          context.trends[name] = this._calculateTrend(olderValue, prevValue, value);
        }

        // Alert on significant changes
        const alert = this._checkSignificantChange(name, value, prevValue, deltaPercent);
        if (alert) context.alerts.push(alert);
      }
    }

    return context;
  },

  /**
   * Format context for AI prompt
   * This creates the "Creatinine 120 (Up from 80 yesterday)" format
   */
  formatForPrompt(context, patientInfo = {}) {
    let prompt = '';

    // Patient info
    if (patientInfo.age || patientInfo.sex) {
      prompt += `Patient: ${patientInfo.age || '?'}yo ${patientInfo.sex || ''}\n`;
    }
    if (patientInfo.diagnosis) {
      prompt += `Primary Dx: ${patientInfo.diagnosis}\n`;
    }
    if (patientInfo.comorbidities?.length) {
      prompt += `PMHx: ${patientInfo.comorbidities.join(', ')}\n`;
    }

    prompt += '\n=== Lab Results with Trends ===\n';

    for (const [name, value] of Object.entries(context.current)) {
      const range = KUWAIT_REFERENCE_RANGES[name];
      const unit = range?.unit || '';

      // Base value
      prompt += `${name}: ${value} ${unit}`;

      // Delta annotation
      const delta = context.deltas[name];
      if (delta) {
        const arrow = delta.direction === 'up' ? '\u2191' : delta.direction === 'down' ? '\u2193' : '\u2192';
        prompt += ` ${arrow} (was ${delta.previous} ${delta.timeSince})`;

        // Show percentage for significant changes
        if (Math.abs(delta.percent) > 15) {
          prompt += ` [${delta.percent > 0 ? '+' : ''}${Math.round(delta.percent)}%]`;
        }
      }

      // Trend
      const trend = context.trends[name];
      if (trend && trend !== 'stable') {
        prompt += ` \u2014 Trend: ${trend}`;
      }

      // Reference range
      if (range) {
        const flag = value < range.low ? 'L' : value > range.high ? 'H' : '';
        if (flag) prompt += ` [${flag}]`;
      }

      prompt += '\n';
    }

    // Critical alerts
    if (context.alerts.length > 0) {
      prompt += '\nALERTS:\n';
      context.alerts.forEach(alert => prompt += `- ${alert}\n`);
    }

    return prompt;
  },

  /**
   * Calculate trend from 3 data points
   */
  _calculateTrend(older, previous, current) {
    const delta1 = previous - older;     // First change
    const delta2 = current - previous;   // Second change

    // Threshold for "significant" change (5%)
    const threshold = Math.abs(older) * 0.05;

    const d1Sig = Math.abs(delta1) > threshold;
    const d2Sig = Math.abs(delta2) > threshold;

    if (!d1Sig && !d2Sig) return 'stable';

    if (delta1 > 0 && delta2 > 0) return 'rising';
    if (delta1 < 0 && delta2 < 0) return 'falling';
    if (delta1 > 0 && delta2 < 0) return 'peaked';
    if (delta1 < 0 && delta2 > 0) return 'recovering';
    if (delta1 > 0 && !d2Sig) return 'plateaued_high';
    if (delta1 < 0 && !d2Sig) return 'plateaued_low';

    return 'fluctuating';
  },

  /**
   * Check for clinically significant changes
   */
  _checkSignificantChange(name, current, previous, percentChange) {
    const thresholds = {
      'Creatinine': { percent: 50, message: 'Creatinine >50% rise \u2014 evaluate for AKI' },
      'Potassium': { percent: 20, message: 'Significant K+ change' },
      'Hemoglobin': { percent: 20, message: 'Significant Hb change \u2014 consider bleeding' },
      'Platelets': { percent: 30, message: 'Significant platelet change' },
      'WBC': { percent: 50, message: 'Significant WBC change' },
      'Troponin': { absolute: 0.04, message: 'Troponin rise \u2014 evaluate for ACS' },
      'Lactate': { absolute: 2, message: 'Lactate elevated \u2014 evaluate perfusion' }
    };

    const config = thresholds[name];
    if (!config) return null;

    if (config.percent && Math.abs(percentChange) > config.percent) {
      return `${config.message} (${percentChange > 0 ? '+' : ''}${Math.round(percentChange)}%)`;
    }

    if (config.absolute && current > config.absolute && previous <= config.absolute) {
      return config.message;
    }

    return null;
  },

  _formatTimeSince(timestamp) {
    if (!timestamp) return 'unknown';
    const hours = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
};
