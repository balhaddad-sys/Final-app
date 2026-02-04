// medward/askClinical.js
// Clinical Q&A with full RAG/RLHF support

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
 * Clinical Q&A function for MedWard.
 * Accepts a clinical question with optional patient context and system prompt.
 * Supports custom system prompts from the client-side RAG/RLHF pipeline.
 *
 * @param {object} request.data
 * @param {string} request.data.question - Clinical question
 * @param {object} [request.data.context] - Patient context (diagnosis, status, notes)
 * @param {string} [request.data.systemPrompt] - Custom system prompt (RAG/RLHF enriched)
 * @param {string} [request.data.model] - Model override
 * @returns {{ success: boolean, answer: string, cached: boolean, timestamp: string }}
 */
exports.medward_askClinical = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_TEXT,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const question = clampText(request.data?.question, UNIFIED_CONFIG.MAX_TEXT_CHARS);
    if (!question) {
      throw new HttpsError("invalid-argument", "Question is required.");
    }

    // 3. Build user message with optional context
    let userMessage = question;
    const context = request.data?.context;
    if (context && typeof context === "object") {
      const contextParts = [];
      if (context.diagnosis) contextParts.push(`Diagnosis: ${clampText(context.diagnosis, 500)}`);
      if (context.status) contextParts.push(`Status: ${clampText(context.status, 200)}`);
      if (context.notes) contextParts.push(`Notes: ${clampText(context.notes, 2000)}`);
      if (contextParts.length > 0) {
        userMessage = `Patient Context:\n${contextParts.join("\n")}\n\nQuestion: ${question}`;
      }
    }

    // 4. Cache check
    const fingerprint = sha1Hex(userMessage);
    const cacheKey = `clinical_${fingerprint.slice(0, 40)}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_askClinical", { uid, cached: true });
      return { ...cached, cached: true };
    }

    // 5. Use custom system prompt if provided (from RAG/RLHF pipeline), else default
    const systemPrompt = request.data?.systemPrompt
      ? clampText(request.data.systemPrompt, UNIFIED_CONFIG.MAX_TEXT_CHARS)
      : SYSTEM_PROMPTS.MEDWARD_CLINICAL;

    // 6. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: systemPrompt,
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
        answer: response,
        disclaimer: "This is educational guidance only. Always use clinical judgment.",
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
