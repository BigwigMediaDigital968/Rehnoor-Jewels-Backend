const crypto = require("crypto");

/**
 * Calculates HMAC-SHA256 signature encoded in Base64
 * @param {object|string} body Data payload
 * @param {string} secret Merchant Secret Key
 */
function generateShiprocketHMAC(body, secret) {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return crypto.createHmac("sha256", secret).update(payload).digest("base64");
}

module.exports = { generateShiprocketHMAC };
