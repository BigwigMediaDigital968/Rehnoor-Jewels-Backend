const express = require("express");
const router = express.Router();

const {
  getProductReviews,
  submitReview,
  adminGetAllReviews,
  adminGetReviewStats,
  adminGetReviewById,
  approveReview,
  rejectReview,
  toggleFeaturedReview,
  deleteReview,
  bulkDeleteReviews,
} = require("../../controller/reviews/reviewController");

const { protect, adminOnly } = require("../../middleware/Authmiddleware");
const {
  handleReviewImageUpload,
} = require("../../middleware/uploadMiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — no token required
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/reviews/:productIdOrSlug          → approved reviews for a product
router.get("/:productIdOrSlug", getProductReviews);

// POST /api/reviews/:productId                → submit a review (goes to pending)
// Accepts multipart/form-data with up to 5 images under the "images" field
router.post("/:productId", handleReviewImageUpload, submitReview);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — JWT + admin role required
// ─────────────────────────────────────────────────────────────────────────────

// GET  /api/admin/reviews/stats               → pending count + status breakdown
router.get("/admin/stats", protect, adminOnly, adminGetReviewStats);

// GET  /api/admin/reviews                     → all reviews (filterable)
router.get("/admin/all", protect, adminOnly, adminGetAllReviews);

// GET  /api/admin/reviews/:id                 → single review full detail
router.get("/admin/:id", protect, adminOnly, adminGetReviewById);

// PATCH /api/admin/reviews/:id/approve        → approve → recalc product rating
router.patch("/admin/:id/approve", protect, adminOnly, approveReview);

// PATCH /api/admin/reviews/:id/reject         → reject → recalc if was approved
router.patch("/admin/:id/reject", protect, adminOnly, rejectReview);

// PATCH /api/admin/reviews/:id/feature        → toggle featured/pinned
router.patch("/admin/:id/feature", protect, adminOnly, toggleFeaturedReview);

// DELETE /api/admin/reviews/bulk              → bulk delete (body: { ids: [...] })
router.delete("/admin/bulk", protect, adminOnly, bulkDeleteReviews);

// DELETE /api/admin/reviews/:id               → delete single review
router.delete("/admin/:id", protect, adminOnly, deleteReview);

module.exports = router;
