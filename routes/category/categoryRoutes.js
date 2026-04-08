// routes/categoryRoutes.js
// All category routes — Admin (protected) + Public (open)
// Mount in server.js:
//   const categoryRoutes = require("./routes/categoryRoutes");
//   app.use("/api", categoryRoutes);

const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const {
  // Admin — Category
  createCategory,
  getAllCategoriesAdmin,
  getCategoryByIdAdmin,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,

  // Admin — SubCategory
  addSubCategory,
  updateSubCategory,
  deleteSubCategory,
  toggleSubCategoryStatus,

  // Admin — Product Assignment
  assignProductsToCategory,
  removeProductFromCategory,
  assignProductsToSubCategory,
  removeProductFromSubCategory,

  // Public
  getPublicCategories,
  getPublicCategoryBySlug,
  getFeaturedCategories,
} = require("../../controller/category/categoryController");

const { protect, adminOnly } = require("../../middleware/Authmiddleware");

// ─── Multer Config (temp disk storage before Cloudinary upload) ───────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "rehnoor/category/"),
  filename: (req, file, cb) =>
    cb(
      null,
      `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`,
    ),
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error("Only JPEG, PNG, and WebP images are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Accept both image and bannerImage fields
const categoryUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "bannerImage", maxCount: 1 },
]);

const subCatUpload = upload.fields([{ name: "image", maxCount: 1 }]);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES  →  /api/public/categories
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/public/categories/featured  — must come before /:slug
router.get("/public/categories/featured", getFeaturedCategories);

// GET /api/public/categories
router.get("/public/categories", getPublicCategories);

// GET /api/public/categories/:slug
router.get("/public/categories/:slug", getPublicCategoryBySlug);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES  →  /api/admin/categories  (protected)
// ─────────────────────────────────────────────────────────────────────────────

// ── Category CRUD ──
router.post(
  "/admin/categories",
  protect,
  adminOnly,
  categoryUpload,
  createCategory,
);
router.get("/admin/categories", protect, adminOnly, getAllCategoriesAdmin);
router.get("/admin/categories/:id", protect, adminOnly, getCategoryByIdAdmin);
router.put(
  "/admin/categories/:id",
  protect,
  adminOnly,
  categoryUpload,
  updateCategory,
);
router.delete("/admin/categories/:id", protect, adminOnly, deleteCategory);
router.patch(
  "/admin/categories/:id/status",
  protect,
  adminOnly,
  toggleCategoryStatus,
);

// ── Sub-Category CRUD ──
router.post(
  "/admin/categories/:id/subcategories",
  protect,
  adminOnly,
  subCatUpload,
  addSubCategory,
);
router.put(
  "/admin/categories/:id/subcategories/:subId",
  protect,
  adminOnly,
  subCatUpload,
  updateSubCategory,
);
router.delete(
  "/admin/categories/:id/subcategories/:subId",
  protect,
  adminOnly,
  deleteSubCategory,
);
router.patch(
  "/admin/categories/:id/subcategories/:subId/status",
  protect,
  adminOnly,
  toggleSubCategoryStatus,
);

// ── Product Assignment ──
router.post(
  "/admin/categories/:id/products",
  protect,
  adminOnly,
  assignProductsToCategory,
);
router.delete(
  "/admin/categories/:id/products/:productId",
  protect,
  adminOnly,
  removeProductFromCategory,
);
router.post(
  "/admin/categories/:id/subcategories/:subId/products",
  protect,
  adminOnly,
  assignProductsToSubCategory,
);
router.delete(
  "/admin/categories/:id/subcategories/:subId/products/:productId",
  protect,
  adminOnly,
  removeProductFromSubCategory,
);

module.exports = router;
