// index.js
// MedWard Pro Cloud Functions — main exports
// ═══════════════════════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

// Initialise Firebase Admin once at module level
admin.initializeApp();

const { assertAuthed } = require("./helpers/auth");

// ─────────────────────────────────────────────────────────────────────────────
// AI MODULE EXPORTS — MedWard
// ─────────────────────────────────────────────────────────────────────────────
const { medward_askClinical } = require("./medward/askClinical");
const { medward_getDrugInfo } = require("./medward/getDrugInfo");
const { medward_getAntibioticGuidance } = require("./medward/getAntibioticGuidance");
const { medward_analyzeLabImage } = require("./medward/analyzeLabImage");
const { medward_analyzeLabsWithClaude } = require("./medward/analyzeLabsWithClaude");
const { medward_generateHandoverSummary } = require("./medward/generateHandoverSummary");

exports.medward_askClinical = medward_askClinical;
exports.medward_getDrugInfo = medward_getDrugInfo;
exports.medward_getAntibioticGuidance = medward_getAntibioticGuidance;
exports.medward_analyzeLabImage = medward_analyzeLabImage;
exports.medward_analyzeLabsWithClaude = medward_analyzeLabsWithClaude;
exports.medward_generateHandoverSummary = medward_generateHandoverSummary;

// ─────────────────────────────────────────────────────────────────────────────
// AI MODULE EXPORTS — OnCall
// ─────────────────────────────────────────────────────────────────────────────
const { oncall_askOnCall } = require("./oncall/askOnCall");
const { oncall_generateDifferential } = require("./oncall/generateDifferential");
const { oncall_verifyElectrolyteCorrection } = require("./oncall/verifyElectrolyteCorrection");

exports.oncall_askOnCall = oncall_askOnCall;
exports.oncall_generateDifferential = oncall_generateDifferential;
exports.oncall_verifyElectrolyteCorrection = oncall_verifyElectrolyteCorrection;

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
const { REFERENCE_RANGES, CLINICAL_PROTOCOLS } = require("./references");

/**
 * Returns Kuwait SI reference ranges for a specific lab test or all tests.
 * No AI call required — purely static data.
 *
 * @param {object} request.data
 * @param {string} [request.data.test] - Specific test name (optional)
 * @returns {{ success, data|availableTests }}
 */
exports.medward_getReferenceRanges = onCall(
  { cors: true },
  async (request) => {
    const uid = assertAuthed(request);

    if (request.data?.test) {
      const key = request.data.test;
      const value = REFERENCE_RANGES[key];
      if (value) {
        return { success: true, data: { [key]: value } };
      }
      throw new HttpsError("not-found", "Test not found in reference ranges.");
    }

    return {
      success: true,
      availableTests: Object.keys(REFERENCE_RANGES),
      timestamp: new Date().toISOString()
    };
  }
);

/**
 * Returns clinical protocols (sepsis, hyperkalemia, DKA, etc.).
 *
 * @param {object} request.data
 * @param {string} [request.data.protocol] - Protocol key (optional)
 * @returns {{ success, data|availableProtocols }}
 */
