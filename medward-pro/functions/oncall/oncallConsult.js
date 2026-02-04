// oncall/oncallConsult.js
// On-call clinical consultation support

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { callClaude } = require("../helpers/claude");

/**
 * On-call consultation support.
 * Provides structured guidance for urgent clinical scenarios.
 *
 * @param {object} request.data
 * @param {string} request.data.scenario - Clinical scenario description
 * @param {string} [request.data.urgency] - "critical", "urgent", or "routine"
 * @param {object} [request.data.vitals] - Patient vitals
 * @returns {{ success: boolean, answer: string, timestamp: string }}
 */
exports.oncall_oncallConsult = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_TEXT,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const scenario = clampText(request.data?.scenario, UNIFIED_CONFIG.MAX_TEXT_CHARS);
    if (!scenario) {
      throw new HttpsError("invalid-argument", "Scenario description is required.");
    }

    const validUrgencies = ["critical", "urgent", "routine"];
    const urgency = validUrgencies.includes(request.data?.urgency)
      ? request.data.urgency
      : "routine";

    // 3. Build message with urgency prefix
    const prefix = { critical: "CRITICAL: ", urgent: "URGENT: ", routine: "" }[urgency];
    let userMessage = `${prefix}On-call consultation:\n${scenario}`;

    // Add vitals if provided
    const vitals = request.data?.vitals;
    if (vitals && typeof vitals === "object") {
      const vitalParts = [];
      if (vitals.hr) vitalParts.push(`HR: ${vitals.hr}`);
      if (vitals.bp) vitalParts.push(`BP: ${vitals.bp}`);
      if (vitals.rr) vitalParts.push(`RR: ${vitals.rr}`);
      if (vitals.temp) vitalParts.push(`Temp: ${vitals.temp}`);
      if (vitals.spo2) vitalParts.push(`SpO2: ${vitals.spo2}`);
      if (vitals.gcs) vitalParts.push(`GCS: ${vitals.gcs}`);
      if (vitalParts.length > 0) {
        userMessage += `\n\nVitals: ${vitalParts.join(", ")}`;
      }
    }

    // 4. Call Claude (no caching for on-call - always fresh)
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ONCALL_CLINICAL,
        message: userMessage
      });

      logger.info("oncall_oncallConsult", {
        uid,
        ms: Date.now() - t0,
        urgency,
        cached: false
      });

      return {
        success: true,
        answer: response,
        urgency,
        disclaimer: "This is educational guidance only. Always use clinical judgment and escalate as needed.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("oncall_oncallConsult failed", {
        uid,
        urgency,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
