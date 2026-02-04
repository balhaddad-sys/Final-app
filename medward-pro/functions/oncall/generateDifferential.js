// oncall/generateDifferential.js
// Differential diagnosis generation

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
 * Generates a differential diagnosis for given symptoms/presentation.
 *
 * @param {object} request.data
 * @param {string} request.data.symptoms - Presenting symptoms
 * @param {object} [request.data.context] - Patient context (age, sex, PMH, labs)
 * @returns {{ success: boolean, answer: string, cached: boolean, timestamp: string }}
 */
exports.oncall_generateDifferential = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_TEXT,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const symptoms = clampText(request.data?.symptoms, UNIFIED_CONFIG.MAX_TEXT_CHARS);
    if (!symptoms) {
      throw new HttpsError("invalid-argument", "Symptoms description is required.");
    }

    // 3. Build message with patient context
    let userMessage = `Generate differential diagnosis for: ${symptoms}`;
    const context = request.data?.context;
    if (context && typeof context === "object") {
      const contextParts = [];
      if (context.age) contextParts.push(`Age: ${context.age}`);
      if (context.sex) contextParts.push(`Sex: ${context.sex}`);
      if (context.pmh) contextParts.push(`PMH: ${clampText(context.pmh, 500)}`);
      if (context.medications) contextParts.push(`Medications: ${clampText(context.medications, 500)}`);
      if (context.labs) contextParts.push(`Labs: ${clampText(context.labs, 1000)}`);
      if (contextParts.length > 0) {
        userMessage += `\n\nPatient info:\n${contextParts.join("\n")}`;
      }
    }

    // 4. Cache check
    const fingerprint = sha1Hex(userMessage);
    const cacheKey = `ddx_${fingerprint.slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("oncall_generateDifferential", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.DIFFERENTIAL,
        message: userMessage
      });

      logger.info("oncall_generateDifferential", {
        uid,
        ms: Date.now() - t0,
        cached: false
      });

      const result = {
        success: true,
        answer: response,
        disclaimer: "This is educational guidance only. Always use clinical judgment.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("oncall_generateDifferential failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
