const express = require("express");
const router = express.Router();
const {
  getShiprocketProducts,
  getShiprocketProductById,
  getShiprocketCollections,
  getShiprocketProductsByCollection,
} = require("../../controller/shiprocket/shiprocketController");
const { generateCheckoutToken } = require("../../controller/shiprocket/checkoutController");

router.get("/shiprocket/products", getShiprocketProducts);
router.get("/shiprocket/products/:id", getShiprocketProductById);
router.get("/shiprocket/collections", getShiprocketCollections);

// Endpoint for Products by Collection
router.get(
  "/shiprocket/collections/:idOrSlug",
  getShiprocketProductsByCollection,
);

router.post("/shiprocket/access-token", generateCheckoutToken);

module.exports = router;
