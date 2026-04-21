// Returns a cached token, refreshing if it's older than 23h
const axios = require("axios");
const ShiprocketToken = require("../model/ShiprocketToken");

const SR_BASE = "https://apiv2.shiprocket.in/v1/external";

async function getShiprocketToken() {
  // Add this temporarily at the top of getShiprocketToken()
  console.log(
    "SR creds:",
    process.env.SHIPROCKET_EMAIL,
    process.env.SHIPROCKET_PASSWORD ? "***set***" : "MISSING",
  );

  let record = await ShiprocketToken.findOne();
  const now = Date.now();
  if (record && now - record.generatedAt.getTime() < 23 * 60 * 60 * 1000) {
    return record.token;
  }
  const { data } = await axios.post(`${SR_BASE}/auth/login`, {
    email: process.env.SHIPROCKET_EMAIL,
    password: process.env.SHIPROCKET_PASSWORD,
  });
  if (!record) record = new ShiprocketToken();
  record.token = data.token;
  record.generatedAt = new Date();
  await record.save();
  return data.token;
}

module.exports = { getShiprocketToken, SR_BASE };
