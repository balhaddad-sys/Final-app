// services/ai/ai-service.js
// Unified AI Service - integrates RAG, RLHF, Context Engine, Multi-Modal Prompts
//
// Integrates:
// - RAG (institutional memory)
// - RLHF (feedback-based optimization)
// - Context Engine (delta analysis)
// - Multi-Modal Prompts
// - Existing Cloud Functions

import { RAGEngine } from './rag-engine.js';
import { RLHFEngine } from './rlhf-engine.js';
import { ContextEngine } from './context-engine.js';
import { MultiModalPrompts } from './multimodal-prompts.js';
import { LearningStore } from './learning-store.js';
import { Store } from '../../core/store.js';
import { EventBus } from '../../core/core.events.js';
import { CloudFunctions } from '../firebase.functions.js';
import { Monitor } from '../../monitor/monitor.core.js';

export const AI = {
  /**
   * Main clinical query with full intelligence pipeline
   */
  async askClinical(query, options = {}) {
    const {
      patientContext = null,
      labHistory = [],
      type = null,
      model = 'claude-haiku-4-5'
    } = options;

    const startTime = Date.now();
    const detectedType = type || MultiModalPrompts.detectType(query);

    Monitor.log('AI', `Clinical query [${detectedType}]: ${query.substring(0, 50)}...`);

    // 1. Build context with delta analysis
    let contextPrompt = '';
    let abnormals = [];

    if (patientContext?.labs) {
      const labContext = ContextEngine.buildLabContext(patientContext.labs, labHistory);
      contextPrompt = ContextEngine.formatForPrompt(labContext, patientContext);
      abnormals = labContext.abnormals;
    }

    // 2. RAG - Find relevant examples from institutional memory
    const ragScenario = {
      type: detectedType,
      abnormals,
      diagnosis: patientContext?.diagnosis
    };
    let relevantExamples = [];
    try {
      relevantExamples = await RAGEngine.findRelevantExamples(ragScenario);
    } catch (e) {
      Monitor.log('AI', 'RAG lookup failed, proceeding without', null, 'warn');
    }
    const ragInjection = RAGEngine.buildContextInjection(relevantExamples);

    // 3. RLHF - Get optimized hints based on team feedback
    let hints = '';
    try {
      hints = await RLHFEngine.getOptimizedHints(detectedType);
    } catch (e) {
      Monitor.log('AI', 'RLHF hints failed, proceeding without', null, 'warn');
    }

    // 4. Build final prompt
    const systemPrompt = MultiModalPrompts.getSystemPrompt(detectedType, 'KW');
    const fullSystemPrompt = systemPrompt + hints + ragInjection;

    const userPrompt = contextPrompt
      ? `${contextPrompt}\n\nQuestion: ${query}`
      : query;

    // 5. Call Cloud Function
    const response = await CloudFunctions.askClinical(userPrompt, fullSystemPrompt, model);

    // 6. Track for learning
    const interactionId = crypto.randomUUID();
    response.interactionId = interactionId;
    response.latencyMs = Date.now() - startTime;
    response.type = detectedType;
    response.ragMatchCount = relevantExamples.length;

    // Store for potential feedback
    this._storeInteraction(interactionId, {
      query,
      response: response.answer,
      type: detectedType,
      abnormals,
      diagnosis: patientContext?.diagnosis
    });

    Monitor.log('AI', `Response received in ${response.latencyMs}ms (RAG: ${relevantExamples.length} matches)`);

    return response;
  },

  /**
   * Analyze labs with full delta detection
   */
  async analyzeLabs(labs, options = {}) {
    const { patientContext = {}, history = [] } = options;

    // Build context with deltas
    const context = ContextEngine.buildLabContext(labs, history);
    const prompt = ContextEngine.formatForPrompt(context, patientContext);

    return this.askClinical(
      `Analyze these lab results:\n${prompt}`,
      {
        patientContext: { ...patientContext, labs },
        labHistory: history,
        type: 'labs'
      }
    );
  },

  /**
   * Get drug information with patient-specific adjustments
   */
  async getDrugInfo(drugName, options = {}) {
    const { indication = null, patientContext = null } = options;

    let query = `Provide clinical information for ${drugName}`;
    if (indication) query += ` for ${indication}`;

    // Add patient context for dosing adjustments
    if (patientContext) {
      const adjustments = [];
      if (patientContext.labs?.Creatinine || patientContext.labs?.eGFR) {
        adjustments.push('renal function data available');
      }
      if (patientContext.labs?.ALT || patientContext.labs?.AST) {
        adjustments.push('liver function data available');
      }
      if (patientContext.age) {
        adjustments.push(`age ${patientContext.age}`);
      }
      if (adjustments.length) {
        query += `. Patient has: ${adjustments.join(', ')}. Adjust dosing accordingly.`;
      }
    }

    return this.askClinical(query, { patientContext, type: 'drug' });
  },

  /**
   * On-call consultation
   */
  async oncallConsult(scenario, urgency = 'routine') {
    const prefix = {
      'critical': 'CRITICAL: ',
      'urgent': 'URGENT: ',
      'routine': ''
    }[urgency] || '';

    return this.askClinical(
      `${prefix}On-call consultation:\n${scenario}`,
      { type: 'oncall' }
    );
  },

  /**
   * Generate differential diagnosis
   */
  async generateDifferential(symptoms, context = null) {
    return this.askClinical(
      `Generate differential diagnosis for: ${symptoms}`,
      { patientContext: context, type: 'clinical' }
    );
  },

  /**
   * Record feedback (for RLHF)
   */
  async recordFeedback(feedback) {
    await RLHFEngine.recordFeedback(feedback);

    // If positive feedback, consider adding to learning store
    if (feedback.rating >= 4 && !feedback.correction) {
      const interaction = this._getStoredInteraction(feedback.interactionId);
      if (interaction) {
        try {
          await LearningStore.addVerified({
            ...interaction,
            rating: feedback.rating,
            userId: Store.currentUser?.uid,
            unitId: Store.currentUnit?.id
          });
        } catch (e) {
          Monitor.log('AI', 'Failed to store verified interaction', null, 'warn');
        }
      }
    }

    // If correction provided, store that too
    if (feedback.correction) {
      const interaction = this._getStoredInteraction(feedback.interactionId);
      if (interaction) {
        try {
          await LearningStore.addVerified({
            ...interaction,
            correction: feedback.correction,
            rating: feedback.rating,
            userId: Store.currentUser?.uid,
            unitId: Store.currentUnit?.id
          });
        } catch (e) {
          Monitor.log('AI', 'Failed to store correction', null, 'warn');
        }
      }
    }

    EventBus.emit('ai:feedback-recorded', feedback);
  },

  // ═══════════════════════════════════════════
  // VISION FEATURES
  // ═══════════════════════════════════════════

  /**
   * Identify medication from image
   */
  async identifyMedication(imageBase64, additionalInfo = null) {
    Monitor.log('AI', 'Medication identification request');
    return CloudFunctions.askClinical(
      `Identify this medication. ${additionalInfo || ''}`,
      'You are a pharmacist identifying medications from images. Identify the medication name, dosage form, strength, and manufacturer if visible.',
      'claude-sonnet-4-20250514'
    );
  },

  /**
   * OCR document analysis
   */
  async analyzeDocument(imageBase64, documentType = null) {
    Monitor.log('AI', `Document analysis request: ${documentType || 'general'}`);
    return CloudFunctions.askClinical(
      `Analyze this clinical document. ${documentType ? `Document type: ${documentType}` : ''}`,
      'You are a medical document analyst. Extract and structure all relevant clinical information from the document.',
      'claude-sonnet-4-20250514'
    );
  },

  /**
   * Extract patient list from handwritten/printed image
   */
  async extractPatients(imageBase64, format = null) {
    Monitor.log('AI', 'Patient list extraction request');
    return CloudFunctions.askClinical(
      `Extract patient list from this image. ${format ? `Expected format: ${format}` : ''}`,
      'You are extracting patient names and details from a handwritten or printed patient list. Return structured data with patient names, bed numbers, and any visible diagnoses.',
      'claude-sonnet-4-20250514'
    );
  },

  // ═══════════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════════

  _interactionCache: new Map(),

  _storeInteraction(id, data) {
    this._interactionCache.set(id, {
      ...data,
      timestamp: Date.now()
    });

    // Cleanup old entries (keep last 50)
    if (this._interactionCache.size > 50) {
      const oldest = [...this._interactionCache.entries()]
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      this._interactionCache.delete(oldest[0]);
    }
  },

  _getStoredInteraction(id) {
    return this._interactionCache.get(id);
  },

  /**
   * Get RLHF statistics
   */
  async getStats() {
    return RLHFEngine.getStats();
  }
};
