// oncall/verifyElectrolyteCorrection.js
// Electrolyte correction verification

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { callClaude, extractJsonStrict } = require("../helpers/claude");

/**
 * Verifies electrolyte correction calculations.
 * Accepts either a freetext scenario or structured parameters.
 *
 * @param {object} request.data
 * @param {string} [request.data.scenario] - Freetext scenario description (alternative input)
 * @param {string} [request.data.electrolyte] - Electrolyte name (e.g., "sodium", "potassium")
 * @param {number} [request.data.currentValue] - Current measured value
 * @param {number} [request.data.targetValue] - Target value
 * @param {string} [request.data.proposedCorrection] - Proposed correction plan
 * @param {object} [request.data.patientData] - Weight, age, sex, comorbidities
 * @returns {{ success: boolean, verification: object, timestamp: string }}
 */
exports.oncall_verifyElectrolyteCorrection = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_TEXT,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate — accept freetext scenario OR structured params
    const scenario = clampText(request.data?.scenario || "", UNIFIED_CONFIG.MAX_TEXT_CHARS);
    const electrolyte = clampText(request.data?.electrolyte || "", 100);

    let userMessage;

    if (scenario) {
      // Freetext scenario mode (from presets or custom text)
      userMessage = `Verify electrolyte correction:\n${scenario}`;
    } else {
      // Structured params mode
      if (!electrolyte) {
        throw new HttpsError("invalid-argument", "Electrolyte name or scenario is required.");
      }

      const currentValue = parseFloat(request.data?.currentValue);
      const targetValue = parseFloat(request.data?.targetValue);
      if (isNaN(currentValue) || isNaN(targetValue)) {
        throw new HttpsError("invalid-argument", "Current and target values must be numbers.");
      }

      const proposedCorrection = clampText(request.data?.proposedCorrection || "", 1000);

      const parts = [
        `Verify electrolyte correction:`,
        `- Electrolyte: ${electrolyte}`,
        `- Current value: ${currentValue}`,
        `- Target value: ${targetValue}`
      ];

      if (proposedCorrection) {
        parts.push(`- Proposed correction: ${proposedCorrection}`);
      }

      const patientData = request.data?.patientData;
      if (patientData && typeof patientData === "object") {
        if (patientData.weight) parts.push(`- Weight: ${patientData.weight} kg`);
        if (patientData.age) parts.push(`- Age: ${patientData.age}`);
        if (patientData.sex) parts.push(`- Sex: ${patientData.sex}`);
        if (patientData.comorbidities) parts.push(`- Comorbidities: ${clampText(patientData.comorbidities, 500)}`);
      }

      userMessage = parts.join("\n");
    }

    // 4. Call Claude (no caching - safety critical)
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ELECTROLYTE,
        message: userMessage
      });

      let verification;
      try {
        verification = extractJsonStrict(response);
      } catch {
        // If JSON extraction fails, return raw text
        verification = {
          verified: false,
          analysis: response,
          warnings: ["Could not parse structured response"]
        };
      }

      logger.info("oncall_verifyElectrolyteCorrection", {
        uid,
        ms: Date.now() - t0,
        electrolyte,
        cached: false
      });

      return {
        success: true,
        verification,
        disclaimer: "Always verify calculations independently. This is for educational support only.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("oncall_verifyElectrolyteCorrection failed", {
        uid,
        electrolyte,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
