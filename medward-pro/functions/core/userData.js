// core/userData.js
// User profile management

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

/**
 * Ensures user profile exists after login.
 * Creates a new profile document if one does not exist.
 */
exports.ensureUserProfile = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Login required.");
    }

    const userId = request.auth.uid;
    const userEmail = request.auth.token.email || "";
    const userName = request.auth.token.name || userEmail.split("@")[0] || "User";

    try {
      const db = admin.firestore();
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        await userRef.set({
          uid: userId,
          email: userEmail,
          displayName: userName,
          photoURL: request.auth.token.picture || "",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          settings: { theme: "light", notifications: true }
        });
        return { created: true, uid: userId };
      }

      return { created: false, uid: userId };
    } catch (error) {
      throw new HttpsError("internal", "Failed to ensure user profile.");
    }
  }
);