exports.medward_getClinicalProtocol = onCall(
  { cors: true },
  async (request) => {
    const uid = assertAuthed(request);

    if (request.data?.protocol) {
      const key = request.data.protocol.toUpperCase();
      const value = CLINICAL_PROTOCOLS[key];
      if (value) {
        return { success: true, data: value };
      }
      throw new HttpsError("not-found", "Protocol not found.");
    }

    return {
      success: true,
      availableProtocols: Object.keys(CLINICAL_PROTOCOLS),
      timestamp: new Date().toISOString()
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// NON-AI FUNCTIONS (preserved from original index.ts)
// ═══════════════════════════════════════════════════════════════════════════════

const db = () => admin.firestore();

/**
 * Chunks an array into sub-arrays for Firestore 'in' queries (max 10).
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ─────────────────────────────────────────────────────────────────────────────
// USER MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensures a user profile document exists in Firestore after login.
 */
exports.ensureUserProfile = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const userEmail = request.auth.token.email || "";
  const userName =
    request.auth.token.name || userEmail.split("@")[0] || "User";

  try {
    const userRef = db().collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid,
        email: userEmail,
        displayName: userName,
        photoURL: request.auth.token.picture || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        settings: { theme: "light", notifications: true }
      });
      return { success: true, created: true, uid };
    }

    return { success: true, created: false, uid };
  } catch (error) {
    logger.error("ensureUserProfile failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to ensure user profile.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DATA OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads patients, tasks, and units for the authenticated user.
 */
exports.loadData = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { unitId } = request.data || {};

  try {
    const unitDoc = await db().collection("units").doc(unitId).get();
    if (!unitDoc.exists) {
      throw new HttpsError("not-found", "Unit not found.");
    }

    const unitData = unitDoc.data();
    if (!unitData?.members?.includes(uid)) {
      throw new HttpsError("permission-denied", "Not a member of this unit.");
    }

    const patientsSnap = await db()
      .collection("patients")
      .where("unitId", "==", unitId)
      .where("deleted", "==", false)
      .get();

    const patients = patientsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const patientIds = patients.map((p) => p.id);
    let tasks = [];

    if (patientIds.length > 0) {
      const chunks = chunkArray(patientIds, 10);
      for (const chunk of chunks) {
        const tasksSnap = await db()
          .collection("tasks")
          .where("patientId", "in", chunk)
          .where("deleted", "==", false)
          .get();
        tasks = tasks.concat(
          tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      }
    }

    const unitsSnap = await db()
      .collection("units")
      .where("members", "array-contains", uid)
      .get();
    const units = unitsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return { success: true, patients, tasks, units };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("loadData failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to load data.");
  }
});

/**
 * Creates or updates a document in patients, tasks, or units.
 */
exports.saveData = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { collection, id, payload, operation } = request.data || {};

  if (!["patients", "tasks", "units"].includes(collection)) {
    throw new HttpsError("invalid-argument", "Invalid collection.");
  }

  try {
    const docRef = db().collection(collection).doc(id);

    if (operation === "create") {
      await docRef.set({
        ...payload,
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        deleted: false
      });
      return { success: true, id };
    } else if (operation === "update") {
      const doc = await docRef.get();
      if (!doc.exists) {
        throw new HttpsError("not-found", "Document not found.");
      }
      await docRef.update({
        ...payload,
        updatedBy: uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, id };
    }

    throw new HttpsError("invalid-argument", "Invalid operation.");
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("saveData failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to save data.");
  }
});

/**
 * Soft-deletes an item to the trash collection (30-day retention).
 */
exports.moveToTrash = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { collection, id } = request.data || {};

  if (!["patients", "tasks"].includes(collection)) {
    throw new HttpsError("invalid-argument", "Invalid collection.");
  }

  try {
    const docRef = db().collection(collection).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError("not-found", "Document not found.");
    }

    await db()
      .collection("trash")
      .doc(id)
      .set({
        originalCollection: collection,
        originalId: id,
        data: doc.data(),
        deletedBy: uid,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        )
      });

    await docRef.update({
      deleted: true,
      deletedBy: uid,
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("moveToTrash failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to delete.");
  }
});

/**
 * Restores an item from the trash collection.
 */
exports.restoreFromTrash = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { id } = request.data || {};

  try {
    const trashRef = db().collection("trash").doc(id);
    const trashDoc = await trashRef.get();
    if (!trashDoc.exists) {
      throw new HttpsError("not-found", "Item not found in trash.");
    }

    const trashData = trashDoc.data();
    const originalRef = db()
      .collection(trashData.originalCollection)
      .doc(trashData.originalId);

    await originalRef.update({
      deleted: false,
      deletedBy: admin.firestore.FieldValue.delete(),
      deletedAt: admin.firestore.FieldValue.delete(),
      restoredAt: admin.firestore.FieldValue.serverTimestamp(),
      restoredBy: uid
    });

    await trashRef.delete();
    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("restoreFromTrash failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to restore.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HANDOVER OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends a patient handover to another clinician.
 */
exports.sendPatient = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { recipientEmail, patientId, notes } = request.data || {};
  const senderEmail = request.auth.token.email;

  try {
    const patientDoc = await db().collection("patients").doc(patientId).get();
    if (!patientDoc.exists) {
      throw new HttpsError("not-found", "Patient not found.");
    }

    const recipientQuery = await db()
      .collection("users")
      .where("email", "==", recipientEmail)
      .limit(1)
      .get();

    if (recipientQuery.empty) {
      throw new HttpsError("not-found", "Recipient not found.");
    }

    const recipientId = recipientQuery.docs[0].id;

    const tasksSnap = await db()
      .collection("tasks")
      .where("patientId", "==", patientId)
      .where("deleted", "==", false)
      .get();

    const tasks = tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const handoverRef = await db().collection("handovers").add({
      senderId: uid,
      senderEmail,
      recipientId,
      recipientEmail,
      patient: { id: patientId, ...patientDoc.data() },
      tasks,
      notes: notes || "",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, handoverId: handoverRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("sendPatient failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to send handover.");
  }
});

/**
 * Checks the authenticated user's handover inbox.
 */
exports.checkInbox = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);

  try {
    const inboxSnap = await db()
      .collection("handovers")
      .where("recipientId", "==", uid)
      .where("status", "==", "pending")
      .orderBy("createdAt", "desc")
      .get();

    return {
      success: true,
      items: inboxSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    };
  } catch (error) {
    logger.error("checkInbox failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to check inbox.");
  }
});

