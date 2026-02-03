// services/ai/rlhf-engine.js
// RLHF Engine - Reinforcement Learning from Human Feedback
//
// From the doc:
// "If they upvote 'Clinical Correlation,' the system appends
// 'Prioritize physiological mechanism explanations.'"

import { FeedbackStore } from './feedback-store.js';
import { Storage } from '../storage.adapter.js';

const HINTS_CACHE_KEY = 'rlhf_hints';
const MIN_FEEDBACK_COUNT = 10;

export const RLHFEngine = {
  /**
   * Record feedback on AI response
   * This is the recordFeedback function
   *
   * @param {object} feedback
   * @param {string} feedback.interactionId - The AI response being rated
   * @param {number} feedback.rating - 1-5 stars
   * @param {string} feedback.feedbackType - 'helpful' | 'unhelpful' | 'incorrect' | 'edited'
   * @param {string[]} feedback.issues - ['too_long', 'too_technical', 'missed_key_point']
   * @param {string[]} feedback.positives - ['concise', 'clinical_correlation', 'actionable']
   * @param {string} feedback.correction - Doctor's correction text
   * @param {string} feedback.queryType - 'labs' | 'drug' | 'differential' | 'oncall'
   */
  async recordFeedback(feedback) {
    const entry = {
      interactionId: feedback.interactionId,
      rating: feedback.rating,
      feedbackType: feedback.feedbackType,
      issues: feedback.issues || [],
      positives: feedback.positives || [],
      correction: feedback.correction || null,
      queryType: feedback.queryType,
      responseLength: feedback.responseLength,
      userId: feedback.userId,
      unitId: feedback.unitId
    };

    await FeedbackStore.add(entry);

    // Invalidate hints cache
    await Storage.meta.set(HINTS_CACHE_KEY + '_valid', false);

    return entry;
  },

  /**
   * Get optimized hints for prompts
   * This is the getOptimizedHints function
   *
   * @param {string} queryType - Type of query to get hints for
   * @returns {string} - Hint text to append to system prompt
   */
  async getOptimizedHints(queryType = null) {
    // Check cache
    const cacheValid = await Storage.meta.get(HINTS_CACHE_KEY + '_valid');
    if (cacheValid) {
      const cached = await Storage.meta.get(HINTS_CACHE_KEY);
      if (cached) {
        return queryType ? (cached[queryType] || cached.general || '') : (cached.general || '');
      }
    }

    // Generate hints from feedback patterns
    const allFeedback = await FeedbackStore.getAll();

    if (allFeedback.length < MIN_FEEDBACK_COUNT) {
      return ''; // Not enough data
    }

    const hints = this._generateHints(allFeedback);

    // Cache results
    await Storage.meta.set(HINTS_CACHE_KEY, hints);
    await Storage.meta.set(HINTS_CACHE_KEY + '_valid', true);

    return queryType ? (hints[queryType] || hints.general || '') : (hints.general || '');
  },

  /**
   * Analyze feedback and generate hint strings
   */
  _generateHints(feedback) {
    const total = feedback.length;
    const hints = {
      general: [],
      labs: [],
      drug: [],
      differential: [],
      oncall: [],
      clinical: []
    };

    // Count patterns
    const patterns = {
      tooLong: 0,
      tooBrief: 0,
      wantsClinicalCorrelation: 0,
      wantsActionable: 0,
      wantsBullets: 0,
      needsTrends: 0,
      needsDosing: 0,
      needsRedFlags: 0,
      tooTechnical: 0,
      missedDiagnosis: 0
    };

    feedback.forEach(f => {
      // Issues
      if (f.issues?.includes('too_long')) patterns.tooLong++;
      if (f.issues?.includes('too_brief')) patterns.tooBrief++;
      if (f.issues?.includes('no_trends')) patterns.needsTrends++;
      if (f.issues?.includes('no_dosing')) patterns.needsDosing++;
      if (f.issues?.includes('too_technical')) patterns.tooTechnical++;
      if (f.issues?.includes('missed_diagnosis')) patterns.missedDiagnosis++;
      if (f.issues?.includes('no_red_flags')) patterns.needsRedFlags++;

      // Positives
      if (f.positives?.includes('concise')) patterns.tooLong++; // Reinforce conciseness
      if (f.positives?.includes('clinical_correlation')) patterns.wantsClinicalCorrelation++;
      if (f.positives?.includes('actionable')) patterns.wantsActionable++;
      if (f.positives?.includes('good_format')) patterns.wantsBullets++;
    });

    // Generate hints based on >50% preference

    // Length preferences
    if (patterns.tooLong / total > 0.5) {
      hints.general.push('Be concise. Avoid lengthy explanations unless asked.');
    } else if (patterns.tooBrief / total > 0.4) {
      hints.general.push('Provide thorough explanations with reasoning.');
    }

    // Clinical correlation
    if (patterns.wantsClinicalCorrelation / total > 0.4) {
      hints.general.push('Prioritize physiological mechanism explanations.');
      hints.labs.push('Always correlate findings with potential clinical presentations.');
    }

    // Actionability
    if (patterns.wantsActionable / total > 0.4) {
      hints.general.push('Focus on immediately actionable recommendations.');
      hints.oncall.push('Lead with what to do first, then explain why.');
    }

    // Format
    if (patterns.wantsBullets / total > 0.5) {
      hints.general.push('Use bullet points for clarity.');
    }

    // Query-specific
    if (patterns.needsTrends / total > 0.3) {
      hints.labs.push('Always compare to previous values and describe trends.');
    }

    if (patterns.needsDosing / total > 0.3) {
      hints.drug.push('Include dosing adjustments for renal/hepatic impairment.');
    }

    if (patterns.needsRedFlags / total > 0.3) {
      hints.general.push('Always highlight red flags and dangerous diagnoses not to miss.');
      hints.differential.push('Start with dangerous diagnoses to rule out.');
    }

    if (patterns.tooTechnical / total > 0.3) {
      hints.general.push('Use clear, practical language. Avoid overly academic phrasing.');
    }

    // Convert arrays to strings
    const result = {};
    for (const [key, arr] of Object.entries(hints)) {
      result[key] = arr.length > 0
        ? '\n\nBased on this team\'s preferences:\n- ' + arr.join('\n- ')
        : '';
    }

    return result;
  },

  /**
   * Get feedback statistics
   */
  async getStats() {
    const feedback = await FeedbackStore.getAll();

    if (feedback.length === 0) {
      return { total: 0, averageRating: 0, byType: {}, topIssues: [], topPositives: [] };
    }

    const stats = {
      total: feedback.length,
      averageRating: feedback.reduce((sum, f) => sum + (f.rating || 0), 0) / feedback.length,
      byType: {},
      issues: {},
      positives: {}
    };

    feedback.forEach(f => {
      // By type
      const type = f.queryType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Issues
      f.issues?.forEach(issue => {
        stats.issues[issue] = (stats.issues[issue] || 0) + 1;
      });

      // Positives
      f.positives?.forEach(pos => {
        stats.positives[pos] = (stats.positives[pos] || 0) + 1;
      });
    });

    // Sort to find top issues/positives
    stats.topIssues = Object.entries(stats.issues)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    stats.topPositives = Object.entries(stats.positives)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return stats;
  }
};
