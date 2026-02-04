// medward/getAntibioticGuidance.js
// Empiric antibiotic guidance

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * Provides empiric antibiotic guidance for a given condition.
 *
 * @param {object} request.data
 * @param {string} request.data.condition - Infection/condition
 * @param {object} [request.data.patientFactors] - Allergies, renal fn, weight, age, pregnancy
 * @returns {{ success: boolean, answer: string, cached: boolean, timestamp: string }}
 */
exports.medward_getAntibioticGuidance = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_TEXT,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const condition = clampText(request.data?.condition, 500);
    if (!condition) {
      throw new HttpsError("invalid-argument", "Condition is required.");
    }

    // 3. Build user message with patient factors
    let userMessage = `Provide empiric antibiotic guidance for: ${condition}`;
    const patientFactors = request.data?.patientFactors;
    if (patientFactors && typeof patientFactors === "object") {
      const factors = [];
      if (patientFactors.allergies) factors.push(`Allergies: ${clampText(patientFactors.allergies, 200)}`);
      if (patientFactors.renalFunction) factors.push(`Renal function: ${clampText(patientFactors.renalFunction, 200)}`);
      if (patientFactors.hepaticFunction) factors.push(`Hepatic function: ${clampText(patientFactors.hepaticFunction, 200)}`);
      if (patientFactors.weight) factors.push(`Weight: ${patientFactors.weight} kg`);
      if (patientFactors.age) factors.push(`Age: ${patientFactors.age}`);
      if (patientFactors.pregnant) factors.push("Pregnant: yes");
      if (factors.length > 0) {
        userMessage += `\n\nPatient factors:\n${factors.join("\n")}`;
      }
    }

    // 4. Cache check
    const fingerprint = sha1Hex(userMessage);
    const cacheKey = `abx_${fingerprint.slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_getAntibioticGuidance", { uid, cached: true, condition });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ANTIBIOTIC,
        message: userMessage
      });

      logger.info("medward_getAntibioticGuidance", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        condition
      });

      const result = {
        success: true,
        answer: response,
        disclaimer: "Always follow local antibiograms and consult ID for complex infections.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_getAntibioticGuidance failed", {
        uid,
        condition,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
