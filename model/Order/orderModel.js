const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // 🔥 Snapshot fields (VERY IMPORTANT)
    name: String,
    slug: String,
    image: String,

    price: Number, // price at time of order
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // Optional (for jewellery use-case)
    size: String,
    purity: String,
  },
  { _id: false },
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phone: { type: String, required: true },

    addressLine1: { type: String, required: true },
    addressLine2: { type: String },

    city: { type: String, required: true },
    state: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: "India" },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    // 🔐 User (optional for guest checkout)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // 📦 Items
    items: {
      type: [orderItemSchema],
      required: true,
    },

    // 💰 Pricing
    itemsPrice: { type: Number, required: true },
    taxPrice: { type: Number, default: 0 },
    shippingPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    totalPrice: { type: Number, required: true },

    // 📍 Address
    shippingAddress: {
      type: addressSchema,
      required: true,
    },

    // 💳 Payment
    paymentMethod: {
      type: String,
      enum: ["COD", "RAZORPAY", "STRIPE"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentId: String, // Razorpay/Stripe ID

    // 🚚 Order Status
    orderStatus: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    deliveredAt: Date,
    shippedAt: Date,

    // 🧾 Extra
    notes: String,

    // 🔢 Order Number (user-friendly)
    orderNumber: {
      type: String,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

orderSchema.pre("save", function (next) {
  if (!this.orderNumber) {
    this.orderNumber =
      "ORD-" +
      Date.now().toString().slice(-6) +
      Math.floor(Math.random() * 1000);
  }
  next();
});
