// medward/getAntibioticGuidance.js
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
 * Provides empiric antibiotic guidance for a clinical condition.
 *
 * @param {object} request.data
 * @param {string} request.data.condition - Infection / clinical scenario
 * @param {object} [request.data.patientFactors] - Allergies, renal fn, etc.
 * @returns {{ success, answer, condition, cached, timestamp }}
 */
exports.medward_getAntibioticGuidance = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const condition = clampText(request.data?.condition, 500);
    if (!condition) {
      throw new HttpsError("invalid-argument", "Condition required.");
    }

    // 3. Build user message
    let userMessage = `Provide empiric antibiotic guidance for: ${condition}`;
    const pf = request.data?.patientFactors;
    if (pf && typeof pf === "object") {
      const factors = [];
      if (pf.allergies) factors.push(`Allergies: ${pf.allergies}`);
      if (pf.renalFunction) factors.push(`Renal function: ${pf.renalFunction}`);
      if (pf.hepaticFunction) factors.push(`Hepatic function: ${pf.hepaticFunction}`);
      if (pf.weight) factors.push(`Weight: ${pf.weight} kg`);
      if (pf.age) factors.push(`Age: ${pf.age}`);
      if (pf.pregnant) factors.push("Pregnant: yes");
      if (factors.length > 0) {
        userMessage += `\n\nPatient factors:\n${factors.join("\n")}`;
      }
    }

    // 4. Cache check
    const cacheKey = `abx_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_getAntibioticGuidance", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
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
        answer,
        condition,
        disclaimer:
          "Always follow local antibiograms and consult ID for complex infections.",
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
