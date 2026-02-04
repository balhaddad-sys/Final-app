// core/admin.js
// Admin operations: export data, delete account

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Exports all user data for GDPR compliance.
 */
exports.exportUserData = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const userId = request.auth.uid;
    const db = admin.firestore();

    try {
      const userDoc = await db.collection("users").doc(userId).get();
      const unitsSnap = await db
        .collection("units")
        .where("members", "array-contains", userId)
        .get();

      const unitIds = unitsSnap.docs.map((doc) => doc.id);
      let patients = [];
      let tasks = [];

      for (const unitId of unitIds) {
        const patientsSnap = await db
          .collection("patients")
          .where("unitId", "==", unitId)
          .where("createdBy", "==", userId)
          .get();

        const unitPatients = patientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        patients = patients.concat(unitPatients);

        const patientIds = unitPatients.map((p) => p.id);
        if (patientIds.length > 0) {
          const chunks = chunkArray(patientIds, 10);
          for (const chunk of chunks) {
            const tasksSnap = await db
              .collection("tasks")
              .where("patientId", "in", chunk)
              .where("createdBy", "==", userId)
              .get();
            tasks = tasks.concat(tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          }
        }
      }

      return {
        user: userDoc.data(),
        units: unitsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        patients,
        tasks,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to export user data.");
    }
  }
);

/**
 * Permanently deletes user account and data.
 */
exports.deleteAccount = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { confirmation } = request.data;
    const userId = request.auth.uid;
    const db = admin.firestore();

    if (confirmation !== "DELETE_MY_ACCOUNT") {
      throw new HttpsError("invalid-argument", 'Invalid confirmation. Send "DELETE_MY_ACCOUNT" to confirm.');
    }

    try {
      await db.collection("users").doc(userId).delete();
      await admin.auth().deleteUser(userId);
      return { success: true, message: "Account deleted successfully." };
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to delete account.");
    }
  }
);
