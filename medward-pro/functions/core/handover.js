// core/handover.js
// Patient handover operations

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Sends a patient to another doctor via handover.
 */
exports.sendPatient = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { recipientEmail, patientId, notes } = request.data;
    const senderId = request.auth.uid;
    const senderEmail = request.auth.token.email;
    const db = admin.firestore();

    try {
      const patientDoc = await db.collection("patients").doc(patientId).get();
      if (!patientDoc.exists) {
        throw new HttpsError("not-found", "Patient not found.");
      }

      const recipientQuery = await db
        .collection("users")
        .where("email", "==", recipientEmail)
        .limit(1)
        .get();

      if (recipientQuery.empty) {
        throw new HttpsError("not-found", "Recipient not found.");
      }

      const recipientId = recipientQuery.docs[0].id;

      const tasksSnap = await db
        .collection("tasks")
        .where("patientId", "==", patientId)
        .where("deleted", "==", false)
        .get();

      const tasks = tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const handoverRef = await db.collection("handovers").add({
        senderId,
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
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to send handover.");
    }
  }
);

/**
 * Checks inbox for pending handovers.
 */
exports.checkInbox = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const db = admin.firestore();

    try {
      const inboxSnap = await db
        .collection("handovers")
        .where("recipientId", "==", request.auth.uid)
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .get();

      return { items: inboxSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
    } catch (error) {
      throw new HttpsError("internal", "Failed to check inbox.");
    }
  }
);

/**
 * Accepts a handover and copies patient to target unit.
 */
exports.acceptInboxPatient = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { handoverId, targetUnitId } = request.data;
    const userId = request.auth.uid;
    const db = admin.firestore();

    try {
      const handoverRef = db.collection("handovers").doc(handoverId);
      const handoverDoc = await handoverRef.get();

      if (!handoverDoc.exists) {
        throw new HttpsError("not-found", "Handover not found.");
      }

      const handoverData = handoverDoc.data();

      if (handoverData.recipientId !== userId) {
        throw new HttpsError("permission-denied", "Not authorized.");
      }

      if (handoverData.status !== "pending") {
        throw new HttpsError("failed-precondition", "Handover already processed.");
      }

      const unitDoc = await db.collection("units").doc(targetUnitId).get();
      if (!unitDoc.exists || !unitDoc.data()?.members?.includes(userId)) {
        throw new HttpsError("permission-denied", "Invalid target unit.");
      }

      const batch = db.batch();

      const newPatientRef = db.collection("patients").doc();
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
        const newTaskRef = db.collection("tasks").doc();
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
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to accept handover.");
    }
  }
);

/**
 * Declines a handover.
 */
exports.declineInboxPatient = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { handoverId, reason } = request.data;
    const db = admin.firestore();

    try {
      const handoverRef = db.collection("handovers").doc(handoverId);
      const handoverDoc = await handoverRef.get();

      if (!handoverDoc.exists) {
        throw new HttpsError("not-found", "Handover not found.");
      }

      if (handoverDoc.data()?.recipientId !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Not authorized.");
      }

      await handoverRef.update({
        status: "declined",
        declinedAt: admin.firestore.FieldValue.serverTimestamp(),
        declineReason: reason || ""
      });

      return { success: true };
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to decline handover.");
    }
  }
);
