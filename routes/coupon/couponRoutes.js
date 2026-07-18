const express = require("express");
const router = express.Router();
const couponController = require("../../controller/coupon/couponController");

// ── Middleware imports (adjust paths to your project) ─────────────────────────
// const { protect } = require("../../middleware/authMiddleware");
// const { adminOnly } = require("../../middleware/roleMiddleware");

// Placeholder wrappers — replace with your actual auth middleware
const protect = (req, res, next) => next(); // requires logged-in user
const adminOnly = (req, res, next) => next(); // requires admin role

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES — /api/admin/coupons
// ─────────────────────────────────────────────────────────────────────────────
const couponAdminRouter = express.Router();

// List + Create
couponAdminRouter
  .route("/")
  .get(protect, adminOnly, couponController.getAllCoupons)
  .post(protect, adminOnly, couponController.createCoupon);

// Bulk generate unique single-use codes
couponAdminRouter.post(
  "/bulk-generate",
  protect,
  adminOnly,
  couponController.bulkGenerateCoupons,
);

// Single coupon CRUD
couponAdminRouter
  .route("/:id")
  .get(protect, adminOnly, couponController.getCouponById)
  .put(protect, adminOnly, couponController.updateCoupon)
  .delete(protect, adminOnly, couponController.deleteCoupon);

// Toggle active / pause
couponAdminRouter.patch(
  "/:id/toggle",
  protect,
  adminOnly,
  couponController.toggleCouponStatus,
);
couponAdminRouter.patch(
  "/:id/pause",
  protect,
  adminOnly,
  couponController.pauseCoupon,
);

// Analytics
couponAdminRouter.get(
  "/:id/analytics",
  protect,
  adminOnly,
  couponController.getCouponAnalytics,
);



// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES — /api/coupons
// ─────────────────────────────────────────────────────────────────────────────
const couponPublicRouter = express.Router();

// Validate at checkout (no auth required, does NOT increment usage)
couponPublicRouter.post("/validate", couponController.validateCoupon);

couponPublicRouter.post("/auto-apply", couponController.getBestAutoApplyCoupon)
// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = { couponAdminRouter, couponPublicRouter };
