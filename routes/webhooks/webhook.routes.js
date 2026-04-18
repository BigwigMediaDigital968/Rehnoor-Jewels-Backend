const router = require("express").Router();
const razorpayWebhook = require("../../webhooks/razorpay.webhook");
const shiprocketWebhook = require("../../webhooks/shiprocket.webhook");

// Raw body parsing for Razorpay — MUST be before express.json()
router.post(
  "/razorpay",
  require("express").raw({ type: "application/json" }),
  razorpayWebhook,
);
router.post("/shiprocket", shiprocketWebhook);

module.exports = router;
