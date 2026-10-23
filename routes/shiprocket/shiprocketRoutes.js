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

const { protect, adminOnly } = require("../../middleware/Authmiddleware");
const {
  syncAllProductsToShiprocket,
} = require("../../services/shipping/shiprocketCatalogSync");

// Catalog APIs
router.get("/products", getShiprocketProducts);
router.get("/products/:id", getShiprocketProductById);
router.get("/collections", getShiprocketCollections);
router.get("/collection-products", getShiprocketProductsByCollection);
router.get("/collections/:idOrSlug", getShiprocketProductsByCollection);

// Admin: push the whole catalog (or specific products) to Shiprocket.
// Body (optional): { "productIds": ["<id>", ...] }
// Runs in the background — progress and the result summary go to the server log.
router.post("/sync-catalog", protect, adminOnly, (req, res) => {
  const ids = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
  syncAllProductsToShiprocket(ids).catch((err) =>
    console.error("[Shiprocket Catalog Sync] Bulk failed:", err.message),
  );
  res.status(202).json({
    success: true,
    message: ids.length
      ? `Syncing ${ids.length} product(s) to Shiprocket. Check the server logs for the result.`
      : "Syncing all products to Shiprocket. Check the server logs for the result.",
  });
});

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
