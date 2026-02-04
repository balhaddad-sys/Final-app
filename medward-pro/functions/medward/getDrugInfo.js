// medward/getDrugInfo.js
// Drug information lookup with caching

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

/**
 * Retrieves comprehensive drug information via Claude.
 *
 * @param {object} request.data
 * @param {string} request.data.drugName - Name of the drug
 * @param {string} [request.data.indication] - Specific indication context
 * @returns {{ success: boolean, drugInfo: object, cached: boolean, timestamp: string }}
 */
exports.medward_getDrugInfo = onCall(
  {
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: UNIFIED_CONFIG.TIMEOUT_TEXT,
    cors: true
  },
  async (request) => {
    // 1. Auth
    const uid = assertAuthed(request);

    // 2. Validate
    const drugName = clampText(request.data?.drugName, 200);
    if (!drugName) {
      throw new HttpsError("invalid-argument", "Drug name required.");
    }

    const indication = clampText(request.data?.indication || "", 500);

    // 3. Cache check
    const cacheKey = `drug_${drugName.toLowerCase().replace(/\s+/g, "_")}`;
    const cached = await getCache(uid, cacheKey);
    if (cached) {
      logger.info("medward_getDrugInfo", { uid, cached: true, drug: drugName });
      return { ...cached, cached: true };
    }

    // 4. Build prompt
    let prompt = `Provide clinical info for: ${drugName}`;
    if (indication) {
      prompt += `\nIndication: ${indication}`;
    }
    prompt += '\n\nFormat as JSON: {"genericName":"","brandNames":[],"class":"",' +
      '"indications":[],"dosing":{"adult":"","renal":"","hepatic":"","elderly":""},' +
      '"contraindications":{"absolute":[],"relative":[]},' +
      '"sideEffects":{"common":[],"serious":[]},' +
      '"interactions":[],"monitoring":[],"clinicalPearls":[]}';

    // 5. Call Claude
    const apiKey = ANTHROPIC_API_KEY.value();
    const t0 = Date.now();

    try {
      const response = await callClaude({
        apiKey,
        system: SYSTEM_PROMPTS.DRUG_INTERACTION,
        message: prompt
      });

      const drugInfo = extractJsonStrict(response);

      logger.info("medward_getDrugInfo", {
        uid,
        ms: Date.now() - t0,
        cached: false,
        drug: drugName
      });

      const result = {
        success: true,
        drugInfo,
        timestamp: new Date().toISOString()
      };

      await setCache(uid, cacheKey, result, UNIFIED_CONFIG.CACHE_TTL_SECONDS);

      return result;
    } catch (error) {
      logger.error("medward_getDrugInfo failed", {
        uid,
        drug: drugName,
        error: error.message?.slice(0, 200)
      });
      throw new HttpsError("internal", "Failed to retrieve drug information.");
    }
  }
);
