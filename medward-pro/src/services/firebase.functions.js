// services/firebase.functions.js
// Cloud function calls

import { functions } from './firebase.config.js';
import { httpsCallable } from 'firebase/functions';
import { Monitor } from '../monitor/monitor.core.js';
import { EventBus } from '../core/core.events.js';

// Cache for function references
const _functionCache = new Map();

function getFunction(name) {
  if (!_functionCache.has(name)) {
    _functionCache.set(name, httpsCallable(functions, name));
  }
  return _functionCache.get(name);
}

export const CloudFunctions = {
  // ========================================
  // DATA OPERATIONS
  // ========================================

  async loadData(clientRev = 0, deviceId = null) {
    try {
      const fn = getFunction('loadData');
      const result = await fn({ clientRev, deviceId });
      Monitor.log('FUNCTIONS', 'loadData completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_LOAD_DATA', error);
      throw error;
    }
  },

  async saveData(payload, baseRev, options = {}) {
    try {
      const fn = getFunction('saveData');
      const result = await fn({
        payload,
        baseRev,
        force: options.force || false,
        deviceId: options.deviceId,
        idempotencyKey: options.idempotencyKey
      });
      Monitor.log('FUNCTIONS', 'saveData completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_SAVE_DATA', error);
      throw error;
    }
  },

  // ========================================
  // TRASH OPERATIONS
  // ========================================

  async moveToTrash(itemIds, itemType) {
    try {
      const fn = getFunction('moveToTrash');
      const result = await fn({ itemIds, itemType });
      Monitor.log('FUNCTIONS', `Moved ${itemIds.length} items to trash`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_TRASH', error);
      throw error;
    }
  },

  async restoreFromTrash(itemIds, itemType) {
    try {
      const fn = getFunction('restoreFromTrash');
      const result = await fn({ itemIds, itemType });
      Monitor.log('FUNCTIONS', `Restored ${itemIds.length} items from trash`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_RESTORE', error);
      throw error;
    }
  },

  // ========================================
  // HANDOVER OPERATIONS
  // ========================================

  async sendPatient(recipientEmail, patientData, notes = '') {
    try {
      const fn = getFunction('sendPatient');
      const result = await fn({ recipientEmail, patientData, notes });
      Monitor.log('FUNCTIONS', `Patient sent to ${recipientEmail}`);
      EventBus.emit('toast:success', `Handover sent to ${recipientEmail}`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_SEND_PATIENT', error);
      EventBus.emit('toast:error', `Failed to send: ${error.message}`);
      throw error;
    }
  },

  async checkInbox() {
    try {
      const fn = getFunction('checkInbox');
      const result = await fn({});
      Monitor.log('FUNCTIONS', `Inbox check: ${result.data.count} items`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_CHECK_INBOX', error);
      throw error;
    }
  },

  async acceptInboxPatient(itemId, unitId) {
    try {
      const fn = getFunction('acceptInboxPatient');
      const result = await fn({ itemId, unitId });
      Monitor.log('FUNCTIONS', 'Patient accepted from inbox');
      EventBus.emit('toast:success', 'Patient added to your unit');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_ACCEPT_PATIENT', error);
      EventBus.emit('toast:error', `Failed to accept: ${error.message}`);
      throw error;
    }
  },

  async declineInboxItem(itemId) {
    try {
      const fn = getFunction('declineInboxPatient');
      const result = await fn({ itemId });
      Monitor.log('FUNCTIONS', 'Inbox item declined');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_DECLINE_INBOX', error);
      throw error;
    }
  },

  // ========================================
  // AI OPERATIONS
  // ========================================

  async askClinical(question, { context = null, systemPrompt = null, model = 'claude-sonnet-4-20250514' } = {}) {
    try {
      const fn = getFunction('askClinical');
      const result = await fn({ question, context, systemPrompt, model });
      Monitor.log('FUNCTIONS', 'AI query completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_AI_CLINICAL', error);

      if (error.code === 'resource-exhausted') {
        EventBus.emit('toast:warning', 'Rate limit reached. Please wait before trying again.');
      } else {
        EventBus.emit('toast:error', 'AI service temporarily unavailable');
      }

      throw error;
    }
  },

  async analyzeLabImage(imageBase64, mediaType = 'image/jpeg', patientName = null) {
    try {
      const fn = getFunction('analyzeLabImage');
      const result = await fn({ imageBase64, mediaType, patientName });
      Monitor.log('FUNCTIONS', 'Lab image analysis completed');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_LAB_ANALYSIS', error);
      throw error;
    }
  },

  async getDrugInfo(drugName, indication = null) {
    try {
      const fn = getFunction('getDrugInfo');
      const result = await fn({ drugName, indication });
      Monitor.log('FUNCTIONS', `Drug info retrieved: ${drugName}`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_DRUG_INFO', error);
      throw error;
    }
  },

  async generateHandoverSummary(patientId) {
    try {
      const fn = getFunction('generateHandoverSummary');
      const result = await fn({ patientId });
      Monitor.log('FUNCTIONS', 'Handover summary generated');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_HANDOVER_SUMMARY', error);
      throw error;
    }
  },

  // ========================================
  // ANTIBIOTIC GUIDE
  // ========================================

  async getAntibioticGuidance(condition, patientFactors = {}) {
    try {
      const fn = getFunction('getAntibioticGuidance');
      const result = await fn({ condition, patientFactors });
      Monitor.log('FUNCTIONS', `Antibiotic guidance: ${condition}`);
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_ANTIBIOTIC', error);
      throw error;
    }
  },

  // ========================================
  // ADMIN OPERATIONS
  // ========================================

  async exportUserData() {
    try {
      const fn = getFunction('exportUserData');
      const result = await fn({});
      Monitor.log('FUNCTIONS', 'User data exported');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_EXPORT', error);
      throw error;
    }
  },

  async deleteAccount(confirmation) {
    try {
      const fn = getFunction('deleteAccount');
      const result = await fn({ confirmation });
      Monitor.log('FUNCTIONS', 'Account deletion initiated');
      return result.data;
    } catch (error) {
      Monitor.logError('FUNC_DELETE_ACCOUNT', error);
      throw error;
    }
  }
};
