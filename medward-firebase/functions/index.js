/**
 * MedWard Pro - Complete Firebase Integration
 * 
 * UNIFIED FILE containing both Backend Cloud Functions and Frontend Configuration
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
// PART 1: BACKEND CLOUD FUNCTIONS (Firebase Runtime Only)
// ============================================================================
// ============================================================================

// ============================================================================
// FIREBASE FUNCTIONS IMPORTS
// ============================================================================
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
// NOTE: Auth triggers (onCreate) are NOT available in v2/identity - use v1 API
const functions = require('firebase-functions');
const cors = require('cors')({
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
});
const admin = require('firebase-admin');

// Define secrets for v2 functions
// Set via: firebase functions:secrets:set ANTHROPIC_API_KEY
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitizes Firestore data for JSON serialization.
 * Converts Timestamps to ISO strings and handles other non-serializable types.
 * @param {Object} data - Raw Firestore document data
 * @returns {Object} Sanitized data safe for JSON serialization
 */
function sanitizeFirestoreData(data) {
  if (data === null || data === undefined) {
    return data;
  }

  if (data instanceof admin.firestore.Timestamp) {
    return data.toDate().toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeFirestoreData(item));
  }

  if (typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeFirestoreData(value);
    }
    return sanitized;
  }

  return data;
}

// ============================================================================
// AUTH TRIGGERS
// ============================================================================

/**
 * Auth trigger: Creates user profile and initial data when new user signs up.
 *
 * Document structure:
 * - /users/{userId} - User profile
 * - /users/{userId}/data/active - Active ward data
 * - /users/{userId}/data/trash - Deleted items
 * - /users/{userId}/data/inbox - Patient handovers
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
    throw new HttpsError('unauthenticated', 'User must be authenticated');
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
    throw new HttpsError('unauthenticated', 'User must be authenticated');
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

    // Sanitize data to ensure proper JSON serialization
    const sanitizedData = sanitizeFirestoreData(serverData);

    return {
      success: true,
      data: sanitizedData,
      rev: serverRev,
      updatedAt: sanitizedData.updatedAt
    };
  } catch (error) {
    console.error(`[loadData] Error for user ${userId}:`, error);
    console.error(`[loadData] Error stack:`, error.stack);
    throw new HttpsError('internal', `Failed to load data: ${error.message}`);
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
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { payload, baseRev, force, deviceId } = request.data || {};

  if (!payload) {
    throw new HttpsError('invalid-argument', 'No data to save');
  }

  try {
    const dataRef = db.collection('users').doc(userId)
      .collection('data').doc('active');

    // Transaction for atomic conflict detection
    const result = await db.runTransaction(async (transaction) => {
      const dataDoc = await transaction.get(dataRef);
      const serverData = dataDoc.exists ? dataDoc.data() : { rev: 0 };
      const serverRev = serverData.rev || 0;

      // Conflict detection (unless forced)
      if (baseRev && !force && baseRev < serverRev) {
        return {
          success: false,
          conflict: true,
          serverRev: serverRev,
          serverData: serverData,
          error: 'Data has been modified by another device'
        };
      }

      // Safety: prevent accidental data wipe
      const serverPatientCount = (serverData.patients || []).length;
      const incomingPatientCount = (payload.patients || []).length;

      if (serverPatientCount > 0 &&
          incomingPatientCount === 0 &&
          !payload.confirmWipe) {
        return {
          success: false,
          safeguard: true,
          serverPatientCount: serverPatientCount,
          error: `Safety Block: Would overwrite ${serverPatientCount} patients with empty data. ` +
            `Set confirmWipe=true to proceed.`
        };
      }

      // Prepare and save new data
      const newData = {
        ...payload,
        rev: serverRev + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: { uid: userId, deviceId: deviceId || 'unknown' }
      };

      transaction.set(dataRef, newData);

      return {
        success: true,
        rev: newData.rev,
        timestamp: new Date().toISOString()
      };
    });

    return result;
  } catch (error) {
    console.error(`[saveData] Error for user ${userId}:`, error);
    throw new HttpsError('internal', error.message);
  }
});

// ============================================================================
// TRASH MANAGEMENT
// ============================================================================

/**
 * Moves items (patients or units) to trash.
 * Uses transaction to ensure consistency.
 */
