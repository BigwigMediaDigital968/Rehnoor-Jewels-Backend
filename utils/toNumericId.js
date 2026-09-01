const crypto = require("crypto");

/**
 * Converts a MongoDB ObjectId or String into a positive integer.
 * Ensures compatibility with Shiprocket's strict integer ID schema.
 */
function toNumericId(mongoId) {
  if (!mongoId) return 0;
  const hash = crypto
    .createHash("md5")
    .update(mongoId.toString())
    .digest("hex");
  // Take first 7 hex characters to ensure value stays within 32-bit signed integer limits
  return parseInt(hash.substring(0, 7), 16);
}

module.exports = toNumericId;
