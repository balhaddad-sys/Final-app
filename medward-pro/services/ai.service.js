/**
 * AI Service - Firebase Cloud Functions Integration
 * Handles clinical queries with structured output format
 * Implements de-identification and source citation
 */
import { functions, auth } from './firebase.config.js';
import { httpsCallable } from 'firebase/functions';
import { onAuthStateChanged } from 'firebase/auth';
import { Store } from '../core/store.js';
import { EventBus } from '../core/events.js';

// Firebase callable functions
const askClinicalFn = httpsCallable(functions, 'askClinical');
const getDrugInfoFn = httpsCallable(functions, 'getDrugInfo');
const getAntibioticGuidanceFn = httpsCallable(functions, 'getAntibioticGuidance');

// Auth readiness guard - wait for Firebase auth state to resolve before
// making function calls. Without this, calls fire before onAuthStateChanged
// resolves, sending no ID token and causing "unauthenticated" errors.
let _authReady = false;
let _authReadyResolve;
const _authReadyPromise = new Promise((resolve) => { _authReadyResolve = resolve; });
const _unsubAuth = onAuthStateChanged(auth, (user) => {
  _authReady = true;
  _authReadyResolve(user);
  _unsubAuth();
});
async function _waitForAuth() {
  if (_authReady) return;
  await Promise.race([
    _authReadyPromise,
    new Promise((resolve) => setTimeout(resolve, 10000))
  ]);
}

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

    // Wait for auth state to resolve before calling Cloud Functions
    await _waitForAuth();
    if (!auth.currentUser) {
      return {
        sections: {
          error: { type: 'text', content: 'You must be logged in to use the AI Assistant. Please log in first.' }
        },
        disclaimer: 'Authentication required'
      };
    }

    // De-identify context if provided
    const safeContext = context ? this._deidentify(context) : null;

    // Log for audit (without PHI)
    this._logQuery(question, !!context);

    try {
      const result = await askClinicalFn({
        question,
        context: safeContext
      });

      const data = result.data;

      // Parse structured response
      const parsed = this._parseStructuredResponse(data);
      parsed.latencyMs = Date.now() - startTime;

      return parsed;

    } catch (error) {
      console.error('[AI] Query failed:', error);
      console.error('[AI] Error details:', { code: error?.code, message: error?.message, details: error?.details });

      // Return structured error for display
      const errorMsg = error?.message || 'AI service unavailable';
      const errorCode = error?.code || '';

      if (errorMsg.includes('ANTHROPIC_API_KEY') || errorMsg.includes('not configured') || errorCode === 'functions/failed-precondition') {
        return {
          sections: {
            error: { type: 'text', content: 'AI service is not configured. The ANTHROPIC_API_KEY secret needs to be set in Firebase Cloud Functions secrets.' }
          },
          disclaimer: 'Service configuration required'
        };
      }
      if (errorCode === 'functions/unauthenticated' || errorCode === 'unauthenticated') {
        return {
          sections: {
            error: { type: 'text', content: 'You must be logged in to use the AI Assistant. Please log in first.' }
          },
          disclaimer: 'Authentication required'
        };
      }
      if (errorCode === 'functions/not-found' || errorMsg.includes('NOT_FOUND') || errorMsg.includes('could not be found')) {
        return {
          sections: {
            error: { type: 'text', content: 'AI Cloud Functions are not deployed. Deploy with: firebase deploy --only functions' }
          },
          disclaimer: 'Deployment required'
        };
      }
      if (errorCode === 'functions/resource-exhausted' || errorCode === 'resource-exhausted') {
        return {
          sections: {
            error: { type: 'text', content: 'Rate limit reached. Please wait a moment before trying again.' }
          },
          disclaimer: 'Rate limited'
        };
      }

      return {
        sections: {
          error: { type: 'text', content: `AI Error (${errorCode || 'unknown'}): ${errorMsg}. Check the browser console (F12) for details.` }
        },
        disclaimer: 'Service error'
      };
    }
  },

  /**
   * Get drug information
   */
  async getDrugInfo(drugName, indication = null, patientContext = null) {
    const startTime = Date.now();

    await _waitForAuth();
    if (!auth.currentUser) {
      return {
        sections: { error: { type: 'text', content: 'You must be logged in to use Drug Info.' } },
        disclaimer: 'Authentication required'
      };
    }

    try {
      const result = await getDrugInfoFn({
        drugName,
        indication: indication || undefined
      });

      const parsed = this._parseStructuredResponse(result.data);
      parsed.latencyMs = Date.now() - startTime;
      return parsed;

    } catch (error) {
      console.error('[AI] Drug info failed:', error);
      return {
        sections: {
          error: { type: 'text', content: `Failed to get drug information: ${error.message}` }
        },
        disclaimer: 'Service error'
      };
    }
  },

  /**
   * Get antibiotic guidance
   */
  async getAntibioticGuidance(condition, factors = {}) {
    const startTime = Date.now();

    await _waitForAuth();
    if (!auth.currentUser) {
      return {
        sections: { error: { type: 'text', content: 'You must be logged in to use Antibiotic Guide.' } },
        disclaimer: 'Authentication required'
      };
    }

    try {
      const result = await getAntibioticGuidanceFn({
        condition,
        patientFactors: factors
      });

      const parsed = this._parseStructuredResponse(result.data);
      parsed.latencyMs = Date.now() - startTime;
      return parsed;

    } catch (error) {
      console.error('[AI] Antibiotic guidance failed:', error);
      return {
        sections: {
          error: { type: 'text', content: `Failed to get antibiotic guidance: ${error.message}` }
        },
        disclaimer: 'Service error'
      };
    }
  },

  /**
   * On-call consultation
   */
  async oncallConsult(scenario, urgency = 'routine') {
    const question = `On-call consultation request (${urgency}):\n${scenario}`;
    return this.askClinical(question);
  },

  /**
   * De-identify patient context
   */
  _deidentify(context) {
    const safe = {};
    if (context.age) safe.age = context.age;
    if (context.sex) safe.sex = context.sex;
    if (context.weight) safe.weight = context.weight;
    if (context.diagnosis) safe.diagnosis = context.diagnosis;
    if (context.labs) safe.labs = context.labs;
    if (context.vitals) safe.vitals = context.vitals;
    if (context.medications) safe.medications = context.medications;
    if (context.allergies) safe.allergies = context.allergies;
    if (context.comorbidities) safe.comorbidities = context.comorbidities;
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
      disclaimer: data.disclaimer || 'This is AI-generated clinical decision support. Always verify with current guidelines and clinical judgment.'
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

    // If no sections parsed, create one from the raw text
    if (Object.keys(result.sections).length === 0 && result.raw) {
      result.sections.assessment = {
        type: 'text',
        content: result.raw
      };
    }

    return result;
  },

  /**
   * Parse individual section content
   */
  _parseSection(content) {
    const lines = content.split('\n').filter(l => l.trim());
    const isList = lines.every(l => l.trim().startsWith('-') || l.trim().startsWith('*') || /^\d+\./.test(l.trim()));

    if (isList) {
      return {
        type: 'list',
        items: lines.map(l => l.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      };
    }

    return {
      type: 'text',
      content: content
    };
  },

  /**
   * Log query for audit (without sensitive data)
   */
  _logQuery(question, hasContext) {
    console.log('[AI Audit]', {
      timestamp: Date.now(),
      userId: Store.get('user')?.uid,
      queryLength: question.length,
      hasPatientContext: hasContext,
    });
  }
};
