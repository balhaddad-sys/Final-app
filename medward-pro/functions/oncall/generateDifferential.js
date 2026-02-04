// oncall/generateDifferential.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude, extractJsonStrict } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * Generates a structured differential diagnosis from a clinical presentation.
 *
 * @param {object} request.data
 * @param {string} request.data.presentation - Clinical presentation
 * @param {object} [request.data.vitals] - Optional vital signs
 * @param {string} [request.data.age] - Patient age
 * @param {string} [request.data.sex] - Patient sex
 * @returns {{ success, differential, cached, timestamp }}
 */
exports.oncall_generateDifferential = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const presentation = clampText(
      request.data?.presentation,
      UNIFIED_CONFIG.MAX_TEXT_CHARS
    );
    if (!presentation) {
      throw new HttpsError("invalid-argument", "Clinical presentation required.");
    }

    // 3. Build user message
    const parts = [`Clinical presentation: ${presentation}`];
    if (request.data?.age) parts.push(`Age: ${request.data.age}`);
    if (request.data?.sex) parts.push(`Sex: ${request.data.sex}`);
    if (request.data?.vitals && typeof request.data.vitals === "object") {
      const v = request.data.vitals;
      const vParts = [];
      if (v.hr) vParts.push(`HR ${v.hr}`);
      if (v.bp) vParts.push(`BP ${v.bp}`);
      if (v.rr) vParts.push(`RR ${v.rr}`);
      if (v.temp) vParts.push(`Temp ${v.temp}`);
      if (v.spo2) vParts.push(`SpO2 ${v.spo2}`);
      if (vParts.length) parts.push(`Vitals: ${vParts.join(", ")}`);
    }

    parts.push(
      '\nReturn JSON: {"mostLikely":[{"diagnosis":"","reasoning":""}],' +
        '"mustNotMiss":[{"diagnosis":"","reasoning":""}],' +
        '"workup":[],"redFlags":[]}'
    );

    const userMessage = parts.join("\n");

    // 4. Cache check
    const cacheKey = `ddx_${sha1Hex(userMessage).slice(0, 40)}`;
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

      const differential = extractJsonStrict(response);

      logger.info("oncall_generateDifferential", {
        uid,
        ms: Date.now() - t0,
        cached: false
      });

      const result = {
        success: true,
        differential,
        disclaimer:
          "AI-generated differential. Always correlate clinically.",
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
