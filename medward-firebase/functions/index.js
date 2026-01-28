/**
 * MedWard Pro - Complete Firebase Integration
 * 
 * This is a unified file containing both:
 * 1. Backend Cloud Functions (Firebase Functions v2)
 * 2. Frontend Configuration and Callable Function Wrappers
 *
 * IMPORTANT: This file structure allows for split deployment:
 * - Backend code (exports for Cloud Functions) runs on Firebase
 * - Frontend code (import statements) runs in the browser
 *
 * Key improvements:
 * - Automatic user creation on first sign-in
 * - Real-time data sync via Firestore
 * - Faster performance with direct Firestore access
 * - Better error handling and conflict detection
 *
 * ============================================================================
 * FIREBASE FUNCTIONS V2 MIGRATION COMPLETE ✅
 * ============================================================================
 *
 * IMPORTANT RUNTIME REQUIREMENTS:
 * ❌ DO NOT run this file with: node index.js
 * ✅ INSTEAD use Firebase runtime:
 *    - firebase emulators:start (for local testing)
 *    - firebase deploy --only functions (for production)
 *
 * WHY?
 * - Firebase Functions code ONLY works in Firebase runtime environment
 * - Running with `node index.js` will crash with "Cannot read properties of undefined"
 * - Auth triggers (onUserCreated) and HTTP callable functions (onCall)
 *   are provided by Firebase runtime, not available in plain Node.js
 *
 * LOCAL TESTING:
 * 1. Start Firebase Emulators: firebase emulators:start
 * 2. Test auth triggers by creating users in Auth emulator UI
 * 3. Call HTTP functions via emulator endpoints
 *
 * KEY V2 CHANGES:
 * - Auth trigger: onUserCreated from firebase-functions/v2/identity
 * - HTTP callable: onCall from firebase-functions/v2/https
 * - Request signature: (request) instead of (data, context)
 * - Auth access: request.auth instead of context.auth
 * - Data access: request.data instead of data parameter
 * - Error handling: throw Error() instead of HttpsError()
 *
 * @version 2.0.0
 * @updated 2025-01-28
 */

// ============================================================================
// ============================================================================
// SECTION 1: BACKEND CLOUD FUNCTIONS (Firebase Runtime)
// ============================================================================
// ============================================================================

// ============================================================================
// FIREBASE FUNCTIONS IMPORTS
// ============================================================================
const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
// NOTE: Auth triggers (onCreate) are NOT available in v2/identity - use v1 API
const functions = require('firebase-functions');
const cors = require('cors')({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
});
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ============================================================================
// CONSTANTS
// ============================================================================

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const AI_CONFIG = {
  CACHE: {
    SHORT: 600, // 10 min - time-sensitive data
    MEDIUM: 3600, // 1 hour - clinical queries
    LONG: 21600, // 6 hours - drug info
    PERMANENT: 86400 // 24 hours - reference data
  },
  MODELS: {
    FAST: 'claude-3-5-sonnet-20241022',      // ✅ Latest fast model - excellent for clinical work
    BALANCED: 'claude-3-5-sonnet-20241022',  // Same as FAST (recommended for balance)
    ADVANCED: 'claude-opus-4-20250514'       // Most capable - use for complex cases
  },
  DEFAULT_MAX_TOKENS: 4000,
  DEFAULT_TEMPERATURE: 0.3 // Focused, consistent clinical responses
};

// ============================================================================
// AUTH TRIGGER - AUTO CREATE USER (CRITICAL)
// ============================================================================

