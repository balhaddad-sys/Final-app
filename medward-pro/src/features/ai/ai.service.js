// features/ai/ai.service.js
// AI assistant service

import { CloudFunctions } from '../../services/firebase.functions.js';
import { EventBus } from '../../core/core.events.js';
import { Monitor } from '../../monitor/monitor.core.js';

export const AIService = {
  // Ask a clinical question
  async askClinical(question, context = null) {
    if (!question?.trim()) {
      throw new Error('Question is required');
    }

    try {
      Monitor.log('AI', `Clinical query: ${question.substring(0, 50)}...`);

      const result = await CloudFunctions.askClinical(question, { context });

      return {
        answer: result.answer,
        disclaimer: result.disclaimer,
        usage: result.usage
      };
    } catch (error) {
      if (error.code === 'resource-exhausted') {
        EventBus.emit('toast:warning', 'AI rate limit reached. Please wait before trying again.');
      }
      throw error;
    }
  },

  // Get drug information
  async getDrugInfo(drugName, indication = null) {
    if (!drugName?.trim()) {
      throw new Error('Drug name is required');
    }

    try {
      Monitor.log('AI', `Drug info query: ${drugName}`);

      const result = await CloudFunctions.getDrugInfo(drugName, indication);

      return result;
    } catch (error) {
      Monitor.logError('AI_DRUG_INFO', error);
      throw error;
    }
  },

  // Get antibiotic guidance
  async getAntibioticGuidance(condition, patientFactors = {}) {
    if (!condition?.trim()) {
      throw new Error('Condition is required');
    }

    try {
      Monitor.log('AI', `Antibiotic guidance: ${condition}`);

      const result = await CloudFunctions.getAntibioticGuidance(condition, patientFactors);

      return result;
    } catch (error) {
      Monitor.logError('AI_ANTIBIOTIC', error);
      throw error;
    }
  },

  // Quick clinical lookup (general)
  async quickLookup(query, type = 'general') {
    const prompts = {
      diagnosis: `Provide a brief differential diagnosis for: ${query}`,
      treatment: `What is the standard treatment approach for: ${query}`,
      investigation: `What investigations should be ordered for: ${query}`,
      general: query
    };

    return this.askClinical(prompts[type] || query);
  },

  // Get clinical decision support
  async getDecisionSupport(scenario) {
    const prompt = `
Clinical Decision Support Request:
${scenario}

Please provide:
1. Assessment summary
2. Key considerations
3. Recommended next steps
4. Red flags to watch for
5. Relevant guidelines or references
`;

    return this.askClinical(prompt);
  },

  // Generate patient summary
  async generatePatientSummary(patientData) {
    // Sanitize - remove PHI for AI
    const { name, mrn, dob, ...safeData } = patientData;

    const context = {
      diagnosis: safeData.diagnosis,
      status: safeData.status,
      pendingTasks: safeData.tasks?.filter(t => !t.completed).length || 0,
      notes: safeData.notes?.substring(0, 500) // Limit notes length
    };

    const prompt = `
Given a patient with:
- Diagnosis: ${context.diagnosis || 'Not specified'}
- Current status: ${context.status || 'active'}
- Pending tasks: ${context.pendingTasks}
${context.notes ? `- Clinical notes: ${context.notes}` : ''}

Generate a brief clinical summary suitable for handover.
`;

    return this.askClinical(prompt, context);
  },

  // Pre-built clinical prompts
  prompts: {
    sepsisWorkup: "What is the standard sepsis workup and initial management?",
    chestPainWorkup: "What is the approach to acute chest pain in the emergency setting?",
    acuteKidneyInjury: "How should acute kidney injury be evaluated and managed?",
    hyperkalemia: "What is the emergency management of hyperkalemia?",
    hypoglycemia: "What is the management of symptomatic hypoglycemia?",
    strokeCode: "What are the key steps in acute stroke management?",
    anaphylaxis: "What is the immediate management of anaphylaxis?",
    dka: "How should diabetic ketoacidosis be managed?",
    giBleed: "What is the initial approach to acute GI bleeding?",
    afibRvr: "How should atrial fibrillation with rapid ventricular response be managed?"
  },

  // Get list of common clinical prompts
  getCommonPrompts() {
    return Object.entries(this.prompts).map(([key, question]) => ({
      id: key,
      question,
      category: this._categorizePrompt(key)
    }));
  },

  _categorizePrompt(key) {
    const categories = {
      sepsisWorkup: 'infectious',
      chestPainWorkup: 'cardiac',
      acuteKidneyInjury: 'renal',
      hyperkalemia: 'metabolic',
      hypoglycemia: 'metabolic',
      strokeCode: 'neurological',
      anaphylaxis: 'emergency',
      dka: 'metabolic',
      giBleed: 'gastrointestinal',
      afibRvr: 'cardiac'
    };
    return categories[key] || 'general';
  }
};
