const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LOG — one entry per successful coupon redemption
// ─────────────────────────────────────────────────────────────────────────────
const UsageLogSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    email: { type: String, lowercase: true, trim: true },
    discountAmount: { type: Number, required: true }, // actual ₹ saved on that order
    orderTotal: { type: Number }, // order total before discount
    usedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT / CATEGORY RESTRICTION
// If empty → applies to all products
// ─────────────────────────────────────────────────────────────────────────────
const RestrictionSchema = new mongoose.Schema(
  {
    // Whitelist specific products or categories
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    categories: [{ type: String, trim: true }],

    // Restrict to specific users or emails
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    emails: [{ type: String, lowercase: true, trim: true }],

    // Restrict to specific customer segments
    newCustomersOnly: { type: Boolean, default: false }, // first order only
    existingCustomersOnly: { type: Boolean, default: false },
  },
  { _id: false },
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COUPON SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const couponSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, "Code must be at least 3 characters"],
      maxlength: [32, "Code cannot exceed 32 characters"],
      match: [
        /^[A-Z0-9_-]+$/,
        "Code can only contain letters, numbers, hyphens, underscores",
      ],
    },

    name: {
      type: String,
      required: [true, "Coupon name is required"],
      trim: true,
    }, // Internal label e.g. "Diwali 2026 Flat 500"

    description: { type: String, default: "", trim: true }, // shown to customer

    // ── Discount Type & Value ─────────────────────────────────────────────────
    discountType: {
      type: String,
      enum: {
        values: ["flat", "percent", "free_shipping", "buy_x_get_y"],
        message:
          "discountType must be flat | percent | free_shipping | buy_x_get_y",
      },
      required: true,
    },

    // For flat → ₹ off  |  For percent → % off
    discountValue: {
      type: Number,
      default: 0,
      min: [0, "Discount value cannot be negative"],
    },

    // Cap: percent discount cannot exceed this ₹ amount (ignored for flat)
    maxDiscountAmount: {
      type: Number,
      default: null, // null = no cap
    },

    // ── Cart Conditions ───────────────────────────────────────────────────────
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"],
    }, // minimum cart subtotal to apply

    minItemCount: { type: Number, default: 0 }, // minimum qty of items in cart

    // ── Buy X Get Y (BOGO) ────────────────────────────────────────────────────
    buyXGetY: {
      buyQuantity: { type: Number, default: 0 },
      getQuantity: { type: Number, default: 0 },
      getDiscountPercent: { type: Number, default: 100 }, // 100 = free
    },

    // ── Usage Limits ─────────────────────────────────────────────────────────
    usageLimitTotal: {
      type: Number,
      default: null, // null = unlimited
    }, // max total redemptions across all users

    usageLimitPerUser: {
      type: Number,
      default: 1,
    }, // max times a single user/email can use it

    usageCount: {
      type: Number,
      default: 0,
    }, // running total of redemptions

    // ── Validity ─────────────────────────────────────────────────────────────
    startsAt: {
      type: Date,
      default: Date.now,
    },

    expiresAt: {
      type: Date,
      default: null, // null = never expires
    },

    // ── Status ────────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },

    // Soft pause without changing dates
    isPaused: { type: Boolean, default: false },

    // ── Restrictions ─────────────────────────────────────────────────────────
    restrictions: { type: RestrictionSchema, default: () => ({}) },

    // ── Stacking ─────────────────────────────────────────────────────────────
    // Can this coupon be combined with other coupons?
    isStackable: { type: Boolean, default: false },

    // ── Usage Log ────────────────────────────────────────────────────────────
    usageLogs: { type: [UsageLogSchema], default: [] },

    // ── Admin ─────────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    tags: { type: [String], default: [] }, // e.g. ["diwali", "influencer", "vip"]
    internalNote: { type: String, default: "" },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, expiresAt: 1 });
