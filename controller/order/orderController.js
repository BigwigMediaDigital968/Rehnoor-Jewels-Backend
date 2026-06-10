const Order = require("../../model/Order/orderModel");
const Product = require("../../model/products/productModel");
const { createOrder } = require("../../services/order/orderService");
const {
  applyCouponToOrder,
} = require("../../controller/coupon/couponController");

// ─── Status helper ────────────────────────────────────────────────────────────

function applyStatusChange(order, newStatus, note = "", changedBy = "admin") {
  order.statusHistory.push({
    status: newStatus,
    note,
    changedBy,
    changedAt: new Date(),
  });
  order.status = newStatus;

  const now = new Date();
  const timestamps = {
    confirmed: () => {
      order.confirmedAt = now;
    },
    processing: () => {
      order.processedAt = now;
    },
    shipped: () => {
      order.shippedAt = now;
      order.shipping.shippedAt = now;
    },
    delivered: () => {
      order.deliveredAt = now;
      order.shipping.deliveredAt = now;
    },
    cancelled: () => {
      order.cancelledAt = now;
    },
    returned: () => {
      order.returnedAt = now;
    },
    refunded: () => {
      order.refundedAt = now;
    },
  };
  timestamps[newStatus]?.();
}

async function resolveOrderItem(raw, { adminPriceOverride = false } = {}) {
  const product = await Product.findOne({
    _id: raw.productId,
    isActive: true,
  }).select("name slug sku images price originalPrice category variants");

  if (!product) {
    throw Object.assign(
      new Error(`Product not found or inactive: ${raw.productId}`),
      { status: 400 },
    );
  }

  const quantity = Math.max(1, Number(raw.quantity) || 1);

  // ── Resolve variant ────────────────────────────────────────────────────────
  let variantSnapshot = null;
  let unitPrice =
    adminPriceOverride && raw.unitPrice != null
      ? Number(raw.unitPrice)
      : product.price;
  let originalPrice = product.originalPrice ?? null;
  let itemSku = product.sku || "";

  if (raw.variantId) {
    const variant = product.variants?.id(raw.variantId);

    if (!variant) {
      throw Object.assign(
        new Error(
          `Variant ${raw.variantId} not found on product "${product.name}"`,
        ),
        { status: 400 },
      );
    }
    if (!variant.isActive) {
      throw Object.assign(
        new Error(
          `Variant "${variant.title || raw.variantId}" is not available for "${product.name}"`,
        ),
        { status: 400 },
      );
    }

    // Variant price takes precedence over base price; admin can still override
    unitPrice =
      adminPriceOverride && raw.unitPrice != null
        ? Number(raw.unitPrice)
        : variant.price;
    originalPrice = variant.originalPrice ?? null;
    itemSku = variant.sku || product.sku || "";

    // First variant image; fall back to product gallery
    const variantImage =
      variant.images?.[0]?.src || product.images?.[0]?.src || "";

    variantSnapshot = {
      variantId: variant._id,
      title: variant.title || "",
      sku: variant.sku || "",
      options: Object.fromEntries(variant.options ?? new Map()),
      weightGrams: variant.weightGrams ?? 0,
      image: variantImage,
    };
  }

  return {
    product: product._id,
    name: product.name,
    slug: product.slug,
    sku: itemSku,
    image: product.images?.[0]?.src || "",
    category: product.category || "",
    variant: variantSnapshot,
    unitPrice,
    originalPrice,
    quantity,
    lineTotal: unitPrice * quantity,
    customNote: raw.customNote || "",
  };
}

// ─── Error normaliser ─────────────────────────────────────────────────────────

