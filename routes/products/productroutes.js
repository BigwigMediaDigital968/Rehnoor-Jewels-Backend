// const express = require("express");
// const router = express.Router();
// const {
//   getPublicProducts,
//   getPublicProductByIdOrSlug,
//   adminGetAllProducts,
//   adminGetProductByIdOrSlug,
//   createProduct,
//   updateProduct,
//   toggleProductStatus,
//   deleteProduct,
//   bulkDeleteProducts,
//   addVariant,
//   updateVariant,
//   deleteVariant,
//   setDefaultVariant,
// } = require("../../controller/Products/productcontroller");
// const { protect, adminOnly } = require("../../middleware/Authmiddleware");

// const { handleImageUpload } = require("../../middleware/uploadMiddleware");

// // ─────────────────────────────────
// // PUBLIC — no token needed
// // ─────────────────────────────────

// // GET /api/products?collection=&category=&tag=&search=&page=&limit=
// router.get("/", getPublicProducts);

// // GET /api/products/:idOrSlug — by MongoDB _id OR slug
// router.get("/:idOrSlug", getPublicProductByIdOrSlug);

// // ─────────────────────────────────
// // ADMIN — all require JWT + admin role
// // ─────────────────────────────────

// // GET  /api/admin/products
// router.get("/admin/all", protect, adminOnly, adminGetAllProducts);

// // GET  /api/admin/products/:idOrSlug
// router.get("/admin/:idOrSlug", protect, adminOnly, adminGetProductByIdOrSlug);

// // POST /api/admin/products
// // router.post("/admin/create", protect, adminOnly, createProduct);
// router.post(
//   "/admin/create",
//   protect,
//   adminOnly,
//   handleImageUpload,
//   createProduct,
// );

// router.post("/:id/variants", addVariant);
// router.patch("/:id/variants/:variantId", updateVariant);
// router.delete("/:id/variants/:variantId", deleteVariant);
// router.patch("/:id/variants/:variantId/default", setDefaultVariant);

// // PUT  /api/admin/products/:id (full update)
// // router.put("/admin/:id", protect, adminOnly, updateProduct);
// router.put("/admin/:id", protect, adminOnly, handleImageUpload, updateProduct);

// // PATCH /api/admin/products/:id/toggle (activate/deactivate status of any product)
// router.patch("/admin/:id/toggle", protect, adminOnly, toggleProductStatus);

// // DELETE /api/admin/products/bulk
// router.delete("/admin/bulk", protect, adminOnly, bulkDeleteProducts);

// // DELETE /api/admin/products/:id
// router.delete("/admin/:id", protect, adminOnly, deleteProduct);

// module.exports = router;

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
