// helpers/claude.js
// Claude API integration helper

const { UNIFIED_CONFIG } = require("../config");

/**
 * Calls the Claude API.
 *
 * @param {object} opts
 * @param {string} opts.apiKey - Anthropic API key
 * @param {string} [opts.system] - System prompt
 * @param {string} [opts.message] - User message (text-only calls)
 * @param {Array}  [opts.contentParts] - Content array (vision calls)
 * @param {string} [opts.model] - Override model
 * @param {number} [opts.maxTokens] - Override max tokens
 * @param {number} [opts.temperature] - Override temperature
 * @returns {Promise<string>} Claude's text response
 * @throws {Error} On API failure
 */
async function callClaude({ apiKey, system, message, contentParts, model, maxTokens, temperature }) {
  const payload = {
    model: model || UNIFIED_CONFIG.CLAUDE.MODEL,
    max_tokens: maxTokens || UNIFIED_CONFIG.CLAUDE.MAX_TOKENS,
    temperature: temperature ?? UNIFIED_CONFIG.CLAUDE.TEMPERATURE,
    messages: [{
      role: "user",
      content: contentParts || [{ type: "text", text: message }]
    }]
  };

  if (system) {
    payload.system = system;
  }

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
 * Safely extracts JSON from Claude response text.
 * Finds the first { ... } block and parses it.
 *
 * @param {string} text - Claude response text
 * @returns {object} Parsed JSON object
 * @throws {Error} If no valid JSON found
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
