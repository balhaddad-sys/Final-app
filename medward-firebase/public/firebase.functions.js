/**
 * MedWard Pro Firebase Cloud Functions Service
 * =============================================
 * This module provides a clean interface to call Firebase Cloud Functions,
 * replacing the Google Apps Script backend.
 *
 * Key benefits:
 * - Automatic user creation on first sign-in
 * - Real-time data sync capabilities
 * - Faster performance (direct Firestore)
 * - Better error handling with conflict detection
 *
 * @version 1.0.0
 */

// Firebase Functions SDK import (CDN) - v10.8.0 to match compat SDK
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';
import { app, auth, db, doc, onSnapshot } from './firebase.config.js';

// Initialize Firebase Functions
const functions = getFunctions(app, 'us-central1');

// Uncomment to use local emulator during development
// connectFunctionsEmulator(functions, 'localhost', 5001);

// Cache for callable function references
const callableCache = {};

/**
 * Gets or creates a callable function reference.
 * @param {string} name - Function name
 * @returns {Function} Callable function
 */
function getCallable(name) {
  if (!callableCache[name]) {
    callableCache[name] = httpsCallable(functions, name);
  }
  return callableCache[name];
}

/**
 * Calls a Cloud Function with error handling.
 * @param {string} functionName - Name of the Cloud Function
 * @param {Object} data - Data to pass to the function
 * @returns {Promise<Object>} Function result
 */
async function callFunction(functionName, data = {}) {
  try {
    const callable = getCallable(functionName);
    const result = await callable(data);
    return result.data;
  } catch (error) {
    console.error(`[CloudFunction] ${functionName} error:`, error);

    // Parse Firebase Functions error
    if (error.code === 'functions/unauthenticated') {
      return { success: false, error: 'Authentication required. Please sign in.' };
    }
    if (error.code === 'functions/permission-denied') {
      return { success: false, error: 'Permission denied.' };
    }
    if (error.code === 'functions/invalid-argument') {
      return { success: false, error: error.message || 'Invalid arguments provided.' };
    }

    return {
      success: false,
      error: error.message || 'An unexpected error occurred.',
      code: error.code
    };
  }
}

// ============================================================================
// DATA OPERATIONS
// ============================================================================

/**
 * Loads user data from Firestore.
 * Supports revision-based caching - returns 'upToDate' if client has latest.
 *
 * @param {Object} options - Load options
 * @param {number} options.clientRev - Client's current revision number
 * @param {string} options.deviceId - Device identifier
 * @returns {Promise<Object>} { success, data, rev, upToDate, isNewUser }
 */
export async function loadData({ clientRev, deviceId } = {}) {
  return callFunction('loadData', { clientRev, deviceId });
}

/**
 * Saves user data with conflict detection.
 *
 * @param {Object} options - Save options
 * @param {Object} options.payload - Data to save
 * @param {number} options.baseRev - Revision this save is based on
 * @param {boolean} options.force - Force save (bypass conflict check)
 * @param {string} options.deviceId - Device identifier
 * @returns {Promise<Object>} { success, rev, conflict, safeguard }
 */
export async function saveData({ payload, baseRev, force = false, deviceId } = {}) {
  return callFunction('saveData', { payload, baseRev, force, deviceId });
}

/**
 * Listens to real-time data changes (RECOMMENDED!).
 * Uses direct Firestore listener instead of polling.
 *
 * @param {Function} onUpdate - Callback when data changes
 * @param {Function} onError - Callback on error
 * @returns {Function} Unsubscribe function
 */
export function listenToData(onUpdate, onError) {
  const user = auth.currentUser;
  if (!user) {
    if (onError) onError(new Error('Not authenticated'));
    return () => {};
  }

  const dataRef = doc(db, 'users', user.uid, 'data', 'active');

  return onSnapshot(dataRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate({ error: 'No data found', data: null });
        return;
      }
      const data = snapshot.data();
      onUpdate({
        data,
        rev: data.rev || 1,
        updatedAt: data.updatedAt
      });
    },
    (error) => {
      console.error('[listenToData] Error:', error);
      if (onError) onError(error);
    }
  );
}

// ============================================================================
// TRASH MANAGEMENT
// ============================================================================

/**
 * Moves items to trash.
 *
 * @param {string[]} itemIds - IDs of items to trash
 * @param {string} itemType - Type: 'patient' or 'unit'
 * @returns {Promise<Object>} { success, trashedCount }
 */
export async function moveToTrash(itemIds, itemType = 'patient') {
  return callFunction('moveToTrash', { itemIds, itemType });
}

/**
 * Gets all items in trash.
 *
 * @returns {Promise<Object>} { success, items }
 */
