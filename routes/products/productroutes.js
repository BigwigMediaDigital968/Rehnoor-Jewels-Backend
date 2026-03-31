const express = require("express");
const router = express.Router();
const {
  getPublicProducts,
  getPublicProductByIdOrSlug,
  adminGetAllProducts,
  adminGetProductByIdOrSlug,
  createProduct,
  updateProduct,
  toggleProductStatus,
  deleteProduct,
  bulkDeleteProducts,
} = require("../../controller/Products/productcontroller");
const { protect, adminOnly } = require("../../middleware/Authmiddleware");

const { handleImageUpload } = require("../../middleware/uploadMiddleware");

// ─────────────────────────────────
// PUBLIC — no token needed
// ─────────────────────────────────

// GET /api/products?collection=&category=&tag=&search=&page=&limit=
router.get("/", getPublicProducts);

// GET /api/products/:idOrSlug — by MongoDB _id OR slug
router.get("/:idOrSlug", getPublicProductByIdOrSlug);

// ─────────────────────────────────
// ADMIN — all require JWT + admin role
// ─────────────────────────────────

// GET  /api/admin/products
router.get("/admin/all", protect, adminOnly, adminGetAllProducts);

// GET  /api/admin/products/:idOrSlug
router.get("/admin/:idOrSlug", protect, adminOnly, adminGetProductByIdOrSlug);

// POST /api/admin/products
// router.post("/admin/create", protect, adminOnly, createProduct);
router.post(
  "/admin/create",
  protect,
  adminOnly,
  handleImageUpload,
  createProduct,
);

// PUT  /api/admin/products/:id (full update)
// router.put("/admin/:id", protect, adminOnly, updateProduct);
router.put("/admin/:id", protect, adminOnly, handleImageUpload, updateProduct);

// PATCH /api/admin/products/:id/toggle (activate/deactivate status of any product)
router.patch("/admin/:id/toggle", protect, adminOnly, toggleProductStatus);

// DELETE /api/admin/products/bulk
router.delete("/admin/bulk", protect, adminOnly, bulkDeleteProducts);

// DELETE /api/admin/products/:id
router.delete("/admin/:id", protect, adminOnly, deleteProduct);

module.exports = router;
