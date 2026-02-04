// core/scheduled.js
// Scheduled functions

const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

/**
 * Daily cleanup of expired trash items.
 * Runs every 24 hours; deletes items past their 30-day expiry.
 */
exports.cleanupTrash = onSchedule("every 24 hours", async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const expiredSnap = await db
    .collection("trash")
    .where("expiresAt", "<=", now)
    .limit(500)
    .get();

  if (expiredSnap.docs.length === 0) return;

  const batch = db.batch();
  expiredSnap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  logger.info("cleanupTrash", { deleted: expiredSnap.docs.length });
});
