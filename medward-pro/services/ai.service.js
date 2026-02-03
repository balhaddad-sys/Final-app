/**
 * AI Service - Claude API Integration
 * Handles clinical queries with structured output format
 * Implements de-identification and source citation
 */
import { Store } from '../core/store.js';
import { EventBus } from '../core/events.js';

const API_ENDPOINT = 'https://your-firebase-function.cloudfunctions.net/askClinical';

// Output sections clinicians want
const OUTPUT_SECTIONS = [
  'assessment',
  'red_flags',
  'immediate_actions',
  'differential',
  'workup',
  'treatment',
  'dosing',
  'references'
];

export const AI = {
  /**
   * Send clinical query to AI
   * @param {string} question - The clinical question
   * @param {object} context - Optional patient context (will be de-identified)
   * @param {object} options - Additional options
   */
  async askClinical(question, context = null, options = {}) {
    const startTime = Date.now();

    // De-identify context if provided
    const safeContext = context ? this._deidentify(context) : null;

    // Build request
    const request = {
      question,
      context: safeContext,
      outputFormat: 'structured',
      sections: options.sections || OUTPUT_SECTIONS,
      locale: options.locale || 'KW', // Kuwait for SI units
      timestamp: Date.now()
    };

    // Log for audit (without PHI)
    this._logQuery(question, !!context);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this._getAuthToken()}`
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`AI request failed: ${response.status}`);
      }

      const data = await response.json();

      // Parse structured response
      const result = this._parseStructuredResponse(data);

      // Track latency
      result.latencyMs = Date.now() - startTime;

      return result;

    } catch (error) {
      console.error('[AI] Query failed:', error);
      EventBus.emit('toast:show', { type: 'error', message: 'AI service unavailable' });
      throw error;
    }
  },

  /**
   * Analyze lab results
   */
  async analyzeLabs(labs, patientContext = null) {
    // Format labs for analysis
    const labSummary = this._formatLabs(labs);

    const question = `Analyze these lab results and provide clinical interpretation:\n${labSummary}`;

    return this.askClinical(question, patientContext, {
      sections: ['assessment', 'red_flags', 'immediate_actions', 'workup', 'references']
    });
  },

  /**
   * Get drug information
   */
  async getDrugInfo(drugName, indication = null, patientContext = null) {
    let question = `Provide clinical information for ${drugName}`;
    if (indication) {
      question += ` for ${indication}`;
    }

    // Include renal/hepatic context if available
    if (patientContext?.labs?.creatinine || patientContext?.labs?.egfr) {
      question += `. Patient has GFR/creatinine values that may affect dosing.`;
    }

    return this.askClinical(question, patientContext, {
      sections: ['assessment', 'dosing', 'red_flags', 'references']
    });
  },

  /**
   * On-call consultation
   */
  async oncallConsult(scenario, urgency = 'routine') {
    const question = `On-call consultation request (${urgency}):\n${scenario}`;

    const sections = urgency === 'urgent' || urgency === 'critical'
      ? ['red_flags', 'immediate_actions', 'assessment', 'workup', 'treatment']
      : OUTPUT_SECTIONS;

    return this.askClinical(question, null, { sections });
  },

  /**
   * De-identify patient context
   * Removes: name, MRN, DOB, specific dates
   * Keeps: age, sex, relevant clinical data
   */
  _deidentify(context) {
    const safe = {};

    // Demographics (de-identified)
    if (context.age) safe.age = context.age;
    if (context.sex) safe.sex = context.sex;
    if (context.weight) safe.weight = context.weight;

    // Clinical data (safe to include)
    if (context.diagnosis) safe.diagnosis = context.diagnosis;
    if (context.labs) safe.labs = context.labs;
    if (context.vitals) safe.vitals = context.vitals;
    if (context.medications) safe.medications = context.medications;
    if (context.allergies) safe.allergies = context.allergies;
    if (context.comorbidities) safe.comorbidities = context.comorbidities;

    // Explicitly exclude PHI
    // name, mrn, dob, address, phone - never included

    return safe;
  },

  /**
   * Parse AI response into structured sections
   */
  _parseStructuredResponse(data) {
    const result = {
      raw: data.answer || data.response || '',
      sections: {},
      confidence: data.confidence || null,
      sources: data.sources || [],
      model: data.model || 'unknown',
      disclaimer: 'This is AI-generated clinical decision support. Always verify with current guidelines and clinical judgment.'
    };

    // If response is already structured
    if (data.structured) {
      result.sections = data.structured;
      return result;
    }

    // Parse markdown sections from raw response
    const sectionRegex = /##\s*([\w\s]+)\n([\s\S]*?)(?=##|$)/gi;
    let match;

    while ((match = sectionRegex.exec(result.raw)) !== null) {
      const sectionName = match[1].toLowerCase().trim().replace(/\s+/g, '_');
      const sectionContent = match[2].trim();

      if (OUTPUT_SECTIONS.includes(sectionName)) {
        result.sections[sectionName] = this._parseSection(sectionContent);
      }
    }

    return result;
  },

  /**
   * Parse individual section content
   */
  _parseSection(content) {
    // Check if it's a list
    const lines = content.split('\n').filter(l => l.trim());
    const isList = lines.every(l => l.trim().startsWith('-') || l.trim().startsWith('•'));

    if (isList) {
      return {
        type: 'list',
        items: lines.map(l => l.replace(/^[-•]\s*/, '').trim())
      };
    }

    return {
      type: 'text',
      content: content
    };
  },

  /**
   * Format labs for AI consumption
   */
  _formatLabs(labs) {
    if (Array.isArray(labs)) {
      return labs.map(l => `${l.name}: ${l.value} ${l.unit || ''} ${l.flag || ''}`).join('\n');
    }

    return Object.entries(labs)
      .map(([key, val]) => `${key}: ${val}`)
      .join('\n');
  },

  /**
   * Log query for audit (without sensitive data)
   */
  _logQuery(question, hasContext) {
    // This would typically go to your audit service
    console.log('[AI Audit]', {
      timestamp: Date.now(),
      userId: Store.get('user')?.uid,
      queryLength: question.length,
      hasPatientContext: hasContext,
      // Do NOT log the actual question or context
    });
  },

  /**
   * Get auth token for API
   */
  async _getAuthToken() {
    const { auth } = await import('./firebase.config.js');
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  }
};
