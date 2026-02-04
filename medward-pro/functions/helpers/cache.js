// helpers/cache.js
// Firestore-based user-scoped cache

const admin = require("firebase-admin");

const db = () => admin.firestore();

/**
 * Retrieves a cached value for a user.
 * Returns null if not found or expired.
 * @param {string} uid - User ID
 * @param {string} cacheKey - Cache key
 * @returns {Promise<object|null>} Cached value or null
 */
async function getCache(uid, cacheKey) {
  try {
    const doc = await db()
      .collection("aiCache")
      .doc(uid)
      .collection("items")
      .doc(cacheKey)
      .get();

    if (!doc.exists) return null;

    const { value, expiresAt } = doc.data();
    if (!expiresAt || expiresAt.toMillis() < Date.now()) {
      return null; // Expired
    }

    return value;
  } catch {
    return null; // Cache miss on error
  }
}

/**
 * Stores a value in user-scoped cache with TTL.
 * @param {string} uid - User ID
 * @param {string} cacheKey - Cache key
 * @param {object} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<void>}
 */
async function setCache(uid, cacheKey, value, ttlSeconds) {
  try {
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      Date.now() + ttlSeconds * 1000
    );

    await db()
      .collection("aiCache")
      .doc(uid)
      .collection("items")
      .doc(cacheKey)
      .set({
        value,
        expiresAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
  } catch {
    // Cache write failure is non-fatal
  }
}

module.exports = { getCache, setCache };