export async function getTrash() {
  return callFunction('getTrash', {});
}

/**
 * Restores items from trash.
 *
 * @param {string[]} itemIds - IDs of items to restore
 * @returns {Promise<Object>} { success, restoredCount }
 */
export async function restoreFromTrash(itemIds) {
  return callFunction('restoreFromTrash', { itemIds });
}

/**
 * Permanently deletes items from trash.
 *
 * @param {string[]} itemIds - IDs to delete (null to empty all)
 * @returns {Promise<Object>} { success, deletedCount }
 */
export async function emptyTrash(itemIds = null) {
  return callFunction('emptyTrash', { itemIds });
}

/**
 * Listens to trash changes in real-time.
 *
 * @param {Function} onUpdate - Callback when trash changes
 * @param {Function} onError - Callback on error
 * @returns {Function} Unsubscribe function
 */
export function listenToTrash(onUpdate, onError) {
  const user = auth.currentUser;
  if (!user) {
    if (onError) onError(new Error('Not authenticated'));
    return () => {};
  }

  const trashRef = doc(db, 'users', user.uid, 'data', 'trash');

  return onSnapshot(trashRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate({ items: [] });
        return;
      }
      const data = snapshot.data();
      onUpdate({
        items: data.items || [],
        updatedAt: data.updatedAt
      });
    },
    (error) => {
      console.error('[listenToTrash] Error:', error);
      if (onError) onError(error);
    }
  );
}

// ============================================================================
// PATIENT HANDOVER (INBOX)
// ============================================================================

/**
 * Sends a patient to another user's inbox.
 *
 * @param {string} recipientEmail - Recipient's email address
 * @param {Object} patientData - Patient data to send
 * @returns {Promise<Object>} { success, message }
 */
export async function sendPatient(recipientEmail, patientData) {
  return callFunction('sendPatient', { recipientEmail, patientData });
}

/**
 * Checks the user's inbox.
 *
 * @returns {Promise<Object>} { success, items, count, pendingCount }
 */
export async function checkInbox() {
  return callFunction('checkInbox', {});
}

/**
 * Accepts a patient from inbox.
 *
 * @param {string} patientId - Patient ID to accept
 * @param {string} targetUnitId - Unit to add patient to
 * @returns {Promise<Object>} { success, message }
 */
export async function acceptInboxPatient(patientId, targetUnitId) {
  return callFunction('acceptInboxPatient', { patientId, targetUnitId });
}

/**
 * Declines a patient from inbox.
 *
 * @param {string} patientId - Patient ID to decline
 * @returns {Promise<Object>} { success, message }
 */
export async function declineInboxPatient(patientId) {
  return callFunction('declineInboxPatient', { patientId });
}

/**
 * Listens to inbox changes in real-time.
 *
 * @param {Function} onUpdate - Callback when inbox changes
 * @param {Function} onError - Callback on error
 * @returns {Function} Unsubscribe function
 */
export function listenToInbox(onUpdate, onError) {
  const user = auth.currentUser;
  if (!user) {
    if (onError) onError(new Error('Not authenticated'));
    return () => {};
  }

  const inboxRef = doc(db, 'users', user.uid, 'data', 'inbox');

  return onSnapshot(inboxRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate({ items: [], count: 0, pendingCount: 0 });
        return;
      }
      const data = snapshot.data();
      const items = data.items || [];
      onUpdate({
        items,
        count: items.length,
        pendingCount: items.filter(i => i.status === 'pending').length,
        updatedAt: data.updatedAt
      });
    },
    (error) => {
      console.error('[listenToInbox] Error:', error);
      if (onError) onError(error);
    }
  );
}

// ============================================================================
// SESSION & HEARTBEAT
// ============================================================================

/**
 * Sends heartbeat for session tracking.
 *
 * @param {Object} options - Heartbeat options
 * @param {string} options.deviceId - Device identifier
 * @param {Object} options.deviceInfo - Device info (browser, OS, etc.)
 * @param {number} options.clientRev - Client's current revision
 * @returns {Promise<Object>} { success, rev, forceFullSync, revGap, activeDevices }
 */
export async function heartbeat({ deviceId, deviceInfo, clientRev } = {}) {
  return callFunction('heartbeat', { deviceId, deviceInfo, clientRev });
}

/**
 * Notifies server of user sign-in (updates lastLoginAt).
 *
 * @returns {Promise<Object>} { success }
 */
export async function notifySignIn() {
  return callFunction('onUserSignIn', {});
}

// ============================================================================
// AI FUNCTIONS (CLAUDE INTEGRATION)
// ============================================================================