function handleOrderError(error, res) {
  if (error.status) {
    return res
      .status(error.status)
      .json({ success: false, message: error.message });
  }
  if (error.name === "ValidationError") {
    const errors = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: errors[0], errors });
  }
  console.error("[orderController]", error);
  return res
    .status(500)
    .json({ success: false, message: "Internal server error." });
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/orders
const placeOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      items: rawItems,
      shippingAddress,
      billingAddress,
      billingSameAsShipping = true,
      paymentMethod = "cod",
      couponCode,
      customerNote,
      giftMessage,
      isGift = false,
      source = "website",
    } = req.body;

    if (!rawItems?.length) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item.",
      });
    }

    // ── Resolve items ──────────────────────────────────────────────────────
    const orderItems = await Promise.all(
      rawItems.map((raw) => resolveOrderItem(raw)),
    );

    let subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
    let totalItemCount = orderItems.reduce((sum, i) => sum + i.quantity, 0);
    let shippingCharge = subtotal >= 100 ? 0 : 149;

    // ── Coupon validation ──────────────────────────────────────────────────
    let couponSnapshot = null;
    let discountAmount = 0;

    if (couponCode?.trim()) {
      const Coupon = require("../../model/coupon/couponModal");
      const couponDoc = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
      });

      if (!couponDoc) {
        return res.status(400).json({
          success: false,
          message: "Invalid coupon code.",
          field: "couponCode",
        });
      }

      const prevOrderCount = await Order.countDocuments({
        customerEmail: customerEmail.toLowerCase(),
        status: { $nin: ["cancelled", "failed"] },
      });

      const validation = couponDoc.calculateDiscount({
        subtotal,
        itemCount: totalItemCount,
        userEmail: customerEmail,
        userId: req.user?._id || null,
        isFirstOrder: prevOrderCount === 0,
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.message,
          field: "couponCode",
        });
      }

      if (couponDoc.discountType === "free_shipping") {
        shippingCharge = 0;
      } else {
        discountAmount = validation.discountAmount;
      }

      couponSnapshot = {
        couponId: couponDoc._id,
        code: couponDoc.code,
        discountType: couponDoc.discountType,
        discountValue: couponDoc.discountValue,
        discountAmount,
      };
    }

    const total = Math.max(0, subtotal + shippingCharge - discountAmount);

    const { order, razorpayOrderId } = await createOrder({
      customerName,
      customerEmail,
      customerPhone,
      items: orderItems,
      shippingAddress,
      billingAddress,
      billingSameAsShipping,
      pricing: {
        subtotal,
        shippingCharge,
        discountAmount,
        taxAmount: 0,
        total,
      },
      coupon: couponSnapshot,
      payment: { method: paymentMethod },
      customerNote: customerNote || "",
      giftMessage: giftMessage || "",
      isGift,
      source,
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || "",
    });

    // Commit coupon usage after order exists
    if (couponSnapshot?.code) {
      try {
        await applyCouponToOrder({
          code: couponSnapshot.code,
          subtotal,
          itemCount: totalItemCount,
          email: customerEmail,
          userId: req.user?._id || null,
          orderId: order._id,
          orderTotal: total,
        });
      } catch (couponErr) {
        console.error(
          `[Coupon] Usage commit failed for ${order.orderNumber}:`,
          couponErr.message,
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      data: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        pricing: {
          subtotal: order.pricing.subtotal,
          shippingCharge: order.pricing.shippingCharge,
          discountAmount: order.pricing.discountAmount,
          total: order.pricing.total,
        },
        coupon: couponSnapshot
          ? {
              code: couponSnapshot.code,
              discountType: couponSnapshot.discountType,
              discountAmount: couponSnapshot.discountAmount,
            }
          : null,
        paymentMethod: order.payment.method,
        razorpayOrderId: razorpayOrderId || null,
      },
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// GET /api/orders/track/:orderNumber
const trackOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { email } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required for tracking." });
    }

    const order = await Order.findOne({
      orderNumber,
      customerEmail: email.toLowerCase(),
    }).select(
      "orderNumber status shipping statusHistory pricing items placedAt shippedAt deliveredAt",
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found. Check the order number and email.",
      });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// GET /api/orders/my
