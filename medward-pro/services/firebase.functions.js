/**
 * Firebase Cloud Functions - Client-side interface
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.config.js';

// Cache for function references
const _fnCache = new Map();
function getFunction(name) {
  if (!_fnCache.has(name)) {
    _fnCache.set(name, httpsCallable(functions, name));
  }
  return _fnCache.get(name);
}

export const CloudFunctions = {
  /**
   * Call a cloud function (generic)
   */
  async call(functionName, data = {}) {
    try {
      const fn = httpsCallable(functions, functionName);
      const result = await fn(data);
      return { success: true, data: result.data };
    } catch (error) {
      console.error(`[CloudFunctions] ${functionName} failed:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Generate handover report
   */
  async generateHandoverReport(unitId, patients) {
    return this.call('generateHandoverReport', { unitId, patients });
  },

  /**
   * AI Assistant query
   */
  async askAI(message, context = {}) {
    return this.call('askAI', { message, context });
  },

  // ========================================
  // AI OPERATIONS
  // ========================================

  async getDrugInfo(drugName, indication = null) {
    const fn = getFunction('getDrugInfo');
    const result = await fn({ drugName, indication });
    return result.data;
  },

  async analyzeLabImage(imageBase64, mediaType = 'image/jpeg', patientName = null) {
    const fn = getFunction('analyzeLabImage');
    const result = await fn({ imageBase64, mediaType, patientName });
    return result.data;
  },

  async generateDifferential(symptoms) {
    const fn = getFunction('oncall_generateDifferential');
    const result = await fn({ symptoms });
    return result.data;
  },

  async verifyElectrolyteCorrection(scenario, electrolyte = null) {
    const fn = getFunction('oncall_verifyElectrolyteCorrection');
    const result = await fn({ scenario, electrolyte });
    return result.data;
  },

  async scanLabReport(images, context = null) {
    const fn = getFunction('medward_scanLabReport');
    const result = await fn({ images, context });
    return result.data;
  },

  async getAntibioticGuidance(condition, patientFactors = {}) {
    const fn = getFunction('getAntibioticGuidance');
    const result = await fn({ condition, patientFactors });
    return result.data;
  },

  async generateHandoverSummary(patientId) {
    const fn = getFunction('generateHandoverSummary');
    const result = await fn({ patientId });
    return result.data;
  }
};
