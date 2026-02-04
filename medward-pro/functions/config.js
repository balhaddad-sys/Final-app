// config.js
// Unified configuration for MedWard Pro AI Module

const UNIFIED_CONFIG = {
  // Claude API settings
  CLAUDE: {
    MODEL: "claude-haiku-4-5-20251001",
    MAX_TOKENS: 8000,
    TEMPERATURE: 0.3
  },

  // Input limits
  MAX_TEXT_CHARS: 10000,
  MAX_IMAGE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_IMAGES_PER_REQUEST: 5,

  // Cache settings
  CACHE_TTL_SECONDS: 3600, // 1 hour

  // Function timeouts
  TIMEOUT_TEXT: 60,
  TIMEOUT_VISION: 90,

  // Locale
  LOCALE: "KW",
  UNIT_SYSTEM: "SI"
};

module.exports = { UNIFIED_CONFIG };
