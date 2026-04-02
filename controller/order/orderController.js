const Order = require("../../model/Order/orderModel");
const Product = require("../../model/products/productModel");

// ─── Helper: push to statusHistory + set timestamp ────────────────────────────
function applyStatusChange(order, newStatus, note = "", changedBy = "admin") {
  order.statusHistory.push({
    status: newStatus,
    note,
    changedBy,
    changedAt: new Date(),
  });
  order.status = newStatus;

  const now = new Date();
  const map = {
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
  if (map[newStatus]) map[newStatus]();
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (website)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/orders
// Customer places an order from the website
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
      coupon,
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

    // ── Build order items with product snapshots ───────────────────────────
    const orderItems = [];
    let subtotal = 0;

    for (const raw of rawItems) {
      const product = await Product.findOne({
        _id: raw.productId,
        isActive: true,
      }).select(
        "name slug sku images price originalPrice purity metal category",
      );
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found: ${raw.productId}`,
        });
      }

      const quantity = Math.max(1, Number(raw.quantity) || 1);
      const unitPrice = product.price;
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        sku: product.sku || "",
        image: product.images?.[0]?.src || "",
        purity: product.purity || "",
        metal: product.metal || "",
        category: product.category || "",
        sizeSelected: raw.sizeSelected || "",
        unitPrice,
        originalPrice: product.originalPrice || null,
        quantity,
        lineTotal,
        customNote: raw.customNote || "",
      });
    }

    // ── Pricing ───────────────────────────────────────────────────────────
    const shippingCharge = subtotal >= 2000 ? 0 : 149; // free above ₹2000
    const discountAmount = 0; // coupon logic placeholder
    const taxAmount = 0; // GST placeholder
    const total = subtotal + shippingCharge - discountAmount + taxAmount;

    // ── Create order ──────────────────────────────────────────────────────
    const order = await Order.create({
      customerName,
      customerEmail,
      customerPhone,
      items: orderItems,
      shippingAddress,
      billingAddress: billingSameAsShipping ? shippingAddress : billingAddress,
      billingSameAsShipping,
      pricing: { subtotal, shippingCharge, discountAmount, taxAmount, total },
      coupon: coupon || null,
      payment: {
        method: paymentMethod,
        status: paymentMethod === "cod" ? "pending" : "initiated",
      },
      shipping: {
        charge: shippingCharge,
        isFree: shippingCharge === 0,
        method: "standard",
      },
      statusHistory: [
        {
          status: "pending",
          note: "Order placed by customer",
          changedBy: "customer",
        },
      ],
      customerNote: customerNote || "",
      giftMessage: giftMessage || "",
      isGift,
      source,
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || "",
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully.",
      data: {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.pricing.total,
        paymentMethod: order.payment.method,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    console.error("placeOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/orders/track/:orderNumber
// Public order tracking by order number + email (no auth required)
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
        message: "Order not found. Please check the order number and email.",
      });
    }

    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("trackOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/orders/my — authenticated customer's orders
const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Uses req.user.email populated by auth middleware
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
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("getMyOrders error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/orders/:id/cancel — customer cancel (only if pending/confirmed)
const customerCancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }
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
    console.error("customerCancelOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
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
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    console.error("adminGetAllOrders error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/orders/stats
// Dashboard summary: revenue, counts, recent, status breakdown
const adminGetOrderStats = async (req, res) => {
  try {
    const { period = "30d" } = req.query;
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [statusBreakdown, revenueStats, periodStats] = await Promise.all([
      // Status breakdown — all time
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      // Revenue — delivered/confirmed orders all time
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
      // This period stats
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
    console.error("adminGetOrderStats error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// GET /api/admin/orders/:id
const adminGetOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "items.product",
      "name slug images price isActive",
    );
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error("adminGetOrderById error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/orders/:id/status
// Change order status with optional note
const adminUpdateOrderStatus = async (req, res) => {
  try {
    const { status, note = "", changedBy = "admin" } = req.body;

    const VALID_STATUSES = [
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
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}`,
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
    console.error("adminUpdateOrderStatus error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/orders/:id/payment
// Update payment details (e.g. after Razorpay webhook or manual verification)
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

    // Auto-confirm order if payment is now paid
    if (status === "paid" && order.status === "pending") {
      applyStatusChange(order, "confirmed", "Payment confirmed", "system");
      order.confirmedAt = new Date();
    }

    await order.save();
    return res.status(200).json({
      success: true,
      message: "Payment details updated.",
      data: order.payment,
    });
  } catch (error) {
    console.error("adminUpdatePayment error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PATCH /api/admin/orders/:id/shipping
// Add tracking info after shipping with carrier
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

    // If tracking number added and status is not already shipped, auto-update
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
      message: "Shipping details updated.",
      data: order.shipping,
    });
  } catch (error) {
    console.error("adminUpdateShipping error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// PUT /api/admin/orders/:id
// Admin full order update (address correction, admin note, priority flag, tags)
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
    console.error("adminUpdateOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// DELETE /api/admin/orders/:id  (soft delete not recommended for orders — hard only for test)
const adminDeleteOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, message: "Order deleted." });
  } catch (error) {
    console.error("adminDeleteOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// POST /api/admin/orders — create order manually from admin panel
const adminCreateOrder = async (req, res) => {
  try {
    const { items: rawItems, ...rest } = req.body;

    const orderItems = [];
    let subtotal = 0;

    for (const raw of rawItems || []) {
      const product = await Product.findById(raw.productId).select(
        "name slug sku images price originalPrice purity metal category",
      );
      if (!product)
        return res.status(400).json({
          success: false,
          message: `Product not found: ${raw.productId}`,
        });

      const quantity = Math.max(1, Number(raw.quantity) || 1);
      const unitPrice = raw.unitPrice || product.price; // admin can override price
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        slug: product.slug,
        sku: product.sku || "",
        image: product.images?.[0]?.src || "",
        purity: product.purity || "",
        metal: product.metal || "",
        category: product.category || "",
        sizeSelected: raw.sizeSelected || "",
        unitPrice,
        originalPrice: product.originalPrice || null,
        quantity,
        lineTotal,
        customNote: raw.customNote || "",
      });
    }

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
        },
      ],
    });

    return res
      .status(201)
      .json({ success: true, message: "Order created.", data: order });
  } catch (error) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((e) => e.message);
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }
    console.error("adminCreateOrder error:", error);
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

module.exports = {
  // Public
  placeOrder,
  trackOrder,
  getMyOrders,
  customerCancelOrder,
  // Admin
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