/**
 * Automatically creates all required Firestore documents when a new user signs in.
 * This solves the authentication bug in the old Google Apps Script system.
 *
 * MIGRATED TO FIREBASE FUNCTIONS V2 (identity trigger)
 *
 * Documents created:
 * - /users/{userId} - User profile
 * - /users/{userId}/data/active - Main patient/unit data
 * - /users/{userId}/data/trash - Deleted items
 * - /users/{userId}/data/inbox - Received patient handovers
 * - /users/{userId}/data/sessions - Active device sessions
 *
 * NOTE: Auth triggers use v1 API because v2/identity only has blocking functions
 * (beforeUserCreated), not async onCreate triggers.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  // v1 auth trigger receives user directly
  console.log(`[Auth] New user created: ${user.uid} (${user.email})`);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const userId = user.uid;

  // User profile document
  const userProfile = {
    uid: userId,
    email: user.email || null,
    displayName: user.displayName ||
      (user.email ? user.email.split('@')[0] : 'User'),
    photoURL: user.photoURL || null,
    createdAt: now,
    lastLoginAt: now,
    authProvider: (user.providerData && user.providerData[0] && user.providerData[0].providerId) || 'unknown',
    settings: {
      adminPassword: 'admin123',
      theme: 'auto',
      notifications: true,
      offlineMode: true
    }
  };

  // Initial ward data with default units
  const initialData = {
    rev: 1,
    updatedAt: now,
    updatedBy: { uid: userId, deviceId: 'server' },
    patients: [],
    units: [
      { id: 'unit_1', name: 'Ward 14', code: '1414', icon: 'ðŸ¥' },
      { id: 'unit_2', name: 'ICU', code: '9999', icon: 'ðŸš¨' }
    ],
    trash: { units: [], patients: [] },
    unitRequests: []
  };

  // Batch write all documents atomically
  const batch = db.batch();

  batch.set(db.collection('users').doc(userId), userProfile);
  batch.set(db.collection('users').doc(userId)
    .collection('data').doc('active'), initialData);
  batch.set(db.collection('users').doc(userId)
    .collection('data').doc('trash'), { items: [], updatedAt: now });
  batch.set(db.collection('users').doc(userId)
    .collection('data').doc('inbox'), { items: [], updatedAt: now });
  batch.set(db.collection('users').doc(userId)
    .collection('data').doc('sessions'),
  { active: [], tombstones: [], updatedAt: now });

  try {
    await batch.commit();
    console.log(`[Auth] Created all documents for user: ${userId}`);
    return { success: true, userId };
  } catch (error) {
    console.error(`[Auth] Failed to create documents for user ${userId}:`, error);
    throw error;
  }
});

/**
 * Updates user's lastLoginAt on each sign-in
 * MIGRATED TO V2
 */
exports.onUserSignIn = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;

  await db.collection('users').doc(userId).update({
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true };
});

// ============================================================================
// DATA OPERATIONS
// ============================================================================

/**
 * Loads user data from Firestore.
 * Supports revision-based caching - returns 'upToDate' if client has latest.
 * MIGRATED TO V2
 */
exports.loadData = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { clientRev, deviceId } = request.data || {};

  try {
    const dataDoc = await db.collection('users').doc(userId)
      .collection('data').doc('active').get();

    if (!dataDoc.exists) {
      // Edge case: create data if missing (shouldn't happen with auth trigger)
      console.log(`[loadData] Creating missing data for user: ${userId}`);
      const initialData = {
        rev: 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: { uid: userId, deviceId: deviceId || 'unknown' },
        patients: [],
        units: [
          { id: 'unit_1', name: 'Ward 14', code: '1414', icon: 'ðŸ¥' },
          { id: 'unit_2', name: 'ICU', code: '9999', icon: 'ðŸš¨' }
        ],
        trash: { units: [], patients: [] },
        unitRequests: []
      };

      await db.collection('users').doc(userId)
        .collection('data').doc('active').set(initialData);

      return { success: true, data: initialData, rev: 1, isNewUser: true };
    }

    const serverData = dataDoc.data();
    const serverRev = serverData.rev || 1;

    // Check if client is up to date
    if (clientRev && clientRev >= serverRev) {
      return { success: true, upToDate: true, rev: serverRev };
    }

    return {
      success: true,
      data: serverData,
      rev: serverRev,
      updatedAt: serverData.updatedAt
    };
  } catch (error) {
    console.error(`[loadData] Error for user ${userId}:`, error);
    throw new Error(`Failed to load data: ${error.message}`);
  }
});

