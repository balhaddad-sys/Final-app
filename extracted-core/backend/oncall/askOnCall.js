// oncall/askOnCall.js
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
 * On-call clinical Q&A for junior doctors covering overnight.
 *
 * @param {object} request.data
 * @param {string} request.data.question - On-call clinical question
 * @param {string} [request.data.urgency] - low | medium | high
 * @returns {{ success, answer, disclaimer, cached, timestamp }}
 */
exports.oncall_askOnCall = onCall(
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

    const validUrgency = ["low", "medium", "high"];
    const urgency = validUrgency.includes(request.data?.urgency)
      ? request.data.urgency
      : "medium";

    // 3. Build user message
    const userMessage = `On-call query (urgency: ${urgency}):\n${question}`;

    // 4. Cache check
    const cacheKey = `oncall_${sha1Hex(userMessage).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("oncall_askOnCall", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.ONCALL_CLINICAL,
        message: userMessage
      });

      logger.info("oncall_askOnCall", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        urgency
      });

      const result = {
        success: true,
        answer,
        urgency,
        disclaimer:
          "This is educational guidance only. Always use clinical judgment.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("oncall_askOnCall failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