/**
 * Accepts a pending handover and imports the patient into a target unit.
 */
exports.acceptInboxPatient = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { handoverId, targetUnitId } = request.data || {};

  try {
    const handoverRef = db().collection("handovers").doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new HttpsError("not-found", "Handover not found.");
    }

    const handoverData = handoverDoc.data();

    if (handoverData.recipientId !== uid) {
      throw new HttpsError("permission-denied", "Not authorised.");
    }
    if (handoverData.status !== "pending") {
      throw new HttpsError("failed-precondition", "Handover already processed.");
    }

    const unitDoc = await db().collection("units").doc(targetUnitId).get();
    if (!unitDoc.exists || !unitDoc.data()?.members?.includes(uid)) {
      throw new HttpsError("permission-denied", "Invalid target unit.");
    }

    const batch = db().batch();

    const newPatientRef = db().collection("patients").doc();
    batch.set(newPatientRef, {
      ...handoverData.patient,
      id: newPatientRef.id,
      unitId: targetUnitId,
      handoverFrom: handoverData.senderId,
      handoverAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    for (const task of handoverData.tasks || []) {
      const newTaskRef = db().collection("tasks").doc();
      batch.set(newTaskRef, {
        ...task,
        id: newTaskRef.id,
        patientId: newPatientRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.update(handoverRef, {
      status: "accepted",
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      newPatientId: newPatientRef.id
    });

    await batch.commit();
    return { success: true, patientId: newPatientRef.id };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("acceptInboxPatient failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to accept handover.");
  }
});

/**
 * Declines a pending handover with an optional reason.
 */
exports.declineInboxPatient = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { handoverId, reason } = request.data || {};

  try {
    const handoverRef = db().collection("handovers").doc(handoverId);
    const handoverDoc = await handoverRef.get();

    if (!handoverDoc.exists) {
      throw new HttpsError("not-found", "Handover not found.");
    }
    if (handoverDoc.data()?.recipientId !== uid) {
      throw new HttpsError("permission-denied", "Not authorised.");
    }

    await handoverRef.update({
      status: "declined",
      declinedAt: admin.firestore.FieldValue.serverTimestamp(),
      declineReason: reason || ""
    });

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("declineInboxPatient failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to decline handover.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Exports all user data (GDPR compliance).
 */
exports.exportUserData = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);

  try {
    const userDoc = await db().collection("users").doc(uid).get();
    const unitsSnap = await db()
      .collection("units")
      .where("members", "array-contains", uid)
      .get();

    const unitIds = unitsSnap.docs.map((doc) => doc.id);
    let patients = [];
    let tasks = [];

    for (const unitId of unitIds) {
      const patientsSnap = await db()
        .collection("patients")
        .where("unitId", "==", unitId)
        .where("createdBy", "==", uid)
        .get();

      const unitPatients = patientsSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));
      patients = patients.concat(unitPatients);

      const patientIds = unitPatients.map((p) => p.id);
      if (patientIds.length > 0) {
        const chunks = chunkArray(patientIds, 10);
        for (const chunk of chunks) {
          const tasksSnap = await db()
            .collection("tasks")
            .where("patientId", "in", chunk)
            .where("createdBy", "==", uid)
            .get();
          tasks = tasks.concat(
            tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
          );
        }
      }
    }

    return {
      success: true,
      user: userDoc.data(),
      units: unitsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      patients,
      tasks,
      exportedAt: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("exportUserData failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to export user data.");
  }
});

/**
 * Deletes the authenticated user's account and data.
 * Requires confirmation string "DELETE_MY_ACCOUNT".
 */
exports.deleteAccount = onCall({ cors: true }, async (request) => {
  const uid = assertAuthed(request);
  const { confirmation } = request.data || {};

  if (confirmation !== "DELETE_MY_ACCOUNT") {
    throw new HttpsError(
      "invalid-argument",
      'Invalid confirmation. Send "DELETE_MY_ACCOUNT" to confirm.'
    );
  }

  try {
    await db().collection("users").doc(uid).delete();
    await admin.auth().deleteUser(uid);
    return { success: true, message: "Account deleted successfully." };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("deleteAccount failed", {
      uid,
      error: error.message?.slice(0, 200)
    });
    throw new HttpsError("internal", "Failed to delete account.");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Daily cleanup of expired trash items (30-day threshold).
 */
exports.cleanupTrash = onSchedule("every 24 hours", async () => {
  const now = admin.firestore.Timestamp.now();
  const expiredSnap = await db()
    .collection("trash")
    .where("expiresAt", "<=", now)
    .limit(500)
    .get();

  if (expiredSnap.docs.length > 0) {
    const batch = db().batch();
    expiredSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    logger.info("cleanupTrash", { removed: expiredSnap.docs.length });
  }
});
