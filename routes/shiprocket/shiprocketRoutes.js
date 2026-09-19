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

// Checkout Token
router.post("/access-token", generateCheckoutToken);

// Webhooks.
// The Shiprocket Checkout dashboard (Settings → Webhooks) is configured with
// `/api/shiprocket/order-webhook`, which did not match the `/webhook/order`
// path this router originally exposed — every delivery hit the 404 handler.
// Both spellings are registered so the dashboard keeps working whichever
// convention is configured there.
router.post(
  ["/order-webhook", "/webhook/order"],
  handleOrderWebhook,
);
router.post(
  ["/abandoned-cart-webhook", "/webhook/abandoned-checkout"],
  handleAbandonedCheckoutWebhook,
);

module.exports = router;
