// helpers/claude.js
const { UNIFIED_CONFIG } = require("../config");

/**
 * Calls the Claude API via raw fetch.
 *
 * @param {object} opts
 * @param {string} opts.apiKey - Anthropic API key
 * @param {string} [opts.system] - System prompt
 * @param {string} [opts.message] - Plain-text user message
 * @param {Array}  [opts.contentParts] - Multimodal content array (overrides message)
 * @returns {Promise<string>} Text content from Claude's response
 */
async function callClaude({ apiKey, system, message, contentParts }) {
  const payload = {
    model: UNIFIED_CONFIG.CLAUDE.MODEL,
    max_tokens: UNIFIED_CONFIG.CLAUDE.MAX_TOKENS,
    temperature: UNIFIED_CONFIG.CLAUDE.TEMPERATURE,
    messages: [
      {
        role: "user",
        content: contentParts || [{ type: "text", text: message }]
      }
    ]
  };

  if (system) payload.system = system;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await res.text();

  if (!res.ok) {
    throw new Error(`Claude API ${res.status}: ${bodyText.slice(0, 500)}`);
  }

  const data = JSON.parse(bodyText);
  return data?.content?.[0]?.text || "";
}

/**
 * Safely extracts the first JSON object from a Claude response string.
 *
 * @param {string} text - Raw response text
 * @returns {object} Parsed JSON object
 * @throws {Error} If no valid JSON is found
 */
function extractJsonStrict(text) {
  const s = String(text || "").trim();
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("No JSON found in response.");
  }

  return JSON.parse(s.slice(first, last + 1));
}

module.exports = { callClaude, extractJsonStrict };
