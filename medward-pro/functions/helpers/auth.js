// helpers/auth.js
// Authentication helper for Firebase Cloud Functions

const { HttpsError } = require("firebase-functions/v2/https");

/**
 * Validates Firebase auth and returns UID.
 * Must be the FIRST call in every function handler.
 * @param {object} request - Cloud Function request
 * @returns {string} User ID
 * @throws {HttpsError} If not authenticated
 */
function assertAuthed(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  return request.auth.uid;
}

module.exports = { assertAuthed };
