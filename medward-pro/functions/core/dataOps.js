// core/dataOps.js
// Data operations: load, save, trash, restore

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
 * Loads patients, tasks, and units for a given unit.
 */
exports.loadData = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { unitId } = request.data;
    const userId = request.auth.uid;
    const db = admin.firestore();

    try {
      const unitDoc = await db.collection("units").doc(unitId).get();
      if (!unitDoc.exists) {
        throw new HttpsError("not-found", "Unit not found.");
      }

      const unitData = unitDoc.data();
      if (!unitData?.members?.includes(userId)) {
        throw new HttpsError("permission-denied", "Not a member of this unit.");
      }

      const patientsSnap = await db
        .collection("patients")
        .where("unitId", "==", unitId)
        .where("deleted", "==", false)
        .get();

      const patients = patientsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const patientIds = patients.map((p) => p.id);
      let tasks = [];

      if (patientIds.length > 0) {
        const chunks = chunkArray(patientIds, 10);
        for (const chunk of chunks) {
          const tasksSnap = await db
            .collection("tasks")
            .where("patientId", "in", chunk)
            .where("deleted", "==", false)
            .get();
          tasks = tasks.concat(tasksSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
      }

      const unitsSnap = await db
        .collection("units")
        .where("members", "array-contains", userId)
        .get();

      const units = unitsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      return { patients, tasks, units };
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to load data.");
    }
  }
);

/**
 * Creates or updates a document in patients, tasks, or units.
 */
exports.saveData = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { collection, id, payload, operation } = request.data;
    const userId = request.auth.uid;
    const db = admin.firestore();

    if (!["patients", "tasks", "units"].includes(collection)) {
      throw new HttpsError("invalid-argument", "Invalid collection.");
    }

    try {
      const docRef = db.collection(collection).doc(id);

      if (operation === "create") {
        await docRef.set({
          ...payload,
          createdBy: userId,
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
          updatedBy: userId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { success: true, id };
      }

      throw new HttpsError("invalid-argument", "Invalid operation.");
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to save data.");
    }
  }
);

/**
 * Soft-deletes a document by moving it to the trash collection.
 */
exports.moveToTrash = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { collection, id } = request.data;
    const userId = request.auth.uid;
    const db = admin.firestore();

    if (!["patients", "tasks"].includes(collection)) {
      throw new HttpsError("invalid-argument", "Invalid collection.");
    }

    try {
      const docRef = db.collection(collection).doc(id);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new HttpsError("not-found", "Document not found.");
      }

      await db.collection("trash").doc(id).set({
        originalCollection: collection,
        originalId: id,
        data: doc.data(),
        deletedBy: userId,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        )
      });

      await docRef.update({
        deleted: true,
        deletedBy: userId,
        deletedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to delete.");
    }
  }
);

/**
 * Restores a document from trash.
 */
exports.restoreFromTrash = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const { id } = request.data;
    const db = admin.firestore();

    try {
      const trashRef = db.collection("trash").doc(id);
      const trashDoc = await trashRef.get();

      if (!trashDoc.exists) {
        throw new HttpsError("not-found", "Item not found in trash.");
      }

      const trashData = trashDoc.data();
      const originalRef = db.collection(trashData.originalCollection).doc(trashData.originalId);

      await originalRef.update({
        deleted: false,
        deletedBy: admin.firestore.FieldValue.delete(),
        deletedAt: admin.firestore.FieldValue.delete(),
        restoredAt: admin.firestore.FieldValue.serverTimestamp(),
        restoredBy: request.auth.uid
      });

      await trashRef.delete();
      return { success: true };
    } catch (error) {
      if (error.code) throw error;
      throw new HttpsError("internal", "Failed to restore.");
    }
  }
);
