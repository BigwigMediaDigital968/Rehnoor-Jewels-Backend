const express = require("express");
const router = express.Router();
const razorpayWebhook = require("../../webhooks/razorpay.webhook");
const shiprocketWebhook = require("../../webhooks/shiprocket.webhook");

// Raw body parsing for Razorpay — MUST be before express.json()
router.post(
  "/razorpay/webhook",
  express.raw({ type: "application/json" }),
  razorpayWebhook,
);

// This router is mounted before the global express.json(), so the Shiprocket
// tracking webhook needs its own parser — without it req.body is undefined and
// the handler throws on destructuring.
router.post("/shiprocket", express.json(), shiprocketWebhook);

module.exports = router;
