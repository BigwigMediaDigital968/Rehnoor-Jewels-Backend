const mongoose = require("mongoose");

// ─── Review Image Sub-schema ──────────────────────────────────────────────────
const ReviewImageSchema = new mongoose.Schema(
  {
    src: { type: String, required: true }, // Cloudinary URL
    alt: { type: String, default: "" },
  },
  { _id: false },
);

// ─── Main Review Schema ───────────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema(
  {
    // ─── Product link ─────────────────────────────────────────────
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },

    // ─── Review content ───────────────────────────────────────────
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    reviewTitle: {
      type: String,
      required: [true, "Review title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    reviewDescription: {
      type: String,
      required: [true, "Review description is required"],
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },

    // ─── Reviewer details ─────────────────────────────────────────
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      maxlength: [80, "Username cannot exceed 80 characters"],
    },
    userCity: {
      type: String,
      trim: true,
      default: "",
      maxlength: [80, "City cannot exceed 80 characters"],
    },
    sizePurchased: {
      type: String,
      trim: true,
      default: "", // e.g. '18"', 'M', '20'
    },

    // ─── Media ───────────────────────────────────────────────────
    images: {
      type: [ReviewImageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 5,
        message: "Maximum 5 images allowed per review",
      },
    },

    // ─── Admin workflow ───────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: {
      type: String, // optional reason for rejection
      trim: true,
      default: "",
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },

    // ─── Meta ─────────────────────────────────────────────────────
    isVerifiedPurchase: {
      type: Boolean,
      default: false, // can be set true via order linkage later
    },
    ipAddress: {
      type: String,
      default: null,
    },
    isFeatured: {
      type: Boolean,
      default: false, // admin can pin a review to show first
    },
    helpfulVotes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// ─── Indexes ──────────────────────────────────────────────────────
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 }); // for admin list

module.exports = mongoose.model("Review", reviewSchema);
