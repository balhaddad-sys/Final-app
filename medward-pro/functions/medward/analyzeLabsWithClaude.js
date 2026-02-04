// medward/analyzeLabsWithClaude.js
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
const { REFERENCE_RANGES } = require("../references");

/**
 * Text-based lab result analysis using Claude.
 * Accepts lab values as text and returns interpretation with reference ranges.
 *
 * @param {object} request.data
 * @param {string} request.data.labText - Lab results as text
 * @param {string} [request.data.context] - Optional clinical context
 * @returns {{ success, answer, referenceRanges, cached, timestamp }}
 */
exports.medward_analyzeLabsWithClaude = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TEXT_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const labText = clampText(request.data?.labText, UNIFIED_CONFIG.MAX_TEXT_CHARS);
    if (!labText) {
      throw new HttpsError("invalid-argument", "Lab results text required.");
    }

    const context = clampText(request.data?.context || "", 2000);

    // 3. Cache check
    const cacheKey = `labtext_${sha1Hex(labText + "|" + context).slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_analyzeLabsWithClaude", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 4. Build prompt with reference ranges context
    const rangesNote =
      "Kuwait SI reference ranges are available. " +
      "Flag any values outside normal range and identify critical values.";

    const userMessage =
      `Lab Results:\n${labText}\n\n` +
      (context ? `Clinical Context: ${context}\n\n` : "") +
      rangesNote;

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const answer = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.MEDWARD_CLINICAL,
        message: userMessage
      });

      logger.info("medward_analyzeLabsWithClaude", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        inputLength: labText.length
      });

      const result = {
        success: true,
        answer,
        referenceRanges: REFERENCE_RANGES,
        disclaimer:
          "AI-generated lab analysis. Always verify with clinical judgment.",
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_analyzeLabsWithClaude failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI service temporarily unavailable.");
    }
  }
);
