const express = require("express");
const router = express.Router();

const {
  placeOrder,
  trackOrder,
  getMyOrders,
  customerCancelOrder,
  adminGetAllOrders,
  adminGetOrderStats,
  adminGetOrderById,
  adminUpdateOrderStatus,
  adminUpdatePayment,
  adminUpdateShipping,
  adminUpdateOrder,
  adminDeleteOrder,
  adminCreateOrder,
} = require("../../controller/order/orderController");

const { protect, adminOnly } = require("../../middleware/Authmiddleware");

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — no token required
// ─────────────────────────────────────────────────────────────────────────────

// POST  /api/orders                           → place order from website
router.post("/", placeOrder);

// GET   /api/orders/track/:orderNumber        → track by order number + email query param
router.get("/track/:orderNumber", trackOrder);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMER AUTH — requires valid JWT (any logged-in user)
// ─────────────────────────────────────────────────────────────────────────────

// GET   /api/orders/my                        → customer's own orders
router.get("/my", protect, getMyOrders);

// POST  /api/orders/:id/cancel                → customer cancels their order
router.post("/:id/cancel", protect, customerCancelOrder);

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — JWT + admin role required
// ─────────────────────────────────────────────────────────────────────────────

// GET   /api/admin/orders/stats               → revenue + status breakdown (dashboard)
router.get("/admin/stats", protect, adminOnly, adminGetOrderStats);

// GET   /api/admin/orders                     → all orders (filterable, paginated)
router.get("/admin/all", protect, adminOnly, adminGetAllOrders);

// GET   /api/admin/orders/:id                 → single order full detail
router.get("/admin/:id", protect, adminOnly, adminGetOrderById);

// POST  /api/admin/orders                     → create order from admin panel
router.post("/admin", protect, adminOnly, adminCreateOrder);

// PUT   /api/admin/orders/:id                 → update address / note / tags / priority
router.put("/admin/:id", protect, adminOnly, adminUpdateOrder);

// PATCH /api/admin/orders/:id/status          → change order status + note
router.patch("/admin/:id/status", protect, adminOnly, adminUpdateOrderStatus);

// PATCH /api/admin/orders/:id/payment         → update payment info (gateway webhook / manual)
router.patch("/admin/:id/payment", protect, adminOnly, adminUpdatePayment);

// PATCH /api/admin/orders/:id/shipping        → add tracking / carrier info
router.patch("/admin/:id/shipping", protect, adminOnly, adminUpdateShipping);

// DELETE /api/admin/orders/:id                → delete order (test/dev only)
router.delete("/admin/:id", protect, adminOnly, adminDeleteOrder);

module.exports = router;
