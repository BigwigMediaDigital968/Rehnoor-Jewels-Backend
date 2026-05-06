const Coupon = require("../../model/coupon/couponModal");
const Order = require("../../model/Order/orderModel");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const sendError = (res, status, message, details = null) =>
  res
    .status(status)
    .json({ success: false, message, ...(details && { details }) });

const sendSuccess = (res, data, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, ...data });

// ─────────────────────────────────────────────────────────────────────────────
// ── ADMIN CONTROLLERS ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── [POST] /api/admin/coupons ─────────────────────────────────────────────────
// Create a new coupon
exports.createCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    name,
    description,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderAmount,
    minItemCount,
    usageLimitTotal,
    usageLimitPerUser,
    startsAt,
    expiresAt,
    isActive,
    restrictions,
    isStackable,
    buyXGetY,
    tags,
    internalNote,
  } = req.body;

  // Validation
  if (!code || !name || !discountType)
    return sendError(res, 400, "code, name, and discountType are required.");

  if (
    ["flat", "percent"].includes(discountType) &&
    (!discountValue || discountValue <= 0)
  )
    return sendError(
      res,
      400,
      "discountValue must be > 0 for flat/percent coupons.",
    );

  if (discountType === "percent" && discountValue > 100)
    return sendError(res, 400, "Percent discount cannot exceed 100%.");

  if (expiresAt && startsAt && new Date(expiresAt) <= new Date(startsAt))
    return sendError(res, 400, "expiresAt must be after startsAt.");

  const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (existing)
    return sendError(res, 409, `Coupon code "${code}" already exists.`);

  const coupon = await Coupon.create({
    code: code.toUpperCase().trim(),
    name,
    description,
    discountType,
    discountValue,
    maxDiscountAmount: maxDiscountAmount || null,
    minOrderAmount: minOrderAmount || 0,
    minItemCount: minItemCount || 0,
    usageLimitTotal: usageLimitTotal ?? null,
    usageLimitPerUser: usageLimitPerUser ?? 1,
    startsAt: startsAt ? new Date(startsAt) : new Date(),
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    isActive: isActive !== undefined ? isActive : true,
    restrictions: restrictions || {},
    isStackable: isStackable || false,
    buyXGetY: buyXGetY || {},
    tags: tags || [],
    internalNote: internalNote || "",
    createdBy: req.user?._id || null,
  });

  return sendSuccess(res, { coupon }, "Coupon created successfully.", 201);
});

// ── [GET] /api/admin/coupons ──────────────────────────────────────────────────
// List all coupons with filters, search, pagination
exports.getAllCoupons = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search = "",
    status, // "active" | "inactive" | "expired" | "paused"
    discountType,
    tag,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  if (discountType) filter.discountType = discountType;
  if (tag) filter.tags = tag;

  if (status === "active") {
    filter.isActive = true;
    filter.isPaused = false;
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];
  } else if (status === "inactive") {
    filter.isActive = false;
  } else if (status === "paused") {
    filter.isPaused = true;
  } else if (status === "expired") {
    filter.expiresAt = { $lte: new Date() };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .select("-usageLogs") // exclude heavy usage log from list view
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .lean({ virtuals: true }),
    Coupon.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    coupons,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  });
});

// ── [GET] /api/admin/coupons/:id ──────────────────────────────────────────────
// Get single coupon with full usage log
exports.getCouponById = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id)
    .populate("restrictions.users", "name email")
    .populate("restrictions.products", "name slug images")
    .populate("createdBy", "name email")
    .lean({ virtuals: true });

  if (!coupon) return sendError(res, 404, "Coupon not found.");

  // Attach recent 50 usage logs
  const usageLogs = (coupon.usageLogs || [])
    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
    .slice(0, 50);

  return sendSuccess(res, { coupon: { ...coupon, usageLogs } });
});

// ── [PUT] /api/admin/coupons/:id ──────────────────────────────────────────────
// Full update of a coupon
exports.updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, 404, "Coupon not found.");

  const immutableFields = ["code", "usageCount", "usageLogs", "createdBy"];
  immutableFields.forEach((f) => delete req.body[f]);

  // Uppercase code if somehow passed
  if (req.body.code) req.body.code = req.body.code.toUpperCase().trim();

  // Date validation
  const newStart = req.body.startsAt
    ? new Date(req.body.startsAt)
    : coupon.startsAt;
  const newEnd = req.body.expiresAt
    ? new Date(req.body.expiresAt)
    : coupon.expiresAt;
  if (newEnd && newStart && newEnd <= newStart)
    return sendError(res, 400, "expiresAt must be after startsAt.");

  Object.assign(coupon, req.body);
  await coupon.save();

  return sendSuccess(res, { coupon }, "Coupon updated successfully.");
});

// ── [PATCH] /api/admin/coupons/:id/toggle ─────────────────────────────────────
// Toggle isActive on/off
exports.toggleCouponStatus = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, 404, "Coupon not found.");

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  return sendSuccess(
    res,
    { coupon },
    `Coupon ${coupon.isActive ? "activated" : "deactivated"}.`,
  );
});

// ── [PATCH] /api/admin/coupons/:id/pause ──────────────────────────────────────
// Pause / resume without changing dates
exports.pauseCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, 404, "Coupon not found.");

  coupon.isPaused = !coupon.isPaused;
  await coupon.save();

  return sendSuccess(
    res,
    { coupon },
    `Coupon ${coupon.isPaused ? "paused" : "resumed"}.`,
  );
});

