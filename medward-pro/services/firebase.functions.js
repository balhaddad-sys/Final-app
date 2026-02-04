/**
 * Firebase Cloud Functions - Client-side interface
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.config.js';

export const CloudFunctions = {
  /**
   * Call a cloud function
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
    return this.call('medward_generateHandoverSummary', { unitId, patients });
  },

  /**
   * AI Assistant query
   */
  async askAI(message, context = {}) {
    return this.call('medward_askClinical', { message, context });
  }
};
