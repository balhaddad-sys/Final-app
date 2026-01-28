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
// FIREBASE FUNCTIONS V2 IMPORTS
// ============================================================================
const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { onUserCreated: onUserCreatedV2 } = require('firebase-functions/v2/identity');
const admin = require('firebase-admin');

// Legacy v1 imports for config access
const functionsV1 = require('firebase-functions');

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
    FAST: 'claude-haiku-4-5-20251001',
    BALANCED: 'claude-sonnet-4-20250514',
    ADVANCED: 'claude-opus-4-20250514'
  }
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
 */
exports.onUserCreated = onUserCreatedV2(async (event) => {
  // In v2, user data is in event.data
  const user = event.data;
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
      { id: 'unit_1', name: 'Ward 14', code: '1414', icon: 'ðŸ¥' },
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
          { id: 'unit_1', name: 'Ward 14', code: '1414', icon: 'ðŸ¥' },
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
    throw new Error('No data to save');
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
    throw new Error(`Internal error: ${error.message}`);
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
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { itemIds, itemType = 'patient' } = request.data || {};

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error('itemIds must be a non-empty array');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Gets all items in trash.
 */
exports.getTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Restores items from trash back to active data.
 */
exports.restoreFromTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { itemIds } = request.data || {};

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw new Error('itemIds must be a non-empty array');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Permanently deletes items from trash.
 */
exports.emptyTrash = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
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
    throw new Error(`Internal error: ${error.message}`);
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
    throw new Error('User must be authenticated');
  }

  const senderId = request.auth.uid;
  const senderEmail = request.auth.token.email;
  const { recipientEmail, patientData } = request.data || {};

  if (!recipientEmail || !patientData) {
    throw new Error('recipientEmail and patientData are required');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Checks the user's inbox for received patients.
 */
exports.checkInbox = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Accepts a patient from inbox and adds to active data.
 */
exports.acceptInboxPatient = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { patientId, targetUnitId } = request.data || {};

  if (!patientId) {
    throw new Error('patientId is required');
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
        throw new Error('Patient not found in inbox');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Declines/removes a patient from inbox.
 */
exports.declineInboxPatient = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const userId = request.auth.uid;
  const { patientId } = request.data || {};

  if (!patientId) {
    throw new Error('patientId is required');
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
    throw new Error(`Internal error: ${error.message}`);
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
    throw new Error('User must be authenticated');
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
    throw new Error(`Internal error: ${error.message}`);
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
 * Gets Claude API key from Firebase config or environment.
 */
function getClaudeApiKey() {
  try {
    return (functionsV1.config().claude && functionsV1.config().claude.api_key) || process.env.CLAUDE_API_KEY;
  } catch (e) {
    return process.env.CLAUDE_API_KEY;
  }
}

/**
 * Calls the Claude API with the given messages.
 */
async function callClaudeAPI(messages, options = {}) {
  const apiKey = getClaudeApiKey();

  if (!apiKey) {
    throw new Error('Claude API key not configured. Set via: firebase functions:config:set claude.api_key="YOUR_KEY"');
  }

  const fetch = (await import('node-fetch')).default;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: options.model || AI_CONFIG.MODELS.FAST,
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.3,
      system: options.system || '',
      messages: messages
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Clinical question assistant.
 */
exports.askClinical = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { question, patientContext, model } = request.data || {};

  if (!question) {
    throw new Error('Question is required');
  }

  const systemPrompt = `You are an expert internal medicine consultant ` +
    `providing evidence-based clinical decision support for healthcare professionals.

IMPORTANT GUIDELINES:
- Use KUWAIT SI UNITS: K+ 3.5-5.0, Na+ 136-145 mmol/L, Hgb g/L (not g/dL)
- Be CONCISE and ACTIONABLE
- Flag RED FLAGS prominently with âš ï¸
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Lab analysis with clinical interpretation.
 */
exports.analyzeLabs = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { labs, patientContext, model } = request.data || {};

  if (!labs) {
    throw new Error('Labs data is required');
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
    throw new Error(`Internal error: ${error.message}`);
  }
});

/**
 * Drug information lookup.
 */
exports.getDrugInfo = onCall(async (request) => {
  if (!request.auth) {
    throw new Error('User must be authenticated');
  }

  const { drugName, indication, patientContext, model } = request.data || {};

  if (!drugName) {
    throw new Error('Drug name is required');
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
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});
