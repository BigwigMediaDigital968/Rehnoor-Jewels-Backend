const express = require("express");
const router = express.Router();

const {
  uploadContentImage,
  getPublishedBlogs,
  getPublishedBlogBySlug,
  getBlogCategories,
  adminGetAllBlogs,
  adminGetBlogStats,
  adminGetBlogById,
  createBlog,
  updateBlog,
  togglePublish,
  setBlogStatus,
  toggleFeatured,
  deleteBlog,
  bulkDeleteBlogs,
} = require("../../controller/blog/blogController");

const { protect, adminOnly } = require("../../middleware/Authmiddleware");
const {
  handleBlogCoverUpload,
  handleBlogContentImageUpload,
} = require("../../middleware/blogUploadMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// SPECIAL — Tiptap editor image upload (admin only, returns URL immediately)
// POST /api/blogs/upload-image  →  { success, url }
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/upload-image",
  protect,
  adminOnly,
  handleBlogContentImageUpload,
  uploadContentImage,
);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — no token required
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/blogs/categories           → distinct published categories
router.get("/categories", getBlogCategories);

// GET  /api/blogs                      → paginated published blogs
router.get("/", getPublishedBlogs);

// GET  /api/blogs/:slug                → single published blog (increments views)
router.get("/:slug", getPublishedBlogBySlug);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — JWT + admin role required
// ─────────────────────────────────────────────────────────────────────────────

// GET    /api/admin/blogs/stats        → blog counts + top viewed
router.get("/admin/stats", protect, adminOnly, adminGetBlogStats);

// GET    /api/admin/blogs              → all blogs including drafts
router.get("/admin/all", protect, adminOnly, adminGetAllBlogs);

// GET    /api/admin/blogs/:id          → single blog full data (any status)
router.get("/admin/:id", protect, adminOnly, adminGetBlogById);

// POST   /api/admin/blogs              → create blog (multipart — cover image optional)
router.post("/admin", protect, adminOnly, handleBlogCoverUpload, createBlog);

// PUT    /api/admin/blogs/:id          → full update (multipart — cover image optional)
router.put("/admin/:id", protect, adminOnly, handleBlogCoverUpload, updateBlog);

// PATCH  /api/admin/blogs/:id/publish  → toggle published ↔ draft
router.patch("/admin/:id/publish", protect, adminOnly, togglePublish);

// PATCH  /api/admin/blogs/:id/status   → set any status (draft/published/archived/scheduled)
router.patch("/admin/:id/status", protect, adminOnly, setBlogStatus);

// PATCH  /api/admin/blogs/:id/feature  → toggle featured flag
router.patch("/admin/:id/feature", protect, adminOnly, toggleFeatured);

// DELETE /api/admin/blogs/bulk         → bulk delete
router.delete("/admin/bulk", protect, adminOnly, bulkDeleteBlogs);

// DELETE /api/admin/blogs/:id          → delete single blog + Cloudinary cleanup
router.delete("/admin/:id", protect, adminOnly, deleteBlog);

module.exports = router;
