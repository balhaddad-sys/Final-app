// config.js
// Unified configuration for MedWard Pro Cloud Functions

const UNIFIED_CONFIG = {
  // ── Claude AI ──────────────────────────────────────
  CLAUDE: {
    MODEL: "claude-haiku-4-5-20251001",
    MAX_TOKENS: 8000,
    TEMPERATURE: 0.3
  },

  // ── Input limits ───────────────────────────────────
  MAX_TEXT_CHARS: 10000,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGES_PER_REQUEST: 5,

  // ── Cache ──────────────────────────────────────────
  CACHE_TTL_SECONDS: 3600, // 1 hour

  // ── Timeouts ───────────────────────────────────────
  TEXT_TIMEOUT_SECONDS: 60,
  VISION_TIMEOUT_SECONDS: 90
};

module.exports = { UNIFIED_CONFIG };
