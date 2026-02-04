// medward/analyzeLabImage.js
// Vision-based lab report analysis

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const { UNIFIED_CONFIG } = require("../config");
const { SYSTEM_PROMPTS } = require("../prompts");
const { assertAuthed } = require("../helpers/auth");
const { clampText, parseDataUrlBase64 } = require("../helpers/validation");
const { callClaude, extractJsonStrict } = require("../helpers/claude");

/**
 * Analyzes a lab report image using Claude vision.
 *
 * @param {object} request.data
 * @param {string} request.data.imageBase64 - Base64-encoded lab report image
 * @param {string} [request.data.mediaType] - Image MIME type (default: image/jpeg)
 * @param {string} [request.data.patientName] - Patient reference name
 * @returns {{ success: boolean, answer: string, timestamp: string }}
 */
exports.medward_analyzeLabImage = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_VISION,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate image
    const rawImage = request.data?.imageBase64;
    if (!rawImage || typeof rawImage !== "string") {
      throw new HttpsError("invalid-argument", "Image data is required.");
    }

    const { mediaType, data } = parseDataUrlBase64(rawImage);
    const patientName = clampText(request.data?.patientName || "", 100);

    // 3. Build content array for vision
    const userText = patientName
      ? `Analyze this lab report for the patient. Patient reference: ${patientName}`
      : "Analyze this lab report.";

    const content = [
      {
        type: "image",
        source: { type: "base64", media_type: mediaType, data }
      },
      {
        type: "text",
        text: userText
      }
    ];

    // 4. Call Claude (vision)
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const responseText = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.LAB_ANALYSIS,
        contentParts: content
      });

      logger.info("medward_analyzeLabImage", {
        uid,
        ms: Date.now() - t0,
        cached: false
      });

      // Attempt JSON extraction; fall back to raw text
      let analysis;
      try {
        analysis = extractJsonStrict(responseText);
      } catch {
        analysis = null;
      }

      return {
        success: true,
        answer: analysis ? undefined : responseText,
        labData: analysis || undefined,
        disclaimer: "AI-generated lab analysis. Always verify with clinical judgment.",
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error("medward_analyzeLabImage failed", {
        uid,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "AI vision service temporarily unavailable.");
    }
  }
);
