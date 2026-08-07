const mongoose = require("mongoose");
const Counter = require("../Counter");

// ─── Address ──────────────────────────────────────────────────────────────────
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

// ─── Variant snapshot ─────────────────────────────────────────────────────────
// Immutable record of which variant was selected and its state at order time.
// Stored even when the variant is later edited or deleted on the product.
const VariantSnapshotSchema = new mongoose.Schema(
  {
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null }, // original variant _id
    title: { type: String, default: "" }, // e.g. "18\" / Rose Gold"
    sku: { type: String, default: "" },
    options: { type: Map, of: String, default: {} }, // { Size: "18\"", Metal: "Rose Gold" }
    weightGrams: { type: Number, default: 0 },
    image: { type: String, default: "" }, // first variant image (if any)
  },
  { _id: false },
);

// ─── Order item ───────────────────────────────────────────────────────────────
const OrderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // ── Product-level snapshot (immutable) ──────────────────────────────────
    name: { type: String, required: true }, // product name at order time
    slug: { type: String, default: "" },
    sku: { type: String, default: "" }, // product-level SKU (not variant)
    image: { type: String, default: "" }, // primary gallery image
    category: { type: String, default: "" },

    // ── Variant snapshot (null when no variants on product) ─────────────────
    // When a variant is selected, pricing and identity come from the variant,
    // not from the base product.
    variant: { type: VariantSnapshotSchema, default: null },

    // ── Pricing snapshot ────────────────────────────────────────────────────
    unitPrice: { type: Number, required: true }, // variant.price ?? product.price
    originalPrice: { type: Number, default: null }, // for showing discount
    quantity: { type: Number, required: true, min: 1, default: 1 },
    lineTotal: { type: Number, required: true }, // unitPrice × quantity

    // ── Customisation ───────────────────────────────────────────────────────
    customNote: { type: String, default: "" }, // e.g. "Engrave: RAVI"
  },
  { _id: true },
);

// ─── Payment ──────────────────────────────────────────────────────────────────
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
    gatewayOrderId: { type: String, default: "" },
    gatewayPaymentId: { type: String, default: "" },
    gatewaySignature: { type: String, default: "" },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    paidAt: { type: Date, default: null },
    refundId: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    refundReason: { type: String, default: "" },
    refundedAt: { type: Date, default: null },
  },
  { _id: false },
);

// ─── Shipping ─────────────────────────────────────────────────────────────────
const ShippingSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["standard", "express", "same_day", "store_pickup", "custom"],
      default: "standard",
    },
    charge: { type: Number, default: 0 },
    isFree: { type: Boolean, default: false },
    estimatedDays: { type: Number, default: null },
    estimatedDeliveryDate: { type: Date, default: null },
    carrier: { type: String, default: "" },
    carrierId: { type: String, default: "" },
    trackingNumber: { type: String, default: "" },
    trackingUrl: { type: String, default: "" },
    awbCode: { type: String, default: "" },
    waybill: { type: String, default: "" },
    courierName: { type: String, default: "" },
    pickupScheduled: { type: Date, default: null },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
  },
  { _id: false },
);

// ─── Coupon ───────────────────────────────────────────────────────────────────
const CouponSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    code: { type: String, default: "" },
    discountType: {
      type: String,
      enum: ["flat", "percent", "free_shipping", "buy_x_get_y", ""],
      default: "",
    },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
  },
  { _id: false },
);

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PricingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true },
    shippingCharge: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: "INR" },
  },
  { _id: false },
);

// ─── Status history ───────────────────────────────────────────────────────────
const StatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    changedBy: { type: String, default: "system" },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

// ─── Main Order Schema ────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },

    // ── Customer ────────────────────────────────────────────────────────────
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
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

    // ── Items ───────────────────────────────────────────────────────────────
    items: {
      type: [OrderItemSchema],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: "Order must have at least one item",
      },
    },

    // ── Addresses ───────────────────────────────────────────────────────────
    shippingAddress: { type: AddressSchema, required: true },
    billingAddress: { type: AddressSchema, default: null },
    billingSameAsShipping: { type: Boolean, default: true },

    // ── Pricing / Coupon / Payment / Shipping ───────────────────────────────
    pricing: { type: PricingSchema, required: true },
    coupon: { type: CouponSchema, default: null },
    payment: { type: PaymentSchema, required: true },
    shipping: { type: ShippingSchema, default: () => ({}) },

    // ── Status ──────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
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
      ],
      default: "pending",
    },
    statusHistory: { type: [StatusHistorySchema], default: [] },

    // ── Timestamps ──────────────────────────────────────────────────────────
    placedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date, default: null },
    processedAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },

    // ── Admin ───────────────────────────────────────────────────────────────
    adminNote: { type: String, default: "" },
    internalTags: { type: [String], default: [] },
    isPriority: { type: Boolean, default: false },

    // ── Customer-facing ─────────────────────────────────────────────────────
    customerNote: { type: String, default: "" },
    giftMessage: { type: String, default: "" },
    isGift: { type: Boolean, default: false },

    // ── Return / Cancellation ───────────────────────────────────────────────
    cancellationReason: { type: String, default: "" },
    returnReason: { type: String, default: "" },

    // ── Source ──────────────────────────────────────────────────────────────
    source: {
      type: String,
      enum: ["website", "instagram", "whatsapp", "admin", "app", "other"],
      default: "website",
    },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: "" },

    isTrashed: { type: Boolean, default: false },
    trashedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
orderSchema.index({ customerEmail: 1, placedAt: -1 });
orderSchema.index({ status: 1, placedAt: -1 });
orderSchema.index({ customer: 1, placedAt: -1 });
orderSchema.index({ "payment.status": 1 });
orderSchema.index({ "shipping.trackingNumber": 1 });

// NEW INDEXES FOR TRASH FUNCTIONALITY:
// 1. Index to quickly query trashed vs active orders
orderSchema.index({ isTrashed: 1, placedAt: -1 });

// 2. TTL Index: Automatically deletes documents 30 days (2,592,000 seconds) after `trashedAt` is set
orderSchema.index(
  { trashedAt: 1 },
  { expireAfterSeconds: 2592000, partialFilterExpression: { isTrashed: true } },
);

// ─── Pre-save: auto-generate orderNumber ──────────────────────────────────────
orderSchema.pre("save", async function () {
  if (this.orderNumber) return;
  const counter = await Counter.findByIdAndUpdate(
    { _id: "order" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const year = new Date().getFullYear();
  const padded = String(counter.seq).padStart(5, "0");
  this.orderNumber = `RJ-${year}-${padded}`;
});

// ─── Virtuals ─────────────────────────────────────────────────────────────────
orderSchema.virtual("itemCount").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

orderSchema.set("toJSON", { virtuals: true });
orderSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Order", orderSchema);
