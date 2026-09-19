const express = require("express");
const router = express.Router();
const {
  getShiprocketProducts,
  getShiprocketProductById,
  getShiprocketCollections,
  getShiprocketProductsByCollection,
} = require("../../controller/shiprocket/shiprocketController");
const {
  generateCheckoutToken,
  handleOrderWebhook,
  handleAbandonedCheckoutWebhook,
} = require("../../controller/shiprocket/checkoutController");

// Catalog APIs
router.get("/products", getShiprocketProducts);
router.get("/products/:id", getShiprocketProductById);
router.get("/collections", getShiprocketCollections);
router.get("/collections/:idOrSlug", getShiprocketProductsByCollection);

// Checkout Token & Webhooks
router.post("/access-token", generateCheckoutToken);
router.post("/webhook/order", handleOrderWebhook);
router.post("/webhook/abandoned-checkout", handleAbandonedCheckoutWebhook);

module.exports = router;
