// const express = require("express");
// const router = express.Router();
// const {
//   getShiprocketProducts,
//   getShiprocketProductById,
//   getShiprocketCollections,
//   getShiprocketProductsByCollection,
// } = require("../../controller/shiprocket/shiprocketController");
// const { generateCheckoutToken } = require("../../controller/shiprocket/checkoutController");

// router.get("/shiprocket/products", getShiprocketProducts);
// router.get("/shiprocket/products/:id", getShiprocketProductById);
// router.get("/shiprocket/collections", getShiprocketCollections);

// // Endpoint for Products by Collection
// router.get(
//   "/shiprocket/collections/:idOrSlug",
//   getShiprocketProductsByCollection,
// );

// router.post("/shiprocket/access-token", generateCheckoutToken);

// module.exports = router;


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
} = require("../../controller/shiprocket/checkoutController");

// Catalog APIs
router.get("/products", getShiprocketProducts);
router.get("/products/:id", getShiprocketProductById);
router.get("/collections", getShiprocketCollections);
router.get("/collections/:idOrSlug", getShiprocketProductsByCollection);

// Checkout Token & Webhooks
router.post("/access-token", generateCheckoutToken);
router.post("/webhook/order", handleOrderWebhook);

module.exports = router;