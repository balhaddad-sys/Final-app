// medward/analyzeLabImage.js
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { parseDataUrlBase64 } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude, extractJsonStrict } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

/**
 * Vision-based lab report analysis.
 * Accepts one or more images of lab reports and returns structured analysis.
 *
 * @param {object} request.data
 * @param {string|string[]} request.data.images - Base64 or data-URL images
 * @param {string} [request.data.image] - Single image fallback
 * @param {string} [request.data.context] - Optional clinical context
 * @returns {{ success, findings, confidence, cached, timestamp }}
 */
exports.medward_analyzeLabImage = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.VISION_TIMEOUT_SECONDS,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate images
    const images = Array.isArray(request.data?.images)
      ? request.data.images
      : request.data?.image
        ? [request.data.image]
        : [];

    if (!images.length) {
      throw new HttpsError("invalid-argument", "No image provided.");
    }

    if (images.length > UNIFIED_CONFIG.MAX_IMAGES_PER_REQUEST) {
      throw new HttpsError(
        "invalid-argument",
        `Maximum ${UNIFIED_CONFIG.MAX_IMAGES_PER_REQUEST} images allowed.`
      );
    }

    // 3. Cache check (fingerprint images + context)
    const context = String(request.data?.context || "");
    const fingerprint = sha1Hex(images.join("") + "|" + context);
    const cacheKey = `labs_${fingerprint.slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_analyzeLabImage", {
        uid,
        cached: true,
        imageCount: images.length
      });
      return { ...cached, cached: true };
    }

    // 4. Build multimodal content
    const content = images.map((img) => {
      const { mediaType, data } = parseDataUrlBase64(img);
      return {
        type: "image",
        source: { type: "base64", media_type: mediaType, data }
      };
    });

    const promptText = context
      ? `Analyze this lab report. Clinical context: ${context}`
      : "Analyze this lab report.";
    content.push({ type: "text", text: promptText });

    // 5. Call Claude (vision)
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const responseText = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.LAB_ANALYSIS,
        contentParts: content
      });

      const analysis = extractJsonStrict(responseText);

      logger.info("medward_analyzeLabImage", {
        uid,
        imageCount: images.length,
        ms: Date.now() - t0,
        cached: false
      });

      const result = {
        success: true,
        findings: analysis.findings || [],
        criticalValues: analysis.criticalValues || [],
        patterns: analysis.patterns || [],
        suggestedWorkup: analysis.suggestedWorkup || [],
        confidence: analysis.confidence ?? 0.8,
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_analyzeLabImage failed", {
        uid,
        imageCount: images.length,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI vision service temporarily unavailable.");
    }
  }
);