/**
 * Asks a clinical question to the AI assistant.
 *
 * @param {string} question - Clinical question
 * @param {Object} patientContext - Optional patient context
 * @param {string} model - Optional model override ('fast', 'balanced', 'advanced')
 * @returns {Promise<Object>} { success, answer, model, usage }
 */
export async function askClinical(question, patientContext = null, model = null) {
  return callFunction('askClinical', { question, patientContext, model });
}

/**
 * Analyzes laboratory results.
 *
 * @param {Object} labs - Laboratory results
 * @param {Object} patientContext - Optional patient context
 * @param {string} model - Optional model override
 * @returns {Promise<Object>} { success, analysis, model, usage }
 */
export async function analyzeLabs(labs, patientContext = null, model = null) {
  return callFunction('analyzeLabs', { labs, patientContext, model });
}

/**
 * Gets drug information.
 *
 * @param {string} drugName - Name of the drug
 * @param {string} indication - Specific indication (optional)
 * @param {Object} patientContext - Patient context (optional)
 * @param {string} model - Model override (optional)
 * @returns {Promise<Object>} { success, drugInfo, model, usage }
 */
export async function getDrugInfo(drugName, indication = null, patientContext = null, model = null) {
  return callFunction('getDrugInfo', { drugName, indication, patientContext, model });
}

/**
 * Generates differential diagnosis.
 *
 * @param {string} symptoms - Presenting symptoms
 * @param {Object} patientContext - Patient context (optional)
 * @param {string} model - Model override (optional)
 * @returns {Promise<Object>} { success, differential, model, usage }
 */
export async function generateDifferential(symptoms, patientContext = null, model = null) {
  return callFunction('generateDifferential', { symptoms, patientContext, model });
}

/**
 * Gets treatment plan for a diagnosis.
 *
 * @param {string} diagnosis - Diagnosis
 * @param {Object} patientContext - Patient context (optional)
 * @param {string} model - Model override (optional)
 * @returns {Promise<Object>} { success, plan, model, usage }
 */
export async function getTreatmentPlan(diagnosis, patientContext = null, model = null) {
  return callFunction('getTreatmentPlan', { diagnosis, patientContext, model });
}

/**
 * On-call clinical consultation (comprehensive).
 *
 * @param {string} scenario - Clinical scenario description
 * @param {Object} patientContext - Patient context (optional)
 * @param {string} urgency - Urgency level: 'low', 'medium', 'high', 'critical'
 * @param {string} model - Model override (optional)
 * @returns {Promise<Object>} { success, consultation, model, usage }
 */
export async function oncallConsult(scenario, patientContext = null, urgency = 'medium', model = null) {
  return callFunction('oncallConsult', { scenario, patientContext, urgency, model });
}

// ============================================================================
// IMAGE-BASED AI FUNCTIONS (Vision)
// ============================================================================

/**
 * Identifies medication from an image.
 *
 * @param {string} image - Base64 encoded image
 * @param {string} additionalInfo - Additional context (optional)
 * @returns {Promise<Object>} { success, identification, model, usage }
 */
export async function identifyMedication(image, additionalInfo = null) {
  return callFunction('identifyMedication', { image, additionalInfo });
}

/**
 * Analyzes a clinical document or image.
 *
 * @param {string} image - Base64 encoded image
 * @param {string} documentType - Type of document (optional)
 * @param {Object} patientContext - Patient context (optional)
 * @returns {Promise<Object>} { success, analysis, model, usage }
 */
export async function analyzeDocument(image, documentType = null, patientContext = null) {
  return callFunction('analyzeDocument', { image, documentType, patientContext });
}

/**
 * Extracts patient information from an image.
 *
 * @param {string} image - Base64 encoded image
 * @param {string} format - Format hint (e.g., 'handover sheet', 'patient list')
 * @returns {Promise<Object>} { success, patients, rawText, count, model, usage }
 */
export async function extractPatients(image, format = null) {
  return callFunction('extractPatients', { image, format });
}

/**
 * Enhanced lab analysis with image support.
 *
 * UPDATED: Now supports:
 * - Single image (string) or multiple images (array)
 * - Extraction prompt for structured JSON output
 *
 * @param {string|string[]|Object} imageOrLabs - Base64 image(s) or structured lab data
 * @param {Object} options - Options object
 * @param {Object} options.patientContext - Patient context (optional)
 * @param {string} options.extractionPrompt - Extraction prompt for structured output (optional)
 * @param {string} options.model - Model override (optional)
 * @returns {Promise<Object>} { success, labData|analysis, model, usage }
 */
