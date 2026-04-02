const mongoose = require("mongoose");

// ─── Address sub-schema ───────────────────────────────────────────────────────
const AddressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, default: "", trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true },
    country: { type: String, default: "India", trim: true },
    landmark: { type: String, default: "", trim: true },
  },
  { _id: false },
);

// ─── Order item sub-schema (snapshot at time of order) ────────────────────────
// Critical: Never rely on live product data — prices & names change
const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // ── Snapshot fields — immutable record of what was ordered ──
    name: { type: String, required: true }, // product name at time of order
    slug: { type: String, default: "" },
    sku: { type: String, default: "" },
    image: { type: String, default: "" }, // primary image URL
    purity: { type: String, default: "" }, // "22kt"
    metal: { type: String, default: "" },
    category: { type: String, default: "" },

    // ── Variant selected ────────────────────────────────────────
    sizeSelected: { type: String, default: "" }, // '18"', 'M', etc.

    // ── Pricing snapshot ────────────────────────────────────────
    unitPrice: { type: Number, required: true }, // price at time of order
    originalPrice: { type: Number, default: null }, // for showing discount
    quantity: { type: Number, required: true, min: 1, default: 1 },
    lineTotal: { type: Number, required: true }, // unitPrice × quantity

    // ── Customisation (for engraving etc.) ─────────────────────
    customNote: { type: String, default: "" }, // e.g. "Engrave: RAVI"
  },
  { _id: true }, // keep _id so we can reference individual items in returns
);

// ─── Payment sub-schema ───────────────────────────────────────────────────────
// Gateway agnostic — supports Razorpay, Stripe, PayU, COD, etc.
const PaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: [
        "cod",
        "razorpay",
        "stripe",
        "payu",
        "upi",
        "bank_transfer",
        "other",
      ],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "initiated",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      default: "pending",
    },

    // ── Gateway-specific IDs (populated after payment) ─────────
    gatewayOrderId: { type: String, default: "" }, // e.g. Razorpay order_id
    gatewayPaymentId: { type: String, default: "" }, // e.g. Razorpay payment_id
    gatewaySignature: { type: String, default: "" }, // for verification
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null }, // full gateway response blob

    // ── Amounts ─────────────────────────────────────────────────
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    paidAt: { type: Date, default: null },

    // ── Refund ──────────────────────────────────────────────────
    refundId: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
  },
  { _id: false },
);

// ─── Shipping / Delivery sub-schema ───────────────────────────────────────────
// Carrier agnostic — supports Shiprocket, Delhivery, DTDC, Blue Dart, manual, etc.
const ShippingSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["standard", "express", "same_day", "store_pickup", "custom"],
      default: "standard",
    },
    charge: { type: Number, default: 0 }, // shipping fee charged to customer
    isFree: { type: Boolean, default: false },
    estimatedDays: { type: Number, default: null }, // e.g. 5 (business days)
    estimatedDeliveryDate: { type: Date, default: null },

    // ── 3rd-party carrier fields (populated on shipment creation) ──
    carrier: { type: String, default: "" }, // "Shiprocket", "Delhivery", "DTDC"
    carrierId: { type: String, default: "" }, // shipment ID from carrier
    trackingNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" }, // direct tracking link
    awbCode: { type: String, default: "" }, // Airway Bill number

    // ── Shiprocket / Delhivery specific fields ──────────────────
    waybill: { type: String, default: "" },
    courierName: { type: String, default: "" },
    pickupScheduled: { type: Date, default: null },

    // ── Raw response from shipping gateway ──────────────────────
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false },
);

// ─── Coupon / Discount sub-schema ─────────────────────────────────────────────
const CouponSchema = new mongoose.Schema(
  {
    code: { type: String, default: "" },
    discountType: { type: String, enum: ["flat", "percent", ""], default: "" },
    discountValue: { type: Number, default: 0 }, // flat ₹ or percent %
    discountAmount: { type: Number, default: 0 }, // actual ₹ saved
  },
  { _id: false },
);