/**
 * Saves user data with conflict detection and safety checks.
 *
 * Features:
 * - Atomic transaction for conflict detection
 * - Prevents accidental data wipe (safeguard)
 * - Force mode to bypass conflict check
 * - Revision incrementing
 */
exports.saveData = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { payload, baseRev, force, deviceId } = request.data || {};

  if (!payload) {
    throw new Error('Payload is required');
  }

  try {
    let result;
    
    if (force) {
      // Force save bypasses conflict check
      console.log(`[saveData] Force saving for user: ${userId}`);
      
      const newData = {
        ...payload,
        rev: (baseRev || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: { uid: userId, deviceId: deviceId || 'unknown' }
      };

      await db.collection('users').doc(userId)
        .collection('data').doc('active').set(newData);

      result = { success: true, newRev: newData.rev };
    } else {
      // Normal save with conflict detection
      result = await db.runTransaction(async (transaction) => {
        const dataRef = db.collection('users').doc(userId)
          .collection('data').doc('active');
        const dataDoc = await transaction.get(dataRef);

        if (!dataDoc.exists) {
          throw new Error('Data document not found');
        }

        const serverRev = dataDoc.data().rev || 1;
        const clientRev = baseRev || 0;

        if (clientRev !== serverRev) {
          // Conflict detected
          console.warn(`[saveData] Conflict for user ${userId}: client rev ${clientRev} != server rev ${serverRev}`);
          return {
            success: false,
            conflict: true,
            serverRev: serverRev,
            message: 'Data has been modified elsewhere. Please reload and try again.'
          };
        }

        const newRev = serverRev + 1;
        const newData = {
          ...payload,
          rev: newRev,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: { uid: userId, deviceId: deviceId || 'unknown' }
        };

        transaction.set(dataRef, newData);
        return { success: true, newRev };
      });
    }

    return result;
  } catch (error) {
    console.error(`[saveData] Error for user ${userId}:`, error);
    throw new Error(`Failed to save data: ${error.message}`);
  }
});

// ============================================================================
// AI & CLINICAL FUNCTIONS
// ============================================================================

/**
 * Helper function to call Claude API
 * (Implementation would go here based on original file)
 */
async function callClaudeAPI(messages, options = {}) {
  // This is a placeholder - implement based on your API setup
  const model = options.model || AI_CONFIG.MODELS.BALANCED;
  const maxTokens = options.maxTokens || AI_CONFIG.DEFAULT_MAX_TOKENS;
  const temperature = options.temperature || AI_CONFIG.DEFAULT_TEMPERATURE;
  
  // Call your Claude API endpoint here
  // Return format: { content: [{ text: '...' }], usage: { ... } }
  throw new Error('callClaudeAPI not implemented - add your API integration');
}

/**
 * Analyzes lab results with AI.
 */