export async function analyzeLabsEnhanced(imageOrLabs, options = {}) {
  // Support old signature: analyzeLabsEnhanced(imageOrLabs, patientContext, model)
  let patientContext, extractionPrompt, model;
  if (typeof options === 'string' || options === null) {
    // Old signature used
    patientContext = options;
    model = arguments[2] || null;
    extractionPrompt = null;
  } else {
    // New options object
    patientContext = options.patientContext || null;
    extractionPrompt = options.extractionPrompt || null;
    model = options.model || null;
  }

  // Check if it's an array of images
  if (Array.isArray(imageOrLabs)) {
    return callFunction('analyzeLabsEnhanced', {
      images: imageOrLabs,
      patientContext,
      extractionPrompt,
      model
    });
  }

  // Check if single image
  const isImage = typeof imageOrLabs === 'string' &&
    (imageOrLabs.startsWith('data:image') || imageOrLabs.length > 1000);

  if (isImage) {
    return callFunction('analyzeLabsEnhanced', {
      image: imageOrLabs,
      patientContext,
      extractionPrompt,
      model
    });
  } else {
    return callFunction('analyzeLabsEnhanced', {
      labs: imageOrLabs,
      patientContext,
      model
    });
  }
}

// ============================================================================
// USER PROFILE & SETTINGS
// ============================================================================

/**
 * Gets the current user's profile.
 *
 * @returns {Promise<Object>} { success, profile }
 */
export async function getUserProfile() {
  return callFunction('getUserProfile', {});
}

/**
 * Updates user settings.
 *
 * @param {Object} settings - Settings to update
 * @returns {Promise<Object>} { success }
 */
export async function updateSettings(settings) {
  return callFunction('updateSettings', { settings });
}

// ============================================================================
// MIGRATION HELPERS
// ============================================================================

/**
 * Migrates data from old Apps Script format to new Firebase format.
 * Call this once after first sign-in if user has existing data.
 *
 * @param {Object} oldData - Data from old Apps Script format
 * @returns {Promise<Object>} { success, migratedCount }
 */
export async function migrateFromAppsScript(oldData) {
  if (!oldData) {
    return { success: false, error: 'No data to migrate' };
  }

  // Transform old format to new format if needed
  const payload = {
    patients: oldData.patients || [],
    units: oldData.units || [],
    trash: oldData.trash || { units: [], patients: [] },
    unitRequests: oldData.unitRequests || []
  };

  // Force save to bypass conflict detection during migration
  return saveData({
    payload,
    force: true,
    deviceId: 'migration'
  });
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Generates a unique device ID for session tracking.
 *
 * @returns {string} Device ID
 */
export function generateDeviceId() {
  let deviceId = localStorage.getItem('medward_device_id');
  if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('medward_device_id', deviceId);
  }
  return deviceId;
}

/**
 * Gets device info for session tracking.
 *
 * @returns {Object} Device info
 */
export function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    timestamp: new Date().toISOString()
  };
}

// Export the functions instance for advanced use cases
export { functions };

// ============================================================================
// GLOBAL EXPOSURE FOR NON-MODULE SCRIPTS
// ============================================================================
// Expose functions to window for dashboard and other non-module scripts
// This allows scripts loaded without type="module" to access Firebase functions

window.FirebaseFunctions = {
  // Core function caller
  callFunction,

  // Data operations
  loadData,
  saveData,
  listenToData,

  // Trash management
  moveToTrash,
  getTrash,
  restoreFromTrash,
  emptyTrash,
  listenToTrash,

  // Patient handover (inbox)
  sendPatient,
  checkInbox,
  acceptInboxPatient,
  declineInboxPatient,
  listenToInbox,

  // Session & heartbeat
  heartbeat,
  notifySignIn,

  // AI functions
  askClinical,
  analyzeLabs,
  getDrugInfo,
  generateDifferential,
  getTreatmentPlan,
  oncallConsult,

  // Image-based AI functions
  identifyMedication,
  analyzeDocument,
  extractPatients,
  analyzeLabsEnhanced,

  // User profile & settings
  getUserProfile,
  updateSettings,

  // Migration helpers
  migrateFromAppsScript,

  // Utilities
  generateDeviceId,
  getDeviceInfo,

  // Firebase instances
  functions
};

// Also expose commonly used functions directly on window for convenience
window.callFunction = callFunction;
window.loadData = loadData;
window.saveData = saveData;
window.askClinical = askClinical;
window.analyzeLabs = analyzeLabs;
window.analyzeLabsEnhanced = analyzeLabsEnhanced;

console.log('[Firebase Functions] Service initialized');
console.log('[Firebase Functions] Global exposure added: window.FirebaseFunctions');