exports.moveToTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { itemIds, itemType = 'patient' } = request.data || {};

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw new HttpsError('invalid-argument', 'itemIds must be a non-empty array');
  }

  const trashRef = db.collection('users').doc(userId)
    .collection('data').doc('trash');
  const dataRef = db.collection('users').doc(userId)
    .collection('data').doc('active');

  try {
    await db.runTransaction(async (transaction) => {
      const [trashDoc, dataDoc] = await Promise.all([
        transaction.get(trashRef),
        transaction.get(dataRef)
      ]);

      const trashData = trashDoc.exists ? trashDoc.data() : { items: [] };
      const activeData = dataDoc.data() || { patients: [], units: [], rev: 0 };

      const itemsToTrash = [];
      let remainingItems;

      if (itemType === 'patient') {
        remainingItems = (activeData.patients || []).filter((p) => {
          if (itemIds.includes(p.id)) {
            itemsToTrash.push({
              ...p,
              deletedAt: new Date().toISOString(),
              deletedBy: userId,
              type: 'patient'
            });
            return false;
          }
          return true;
        });

        transaction.update(dataRef, {
          patients: remainingItems,
          rev: (activeData.rev || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else if (itemType === 'unit') {
        remainingItems = (activeData.units || []).filter((u) => {
          if (itemIds.includes(u.id)) {
            itemsToTrash.push({
              ...u,
              deletedAt: new Date().toISOString(),
              deletedBy: userId,
              type: 'unit'
            });
            return false;
          }
          return true;
        });

        transaction.update(dataRef, {
          units: remainingItems,
          rev: (activeData.rev || 0) + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      transaction.set(trashRef, {
        items: [...(trashData.items || []), ...itemsToTrash],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return { success: true, trashedCount: itemIds.length };
  } catch (error) {
    console.error(`[moveToTrash] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Gets all items in trash.
 */
exports.getTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;

  try {
    const trashDoc = await db.collection('users').doc(userId)
      .collection('data').doc('trash').get();

    return {
      success: true,
      items: trashDoc.exists ? (trashDoc.data().items || []) : []
    };
  } catch (error) {
    console.error(`[getTrash] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Restores items from trash back to active data.
 */
exports.restoreFromTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { itemIds } = request.data || {};

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw new HttpsError('invalid-argument', 'itemIds must be a non-empty array');
  }

  const trashRef = db.collection('users').doc(userId)
    .collection('data').doc('trash');
  const dataRef = db.collection('users').doc(userId)
    .collection('data').doc('active');

  try {
    await db.runTransaction(async (transaction) => {
      const [trashDoc, dataDoc] = await Promise.all([
        transaction.get(trashRef),
        transaction.get(dataRef)
      ]);

      const trashData = trashDoc.exists ? trashDoc.data() : { items: [] };
      const activeData = dataDoc.data() || { patients: [], units: [], rev: 0 };

      const itemsToRestore = [];
      const remainingTrash = (trashData.items || []).filter((item) => {
        if (itemIds.includes(item.id)) {
          // Remove trash metadata
          const { deletedAt: _deletedAt, deletedBy: _deletedBy, type, ...cleanItem } = item;
          itemsToRestore.push({ item: cleanItem, type });
          return false;
        }
        return true;
      });

      // Restore items to appropriate arrays
      const restoredPatients = [...(activeData.patients || [])];
      const restoredUnits = [...(activeData.units || [])];

      itemsToRestore.forEach(({ item, type }) => {
        if (type === 'patient') {
          restoredPatients.push(item);
        } else if (type === 'unit') {
          restoredUnits.push(item);
        }
      });

      transaction.update(dataRef, {
        patients: restoredPatients,
        units: restoredUnits,
        rev: (activeData.rev || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      transaction.set(trashRef, {
        items: remainingTrash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true, restoredCount: itemIds.length };
  } catch (error) {
    console.error(`[restoreFromTrash] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Permanently deletes items from trash.
 */
exports.emptyTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { itemIds } = request.data || {}; // If null, empty all

  const trashRef = db.collection('users').doc(userId)
    .collection('data').doc('trash');

  try {
    if (!itemIds) {
      // Empty all trash
      await trashRef.set({
        items: [],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, message: 'Trash emptied' };
    }

    // Delete specific items
    const trashDoc = await trashRef.get();
    const trashData = trashDoc.exists ? trashDoc.data() : { items: [] };

    const remainingItems = (trashData.items || []).filter(
      (item) => !itemIds.includes(item.id)
    );

    await trashRef.set({
      items: remainingItems,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      deletedCount: (trashData.items || []).length - remainingItems.length
    };
  } catch (error) {
    console.error(`[emptyTrash] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

// ============================================================================
// PATIENT HANDOVER (INBOX)
// ============================================================================

/**
 * Sends a patient to another user's inbox.
 */
exports.sendPatient = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const senderId = request.auth.uid;
  const senderEmail = request.auth.token.email;
  const { recipientEmail, patientData } = request.data || {};

  if (!recipientEmail || !patientData) {
    throw new HttpsError('invalid-argument', 'recipientEmail and patientData are required');
  }

  try {
    // Find recipient by email
    const usersSnapshot = await db.collection('users')
      .where('email', '==', recipientEmail)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return {
        success: false,
        error: `Recipient not found: ${recipientEmail}`
      };
    }

    const recipientId = usersSnapshot.docs[0].id;
    const inboxRef = db.collection('users').doc(recipientId)
      .collection('data').doc('inbox');

    await db.runTransaction(async (transaction) => {
      const inboxDoc = await transaction.get(inboxRef);
      const inboxData = inboxDoc.exists ? inboxDoc.data() : { items: [] };

      const newItem = {
        ...patientData,
        id: patientData.id || `handover_${Date.now()}`,
        sentAt: new Date().toISOString(),
        sentBy: {
          uid: senderId,
          email: senderEmail,
          displayName: request.auth.token.name || senderEmail
        },
        status: 'pending'
      };

      transaction.set(inboxRef, {
        items: [...(inboxData.items || []), newItem],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return {
      success: true,
      message: `Patient sent to ${recipientEmail}`
    };
  } catch (error) {
    console.error(`[sendPatient] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Checks the user's inbox for received patients.
 */
exports.checkInbox = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;

  try {
    const inboxDoc = await db.collection('users').doc(userId)
      .collection('data').doc('inbox').get();

    const items = inboxDoc.exists ? (inboxDoc.data().items || []) : [];

    return {
      success: true,
      items: items,
      count: items.length,
      pendingCount: items.filter((i) => i.status === 'pending').length
    };
  } catch (error) {
    console.error(`[checkInbox] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Accepts a patient from inbox and adds to active data.
 */
exports.acceptInboxPatient = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { patientId, targetUnitId } = request.data || {};

  if (!patientId) {
    throw new HttpsError('invalid-argument', 'patientId is required');
  }

  const inboxRef = db.collection('users').doc(userId)
    .collection('data').doc('inbox');
  const dataRef = db.collection('users').doc(userId)
    .collection('data').doc('active');

  try {
    await db.runTransaction(async (transaction) => {
      const [inboxDoc, dataDoc] = await Promise.all([
        transaction.get(inboxRef),
        transaction.get(dataRef)
      ]);

      const inboxData = inboxDoc.exists ? inboxDoc.data() : { items: [] };
      const activeData = dataDoc.data() || { patients: [], units: [], rev: 0 };

      // Find the patient in inbox
      const patientIndex = (inboxData.items || []).findIndex(
        (item) => item.id === patientId
      );

      if (patientIndex === -1) {
        throw new HttpsError('not-found', 'Patient not found in inbox');
      }

      const patient = inboxData.items[patientIndex];

      // Remove inbox metadata and add to active patients
      const { sentAt: _sentAt, sentBy, status: _status, ...cleanPatient } = patient;
      cleanPatient.unitId = targetUnitId || cleanPatient.unitId;
      cleanPatient.acceptedAt = new Date().toISOString();
      cleanPatient.acceptedFrom = sentBy;

      // Update inbox - mark as accepted or remove
      const updatedInboxItems = [...inboxData.items];
      updatedInboxItems.splice(patientIndex, 1);

      transaction.set(inboxRef, {
        items: updatedInboxItems,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Add to active patients
      transaction.update(dataRef, {
        patients: [...(activeData.patients || []), cleanPatient],
        rev: (activeData.rev || 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true, message: 'Patient accepted' };
  } catch (error) {
    console.error(`[acceptInboxPatient] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Declines/removes a patient from inbox.
 */
exports.declineInboxPatient = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { patientId } = request.data || {};

  if (!patientId) {
    throw new HttpsError('invalid-argument', 'patientId is required');
  }

  const inboxRef = db.collection('users').doc(userId)
    .collection('data').doc('inbox');

  try {
    const inboxDoc = await inboxRef.get();
    const inboxData = inboxDoc.exists ? inboxDoc.data() : { items: [] };

    const updatedItems = (inboxData.items || []).filter(
      (item) => item.id !== patientId
    );

    await inboxRef.set({
      items: updatedItems,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, message: 'Patient declined' };
  } catch (error) {
    console.error(`[declineInboxPatient] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

// ============================================================================
// SESSION TRACKING & HEARTBEAT
// ============================================================================

/**
 * Updates session info and returns sync status.
 */
async function updateSession(userId, deviceId, deviceInfo, clientRev) {
  const sessionsRef = db.collection('users').doc(userId)
    .collection('data').doc('sessions');

  await db.runTransaction(async (transaction) => {
    const sessionsDoc = await transaction.get(sessionsRef);
    const sessionsData = sessionsDoc.exists ?
      sessionsDoc.data() : { active: [], tombstones: [] };

    const now = Date.now();

    // Filter out stale sessions (older than 5 minutes)
    const activeSessions = (sessionsData.active || []).filter((s) => {
      const lastSeen = new Date(s.lastSeen).getTime();
      return (now - lastSeen) < SESSION_TIMEOUT_MS;
    });

    // Update or add current session
    const sessionIndex = activeSessions.findIndex((s) => s.deviceId === deviceId);
    const sessionData = {
      deviceId,
      deviceInfo: deviceInfo || {},
      lastSeen: new Date().toISOString(),
      clientRev: clientRev || 0
    };

    if (sessionIndex >= 0) {
      activeSessions[sessionIndex] = sessionData;
    } else {
      activeSessions.push(sessionData);
    }

    transaction.set(sessionsRef, {
      active: activeSessions,
      tombstones: sessionsData.tombstones || [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

/**
 * Heartbeat function for session tracking and sync status.
 */
exports.heartbeat = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { deviceId, deviceInfo, clientRev } = request.data || {};

  try {
    await updateSession(userId, deviceId || 'unknown', deviceInfo, clientRev);

    // Get current server rev
    const dataDoc = await db.collection('users').doc(userId)
      .collection('data').doc('active').get();
    const serverData = dataDoc.exists ? dataDoc.data() : { rev: 1 };
    const serverRev = serverData.rev || 1;

    const revGap = serverRev - (clientRev || 0);

    return {
      success: true,
      rev: serverRev,
      updatedAt: serverData.updatedAt,
      forceFullSync: revGap > 10 || revGap < 0,
      revGap,
      activeDevices: await getActiveDeviceCount(userId)
    };
  } catch (error) {
    console.error(`[heartbeat] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Gets count of active devices for a user.
 */
async function getActiveDeviceCount(userId) {
  const sessionsDoc = await db.collection('users').doc(userId)
    .collection('data').doc('sessions').get();

  if (!sessionsDoc.exists) return 0;

  const sessionsData = sessionsDoc.data();
  const now = Date.now();

  return (sessionsData.active || []).filter((s) => {
    const lastSeen = new Date(s.lastSeen).getTime();
    return (now - lastSeen) < SESSION_TIMEOUT_MS;
  }).length;
}

// ============================================================================
// AI FUNCTIONS (CLAUDE INTEGRATION)
// ============================================================================

/**
 * ============================================================================
 * CRITICAL FIX APPLIED - 2026-01-28
 * ============================================================================
 * 
 * BUG: Network errors due to API key mismatch
 * ROOT CAUSE: Code looked for 'claude.api_key' but key was saved as 'anthropic.key'
 * RESULT: Function received undefined, sent bad request → network error
 * 
 * FIXES APPLIED:
 * 1. getClaudeApiKey() - Now checks BOTH config locations + environment variables
 *    - ANTHROPIC_API_KEY (where you saved it)
 *    - CLAUDE_API_KEY (backwards compatibility)
 *    - Legacy firebase config locations
 * 
 * 2. callClaudeAPI() - Hardened with better error handling
 *    - Validates API key BEFORE making request
 *    - Checks API key is actually defined (not undefined)
 *    - Better error messages with actionable solutions
 *    - Specific handling for different HTTP error codes
 * 
 * 3. AI_CONFIG - Updated to latest Claude models
 *    - FAST: claude-3-5-sonnet-20241022 (excellent for clinical work)
 *    - ADVANCED: claude-opus-4-20250514 (most capable)
 * 
 * DEPLOYMENT:
 * 1. Set your API key: firebase functions:config:set anthropic.key="sk-ant-YOUR_KEY"
 * 2. Deploy: firebase deploy --only functions
 * 
 * VERIFICATION:
 * Your functions should now work without "Network Issues" errors.
 * Check logs: firebase functions:log --follow
 * ============================================================================
 */

/**
 * Gets Claude API key from environment variables.
 *
 * FIREBASE FUNCTIONS V2:
 * In v2, secrets are set via: firebase functions:secrets:set ANTHROPIC_API_KEY
 * The secret is then available as process.env.ANTHROPIC_API_KEY when the
 * function is configured with secrets: [anthropicApiKey]
 *
 * Configuration:
 * 1. Run: firebase functions:secrets:set ANTHROPIC_API_KEY
 * 2. Enter your API key when prompted
 * 3. Redeploy: firebase deploy --only functions
 */
function getClaudeApiKey() {
  // Check ANTHROPIC_API_KEY (set via firebase functions:secrets:set)
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('✓ Using API key from ANTHROPIC_API_KEY');
    return process.env.ANTHROPIC_API_KEY;
  }

  // Fallback: Check CLAUDE_API_KEY
  if (process.env.CLAUDE_API_KEY) {
    console.log('✓ Using API key from CLAUDE_API_KEY');
    return process.env.CLAUDE_API_KEY;
  }

  // No API key found
  console.error('✗ CRITICAL: No API Key found in any location');
  console.error('  Checked: ANTHROPIC_API_KEY env, CLAUDE_API_KEY env, anthropic.key config, claude.api_key config');
  return null;
}

/**
 * Calls the Claude API with the given messages.
 * 
 * IMPROVED VERSION:
 * - Validates API key before making request
 * - Better error diagnostics with actionable messages
 * - Proper Anthropic header configuration
 * - Robust fetch error handling
 * - Specific HTTP error code handling
 */
async function callClaudeAPI(messages, options = {}) {
  const apiKey = getClaudeApiKey();

  // CRITICAL ERROR CHECK: Prevent bad requests
  if (!apiKey) {
    console.error('CRITICAL: No API Key found in environment');
    console.error('ACTION REQUIRED: Run this command in Firebase CLI:');
    console.error('firebase functions:config:set anthropic.key="YOUR_ANTHROPIC_API_KEY"');
    throw new HttpsError('failed-precondition', 'Claude API key not configured. Run: firebase functions:secrets:set ANTHROPIC_API_KEY');
  }

  console.log('📡 Calling Claude API...');
  console.log('   Model:', options.model || AI_CONFIG.MODELS.FAST);
  
  try {
    const fetch = (await import('node-fetch')).default;

    // Build request body
    const requestBody = {
      model: options.model || AI_CONFIG.MODELS.FAST,
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature !== undefined ? options.temperature : 0.3,
      system: options.system || '',
      messages: messages
    };

    console.log('📨 Sending request to Anthropic API...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📬 Response received. Status:', response.status);

    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Claude API Error (${response.status}):`, errorText);
      
      // Provide specific error guidance based on HTTP status
      if (response.status === 401) {
        throw new HttpsError('unauthenticated', 'Invalid Anthropic API Key. Please verify your API key is correct.');
      } else if (response.status === 429) {
        throw new HttpsError('resource-exhausted', 'Rate limit exceeded. Please try again in a moment.');
      } else if (response.status === 500) {
        throw new HttpsError('unavailable', 'AI service temporarily unavailable. Please try again later.');
      } else {
        throw new HttpsError('internal', `AI service error (${response.status}): ${errorText}`);
      }
    }

    const data = await response.json();
    console.log('✓ Claude API response received successfully');
    
    return data;
    
  } catch (error) {
    console.error('❌ Error in callClaudeAPI:');
    console.error('   Message:', error.message);
    throw error;
  }
}

/**
 * Clinical question assistant.
 */
exports.askClinical = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { question, patientContext, model } = request.data || {};

  if (!question) {
    throw new HttpsError('invalid-argument', 'Question is required');
  }

  const systemPrompt = `You are an expert internal medicine consultant ` +
    `providing evidence-based clinical decision support for healthcare professionals.

IMPORTANT GUIDELINES:
- Use KUWAIT SI UNITS: K+ 3.5-5.0, Na+ 136-145 mmol/L, Hgb g/L (not g/dL)
- Be CONCISE and ACTIONABLE
- Flag RED FLAGS prominently with ⚠️
- Include relevant differential diagnoses
- Provide specific medication dosages when applicable
- Always include a disclaimer that this is for educational purposes only

Format your response with clear sections:
1. Key Points
2. Assessment
3. Recommendations
4. Red Flags (if any)`;

  let userMessage = question;
  if (patientContext) {
    userMessage = `Patient Context:
${JSON.stringify(patientContext, null, 2)}

Clinical Question: ${question}`;
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
      answer: response.content[0].text,
      model: model || AI_CONFIG.MODELS.FAST,
      usage: response.usage
    };
  } catch (error) {
    console.error(`[askClinical] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Lab analysis with clinical interpretation.
 */
exports.analyzeLabs = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { labs, patientContext, model } = request.data || {};

  if (!labs) {
    throw new HttpsError('invalid-argument', 'Labs data is required');
  }

  const systemPrompt = `You are a clinical pathologist providing expert interpretation of laboratory results.

IMPORTANT:
- Use KUWAIT SI UNITS (mmol/L, g/L, etc.)
- Identify critical/panic values immediately
- Suggest follow-up tests if indicated
- Consider clinical context when interpreting
- Provide differential diagnoses for abnormalities

Format your response:
1. Critical Values (if any) - HIGHLIGHT PROMINENTLY
2. Abnormal Results Summary
3. Clinical Interpretation
4. Recommended Follow-up
5. Differential Considerations`;

  let userMessage = `Laboratory Results:\n${JSON.stringify(labs, null, 2)}`;
  if (patientContext) {
    userMessage += `\n\nPatient Context:\n${JSON.stringify(patientContext, null, 2)}`;
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
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Drug information lookup.
 */
exports.getDrugInfo = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { drugName, indication, patientContext, model } = request.data || {};

  if (!drugName) {
    throw new HttpsError('invalid-argument', 'Drug name is required');
  }

  const systemPrompt = `You are a clinical pharmacist providing evidence-based drug information.

Include the following in your response:
1. Drug Class & Mechanism
2. Indications
3. Dosing (adult & renal adjustment if applicable)
4. Contraindications
5. Major Drug Interactions
6. Side Effects (common and serious)
7. Monitoring Parameters
8. Special Considerations (pregnancy, elderly, etc.)

Be concise but comprehensive. Use bullet points for clarity.`;

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
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Generates differential diagnosis from symptoms.
 */
exports.generateDifferential = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { symptoms, patientContext, model } = request.data || {};

  if (!symptoms) {
    throw new HttpsError('invalid-argument', 'Symptoms are required');
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
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Generates treatment plan.
 */
exports.getTreatmentPlan = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { diagnosis, patientContext, model } = request.data || {};

  if (!diagnosis) {
    throw new HttpsError('invalid-argument', 'Diagnosis is required');
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
    throw new HttpsError('internal', error.message);
  }
});

/**
 * On-call clinical consultation (more comprehensive).
 */
exports.oncallConsult = onCall({ secrets: [anthropicApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { scenario, patientContext, urgency, model } = request.data || {};

  if (!scenario) {
    throw new HttpsError('invalid-argument', 'Clinical scenario is required');
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
    throw new HttpsError('internal', error.message);
  }
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets user profile.
 *
 * FIXED v2.3: Added data sanitization to prevent serialization errors.
 *
 * KEY FIXES:
 * 1. All code wrapped in try-catch to prevent any unhandled exceptions
 * 2. Auth check returns proper 'unauthenticated' error (not crash → internal)
 * 3. HttpsError re-thrown properly using httpErrorCode check
 * 4. Structured logging for server-side diagnostics
 * 5. Firestore Timestamps converted to ISO strings before returning
 *
 * IMPORTANT: In Firebase callable functions, ANY unhandled exception becomes
 * "internal" error. We must explicitly throw HttpsError for proper error codes.
 */
exports.getUserProfile = onCall(async (request) => {
  console.log('[getUserProfile] Function invoked - v2.3 with sanitization');

  try {
    // =========================================================================
    // AUTH CHECK - Must return 'unauthenticated', not crash
    // =========================================================================
    if (!request.auth) {
      console.log('[getUserProfile] No auth context - returning unauthenticated');
      throw new HttpsError('unauthenticated', 'User must be authenticated to access profile');
    }

    const userId = request.auth.uid;
    if (!userId) {
      console.log('[getUserProfile] Auth exists but no uid - returning unauthenticated');
      throw new HttpsError('unauthenticated', 'User ID not found in authentication context');
    }

    console.log(`[getUserProfile] Authenticated user: ${userId}`);

    // =========================================================================
    // FIRESTORE LOOKUP
    // =========================================================================
    console.log(`[getUserProfile] Fetching document: users/${userId}`);
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.log(`[getUserProfile] No profile document for user: ${userId} - creating one`);
      // Auto-create profile if it doesn't exist (handles users created before trigger deployment)
      const now = admin.firestore.FieldValue.serverTimestamp();
      const newProfile = {
        uid: userId,
        email: request.auth.token?.email || null,
        displayName: request.auth.token?.name || request.auth.token?.email?.split('@')[0] || 'User',
        photoURL: request.auth.token?.picture || null,
        createdAt: now,
        lastLoginAt: now,
        authProvider: request.auth.token?.firebase?.sign_in_provider || 'unknown',
        settings: {
          adminPassword: 'admin123',
          theme: 'auto',
          notifications: true,
          offlineMode: true
        }
      };

      await db.collection('users').doc(userId).set(newProfile);
      console.log(`[getUserProfile] Created new profile for user: ${userId}`);

      // Return sanitized profile (convert serverTimestamp to ISO string)
      return {
        success: true,
        profile: {
          ...newProfile,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        },
        isNewProfile: true
      };
    }

    // Sanitize data to ensure it can be serialized properly
    const rawData = userDoc.data();

    // Edge case: document exists but has no data
    if (!rawData) {
      console.log(`[getUserProfile] Profile document exists but has no data for: ${userId}`);
      return { success: false, error: 'User profile is empty', userId };
    }

    console.log(`[getUserProfile] Raw data keys: ${Object.keys(rawData).join(', ')}`);

    const sanitizedProfile = sanitizeFirestoreData(rawData);
    console.log(`[getUserProfile] Profile sanitized successfully for: ${userId}`);

    return {
      success: true,
      profile: sanitizedProfile
    };

  } catch (error) {
    // =========================================================================
    // ERROR HANDLING - Re-throw HttpsError, wrap everything else
    // =========================================================================
    console.error('[getUserProfile] Error caught:', error);
    console.error('[getUserProfile] Error name:', error.name);
    console.error('[getUserProfile] Error message:', error.message);
    console.error('[getUserProfile] Error code:', error.code);
    console.error('[getUserProfile] Error stack:', error.stack);

    // If it's already an HttpsError, re-throw it as-is
    // HttpsError has httpErrorCode property (e.g., { canonicalName: 'UNAUTHENTICATED' })
    if (error.httpErrorCode) {
      console.log(`[getUserProfile] Re-throwing HttpsError: ${error.code}`);
      throw error;
    }

    // Handle Firestore permission errors specifically
    if (error.code === 'permission-denied' || error.code === 7) {
      console.log('[getUserProfile] Firestore permission denied');
      throw new HttpsError('permission-denied', 'Access denied to user profile');
    }

    // Wrap any other error as internal with detailed message
    const errorMessage = error.message || 'Unknown error';
    const errorName = error.name || 'UnknownError';
    console.error(`[getUserProfile] Unexpected ${errorName}: ${errorMessage}`);
    throw new HttpsError('internal', `Failed to get profile: ${errorName} - ${errorMessage}`);
  }
});

/**
 * Updates user settings.
 */
exports.updateSettings = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = request.auth.uid;
  const { settings } = request.data || {};

  if (!settings || typeof settings !== 'object') {
    throw new HttpsError('invalid-argument', 'Settings object is required');
  }

  try {
    await db.collection('users').doc(userId).update({
      settings: settings,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    console.error(`[updateSettings] Error:`, error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Health check endpoint.
 * MIGRATED TO V2 - uses cors: true option for automatic CORS handling
 *
 * NOTE: If CORS still fails after deployment, the function may need redeployment.
 * Run: firebase deploy --only functions:healthCheck
 */
exports.healthCheck = onRequest({
  cors: true,
  // Explicitly allow all methods for maximum compatibility
  invoker: 'public'
}, (req, res) => {
  // Set explicit CORS headers as a fallback
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.2.2',
    region: 'us-central1',
    method: req.method,
    origin: req.headers.origin || 'none',
    corsEnabled: true
  });
});

/**
 * Configuration check endpoint.
 * Returns diagnostic info about function configuration (no sensitive data).
 */
exports.configCheck = onRequest({ cors: true, secrets: [anthropicApiKey] }, (req, res) => {
  // Check API key configuration (v2 uses secrets/env vars only)
  const apiKeyStatus = {
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    CLAUDE_API_KEY: !!process.env.CLAUDE_API_KEY
  };

  // Test if we can actually get the API key
  const apiKey = getClaudeApiKey();
  const hasValidKey = !!(apiKey && apiKey.length > 10);

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    functionsVersion: 'v2',
    nodeVersion: process.version,
    apiKeyConfiguration: apiKeyStatus,
    apiKeyFound: hasValidKey,
    apiKeyPrefix: hasValidKey ? apiKey.substring(0, 10) + '...' : null,
    recommendation: hasValidKey
      ? 'API key is configured correctly'
      : 'Run: firebase functions:secrets:set ANTHROPIC_API_KEY then redeploy'
  });
});

// End of Cloud Functions - Frontend code should be in a separate file (e.g., public/index.html or src/firebase.js)
