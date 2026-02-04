// helpers/hash.js
// Hashing utility for cache key generation

const crypto = require("crypto");

/**
 * Generates a SHA-1 hex digest of input string.
 * Used for cache key fingerprinting.
 * @param {string} input - String to hash
 * @returns {string} Hex digest
 */
function sha1Hex(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex");
}

module.exports = { sha1Hex };
