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
  addVariant,
  updateVariant,
  deleteVariant,
  setDefaultVariant,
  exportProductsExcel,
} = require("../../controller/Products/productcontroller");

const { protect, adminOnly } = require("../../middleware/Authmiddleware");
const { upload } = require("../../config/cloudinary");

const adminAuth = [protect, adminOnly];

// ─── PUBLIC ────────────────────────────────────────────────────────────────────
// These must come before any parameterised routes (/:idOrSlug) to avoid
// Express swallowing static segments like "admin" as a param value.

// GET /api/products?collection=&category=&tag=&search=&page=&limit=&sort=
router.get("/", getPublicProducts);

// ─── ADMIN — products ──────────────────────────────────────────────────────────

// GET  /api/products/admin/all
router.get("/admin/all", ...adminAuth, adminGetAllProducts);

router.get("/admin/export/excel", ...adminAuth, exportProductsExcel);

// GET  /api/products/admin/:idOrSlug
router.get("/admin/:idOrSlug", ...adminAuth, adminGetProductByIdOrSlug);

// POST /api/products/admin/create
router.post("/admin/create", ...adminAuth, upload.productFields, createProduct);

// PUT  /api/products/admin/:id  (full update)
router.put("/admin/:id", ...adminAuth, upload.productFields, updateProduct);

// PATCH /api/products/admin/:id/toggle
router.patch("/admin/:id/toggle", ...adminAuth, toggleProductStatus);

// DELETE /api/products/admin/bulk  — must precede /admin/:id
router.delete("/admin/bulk", ...adminAuth, bulkDeleteProducts);

// DELETE /api/products/admin/:id
router.delete("/admin/:id", ...adminAuth, deleteProduct);

// ─── ADMIN — variants ──────────────────────────────────────────────────────────
// Kept under /admin/ prefix for consistency and so auth is always enforced.

// POST   /api/products/admin/:id/variants
router.post(
  "/admin/:id/variants",
  ...adminAuth,
  upload.productFields,
  addVariant,
);

// PATCH  /api/products/admin/:id/variants/:variantId/default  — must precede the generic PATCH below
router.patch(
  "/admin/:id/variants/:variantId/default",
  ...adminAuth,
  setDefaultVariant,
);

// PATCH  /api/products/admin/:id/variants/:variantId
router.patch(
  "/admin/:id/variants/:variantId",
  ...adminAuth,
  upload.productFields,
  updateVariant,
);

// DELETE /api/products/admin/:id/variants/:variantId
router.delete("/admin/:id/variants/:variantId", ...adminAuth, deleteVariant);

// ─── PUBLIC — by id or slug ────────────────────────────────────────────────────
// Registered LAST — this wildcard would shadow every static segment above it
// if placed earlier.

// GET /api/products/:idOrSlug
router.get("/:idOrSlug", getPublicProductByIdOrSlug);

module.exports = router;
