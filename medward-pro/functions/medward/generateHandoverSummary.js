// medward/generateHandoverSummary.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { callClaude } = require("../helpers/claude");

/**
 * Generates an AI-powered clinical handover summary from patient data.
 *
 * @param {object} request.data
 * @param {string} request.data.patientId - Firestore patient document ID
 * @returns {{ success, summary, disclaimer, timestamp }}
 */
exports.medward_generateHandoverSummary = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const patientId = clampText(request.data?.patientId, 200);
    if (!patientId) {
      throw new HttpsError("invalid-argument", "Patient ID required.");
    }

    const db = admin.firestore();

    try {
      // 3. Fetch patient
      const patientDoc = await db.collection("patients").doc(patientId).get();
      if (!patientDoc.exists) {
        throw new HttpsError("not-found", "Patient not found.");
      }
      const patient = patientDoc.data();

      // 4. Fetch tasks
      const tasksSnap = await db
        .collection("tasks")
        .where("patientId", "==", patientId)
        .where("deleted", "==", false)
        .get();

      const tasks = tasksSnap.docs.map((doc) => doc.data());
      const pendingTasks = tasks.filter((t) => !t.completed);
      const completedTasks = tasks.filter((t) => t.completed);

      // 5. Build prompt (no PHI sent — diagnosis, status, tasks only)
      const userMessage =
        `Generate a concise handover summary for this patient:\n` +
        `- Diagnosis: ${patient.diagnosis || "Not specified"}\n` +
        `- Status: ${patient.status || "active"}\n` +
        `- Pending tasks (${pendingTasks.length}): ${pendingTasks.map((t) => t.text).join(", ") || "None"}\n` +
        `- Completed tasks (${completedTasks.length}): ${completedTasks.map((t) => t.text).join(", ") || "None"}\n` +
        (patient.notes
          ? `- Clinical notes: ${String(patient.notes).substring(0, 500)}\n`
          : "");

      // 6. Call Claude
      const apiKey = ANTHROPIC_API_KEY.value();
      const t0 = Date.now();

      const summary = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.HANDOVER,
        message: userMessage
      });

      logger.info("medward_generateHandoverSummary", {
        uid,
        ms: Date.now() - t0,
        cached: false
      });

      return {
        success: true,
        summary,
        disclaimer:
          "AI-generated summary. Please verify all details before handover.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error("medward_generateHandoverSummary failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "Failed to generate handover summary.");
    }
  }
);