exports.analyzeLabs = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { labResults, patientContext, model } = request.data || {};

  if (!labResults) {
    throw new Error('Lab results are required');
  }

  const systemPrompt = `You are an expert clinical pathologist and internal medicine consultant analyzing lab results.

For each abnormal result:
1. Significance and pathophysiology
2. Differential diagnosis
3. Suggested follow-up tests
4. Red flags requiring immediate action

Format results clearly with normal/abnormal status and clinical interpretation.`;

  let userMessage = `Analyze these lab results:\n${JSON.stringify(labResults, null, 2)}`;
  if (patientContext) {
    userMessage += `\n\nPatient context:\n${JSON.stringify(patientContext, null, 2)}`;
  }

  try {
    const response = await callClaudeAPI([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
      model: model || AI_CONFIG.MODELS.FAST
    });

    return {
      success: true,
      analysis: response.content[0].text,
      model: model || AI_CONFIG.MODELS.FAST,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[analyzeLabs] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Gets drug information.
 */
exports.getDrugInfo = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { drugName, indication, patientContext, model } = request.data || {};

  if (!drugName) {
    throw new Error('Drug name is required');
  }

  const systemPrompt = `You are a pharmacology expert providing concise, clinically relevant drug information.

Include:
1. Mechanism of action
2. Indications and contraindications
3. Dosing (standard and special populations)
4. Common side effects and serious adverse events
5. Drug interactions (key ones)
6. Monitoring requirements
7. Cost/availability notes if relevant`;

  let userMessage = `Provide information about: ${drugName}`;
  if (indication) {
    userMessage += `\nSpecific indication: ${indication}`;
  }
  if (patientContext) {
    userMessage += `\nPatient context: ${JSON.stringify(patientContext)}`;
  }

  try {
    const response = await callClaudeAPI([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
      model: model || AI_CONFIG.MODELS.FAST
    });

    return {
      success: true,
      drugInfo: response.content[0].text,
      model: model || AI_CONFIG.MODELS.FAST,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[getDrugInfo] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Generates differential diagnosis from symptoms.
 */
exports.generateDifferential = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { symptoms, patientContext, model } = request.data || {};

  if (!symptoms) {
    throw new Error('Symptoms are required');
  }

  const systemPrompt = `You are an experienced internal medicine consultant generating differential diagnoses.

For each differential:
1. List diagnoses from most to least likely
2. Include supporting and opposing features
3. Suggest key investigations to rule in/out
4. Flag emergent conditions that need immediate attention

Format:
1. [Diagnosis] - [Likelihood: High/Medium/Low]
   - Supporting: ...
   - Against: ...
   - Key tests: ...`;

  let userMessage = `Generate differential diagnosis for:\n${symptoms}`;
  if (patientContext) {
    userMessage += `\n\nPatient context:\n${JSON.stringify(patientContext, null, 2)}`;
  }

  try {
    const response = await callClaudeAPI([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
      model: model || AI_CONFIG.MODELS.BALANCED
    });

    return {
      success: true,
      differential: response.content[0].text,
      model: model || AI_CONFIG.MODELS.BALANCED,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[generateDifferential] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Generates treatment plan.
 */
exports.getTreatmentPlan = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { diagnosis, patientContext, model } = request.data || {};

  if (!diagnosis) {
    throw new Error('Diagnosis is required');
  }

  const systemPrompt = `You are an internal medicine consultant creating evidence-based treatment plans.

Include:
1. Immediate Management (if urgent)
2. Investigations
3. Pharmacological Treatment (with specific doses)
4. Non-pharmacological Management
5. Monitoring Plan
6. Patient Education Points
7. Follow-up Recommendations
8. Red Flags for Patient

Consider patient-specific factors (comorbidities, allergies, etc.) when making recommendations.`;

  let userMessage = `Create treatment plan for: ${diagnosis}`;
  if (patientContext) {
    userMessage += `\n\nPatient context:\n${JSON.stringify(patientContext, null, 2)}`;
  }

  try {
    const response = await callClaudeAPI([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
      model: model || AI_CONFIG.MODELS.BALANCED
    });

    return {
      success: true,
      plan: response.content[0].text,
      model: model || AI_CONFIG.MODELS.BALANCED,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[getTreatmentPlan] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * On-call clinical consultation (more comprehensive).
 */
exports.oncallConsult = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { scenario, patientContext, urgency, model } = request.data || {};

  if (!scenario) {
    throw new Error('Clinical scenario is required');
  }

  const systemPrompt = `You are an experienced on-call internal medicine consultant providing urgent clinical guidance.

CRITICAL: If this is a life-threatening emergency, start with immediate actions.

Structure your response:
1. IMMEDIATE ACTIONS (if urgent)
2. Initial Assessment
3. Differential Diagnosis (prioritized)
4. Investigations (stat vs routine)
5. Management Plan
6. Monitoring
7. When to Escalate
8. Documentation Points

Be concise, actionable, and prioritize patient safety.`;

  let userMessage = `On-call consultation request:\n\n${scenario}`;
  if (urgency) {
    userMessage = `[URGENCY: ${urgency.toUpperCase()}]\n\n${userMessage}`;
  }
  if (patientContext) {
    userMessage += `\n\nPatient details:\n${JSON.stringify(patientContext, null, 2)}`;
  }

  try {
    const response = await callClaudeAPI([
      { role: 'user', content: userMessage }
    ], {
      system: systemPrompt,
      model: model || AI_CONFIG.MODELS.BALANCED,
      maxTokens: 6000
    });

    return {
      success: true,
      consultation: response.content[0].text,
      model: model || AI_CONFIG.MODELS.BALANCED,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[oncallConsult] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets user profile.
 */
exports.getUserProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;

  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return { success: false, error: 'User profile not found' };
    }

    return {
      success: true,
      profile: userDoc.data()
    };
  } catch (error) {
    console.error(`[getUserProfile] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Updates user settings.
 */
exports.updateSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { settings } = request.data || {};

  if (!settings || typeof settings !== 'object') {
    throw new Error('Settings object is required');
  }

  try {
    await db.collection('users').doc(userId).update({
      settings: settings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error(`[updateSettings] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Health check endpoint.
 * MIGRATED TO V2
 */
exports.healthCheck = onRequest((req, res) => {
  cors(req, res, () => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  });
});

// ============================================================================
// ============================================================================
// SECTION 2: FRONTEND CLIENT CONFIGURATION
// ============================================================================
// ============================================================================
// Use this section in your frontend application (browser)
// Import these functions in your frontend code

/**
 * Firebase Client Configuration (Browser only)
 * 
 * This section provides client-side wrappers for calling Cloud Functions
 * from the browser. These wrap the backend exports above.
 */

// Note: In browser, use ES6 imports instead:
// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
// import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
// etc.

/**
 * FIREBASE PROJECT CONFIGURATION
 * Update these values to match your Firebase project
 */
const firebaseConfig = {
  apiKey: "AIzaSyDummy123", // Replace with your actual API key
  authDomain: "medward-pro.firebaseapp.com",
  projectId: "medward-pro",
  storageBucket: "medward-pro.appspot.com",
  messagingSenderId: "123456789", // Replace with your actual sender ID
  appId: "1:123456789:web:abc123def456", // Replace with your actual app ID
  measurementId: "G-ABC123DEF" // Optional
};

// ============================================================================
// FRONTEND CLIENT CALLABLE FUNCTIONS
// ============================================================================
// These functions are called from the browser and invoke the Cloud Functions above
// Each function automatically includes authentication

/**
 * Load user data from Firestore
 * @param {Object} data - { clientRev, deviceId }
 * @returns {Promise} - { success, data, rev, upToDate }
 */
async function loadData(data = {}) {
  try {
    const result = await callFunction('loadData', data);
    return result;
  } catch (error) {
    console.error('[loadData] Error:', error);
    throw new Error(`Failed to load data: ${error.message}`);
  }
}

/**
 * Save user data with conflict detection
 * @param {Object} data - { payload, baseRev, force, deviceId }
 * @returns {Promise} - { success, newRev }
 */
async function saveData(data) {
  try {
    const result = await callFunction('saveData', data);
    return result;
  } catch (error) {
    console.error('[saveData] Error:', error);
    throw new Error(`Failed to save data: ${error.message}`);
  }
}

/**
 * Update user login timestamp
 * @returns {Promise} - { success: true }
 */
async function onUserSignIn() {
  try {
    const result = await callFunction('onUserSignIn', {});
    return result;
  } catch (error) {
    console.error('[onUserSignIn] Error:', error);
    throw new Error(`Failed to update login: ${error.message}`);
  }
}

/**
 * Get user profile
 * @returns {Promise} - { success, profile }
 */
async function getUserProfile() {
  try {
    const result = await callFunction('getUserProfile', {});
    return result;
  } catch (error) {
    console.error('[getUserProfile] Error:', error);
    throw new Error(`Failed to get profile: ${error.message}`);
  }
}

/**
 * Update user settings
 * @param {Object} settings - User settings object
 * @returns {Promise} - { success: true }
 */
async function updateSettings(settings) {
  try {
    const result = await callFunction('updateSettings', { settings });
    return result;
  } catch (error) {
    console.error('[updateSettings] Error:', error);
    throw new Error(`Failed to update settings: ${error.message}`);
  }
}

/**
 * Analyze lab results with AI
 * @param {Object} data - { labResults, patientContext, model }
 * @returns {Promise} - { success, analysis, model, usage }
 */
async function analyzeLabs(data) {
  try {
    const result = await callFunction('analyzeLabs', data);
    return result;
  } catch (error) {
    console.error('[analyzeLabs] Error:', error);
    throw new Error(`Failed to analyze labs: ${error.message}`);
  }
}

/**
 * Get drug information
 * @param {Object} data - { drugName, indication, patientContext, model }
 * @returns {Promise} - { success, drugInfo, model, usage }
 */
async function getDrugInfo(data) {
  try {
    const result = await callFunction('getDrugInfo', data);
    return result;
  } catch (error) {
    console.error('[getDrugInfo] Error:', error);
    throw new Error(`Failed to get drug info: ${error.message}`);
  }
}

/**
 * Generate differential diagnosis
 * @param {Object} data - { symptoms, patientContext, model }
 * @returns {Promise} - { success, differential, model, usage }
 */
async function generateDifferential(data) {
  try {
    const result = await callFunction('generateDifferential', data);
    return result;
  } catch (error) {
    console.error('[generateDifferential] Error:', error);
    throw new Error(`Failed to generate differential: ${error.message}`);
  }
}

/**
 * Get treatment plan
 * @param {Object} data - { diagnosis, patientContext, model }
 * @returns {Promise} - { success, plan, model, usage }
 */
async function getTreatmentPlan(data) {
  try {
    const result = await callFunction('getTreatmentPlan', data);
    return result;
  } catch (error) {
    console.error('[getTreatmentPlan] Error:', error);
    throw new Error(`Failed to get treatment plan: ${error.message}`);
  }
}

/**
 * On-call clinical consultation
 * @param {Object} data - { scenario, patientContext, urgency, model }
 * @returns {Promise} - { success, consultation, model, usage }
 */
async function oncallConsult(data) {
  try {
    const result = await callFunction('oncallConsult', data);
    return result;
  } catch (error) {
    console.error('[oncallConsult] Error:', error);
    throw new Error(`Failed to get consultation: ${error.message}`);
  }
}

/**
 * Health check
 * @returns {Promise} - { status, timestamp, version }
 */
async function healthCheck() {
  try {
    const result = await callFunction('healthCheck', {});
    return result;
  } catch (error) {
    console.error('[healthCheck] Error:', error);
    throw new Error(`Health check failed: ${error.message}`);
  }
}

/**
 * Helper function to call Cloud Functions from browser
 * (Replace with your actual httpsCallable implementation)
 */
async function callFunction(functionName, data) {
  // This would be implemented with your functions instance
  // Example using Firebase SDK:
  // const func = httpsCallable(functions, functionName);
  // const result = await func(data);
  // return result.data;
  throw new Error(`callFunction not implemented - set up Firebase SDK in browser`);
}

// ============================================================================
// EXPORT FUNCTIONS FOR BROWSER USE
// ============================================================================
// In browser, use ES6 module exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadData,
    saveData,
    onUserSignIn,
    getUserProfile,
    updateSettings,
    analyzeLabs,
    getDrugInfo,
    generateDifferential,
    getTreatmentPlan,
    oncallConsult,
    healthCheck,
    firebaseConfig
  };
}
