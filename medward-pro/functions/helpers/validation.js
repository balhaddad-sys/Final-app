// helpers/validation.js
// Input validation helpers

const { HttpsError } = require("firebase-functions/v2/https");
const { UNIFIED_CONFIG } = require("../config");

/**
 * Validates and clamps text input.
 * @param {*} s - Raw input value
 * @param {number} max - Maximum character count
 * @returns {string} Trimmed, validated string
 * @throws {HttpsError} If text exceeds max length
 */
function clampText(s, max) {
  if (!s) return "";
  const t = String(s).trim();
  if (t.length > max) {
    throw new HttpsError("invalid-argument", `Text exceeds ${max} characters.`);
  }
  return t;
}

/**
 * Parses and validates a base64-encoded image (with or without data URL prefix).
 * @param {string} dataUrl - Base64 string or data URL
 * @returns {{ mediaType: string, data: string }} Parsed media type and raw base64
 * @throws {HttpsError} If image is missing, invalid, or too large
 */
function parseDataUrlBase64(dataUrl) {
  const s = String(dataUrl || "");
  if (!s) {
    throw new HttpsError("invalid-argument", "Missing image.");
  }

  let mediaType = "image/jpeg";
  let b64 = s;

  if (s.startsWith("data:")) {
    const match = s.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new HttpsError("invalid-argument", "Invalid image format.");
    }
    mediaType = match[1];
    b64 = match[2];
  }

  // Validate media type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(mediaType)) {
    throw new HttpsError("invalid-argument", "Unsupported image type. Use JPEG, PNG, WebP, or GIF.");
  }

  // Check approximate file size (base64 adds ~33% overhead)
  const approxBytes = Math.floor((b64.length * 3) / 4);
  if (approxBytes > UNIFIED_CONFIG.MAX_IMAGE_BYTES) {
    throw new HttpsError("invalid-argument", "Image too large. Maximum 10 MB.");
  }

  return { mediaType, data: b64 };
}

module.exports = { clampText, parseDataUrlBase64 };