// ── [DELETE] /api/admin/coupons/:id ───────────────────────────────────────────
// Soft delete — just deactivate (orders hold coupon snapshots so never hard-delete)
exports.deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, 404, "Coupon not found.");

  // Hard delete only if never used
  if (coupon.usageCount > 0) {
    coupon.isActive = false;
    coupon.isPaused = true;
    await coupon.save();
    return sendSuccess(
      res,
      {},
      "Coupon deactivated (has usage history, not deleted).",
    );
  }

  await coupon.deleteOne();
  return sendSuccess(res, {}, "Coupon deleted successfully.");
});

// ── [GET] /api/admin/coupons/:id/analytics ────────────────────────────────────
// Revenue & usage analytics for a specific coupon
exports.getCouponAnalytics = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) return sendError(res, 404, "Coupon not found.");

  const logs = coupon.usageLogs || [];
  const totalDiscount = logs.reduce((s, l) => s + (l.discountAmount || 0), 0);
  const totalOrderValue = logs.reduce((s, l) => s + (l.orderTotal || 0), 0);

  // Usage by day (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentLogs = logs.filter((l) => new Date(l.usedAt) >= thirtyDaysAgo);

  const byDay = {};
  recentLogs.forEach((l) => {
    const day = new Date(l.usedAt).toISOString().split("T")[0];
    byDay[day] = (byDay[day] || 0) + 1;
  });

  return sendSuccess(res, {
    analytics: {
      totalRedemptions: coupon.usageCount,
      totalDiscountGiven: Math.round(totalDiscount),
      totalOrderValue: Math.round(totalOrderValue),
      avgDiscountPerOrder: logs.length
        ? Math.round(totalDiscount / logs.length)
        : 0,
      remainingRedemptions:
        coupon.usageLimitTotal !== null
          ? Math.max(0, coupon.usageLimitTotal - coupon.usageCount)
          : null,
      usageByDay: byDay,
    },
  });
});

// ── [POST] /api/admin/coupons/bulk-generate ────────────────────────────────────
// Generate N unique single-use codes (e.g. for influencer drops)
exports.bulkGenerateCoupons = asyncHandler(async (req, res) => {
  const {
    prefix = "RJ",
    count = 10,
    discountType,
    discountValue,
    minOrderAmount = 0,
    expiresAt,
    usageLimitPerUser = 1,
    tags = [],
    name,
  } = req.body;

  if (!discountType || !discountValue)
    return sendError(res, 400, "discountType and discountValue are required.");
  if (count > 500)
    return sendError(
      res,
      400,
      "Cannot generate more than 500 coupons at once.",
    );

  const generated = [];
  const errors = [];

  for (let i = 0; i < count; i++) {
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    const code = `${prefix.toUpperCase()}-${randomSuffix}`;
    try {
      const coupon = await Coupon.create({
        code,
        name: name || `${prefix} Bulk Code`,
        discountType,
        discountValue,
        minOrderAmount,
        usageLimitTotal: 1, // single-use by design
        usageLimitPerUser,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        tags,
        createdBy: req.user?._id || null,
      });
      generated.push(coupon.code);
    } catch (err) {
      errors.push({ attempt: code, error: err.message });
    }
  }

  return sendSuccess(
    res,
    { generated, errors, generatedCount: generated.length },
    `${generated.length} coupons generated.`,
    201,
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ── PUBLIC / CHECKOUT CONTROLLERS ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── [POST] /api/coupons/validate ─────────────────────────────────────────────
// Validate a coupon code at checkout — does NOT increment usage count
exports.validateCoupon = asyncHandler(async (req, res) => {
  const { code, subtotal, itemCount, email, userId } = req.body;

  if (!code || !subtotal)
    return sendError(res, 400, "code and subtotal are required.");

  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (!coupon) return sendError(res, 404, "Invalid coupon code.");

  // Check if first order for this email
  let isFirstOrder = false;
  if (email) {
    const prevOrders = await Order.countDocuments({
      customerEmail: email.toLowerCase(),
      status: { $nin: ["cancelled", "failed"] },
    });
    isFirstOrder = prevOrders === 0;
  }

  const result = coupon.calculateDiscount({
    subtotal: Number(subtotal),
    itemCount: Number(itemCount) || 1,
    userEmail: email || null,
    userId: userId || null,
    isFirstOrder,
  });

  if (!result.valid) return sendError(res, 400, result.message);

  return sendSuccess(res, {
    coupon: {
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
    },
    discountAmount: result.discountAmount,
    message: result.message,
  });
});

// ── [POST] /api/coupons/apply ─────────────────────────────────────────────────
// Called when order is confirmed — increments usageCount and logs the redemption
// This should be called from your order creation flow, not standalone
exports.applyCouponToOrder = async ({
  code,
  subtotal,
  itemCount,
  email,
  userId,
  orderId,
  orderTotal,
}) => {
  if (!code) return null;

  const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });
  if (!coupon) return null;

  let isFirstOrder = false;
  if (email) {
    const prevOrders = await Order.countDocuments({
      customerEmail: email.toLowerCase(),
      status: { $nin: ["cancelled", "failed"] },
      _id: { $ne: orderId }, // exclude current order
    });
    isFirstOrder = prevOrders === 0;
  }

  const result = coupon.calculateDiscount({
    subtotal: Number(subtotal),
    itemCount: Number(itemCount) || 1,
    userEmail: email || null,
    userId: userId || null,
    isFirstOrder,
  });

  if (!result.valid) return null;

  // Increment usage and log
  coupon.usageCount += 1;
  coupon.usageLogs.push({
    order: orderId || null,
    user: userId || null,
    email: email?.toLowerCase() || "",
    discountAmount: result.discountAmount,
    orderTotal: orderTotal || subtotal,
  });

  await coupon.save();

  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    discountAmount: result.discountAmount,
  };
};
