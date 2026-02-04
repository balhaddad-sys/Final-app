// medward/scanLabReport.js
// Vision-based lab report scanner - extracts structured lab values from images

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { assertAuthed } = require("../helpers/auth");
const { clampText, parseDataUrlBase64 } = require("../helpers/validation");
const { getCache, setCache } = require("../helpers/cache");
const { callClaude, extractJsonStrict } = require("../helpers/claude");
const { sha1Hex } = require("../helpers/hash");

const SCAN_SYSTEM_PROMPT = `You are a clinical laboratory data extraction specialist.
Use Kuwait SI units throughout (mmol/L, \u03BCmol/L, g/L, etc.).

Extract ALL lab values from the provided lab report image(s).

Return JSON with this exact structure:
{
  "values": [
    {
      "test": "Test Name",
      "value": 5.2,
      "unit": "mmol/L",
      "status": "normal|high|low|critical_high|critical_low",
      "referenceRange": "3.5-5.0"
    }
  ],
  "reportDate": "date if visible",
  "patientId": "ID if visible",
  "confidence": 0.95
}

Be precise with decimal values. Mark status relative to reference ranges shown on the report.
If reference ranges are not shown, use standard Kuwait SI ranges.`;

/**
 * Scans lab report image(s) and extracts structured lab values.
 * Supports single or multiple images.
 *
 * @param {object} request.data
 * @param {string|string[]} request.data.images - Base64 image(s)
 * @param {string} [request.data.image] - Single base64 image (alternative)
 * @param {string} [request.data.context] - Additional context
 * @returns {{ success: boolean, values: Array, confidence: number, cached: boolean, timestamp: string }}
 */
exports.medward_scanLabReport = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_VISION,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Handle single image or array
    const images = Array.isArray(request.data?.images)
      ? request.data.images
      : (request.data?.image ? [request.data.image] : []);

    if (!images.length) {
      throw new HttpsError("invalid-argument", "No image provided.");
    }

    if (images.length > UNIFIED_CONFIG.MAX_IMAGES_PER_REQUEST) {
      throw new HttpsError(
        "invalid-argument",
        `Maximum ${UNIFIED_CONFIG.MAX_IMAGES_PER_REQUEST} images allowed.`
      );
    }

    // 3. Cache check
    const contextText = clampText(request.data?.context || "", 500);
    const fingerprint = sha1Hex(images.join("").slice(0, 1000) + "|" + contextText);
    const cacheKey = `labs_${fingerprint.slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_scanLabReport", { uid, cached: true, imageCount: images.length });
      return { ...cached, cached: true };
    }

    // 4. Build content array
    const content = images.map((img) => {
      const { mediaType, data } = parseDataUrlBase64(img);
      return {
        type: "image",
        source: { type: "base64", media_type: mediaType, data }
      };
    });

    let promptText = "Extract all lab values from this report.";
    if (contextText) {
      promptText += `\nAdditional context: ${contextText}`;
    }
    content.push({ type: "text", text: promptText });

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const responseText = await callClaude({ apiKey, contentParts: content, system: SCAN_SYSTEM_PROMPT });

      logger.info("medward_scanLabReport", {
        uid,
        imageCount: images.length,
        ms: Date.now() - t0,
        cached: false
      });

      const analysis = extractJsonStrict(responseText);

      const result = {
        success: true,
        values: analysis.values || [],
        reportDate: analysis.reportDate || null,
        confidence: analysis.confidence ?? 0.8,
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_scanLabReport failed", {
        uid,
        imageCount: images.length,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "Failed to scan lab report.");
    }
  }
);