couponSchema.index({ "restrictions.users": 1 });
couponSchema.index({ "restrictions.emails": 1 });
couponSchema.index({ tags: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
couponSchema.virtual("isExpired").get(function () {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
});

couponSchema.virtual("isUsageLimitReached").get(function () {
  if (this.usageLimitTotal === null) return false;
  return this.usageCount >= this.usageLimitTotal;
});

couponSchema.virtual("isValid").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    !this.isPaused &&
    !this.isExpired &&
    !this.isUsageLimitReached &&
    now >= new Date(this.startsAt)
  );
});

couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

// ─── Instance method: calculate discount for a given cart ─────────────────────
/**
 * @param {number} subtotal      - cart subtotal (before discount)
 * @param {number} itemCount     - total qty of items in cart
 * @param {string|null} userEmail
 * @param {string|null} userId
 * @param {boolean} isFirstOrder - is this the customer's first order?
 * @returns {{ valid: boolean, discountAmount: number, message: string }}
 */
couponSchema.methods.calculateDiscount = function ({
  subtotal,
  itemCount = 1,
  userEmail = null,
  userId = null,
  isFirstOrder = false,
}) {
  const now = new Date();

  // ── Gate checks ──────────────────────────────────────────────
  if (!this.isActive || this.isPaused)
    return {
      valid: false,
      discountAmount: 0,
      message: "This coupon is not active.",
    };

  if (now < new Date(this.startsAt))
    return {
      valid: false,
      discountAmount: 0,
      message: "This coupon is not yet valid.",
    };

  if (this.expiresAt && now > new Date(this.expiresAt))
    return {
      valid: false,
      discountAmount: 0,
      message: "This coupon has expired.",
    };

  if (this.usageLimitTotal !== null && this.usageCount >= this.usageLimitTotal)
    return {
      valid: false,
      discountAmount: 0,
      message: "This coupon has reached its usage limit.",
    };

  if (subtotal < this.minOrderAmount)
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimum order amount of ₹${this.minOrderAmount.toLocaleString("en-IN")} required.`,
    };

  if (itemCount < this.minItemCount)
    return {
      valid: false,
      discountAmount: 0,
      message: `Minimum ${this.minItemCount} item(s) required.`,
    };

  // ── Customer segment checks ──────────────────────────────────
  const r = this.restrictions;

  if (r.newCustomersOnly && !isFirstOrder)
    return {
      valid: false,
      discountAmount: 0,
      message: "This coupon is for new customers only.",
    };

  if (r.existingCustomersOnly && isFirstOrder)
    return {
      valid: false,
      discountAmount: 0,
      message: "This coupon is for existing customers only.",
    };

  if (
    r.emails?.length &&
    userEmail &&
    !r.emails.includes(userEmail.toLowerCase())
  )
    return {
      valid: false,
      discountAmount: 0,
      message: "You are not eligible for this coupon.",
    };

  if (
    r.users?.length &&
    userId &&
    !r.users.map(String).includes(String(userId))
  )
    return {
      valid: false,
      discountAmount: 0,
      message: "You are not eligible for this coupon.",
    };

  // ── Per-user usage check ─────────────────────────────────────
  if (this.usageLimitPerUser && userEmail) {
    const userUsage = this.usageLogs.filter(
      (l) => l.email === userEmail.toLowerCase(),
    ).length;
    if (userUsage >= this.usageLimitPerUser)
      return {
        valid: false,
        discountAmount: 0,
        message: "You have already used this coupon.",
      };
  }

  // ── Calculate discount ───────────────────────────────────────
  let discountAmount = 0;

  if (this.discountType === "flat") {
    discountAmount = Math.min(this.discountValue, subtotal);
  } else if (this.discountType === "percent") {
    discountAmount = (subtotal * this.discountValue) / 100;
    if (this.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
    }
  } else if (this.discountType === "free_shipping") {
    discountAmount = 0; // Handled at order level (shipping charge waived)
  }

  discountAmount = Math.round(discountAmount * 100) / 100; // round to 2dp

  return {
    valid: true,
    discountAmount,
    discountType: this.discountType,
    message: `Coupon applied! You save ₹${discountAmount.toLocaleString("en-IN")}.`,
  };
};

module.exports = mongoose.model("Coupon", couponSchema);
