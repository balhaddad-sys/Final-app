// oncall/verifyElectrolyteCorrection.js
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
 * Verifies electrolyte correction calculations and provides guidance.
 *
 * @param {object} request.data
 * @param {string} request.data.electrolyte - e.g. "potassium", "sodium", "magnesium"
 * @param {number} request.data.currentValue - Current lab value
 * @param {number} [request.data.targetValue] - Target value
 * @param {string} [request.data.unit] - Unit (defaults to mmol/L)
 * @param {number} [request.data.weight] - Patient weight in kg
 * @param {string} [request.data.renalFunction] - Renal function description
 * @returns {{ success, verification, cached, timestamp }}
 */
exports.oncall_verifyElectrolyteCorrection = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const electrolyte = clampText(request.data?.electrolyte, 50);
    if (!electrolyte) {
      throw new HttpsError("invalid-argument", "Electrolyte name required.");
    }

    const validElectrolytes = [
      "sodium", "potassium", "calcium", "magnesium", "phosphate"
    ];
    if (!validElectrolytes.includes(electrolyte.toLowerCase())) {
      throw new HttpsError("invalid-argument", "Unsupported electrolyte.");
    }

    const currentValue = parseFloat(request.data?.currentValue);
    if (isNaN(currentValue)) {
      throw new HttpsError("invalid-argument", "Valid current value required.");
    }

    // 3. Build prompt
    const parts = [
      `Verify electrolyte correction for: ${electrolyte}`,
      `Current value: ${currentValue} ${request.data?.unit || "mmol/L"}`
    ];
    if (request.data?.targetValue != null) {
      parts.push(`Target value: ${request.data.targetValue}`);
    }
    if (request.data?.weight) {
      parts.push(`Patient weight: ${request.data.weight} kg`);
    }
    if (request.data?.renalFunction) {
      parts.push(`Renal function: ${request.data.renalFunction}`);
    }

    parts.push(
      '\nReturn JSON: {"verification":{"safe":true,"notes":""},' +
        '"calculations":{"deficit":"","replacementNeeded":""},' +
        '"regimen":{"fluid":"","rate":"","route":"","duration":""},' +
        '"monitoring":{"frequency":"","parameters":[]},' +
        '"warnings":[]}'
    );

    const userMessage = parts.join("\n");

    // 4. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ELECTROLYTE,
        message: userMessage
      });

      const verification = extractJsonStrict(response);

      logger.info("oncall_verifyElectrolyteCorrection", {
        uid,
        ms: Date.now() - t0,
        electrolyte,
        cached: false
      });

      return {
        success: true,
        verification,
        disclaimer:
          "AI-verified calculation. Always double-check with clinical protocols.",
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
