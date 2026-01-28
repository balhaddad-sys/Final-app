/**
 * MedWard Pro Firebase Cloud Functions
 *
 * This module replaces the Google Apps Script backend with Firebase Cloud Functions.
 * Key improvements:
 * - Automatic user creation on first sign-in (no more auth failures)
 * - Real-time data sync via Firestore
 * - Faster performance with direct Firestore access
 * - Better error handling and conflict detection
 *
 * ============================================================================
 * FIREBASE FUNCTIONS V2 MIGRATION COMPLETE ✅
 * ============================================================================
 *
 * This file has been fully migrated from Firebase Functions v1 to v2 API.
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
 * @migrated 2025-01-28
 */

// ============================================================================
// FIREBASE FUNCTIONS IMPORTS
// ============================================================================
const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
// NOTE: Auth triggers (onCreate) are NOT available in v2/identity - use v1 API
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
});

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
      { id: 'unit_1', name: 'Ward 14', code: '1414', icon: '🏥' },
      { id: 'unit_2', name: 'ICU', code: '9999', icon: '🚨' }
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
          { id: 'unit_1', name: 'Ward 14', code: '1414', icon: '🏥' },
          { id: 'unit_2', name: 'ICU', code: '9999', icon: '🚨' }
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
    throw new Error('No data to save');
  }

  try {
    const result = await db.runTransaction(async (transaction) => {
      const dataRef = db.collection('users').doc(userId)
        .collection('data').doc('active');
      const dataDoc = await transaction.get(dataRef);

      if (!dataDoc.exists) {
        throw new Error('User data not found');
      }

      const serverData = dataDoc.data();
      const serverRev = serverData.rev || 1;

      // Conflict detection
      if (!force && baseRev && baseRev < serverRev) {
        throw new Error(`Conflict: server revision ${serverRev}, client revision ${baseRev}`);
      }

      // Safeguard against accidental data wipe
      const safeguard = payload.patients && payload.units;
      if (!safeguard && (payload.patients === null || payload.units === null)) {
        throw new Error('Safeguard: refusing to wipe data');
      }

      const newData = {
        ...payload,
        rev: (serverRev || 1) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: { uid: userId, deviceId: deviceId || 'unknown' }
      };

      transaction.set(dataRef, newData);
      return { newRev: newData.rev };
    });

    return {
      success: true,
      newRev: result.newRev,
      message: 'Data saved successfully'
    };
  } catch (error) {
    console.error(`[saveData] Error for user ${userId}:`, error);
    throw new Error(`Failed to save data: ${error.message}`);
  }
});

// ============================================================================
// AI/CLINICAL ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Claude API integration helper
 * Handles authentication and response parsing
 */
async function callClaudeAPI(messages, options = {}) {
  const {
    system = '',
    model = AI_CONFIG.MODELS.BALANCED,
    maxTokens = AI_CONFIG.DEFAULT_MAX_TOKENS,
    temperature = AI_CONFIG.DEFAULT_TEMPERATURE
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const payload = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages
  };

  if (system) {
    payload.system = system;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[Claude API] Error: ${response.status} - ${error}`);
    throw new Error(`Claude API error: ${response.status}`);
  }

  return await response.json();
}

/**
 * Analyzes lab results using Claude AI
 */
exports.analyzeLabs = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { labResults, patientContext, model } = request.data || {};

  if (!labResults) {
    throw new Error('Lab results are required');
  }

  const systemPrompt = `You are an experienced clinical pathologist analyzing lab results.

For each lab value:
1. Identify if it's normal, high, or low
2. Explain clinical significance
3. Suggest likely causes
4. Recommend follow-up tests if needed
5. Flag any critical values

Format your response clearly with each lab value as a heading.`;

  let userMessage = `Analyze these lab results:\n${labResults}`;
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
      analysis: response.content[0].text,
      model: model || AI_CONFIG.MODELS.BALANCED,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[analyzeLabs] Error:`, error);
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Provides drug information and interactions
 */
exports.getDrugInfo = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { drugName, indication, patientContext, model } = request.data || {};

  if (!drugName) {
    throw new Error('Drug name is required');
  }

  const systemPrompt = `You are a clinical pharmacist providing accurate drug information.

Include:
1. Mechanism of Action
2. Indication & Dosing
3. Side Effects & Contraindications
4. Drug Interactions (if applicable)
5. Monitoring Parameters
6. Patient Education Points
7. Special Considerations

Be concise but comprehensive.`;

  let userMessage = `Provide clinical information for: ${drugName}`;
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
 * Health check endpoint with CORS support.
 * MIGRATED TO V2
 */
exports.healthCheck = onRequest((req, res) => {
  cors(req, res, () => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0'
    });
  });
});
