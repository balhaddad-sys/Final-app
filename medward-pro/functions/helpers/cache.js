// helpers/cache.js
const admin = require("firebase-admin");

const db = () => admin.firestore();

/**
 * Retrieves a cached value scoped to a user.
 * @param {string} uid - User ID
 * @param {string} cacheKey - Cache key
 * @returns {object|null} Cached value or null if expired / missing
 */
async function getCache(uid, cacheKey) {
  const doc = await db()
    .collection("aiCache")
    .doc(uid)
    .collection("items")
    .doc(cacheKey)
    .get();

  if (!doc.exists) return null;

  const { value, expiresAt } = doc.data();
  if (!expiresAt || expiresAt.toMillis() < Date.now()) {
    return null; // expired
  }
  return value;
}

/**
 * Stores a value in the user-scoped cache.
 * @param {string} uid - User ID
 * @param {string} cacheKey - Cache key
 * @param {object} value - Value to cache
 * @param {number} ttlSeconds - Time-to-live in seconds
 */
async function setCache(uid, cacheKey, value, ttlSeconds) {
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
}

module.exports = { getCache, setCache };
