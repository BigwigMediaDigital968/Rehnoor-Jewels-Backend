const express = require("express");
const router = express.Router();
const {
  getPublicCollections,
  getPublicCollectionByIdOrSlug,
  adminGetAllCollections,
  adminGetCollectionByIdOrSlug,
  createCollection,
  updateCollection,
  toggleCollectionStatus,
  manageCollectionProducts,
  deleteCollection,
} = require("../../controller/collections/collectionController");
const { protect, adminOnly } = require("../../middleware/Authmiddleware");

// ─────────────────────────────────
// PUBLIC — no token needed
// ─────────────────────────────────

// GET /api/collections — all active collections
router.get("/", getPublicCollections);

// GET /api/collections/:idOrSlug — single collection with its active products
router.get("/:idOrSlug", getPublicCollectionByIdOrSlug);

// ─────────────────────────────────
// ADMIN — JWT + admin role required
// ─────────────────────────────────

// GET  /api/admin/collections
router.get("/admin/all", protect, adminOnly, adminGetAllCollections);

// GET  /api/admin/collections/:idOrSlug
router.get(
  "/admin/:idOrSlug",
  protect,
  adminOnly,
  adminGetCollectionByIdOrSlug,
);

// POST /api/admin/collections
router.post("/admin", protect, adminOnly, createCollection);

// PUT  /api/admin/collections/:id
router.put("/admin/:id", protect, adminOnly, updateCollection);

// PATCH /api/admin/collections/:id/toggle
router.patch("/admin/:id/toggle", protect, adminOnly, toggleCollectionStatus);

// PATCH /api/admin/collections/:id/products — add/remove products
router.patch(
  "/admin/:id/products",
  protect,
  adminOnly,
  manageCollectionProducts,
);

// DELETE /api/admin/collections/:id
router.delete("/admin/:id", protect, adminOnly, deleteCollection);

module.exports = router;