// ─── Pricing sub-schema ───────────────────────────────────────────────────────
const PricingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true }, // sum of all lineTotal
    shippingCharge: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 }, // from coupon
    taxAmount: { type: Number, default: 0 }, // GST / future use
    taxRate: { type: Number, default: 0 }, // % e.g. 3 for 3% GST on gold
    total: { type: Number, required: true }, // what customer actually pays
    currency: { type: String, default: "INR" },
  },
  { _id: false },
);

// ─── Status history entry ─────────────────────────────────────────────────────
const StatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    changedBy: { type: String, default: "system" }, // "admin", "system", "customer"
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ─── Main Order Schema ────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    // ─── Order Identity ────────────────────────────────────────
    orderNumber: {
      type: String,
      unique: true,
      // Generated before save: RJ-2026-XXXXX
    },

    // ─── Customer (guest or registered) ───────────────────────
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null = guest order
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    customerPhone: { type: String, required: true, trim: true },

    // ─── Order items ───────────────────────────────────────────
    items: {
      type: [OrderItemSchema],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: "Order must have at least one item",
      },
    },

    // ─── Addresses ────────────────────────────────────────────
    shippingAddress: { type: AddressSchema, required: true },
    billingAddress: { type: AddressSchema, default: null },
    billingSameAsShipping: { type: Boolean, default: true },

    // ─── Pricing ───────────────────────────────────────────────
    pricing: { type: PricingSchema, required: true },

    // ─── Coupon ────────────────────────────────────────────────
    coupon: { type: CouponSchema, default: null },

    // ─── Payment ───────────────────────────────────────────────
    payment: { type: PaymentSchema, required: true },

    // ─── Shipping / Delivery ───────────────────────────────────
    shipping: { type: ShippingSchema, default: () => ({}) },

    // ─── Order status ──────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending", // order placed, payment not confirmed
        "confirmed", // payment confirmed / COD accepted
        "processing", // being packed / prepared
        "ready_to_ship", // packed, awaiting pickup
        "shipped", // handed to carrier
        "out_for_delivery",
        "delivered",
        "cancelled",
        "return_requested",
        "return_in_transit",
        "returned",
        "refunded",
        "failed", // payment failed
      ],
      default: "pending",
    },

    // ─── Status audit trail ────────────────────────────────────
    statusHistory: { type: [StatusHistorySchema], default: [] },

    // ─── Key timestamps ────────────────────────────────────────
    placedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    // ─── Admin fields ──────────────────────────────────────────
    adminNote: { type: String, default: "" },
    internalTags: { type: [String], default: [] }, // e.g. ["vip", "fragile", "gift"]
    isPriority: { type: Boolean, default: false },

    // ─── Customer facing ───────────────────────────────────────
    customerNote: { type: String, default: "" }, // note from customer at checkout
    giftMessage: { type: String, default: "" },
    isGift: { type: Boolean, default: false },

    // ─── Return / Cancellation ─────────────────────────────────
    cancellationReason: { type: String, default: "" },
    returnReason: { type: String, default: "" },

    // ─── Source ────────────────────────────────────────────────
    source: {
      type: String,
      enum: ["website", "instagram", "whatsapp", "admin", "app", "other"],
      default: "website",
    },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: "" },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// orderSchema.index({ orderNumber: 1 });
orderSchema.index({ customerEmail: 1, placedAt: -1 });
orderSchema.index({ status: 1, placedAt: -1 });
orderSchema.index({ customer: 1, placedAt: -1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "shipping.trackingNumber": 1 });

// ─── Pre-save: generate orderNumber ───────────────────────────────────────────
// orderSchema.pre("save", async function (next) {
//   if (this.orderNumber) return next(); // already set

//   const year = new Date().getFullYear();
//   const count = (await this.constructor.countDocuments()) + 1;
//   const padded = String(count).padStart(5, "0");
//   this.orderNumber = `RJ-${year}-${padded}`;
//   // next();
// });
orderSchema.pre("save", async function () {
  if (this.orderNumber) return;

  const year = new Date().getFullYear();
  const count = (await this.constructor.countDocuments()) + 1;
  const padded = String(count).padStart(5, "0");

  this.orderNumber = `RJ-${year}-${padded}`;
});

// ─── Virtual: item count ──────────────────────────────────────────────────────
orderSchema.virtual("itemCount").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