const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { customerEmail: req.user.email };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select(
          "orderNumber status pricing.total items placedAt shipping.trackingNumber",
        )
        .sort("-placedAt")
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// POST /api/orders/:id/cancel
const customerCancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: "Order cannot be cancelled at this stage.",
      });
    }

    const { reason = "" } = req.body;
    applyStatusChange(
      order,
      "cancelled",
      `Customer cancelled: ${reason}`,
      "customer",
    );
    order.cancellationReason = reason;
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      data: { orderNumber: order.orderNumber, status: order.status },
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/admin/orders
const adminGetAllOrders = async (req, res) => {
  try {
    const {
      status,
      search,
      paymentStatus,
      paymentMethod,
      source,
      isPriority,
      startDate,
      endDate,
      page = 1,
      limit = 20,
      sort = "-placedAt",
    } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter["payment.status"] = paymentStatus;
    if (paymentMethod) filter["payment.method"] = paymentMethod;
    if (source) filter.source = source;
    if (isPriority) filter.isPriority = isPriority === "true";
    if (startDate || endDate) {
      filter.placedAt = {};
      if (startDate) filter.placedAt.$gte = new Date(startDate);
      if (endDate) filter.placedAt.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerEmail: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
        { "shipping.trackingNumber": { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select("-statusHistory -userAgent")
        .sort(sort)
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: +page,
        limit: +limit,
        totalPages: Math.ceil(total / +limit),
      },
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// GET /api/admin/orders/stats
const adminGetOrderStats = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [statusBreakdown, revenueStats, periodStats] = await Promise.all([
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.aggregate([
        {
          $match: {
            status: {
              $in: [
                "delivered",
                "confirmed",
                "processing",
                "shipped",
                "out_for_delivery",
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$pricing.total" },
            totalOrders: { $sum: 1 },
          },
        },
      ]),
      Order.aggregate([
        { $match: { placedAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            revenue: { $sum: "$pricing.total" },
            avgOrderValue: { $avg: "$pricing.total" },
          },
        },
      ]),
    ]);

    const byStatus = {};
    statusBreakdown.forEach(({ _id, count }) => {
      byStatus[_id] = count;
    });
    const totalOrders = Object.values(byStatus).reduce((a, b) => a + b, 0);

    return res.status(200).json({
      success: true,
      data: {
        totalOrders,
        byStatus,
        revenue: {
          total: revenueStats[0]?.totalRevenue || 0,
          paidOrders: revenueStats[0]?.totalOrders || 0,
        },
        period: {
          label: period,
          orders: periodStats[0]?.orders || 0,
          revenue: periodStats[0]?.revenue || 0,
          avgOrderValue: Math.round(periodStats[0]?.avgOrderValue || 0),
        },
      },
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// GET /api/admin/orders/:id
const adminGetOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "name slug images price isActive variants",
    );

    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// PATCH /api/admin/orders/:id/status
const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status, note = "", changedBy = "admin" } = req.body;

    const VALID = [
      "pending",
      "confirmed",
      "processing",
      "ready_to_ship",
      "shipped",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "return_requested",
      "return_in_transit",
      "returned",
      "refunded",
      "failed",
    ];
    if (!status || !VALID.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid: ${VALID.join(", ")}`,
      });
    }

    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });

    applyStatusChange(order, status, note, changedBy);
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to "${status}".`,
      data: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        statusHistory: order.statusHistory,
      },
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// PATCH /api/admin/orders/:id/payment
const adminUpdatePayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });

    const {
      status,
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
      gatewayResponse,
      amountPaid,
      paidAt,
      refundId,
      refundAmount,
      refundReason,
      refundedAt,
    } = req.body;

    if (status) order.payment.status = status;
    if (gatewayOrderId) order.payment.gatewayOrderId = gatewayOrderId;
    if (gatewayPaymentId) order.payment.gatewayPaymentId = gatewayPaymentId;
    if (gatewaySignature) order.payment.gatewaySignature = gatewaySignature;
    if (gatewayResponse) order.payment.gatewayResponse = gatewayResponse;
    if (amountPaid != null) order.payment.amountPaid = amountPaid;
    if (paidAt) order.payment.paidAt = new Date(paidAt);
    if (refundId) order.payment.refundId = refundId;
    if (refundAmount != null) order.payment.refundAmount = refundAmount;
    if (refundReason) order.payment.refundReason = refundReason;
    if (refundedAt) order.payment.refundedAt = new Date(refundedAt);

    if (status === "paid" && order.status === "pending") {
      applyStatusChange(order, "confirmed", "Payment confirmed", "system");
    }

    await order.save();
    return res.status(200).json({
      success: true,
      message: "Payment updated.",
      data: order.payment,
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// PATCH /api/admin/orders/:id/shipping
const adminUpdateShipping = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });

    const {
      carrier,
      carrierId,
      trackingNumber,
      trackingUrl,
      awbCode,
      waybill,
      courierName,
      estimatedDeliveryDate,
      gatewayResponse,
      shippedAt,
      method,
    } = req.body;

    if (carrier) order.shipping.carrier = carrier;
    if (carrierId) order.shipping.carrierId = carrierId;
    if (trackingNumber) order.shipping.trackingNumber = trackingNumber;
    if (trackingUrl) order.shipping.trackingUrl = trackingUrl;
    if (awbCode) order.shipping.awbCode = awbCode;
    if (waybill) order.shipping.waybill = waybill;
    if (courierName) order.shipping.courierName = courierName;
    if (estimatedDeliveryDate)
      order.shipping.estimatedDeliveryDate = new Date(estimatedDeliveryDate);
    if (gatewayResponse) order.shipping.gatewayResponse = gatewayResponse;
    if (method) order.shipping.method = method;
    if (shippedAt) order.shipping.shippedAt = new Date(shippedAt);

    if (
      trackingNumber &&
      !["shipped", "out_for_delivery", "delivered"].includes(order.status)
    ) {
      applyStatusChange(
        order,
        "shipped",
        `Shipped via ${carrier || "carrier"} — AWB: ${awbCode || trackingNumber}`,
        "admin",
      );
    }

    await order.save();
    return res.status(200).json({
      success: true,
      message: "Shipping updated.",
      data: order.shipping,
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// PUT /api/admin/orders/:id
const adminUpdateOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });

    const {
      shippingAddress,
      billingAddress,
      adminNote,
      internalTags,
      isPriority,
      customerNote,
      giftMessage,
      isGift,
      cancellationReason,
      returnReason,
    } = req.body;

    if (shippingAddress) order.shippingAddress = shippingAddress;
    if (billingAddress) order.billingAddress = billingAddress;
    if (adminNote != null) order.adminNote = adminNote;
    if (internalTags) order.internalTags = internalTags;
    if (isPriority != null) order.isPriority = isPriority;
    if (customerNote) order.customerNote = customerNote;
    if (giftMessage) order.giftMessage = giftMessage;
    if (isGift != null) order.isGift = isGift;
    if (cancellationReason) order.cancellationReason = cancellationReason;
    if (returnReason) order.returnReason = returnReason;

    await order.save();
    return res
      .status(200)
      .json({ success: true, message: "Order updated.", data: order });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// DELETE /api/admin/orders/:id
const adminDeleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, message: "Order deleted." });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// POST /api/admin/orders — manual order creation from admin panel
const adminCreateOrder = async (req, res) => {
  try {
    const { items: rawItems, ...rest } = req.body;

    if (!rawItems?.length) {
      return res.status(400).json({
        success: false,
        message: "Order must contain at least one item.",
      });
    }

    // Admin can pass raw.unitPrice to override the product/variant price
    const orderItems = await Promise.all(
      rawItems.map((raw) =>
        resolveOrderItem(raw, { adminPriceOverride: true }),
      ),
    );

    const subtotal = orderItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const shippingCharge =
      rest.pricing?.shippingCharge ?? (subtotal >= 2000 ? 0 : 149);
    const discountAmount = rest.pricing?.discountAmount ?? 0;
    const total = subtotal + shippingCharge - discountAmount;

    const order = await Order.create({
      ...rest,
      items: orderItems,
      pricing: {
        subtotal,
        shippingCharge,
        discountAmount,
        taxAmount: 0,
        total,
      },
      payment: rest.payment || { method: "cod", status: "pending" },
      shipping: rest.shipping || {
        charge: shippingCharge,
        isFree: shippingCharge === 0,
      },
      source: rest.source || "admin",
      statusHistory: [
        {
          status: rest.status || "pending",
          note: "Order created by admin",
          changedBy: "admin",
          changedAt: new Date(),
        },
      ],
    });

    return res
      .status(201)
      .json({ success: true, message: "Order created.", data: order });
  } catch (error) {
    return handleOrderError(error, res);
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
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
};
