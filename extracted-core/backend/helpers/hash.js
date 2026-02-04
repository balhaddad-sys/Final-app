// helpers/hash.js
const crypto = require("crypto");

/**
 * Returns a hex-encoded SHA-1 hash of the input string.
 * Used for generating cache keys from content fingerprints.
 *
 * @param {string} input - String to hash
 * @returns {string} Hex-encoded SHA-1 digest
 */
function sha1Hex(input) {
  return crypto.createHash("sha1").update(String(input)).digest("hex");
}

module.exports = { sha1Hex };
