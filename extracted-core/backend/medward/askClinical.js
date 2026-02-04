// medward/askClinical.js
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
 * General clinical decision-support Q&A for MedWard physicians.
 *
 * @param {object} request.data
 * @param {string} request.data.question - Clinical question
 * @param {object} [request.data.context] - Optional patient context
 * @param {string} [request.data.context.diagnosis]
 * @param {string} [request.data.context.status]
 * @param {string} [request.data.context.notes]
 * @returns {{ success, answer, disclaimer, cached, timestamp }}
 */
exports.medward_askClinical = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const question = clampText(
      request.data?.question,
      UNIFIED_CONFIG.MAX_TEXT_CHARS
    );
    if (!question) {
      throw new HttpsError("invalid-argument", "Question required.");
    }

    // 3. Build user message with optional context
    let userMessage = question;
    const ctx = request.data?.context;
    if (ctx && typeof ctx === "object") {
      const parts = [];
      if (ctx.diagnosis) parts.push(`Diagnosis: ${ctx.diagnosis}`);
      if (ctx.status) parts.push(`Status: ${ctx.status}`);
      if (ctx.notes) parts.push(`Notes: ${ctx.notes}`);
      if (parts.length > 0) {
        userMessage = `Patient Context:\n${parts.join("\n")}\n\nQuestion: ${question}`;
      }
    }

    // 4. Cache check
    const cacheKey = `clinical_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_askClinical", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.MEDWARD_CLINICAL,
        message: userMessage
      });

      logger.info("medward_askClinical", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        inputLength: userMessage.length
      });

      const result = {
        success: true,
        answer,
        disclaimer:
          "This is educational guidance only. Always use clinical judgment and consult specialists for complex cases.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_askClinical failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
