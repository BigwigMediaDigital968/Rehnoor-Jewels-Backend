const express = require("express");
const router = express.Router();
const {
  getShiprocketProducts,
  getShiprocketProductById,
  getShiprocketCollections,
  getShiprocketProductsByCollection,
} = require("../../controller/shiprocket/shiprocketController");

router.get("/shiprocket/products", getShiprocketProducts);
router.get("/shiprocket/products/:id", getShiprocketProductById);
router.get("/shiprocket/collections", getShiprocketCollections);

// Endpoint for Products by Collection
router.get(
  "/shiprocket/collections/:idOrSlug",
  getShiprocketProductsByCollection,
);

module.exports = router;
